import { describe, expect, it, vi } from 'vitest';
import { bundledManifest, bundledPackage, bundledTables } from '../src/marketplaces/catalogs/bundled';
import { catalogIndicator, selectTable } from '../src/marketplaces/catalogs/select';
import { CATALOG_BASE, checkCatalogUpdate, loadTrustedPackage, preventRegression, validatePackage } from '../src/marketplaces/catalogs/update';
import { parseManifest, parseTable, validateTables } from '../src/marketplaces/catalogs/validation';
import type { CatalogPackage, ShopeeTable } from '../src/marketplaces/catalogs/types';
import { createShopeeCatalog, shopeeFacts, shopeeSelections } from '../src/marketplaces/shopee/catalog';
import type { ShopeeContext } from '../src/marketplaces/shopee/catalog';
import { calculatePricing, solvePrice } from '../src/engine';
import { sale } from './helpers';
import { packageWith, syntheticTable } from './catalog-helpers';

const context: ShopeeContext = { seller: 'CNPJ', ordersLast90Days: null, returnsProtection: 'inactive', highlightCampaign: 'inactive', adsEasy: 'inactive', affiliates: 'inactive', cashAdvance: 'inactive', shippingConfirmed: true };
function calculate(date: string, tables = bundledTables, price = '19.90', accepted = true) {
  const input = sale({ date, unitPrice: price, selections: shopeeSelections(context), facts: shopeeFacts(context), acceptedAssumptions: { validity: accepted, rounding: accepted, precedence: accepted } });
  return calculatePricing(input, createShopeeCatalog(context, price, '0', date, {}, tables));
}
function fetchPackage(pkg: CatalogPackage) {
  const manifest = parseManifest(pkg.manifestText);
  return vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
    const url = String(input); expect(url.startsWith(CATALOG_BASE)).toBe(true);
    if (url === `${CATALOG_BASE}catalogs/manifest.json`) return new Response(pkg.manifestText);
    const file = manifest.files.find(item => url === `${CATALOG_BASE}${item.path}`);
    return file ? new Response(pkg.tableTexts[file.id]) : new Response('', { status: 404 });
  });
}

describe('catálogo versionado e seleção documental', () => {
  it('confere integralmente os hashes e o esquema dos JSON distribuídos', async () => {
    expect((await validatePackage(bundledPackage)).tables).toEqual(bundledTables);
  });
  it('seleciona início e fim inclusivos, altera tarifas por dados e não ressuscita referência substituída', () => {
    const next = syntheticTable(); const tables = [...bundledTables, next];
    expect(calculate('2026-12-31', tables).knownMarketplaceFees).toBe('8.48');
    for (const date of ['2027-01-01', '2027-01-31']) expect(calculate(date, tables).knownMarketplaceFees).toBe('2.99');
    expect(calculate('2027-02-01', tables)).toMatchObject({ status: 'partial', knownMarketplaceFees: '0.00', operatingProfit: null });
    expect(selectTable('2027-02-01', tables)).toBeNull();
  });
  it('não transforma data atual, seleção ou consulta em verificação documental recente', () => {
    expect(calculate('2028-01-01', bundledTables, '19.90', false).status).toBe('partial');
    expect(calculate('2028-01-01')).toMatchObject({ confidence: 'provisional', knownMarketplaceFees: '8.48', settlement: 'not-confirmed' });
    const indicator = catalogIndicator('2028-01-01', bundledTables);
    expect(indicator).toMatchObject({ title: 'Referência documental selecionada', tone: 'warning' });
    expect(indicator.detail).toContain('22/11/2026'); expect(indicator.detail).toContain('vigência não comprovada');
    expect(selectTable('2026-11-21', bundledTables)).toBeNull();
  });
  it('libera 500 comprovados, preserva 80/100/200 e custos imediatamente adjacentes', () => {
    expect(calculate('2026-11-22', bundledTables, '500')).toMatchObject({ status: 'complete', knownMarketplaceFees: '96.00' });
    for (const price of ['80', '100', '200']) expect(calculate('2026-11-22', bundledTables, price)).toMatchObject({ status: 'partial', operatingProfit: null });
    for (const price of ['499.99', '500.01']) expect(calculate('2026-11-22', bundledTables, price).knownMarketplaceFees).toBe('96.00');
  });
  it('retirada documental impede reutilizar a versão antiga, sem apagar seus dados', () => {
    const withdrawn = { ...syntheticTable(), confirmation: 'withdrawn' as const };
    expect(selectTable('2026-11-22', [...bundledTables, withdrawn])?.table.id).toBe(bundledTables[0]!.id);
    expect(selectTable('2026-11-23', [...bundledTables, withdrawn])).toBeNull();
    expect(bundledTables[0]!.confirmation).toBe('documentary');
  });
  it('busca inversa pode encontrar exatamente 500 sem pular a fronteira comprovada', () => {
    const input = sale({ selections: shopeeSelections(context), facts: shopeeFacts(context), acceptedAssumptions: { validity: true, rounding: true } });
    const result = solvePrice(input, price => createShopeeCatalog(context, price, '0', input.date), { kind: 'profit', amount: '404' }, { min: '499.99', max: '500.01' });
    expect(result).toMatchObject({ status: 'found', unitPrice: '500.00', examined: 2, confidence: 'provisional' });
  });
  it('condição inclusiva de volume pode ser versionada sem alterar o adaptador', () => {
    const table = syntheticTable(); table.cpf.thresholdInclusive = true;
    const account = { ...context, seller: 'CPF' as const, ordersLast90Days: 450 };
    const input = sale({ date: '2027-01-01', selections: shopeeSelections(account), facts: shopeeFacts(account), acceptedAssumptions: { validity: true, rounding: true, precedence: true } });
    const result = calculatePricing(input, createShopeeCatalog(account, input.unitPrice, '0', input.date, {}, [...bundledTables, table]));
    expect(result.fees.find(line => line.rule.id === 'shopee:cpf-extra')?.amount).toBe('3.00');
  });
  it('rejeita vigências sobrepostas sem substituição explícita e revisões regressivas', () => {
    const first = syntheticTable(); const second = { ...syntheticTable(4), supersedes: [] };
    expect(() => validateTables([...bundledTables, first, second])).toThrow('ambíguas');
    expect(() => validateTables([...bundledTables, { ...first, supersedes: ['missing'] }])).toThrow('Substituição');
  });
  it.each([
    (table: ShopeeTable) => ({ ...table, extra: true }),
    (table: ShopeeTable) => ({ ...table, confirmation: 'confirmed', effectiveFrom: null }),
    (table: ShopeeTable) => ({ ...table, effectiveFrom: '2027-02-01', effectiveUntil: '2027-01-01' }),
    (table: ShopeeTable) => ({ ...table, review: { status: 'unreviewed', reference: 'test' } }),
    (table: ShopeeTable) => ({ ...table, bands: [{ ...table.bands[0], percent: '101' }] }),
    (table: ShopeeTable) => ({ ...table, sources: table.sources.map(source => ({ ...source, url: 'https://evil.example/edu/article/1' })) }),
    (table: ShopeeTable) => ({ ...table, sources: [] }),
  ])('rejeita tabelas fora do esquema ou sem revisão/fonte', change => { expect(() => parseTable(JSON.stringify(change(syntheticTable())))).toThrow(); });
  it('rejeita caminhos remotos, protótipos e esquemas futuros no manifesto', () => {
    expect(() => parseManifest(JSON.stringify({ ...bundledManifest, schemaVersion: 99 }))).toThrow();
    expect(() => parseManifest(JSON.stringify({ ...bundledManifest, files: [{ ...bundledManifest.files[0], path: '../other.json' }] }))).toThrow();
    expect(() => parseManifest('{"__proto__":{}}')).toThrow('Chave');
  });
});

