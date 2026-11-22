import { calculatePricing } from '../engine';
import type { SaleInput, TariffCatalog } from '../engine';
import { buildScenario, validateDraft } from './model';
import type { CalculatorDraft, SavedKind } from './model';
import { loadTrustedPackage, preventRegression } from '../marketplaces/catalogs/update';
import { parseManifest, parseTable } from '../marketplaces/catalogs/validation';
import type { CatalogPackage } from '../marketplaces/catalogs/types';

export interface SavedEntry {
  id: string; kind: SavedKind; name: string; updatedAt: string; draft: CalculatorDraft;
  snapshot?: { input: SaleInput; catalog: TariffCatalog };
}
const kinds: SavedKind[] = ['product', 'printer', 'filament', 'production', 'marketplace', 'simulation'];
const MAX_BACKUP = 12 * 1024 * 1024;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
}
function safeTree(value: unknown, depth = 0): void {
  if (depth > 40) throw new Error('Dados excedem a complexidade permitida.');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Chave não permitida no backup.');
    safeTree(child, depth + 1);
  }
}
export function validateEntry(value: unknown): asserts value is SavedEntry {
  safeTree(value);
  if (!value || typeof value !== 'object') throw new Error('Registro inválido.');
  const entry = value as SavedEntry;
  if (typeof entry.id !== 'string' || !/^[\w-]{1,100}$/.test(entry.id) || !kinds.includes(entry.kind) || typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 200 || typeof entry.updatedAt !== 'string' || !Number.isFinite(Date.parse(entry.updatedAt))) throw new Error('Identificação de cadastro inválida.');
  validateDraft(entry.draft);
  if ((entry.kind === 'simulation') !== (entry.snapshot !== undefined)) throw new Error('Simulação exige cópia das entradas e do catálogo.');
  if (entry.snapshot) {
    if (entry.snapshot.input.purpose !== 'simulation' || entry.snapshot.catalog.purpose !== 'simulation') throw new Error('Finalidade inválida no histórico.');
    calculatePricing(entry.snapshot.input, entry.snapshot.catalog);
    if (canonical(buildScenario(entry.draft).input) !== canonical(entry.snapshot.input)) throw new Error('Entradas salvas não correspondem ao formulário da simulação.');
  }
}
export function decodeBackup(json: string): SavedEntry[] {
  if (new TextEncoder().encode(json).length > MAX_BACKUP) throw new Error('Backup excede 12 MB.');
  const data: unknown = JSON.parse(json); safeTree(data);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('entries' in data) || !Array.isArray(data.entries) || data.entries.length > 5000) throw new Error('Formato ou versão de backup incompatível.');
  const ids = new Set<string>();
  for (const entry of data.entries) { validateEntry(entry); if (ids.has(entry.id)) throw new Error('Backup contém identificadores duplicados.'); ids.add(entry.id); }
  return data.entries as SavedEntry[];
}

/** One local IndexedDB transaction per mutation. No network or native plugin. */
export class LocalRepository {
  private connection: Promise<IDBDatabase> | undefined;
  constructor(private readonly factory: IDBFactory, private readonly name = 'fatialucro-local-v1') {}
  private open(): Promise<IDBDatabase> {
    if (!this.connection) this.connection = new Promise((resolve, reject) => {
      let blocked = false;
      const request = this.factory.open(this.name, 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('entries')) request.result.createObjectStore('entries', { keyPath: 'id' });
        if (!request.result.objectStoreNames.contains('settings')) request.result.createObjectStore('settings', { keyPath: 'id' });
      };
      request.onerror = () => { this.connection = undefined; reject(request.error ?? new Error('Armazenamento local indisponível.')); };
      request.onblocked = () => { blocked = true; this.connection = undefined; reject(new Error('Banco local bloqueado por outra instância.')); };
      request.onsuccess = () => { const db = request.result; if (blocked) { db.close(); return; } db.onversionchange = () => { db.close(); this.connection = undefined; }; resolve(db); };
    });
    return this.connection;
  }
  async list(): Promise<SavedEntry[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entries', 'readonly'); const request = tx.objectStore('entries').getAll();
      tx.oncomplete = () => { try { const entries: unknown[] = request.result; entries.forEach(validateEntry); resolve((entries as SavedEntry[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); } catch (error) { reject(error); } };
      tx.onabort = () => reject(tx.error ?? new Error('Falha ao ler os cadastros.'));
    });
  }
  private async write(entries: SavedEntry[], removeId?: string): Promise<void> {
    entries.forEach(validateEntry);
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entries', 'readwrite'); const store = tx.objectStore('entries');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Não foi possível salvar. Espaço local pode estar indisponível.'));
      try {
        if (removeId !== undefined) store.delete(removeId);
        for (const entry of entries) store.put(entry);
      } catch (error) { tx.abort(); reject(error); }
    });
  }
  save(entry: SavedEntry) { return this.write([entry]); }
  remove(id: string) { return this.write([], id); }
  async export(): Promise<string> { const json = JSON.stringify({ version: 1, entries: await this.list() }, null, 2); decodeBackup(json); return json; }
  async import(json: string): Promise<void> { await this.write(decodeBackup(json)); }
  async getSetting(id: string): Promise<unknown> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly'); const request = tx.objectStore('settings').get(id);
      tx.oncomplete = () => resolve((request.result as { data?: unknown } | undefined)?.data ?? null);
      tx.onabort = () => reject(tx.error ?? new Error('Não foi possível ler as preferências.'));
    });
  }
  async setTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
    if (!['system', 'light', 'dark'].includes(theme)) throw new Error('Tema inválido.');
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite'); tx.objectStore('settings').put({ id: 'theme', data: theme });
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Tema aplicado apenas nesta sessão: não foi salvo.'));
    });
  }
  async activateCatalog(pkg: CatalogPackage): Promise<void> {
    const next = await loadTrustedPackage(pkg); const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite'); const store = tx.objectStore('settings'); const request = store.get('catalog-active');
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Catálogo não aplicado; cópia anterior preservada.'));
      request.onsuccess = () => {
        try {
          const old = (request.result as { data: CatalogPackage } | undefined)?.data;
          if (old) preventRegression({ manifest: parseManifest(old.manifestText), tables: Object.values(old.tableTexts).map(parseTable), package: old }, next);
          store.put({ id: `catalog-archive-${next.manifest.releaseSequence}`, data: pkg });
          store.put({ id: 'catalog-active', data: pkg });
        } catch (error) { tx.abort(); reject(error); }
      };
    });
  }
  async close() { if (this.connection) (await this.connection).close(); this.connection = undefined; }
}
