import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { decodeBackup, LocalRepository } from '../src/app/storage';
import type { SavedEntry } from '../src/app/storage';
import { calculateExperience, exampleDraft, newCalculationDraft } from '../src/app/experience';
import { frozenResult, recordsForResult } from '../src/app/records';
import { workshopDefaults, workshopRecords } from '../src/app/workshop';
import { defaultDraft, evaluateDraft } from '../src/app/model';
import { realDraft, cpfDraft } from './ux-helpers';

const repositories: LocalRepository[] = [];
function repo(factory = new IDBFactory()) { const value = new LocalRepository(factory); repositories.push(value); return value; }
let nextId = 0;
const ids = () => `test-${++nextId}`;
const now = '2026-11-22T12:00:00.000Z';
afterEach(async () => { await Promise.all(repositories.splice(0).map(value => value.close())); });
describe('UX V2: dados locais e revisões preservadas', () => {
  it('reabre perfis, oficina incompleta, modo e rascunho sem substituir dados específicos do trabalho', async () => {
    const factory = new IDBFactory(); const first = repo(factory); const draft = realDraft();
    await first.saveMany(workshopRecords(draft, now)); await first.saveSetting('workshop-v2', { step: 2, draft });
    await first.saveSetting('draft-v2', draft); await first.saveSetting('experience-mode', 'advanced'); await first.close();
    const restored = repo(factory); const entries = await restored.list(); const blank = workshopDefaults(newCalculationDraft(), entries);
    expect(blank.ux?.filament).toEqual(draft.ux?.filament); expect(blank.fields.machine).toBe('2');
    for (const key of ['grams', 'hours', 'pieces', 'price', 'quantity']) expect(blank.fields[key]).toBe('');
    expect(await restored.getSetting('draft-v2')).toEqual(draft); expect(await restored.getSetting('experience-mode')).toBe('advanced');
    expect(await restored.getSetting('workshop-v2')).toEqual({ step: 2, draft });
  });
  it('a demonstração nunca substitui rascunho nem cadastro real', async () => {
    const repository = repo(); const draft = realDraft(); await repository.saveSetting('draft-v2', draft);
    await expect(repository.saveSetting('draft-v2', exampleDraft())).rejects.toThrow('Demonstração');
    await expect(repository.save({ id: 'demo', name: 'Demo', kind: 'product', updatedAt: now, draft: exampleDraft() })).rejects.toThrow('fictício');
    expect(await repository.getSetting('draft-v2')).toEqual(draft); expect(await repository.list()).toEqual([]);
  });
  it('salva custo sem venda, edita nova revisão e mantém a anterior reproduzível', async () => {
    const repository = repo(); const draft = realDraft(); const first = recordsForResult(draft, calculateExperience(draft), [], {}, now, ids); await repository.saveMany(first);
    const before = structuredClone(first[1]!); draft.ux!.filament.amount = '200';
    const second = recordsForResult(draft, calculateExperience(draft), first, { productId: first[0]!.id, parentId: first[1]!.id }, now, ids); await repository.saveMany(second);
    const all = await repository.list(); expect(all).toHaveLength(3); expect(all.find(entry => entry.id === before.id)).toEqual(before);
    expect(second[1]).toMatchObject({ revision: 2, parentId: before.id, productId: first[0]!.id });
    const old = frozenResult(before); const fresh = frozenResult(second[1]!);
    expect(old?.kind === 'cost' && old.cost.total).toBe('20.00'); expect(fresh?.kind === 'cost' && fresh.cost.total).toBe('30.00');
    const invalid = structuredClone(before); invalid.costSnapshot!.quantity = 2; await expect(repository.save(invalid)).rejects.toThrow('não correspondem');
  });
  it('histórico Shopee usa catálogo original e aceita revisão independente com tarifa diferente', async () => {
    const draft = cpfDraft(); const output = calculateExperience(draft); const records = recordsForResult(draft, output, [], {}, now, ids); const repository = repo(); await repository.saveMany(records);
    if (output.kind !== 'sale') throw new Error(); output.data.catalog.version = 'mudança-posterior'; output.data.catalog.rules = [];
    const historical = frozenResult((await repository.list()).find(entry => entry.kind === 'simulation')!);
    expect(historical?.kind === 'sale' && historical.data.result.knownMarketplaceFees).toBe('16.96');
    expect(historical?.kind === 'sale' && historical.data.catalog.version).not.toBe('mudança-posterior');
  });
  it('recusa salvar resultado de entradas antigas e duplicação cria outro produto', () => {
    const draft = realDraft(); const output = calculateExperience(draft); draft.fields.grams = '200';
    expect(() => recordsForResult(draft, output, [], {}, now, ids)).toThrow('mudaram');
    const one = recordsForResult(draft, calculateExperience(draft), [], {}, now, ids); const copy = recordsForResult(draft, calculateExperience(draft), one, {}, now, ids);
    expect(copy[0]!.id).not.toBe(one[0]!.id); expect(copy[1]!.revision).toBe(1);
  });
  it('lixeira de produto restaura seus filhos sem reviver uma revisão já excluída antes', async () => {
    const repository = repo(); const draft = realDraft(); const first = recordsForResult(draft, calculateExperience(draft), [], {}, now, ids);
    const second = recordsForResult(draft, calculateExperience(draft), first, { productId: first[0]!.id }, now, ids);
    await repository.saveMany([...first, second[1]!]); await repository.trash(first[1]!.id); await repository.trash(first[0]!.id);
    expect(await repository.list()).toHaveLength(0); expect(await repository.list(true)).toHaveLength(3);
    await repository.restore(first[0]!.id); expect((await repository.list()).map(entry => entry.id).sort()).toEqual([first[0]!.id, second[1]!.id].sort());
    await repository.restore(first[1]!.id); expect(await repository.list()).toHaveLength(3);
  });
  it('backup v2 inclui lixeira; conflito de IDs restaura cópias com família correta sem sobrescrever', async () => {
    const source = repo(); const draft = realDraft(); const records = recordsForResult(draft, calculateExperience(draft), [], {}, now, ids);
    await source.saveMany(records); await source.trash(records[0]!.id); const backup = await source.export(); expect(JSON.parse(backup).version).toBe(2);
    const target = repo(); await target.saveMany(records); await target.import(backup); const all = await target.list(true); expect(all).toHaveLength(4);
    expect(all.find(entry => entry.id === records[0]!.id)?.deletedAt).toBeUndefined();
    const copiedRoot = all.find(entry => entry.restoredFromId === records[0]!.id)!; const copiedChild = all.find(entry => entry.restoredFromId === records[1]!.id)!;
    expect(copiedChild.productId).toBe(copiedRoot.id); expect(copiedChild.deletedBatch).toBe(copiedRoot.id);
    await target.restore(copiedRoot.id); expect(await target.list()).toHaveLength(4);
  });
  it('migra banco v2 para v3 sem regravar formulários ou snapshots legados e lê backup v1', async () => {
    const factory = new IDBFactory(); const draft = defaultDraft(); const output = evaluateDraft(draft);
    const legacy: SavedEntry = { id: 'legacy', name: 'Histórico anterior', kind: 'simulation', updatedAt: now, draft, snapshot: { input: output.input, catalog: output.catalog } };
    await new Promise<void>((resolve, reject) => { const request = factory.open('fatialucro-local-v1', 2);
      request.onupgradeneeded = () => { request.result.createObjectStore('entries', { keyPath: 'id' }); request.result.createObjectStore('settings', { keyPath: 'id' }); };
      request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result; const tx = db.transaction(['entries', 'settings'], 'readwrite'); tx.objectStore('entries').put(legacy); tx.objectStore('settings').put({ id: 'theme', data: 'dark' }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); };
    });
    const restored = repo(factory); expect(await restored.list()).toEqual([legacy]); expect(await restored.getSetting('theme')).toBe('dark');
    expect(decodeBackup(JSON.stringify({ version: 1, entries: [legacy] }))).toEqual([legacy]);
  });
});
