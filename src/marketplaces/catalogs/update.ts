import { bundledPackage } from './bundled';
import { parseManifest, parseTable, validateTables } from './validation';
import type { CatalogManifest, CatalogPackage, ValidatedPackage } from './types';

// Public review channel. Promotion to main/release is a separate authorized step.
export const CATALOG_BASE = 'https://raw.githubusercontent.com/brunonaval/fatialucro/feat/pricing-engine-v01/public/';
export async function sha256(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Verificação de integridade indisponível neste ambiente. O catálogo local foi preservado.');
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
export async function validatePackage(pkg: CatalogPackage): Promise<ValidatedPackage> {
  if (!pkg || typeof pkg.manifestText !== 'string' || !pkg.tableTexts || typeof pkg.tableTexts !== 'object' || Array.isArray(pkg.tableTexts) || typeof pkg.downloadedAt !== 'string' || !Number.isFinite(Date.parse(pkg.downloadedAt))) throw new Error('Cache de catálogo inválido.');
  const manifest = parseManifest(pkg.manifestText);
  if (Object.keys(pkg.tableTexts).length !== manifest.files.length) throw new Error('Conteúdo incompleto ou inesperado no pacote.');
  const tables = [];
  for (const file of manifest.files) {
    const text = pkg.tableTexts[file.id]; if (typeof text !== 'string') throw new Error('Tabela ausente.');
    const bytes = new TextEncoder().encode(text);
    if (bytes.length !== file.bytes || await sha256(bytes) !== file.sha256) throw new Error('Integridade SHA-256 da tabela não confere.');
    const table = parseTable(text);
    if (table.id !== file.id || table.version !== file.version || table.revision !== file.revision || table.lastVerified > manifest.publishedAt) throw new Error('Identidade, revisão ou verificação difere do manifesto.');
    tables.push(table);
  }
  validateTables(tables);
  return { manifest, tables, package: pkg };
}
export function preventManifestRegression(previous: CatalogManifest, next: CatalogManifest) {
  if (next.releaseSequence < previous.releaseSequence || next.publishedAt < previous.publishedAt) throw new Error('Catálogo regressivo rejeitado.');
  for (const file of previous.files) {
    const retained = next.files.find(item => item.id === file.id);
    if (!retained || (Object.keys(file) as (keyof typeof file)[]).some(key => retained[key] !== file[key])) throw new Error('Versões publicadas são imutáveis e não podem ser removidas.');
  }
  if (next.releaseSequence === previous.releaseSequence && next.files.length !== previous.files.length) throw new Error('Publicação alterada sem incrementar sequência.');
}
export function preventRegression(previous: ValidatedPackage, next: ValidatedPackage) {
  preventManifestRegression(previous.manifest, next.manifest);
  if (next.manifest.releaseSequence === previous.manifest.releaseSequence && next.package.manifestText !== previous.package.manifestText) throw new Error('Mesmo número de publicação com conteúdo diferente.');
  const oldRevision = Math.max(...previous.tables.map(table => table.revision));
  for (const table of next.tables) if (!previous.tables.some(old => old.id === table.id) && (table.revision <= oldRevision || table.lastVerified < previous.tables.reduce((latest, item) => item.lastVerified > latest ? item.lastVerified : latest, '0001-01-01'))) throw new Error('Nova tabela regride revisão ou verificação documental.');
}
export async function loadTrustedPackage(pkg: CatalogPackage) {
  const baseline = await validatePackage(bundledPackage); const candidate = await validatePackage(pkg);
  preventRegression(baseline, candidate); return candidate;
}
async function boundedText(response: Response, limit: number) {
  if (!response.ok || response.redirected || !response.body) throw new Error('Catálogo público indisponível. A cópia local foi preservada.');
  const reader = response.body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true }); let size = 0; let text = '';
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) throw new Error('Resposta de catálogo excede o limite.'); text += decoder.decode(value, { stream: true }); }
    return text + decoder.decode();
  } finally { await reader.cancel(); }
}
export async function checkCatalogUpdate(current: ValidatedPackage, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<ValidatedPackage> {
  const timeout = AbortSignal.timeout(15_000); const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const request = (path: string) => fetcher(`${CATALOG_BASE}${path}`, { signal: combined, cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
  const manifestText = await boundedText(await request('catalogs/manifest.json'), 64 * 1024);
  const manifest = parseManifest(manifestText);
  if (manifest.releaseSequence < current.manifest.releaseSequence) throw new Error('Catálogo regressivo rejeitado.');
  const tableTexts: Record<string, string> = {};
  for (const file of manifest.files) tableTexts[file.id] = await boundedText(await request(file.path), 512 * 1024);
  const next = await validatePackage({ manifestText, tableTexts, downloadedAt: new Date().toISOString() });
  preventRegression(current, next); return next;
}
