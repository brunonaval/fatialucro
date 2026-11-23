import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { LocalRepository } from '../src/app/storage';
import type { SavedEntry } from '../src/app/storage';
import { defaultDraft, evaluateDraft, localDate } from '../src/app/model';
import { applySavedStore, isTheme } from '../src/app/preferences';
import { bundledPackage, bundledTables } from '../src/marketplaces/catalogs/bundled';
import { loadTrustedPackage } from '../src/marketplaces/catalogs/update';
import type { CatalogPackage } from '../src/marketplaces/catalogs/types';
import { calculatePricing } from '../src/engine';
import { packageWith, syntheticTable } from './catalog-helpers';

const repositories: LocalRepository[] = [];
function repository(factory = new IDBFactory()) { const repo = new LocalRepository(factory); repositories.push(repo); return repo; }
afterEach(async () => { await Promise.all(repositories.splice(0).map(repo => repo.close())); });

describe('preferências, loja e cache offline', () => {
  it('data inicial usa os componentes locais, sem converter o dia para UTC', () => {
    expect(localDate({ getFullYear: () => 2027, getMonth: () => 0, getDate: () => 2 } as Date)).toBe('2027-01-02');
    const draft = defaultDraft(new Date(2027, 0, 2, 0, 15));
    expect(draft.fields).toMatchObject({ date: '2027-01-02', manualFrom: '2027-01-02', manualUntil: '2027-01-02' });
  });
  it('reutiliza CPF sem perpetuar adesões temporárias; frete/volume/aceites atuais são preservados', () => {
    const store = defaultDraft(new Date(2026, 10, 22)); Object.assign(store.fields, { marketplace: 'shopee', seller: 'CPF', highlight: 'active', returns: 'trial', shippingConfirmed: true, orders: '500', acceptValidity: true });
    const current = defaultDraft(new Date(2026, 10, 23)); current.fields.price = '35';
    expect(applySavedStore(current, store, new Date(2026, 10, 22, 10).toISOString()).fields).toMatchObject({ seller: 'CPF', highlight: 'unknown', returns: 'unknown', price: '35', date: '2026-11-23', shippingConfirmed: false, orders: '', acceptValidity: false });
    expect(applySavedStore(store, store, new Date(2026, 10, 22, 10).toISOString()).fields.orders).toBe('500');
  });
  it('tema claro/escuro/sistema e loja permanecem depois de fechar e reabrir o banco', async () => {
    const factory = new IDBFactory(); const repo = repository(factory);
    await repo.setTheme('dark'); await repo.save({ id: 'store-shopee', kind: 'marketplace', name: 'Loja de teste', updatedAt: '2026-11-22T12:00:00Z', draft: defaultDraft() });
    await repo.close(); const reopened = repository(factory);
    expect(await reopened.getSetting('theme')).toBe('dark'); expect((await reopened.list())[0]?.id).toBe('store-shopee');
    expect(['light', 'dark', 'system'].every(isTheme)).toBe(true); expect(isTheme('other')).toBe(false);
  });
  it('migra IndexedDB v1 para v2 preservando registros anteriores', async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const request = factory.open('fatialucro-local-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('entries', { keyPath: 'id' }); request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result; const tx = db.transaction('entries', 'readwrite'); tx.objectStore('entries').put({ id: 'legacy', kind: 'product', name: 'Produto anterior', updatedAt: '2026-11-22T12:00:00Z', draft: defaultDraft() }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); };
    });
    const migrated = repository(factory); expect((await migrated.list())[0]?.id).toBe('legacy'); await migrated.setTheme('light'); expect(await migrated.getSetting('theme')).toBe('light');
  });
  it('reabre catálogo aplicado sem rede, preservando a verificação documental e versões arquivadas', async () => {
    const factory = new IDBFactory(); const repo = repository(factory); const next = await packageWith([syntheticTable()]);
    await repo.activateCatalog(next); await repo.close(); const reopened = repository(factory);
    const cached = await loadTrustedPackage(await reopened.getSetting('catalog-active') as CatalogPackage);
    expect(cached.tables).toHaveLength(bundledTables.length + 1); expect(cached.tables[0]!.lastVerified).toBe('2026-11-22');
    expect(await reopened.getSetting('catalog-archive-2')).toEqual(next);
  });
  it('rejeita regressão e cache adulterado sem substituir o ativo nem alterar simulações salvas', async () => {
    const repo = repository(); const output = evaluateDraft(defaultDraft()); const snapshot = { input: output.input, catalog: output.catalog };
    const saved: SavedEntry = { id: 'snapshot', kind: 'simulation', name: 'Anterior', updatedAt: '2026-11-22T12:00:00Z', draft: defaultDraft(), snapshot };
    await repo.save(saved); const next = await packageWith([syntheticTable()]); await repo.activateCatalog(next);
    await expect(repo.activateCatalog(bundledPackage)).rejects.toThrow('regressivo');
    const bad = structuredClone(next); bad.tableTexts[bundledTables[0]!.id] += ' '; await expect(repo.activateCatalog(bad)).rejects.toThrow('Integridade');
    expect(await repo.getSetting('catalog-active')).toEqual(next);
    const restored = (await repo.list())[0]!.snapshot!; expect(restored).toEqual(snapshot); expect(calculatePricing(restored.input, restored.catalog)).toEqual(output.result);
  });
  it('confere a sequência dentro da transação, impedindo aplicação atrasada de uma instância antiga', async () => {
    const factory = new IDBFactory(); const first = repository(factory); const second = repository(factory);
    const r3 = syntheticTable(); const r4 = { ...syntheticTable(4), supersedes: [bundledTables[0]!.id, r3.id] };
    const old = await packageWith([r3], 2); const newest = await packageWith([r3, r4], 3);
    await first.activateCatalog(newest); await expect(second.activateCatalog(old)).rejects.toThrow('regressivo');
    expect(await first.getSetting('catalog-active')).toEqual(newest);
  });
});