describe('atualização pública opt-in, cache e proteção contra regressões', () => {
  it('consulta sem alterar valores ativos, verifica pacote e preserva histórico de versões', async () => {
    const current = await loadTrustedPackage(bundledPackage); const next = await packageWith([syntheticTable()]); const fetcher = fetchPackage(next);
    const staged = await checkCatalogUpdate(current, fetcher);
    expect(staged.manifest.releaseSequence).toBe(2); expect(current.tables).toEqual(bundledTables);
    expect(staged.tables).toHaveLength(bundledTables.length + 1); expect(fetcher).toHaveBeenCalledTimes(bundledTables.length + 2);
    expect(staged.tables[0]!.lastVerified).toBe('2026-11-22');
  });
  it('igual publicação não muda data de verificação e funciona sem qualquer servidor para calcular', async () => {
    const current = await validatePackage(bundledPackage); const staged = await checkCatalogUpdate(current, fetchPackage(bundledPackage));
    expect(staged.tables[0]!.lastVerified).toBe(current.tables[0]!.lastVerified);
    expect(calculate('2026-11-22', staged.tables).knownMarketplaceFees).toBe('8.48');
  });
  it('rejeita alteração de bytes mesmo se o JSON continuar válido', async () => {
    const tampered = structuredClone(bundledPackage); tampered.tableTexts[bundledTables[0]!.id] += ' ';
    await expect(validatePackage(tampered)).rejects.toThrow('Integridade');
  });
  it('rejeita downgrade, remoção e reescrita de uma versão publicada', async () => {
    const old = await validatePackage(bundledPackage); const next = await validatePackage(await packageWith([syntheticTable()]));
    expect(() => preventRegression(next, old)).toThrow('regressivo');
    const rewritten = structuredClone(next); rewritten.manifest.files[0]!.sha256 = '0'.repeat(64);
    expect(() => preventRegression(old, rewritten)).toThrow('imutáveis');
    const removed = structuredClone(next); removed.manifest.files.shift(); expect(() => preventRegression(old, removed)).toThrow('imutáveis');
    const same = structuredClone(old); same.package.manifestText += ' '; expect(() => preventRegression(old, same)).toThrow('Mesmo número');
  });
  it('erro offline, HTTP, redirecionamento ou resposta excessiva mantém a cópia anterior', async () => {
    const current = await validatePackage(bundledPackage);
    await expect(checkCatalogUpdate(current, vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')))).rejects.toThrow('offline');
    await expect(checkCatalogUpdate(current, vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 })))).rejects.toThrow('indisponível');
    const redirected = new Response('{}'); Object.defineProperty(redirected, 'redirected', { value: true });
    await expect(checkCatalogUpdate(current, vi.fn<typeof fetch>().mockResolvedValue(redirected))).rejects.toThrow();
    await expect(checkCatalogUpdate(current, vi.fn<typeof fetch>().mockResolvedValue(new Response(' '.repeat(65 * 1024))))).rejects.toThrow('limite');
    expect(current.package).toEqual(bundledPackage);
  });
});
