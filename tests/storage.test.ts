import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { decodeBackup, LocalRepository } from '../src/app/storage';
import type { SavedEntry } from '../src/app/storage';
import { defaultDraft, evaluateDraft } from '../src/app/model';
import { calculatePricing } from '../src/engine';

const entry = (id = 'product-1'): SavedEntry => ({ id, kind: 'product', name: 'Produto sintético', updatedAt: '2026-11-22T12:00:00.000Z', draft: defaultDraft() });
const repositories: LocalRepository[] = [];
const repo = (factory = new IDBFactory()) => { const repository = new LocalRepository(factory); repositories.push(repository); return repository; };
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(repositories.splice(0).map(repository => repository.close())); });

describe('IndexedDB e backup local sem navegador', () => {
  it('salva todas as categorias, fecha e reabre com os mesmos valores', async () => {
    const factory = new IDBFactory(); const first = repo(factory);
    for (const kind of ['product', 'printer', 'filament', 'production', 'marketplace'] as const) await first.save({ ...entry(kind), kind });
    await first.close();
    const restored = await repo(factory).list(); expect(restored).toHaveLength(5);
    expect(restored.find(value => value.id === 'printer')?.draft).toEqual(defaultDraft());
  });
  it('preserva catálogo e entradas para reproduzir lucro mesmo após outra tarifa ser editada', async () => {
    const repository = repo(); const draft = defaultDraft(); const output = evaluateDraft(draft);
    const simulation: SavedEntry = { ...entry('sim-1'), kind: 'simulation', snapshot: { input: output.input, catalog: output.catalog } };
    await repository.save(simulation); output.catalog.version = 'outra-versao';
    const saved = (await repository.list())[0]!;
    expect(saved.snapshot?.catalog.version).not.toBe('outra-versao');
    expect(calculatePricing(saved.snapshot!.input, saved.snapshot!.catalog)).toEqual(output.result);
  });
  it('exporta, restaura atomicamente, atualiza mesmos IDs e remove', async () => {
    const original = repo(); await original.save(entry()); const json = await original.export();
    const target = repo(); await target.import(json); await target.save({ ...entry(), name: 'Atualizado' });
    expect(await target.list()).toHaveLength(1); expect((await target.list())[0]?.name).toBe('Atualizado');
    await target.remove('product-1'); expect(await target.list()).toEqual([]);
  });
  it('nenhum registro do backup é gravado se outro registro falhar na validação', async () => {
    const repository = repo(); await repository.save(entry('existing'));
    const invalid = { ...entry('invalid'), draft: { fields: {}, materials: [] } };
    await expect(repository.import(JSON.stringify({ version: 1, entries: [entry('new'), invalid] }))).rejects.toThrow();
    expect((await repository.list()).map(value => value.id)).toEqual(['existing']);
  });
  it('aborta toda a transação quando uma gravação falha por falta de espaço', async () => {
    const repository = repo(); await repository.save(entry('existing'));
    const original = IDBObjectStore.prototype.put; let calls = 0;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (++calls === 2) throw new DOMException('Quota excedida', 'QuotaExceededError');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    });
    await expect(repository.import(JSON.stringify({ version: 1, entries: [entry('first'), entry('second')] }))).rejects.toThrow('Quota');
    expect((await repository.list()).map(value => value.id)).toEqual(['existing']);
  });
  it('recusa versão desconhecida, IDs repetidos, campos falsos e chaves perigosas', () => {
    expect(() => decodeBackup('{"version":2,"entries":[]}')).toThrow('versão');
    expect(() => decodeBackup(JSON.stringify({ version: 1, entries: [entry(), entry()] }))).toThrow('duplicados');
    expect(() => decodeBackup('{"version":1,"entries":[],"__proto__":{"x":1}}')).toThrow('Chave');
    expect(() => decodeBackup(JSON.stringify({ version: 1, entries: [{ ...entry(), kind: 'simulation' }] }))).toThrow('cópia');
    expect(() => decodeBackup('x'.repeat(12 * 1024 * 1024 + 1))).toThrow('12 MB');
  });
  it('gravações recebem cópia isolada e nome vazio é rejeitado', async () => {
    const repository = repo(); const value = entry(); await repository.save(value); value.draft.fields.price = '99';
    expect((await repository.list())[0]?.draft.fields.price).toBe('19,90');
    await expect(repository.save({ ...entry(), name: '' })).rejects.toThrow('Identificação');
  });
  it('rejeita histórico cujo formulário diverge das entradas do cálculo', async () => {
    const value = entry('mismatch'); const output = evaluateDraft(value.draft); value.draft.fields.quantity = '5';
    await expect(repo().save({ ...value, kind: 'simulation', snapshot: { input: output.input, catalog: output.catalog } })).rejects.toThrow('não correspondem');
  });
});
