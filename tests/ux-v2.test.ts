import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { applyImportedPlate, applyProfile, calculateExperience, calculationSignature, exampleDraft, newCalculationDraft, spoolRates } from '../src/app/experience';
import { realDraft, cpfDraft } from './ux-helpers';
import { calculateManufacturing, calculatePackaging } from '../src/engine';
import { importPrintFile } from '../src/importers';
import { bundledTables } from '../src/marketplaces/catalogs/bundled';
import { tariffHints } from '../src/app/tariff-hints';
import { sale } from './helpers';

describe('UX V2: primeiro uso, escopo e custos reais informados', () => {
  it('inicia sem preço, peso, tempo, bobina ou custo de impressora fictícios', () => {
    const draft = newCalculationDraft();
    for (const key of ['price', 'quantity', 'grams', 'hours', 'pieces', 'filament', 'machine', 'watts', 'kwh']) expect(draft.fields[key]).toBe('');
    expect(draft.ux).toMatchObject({ entry: 'none', mode: 'simple', intent: 'cost', filament: { amount: '', netGrams: '' } });
    expect(() => calculateExperience(draft)).toThrow('Importe');
  });
  it('exemplo é identificado e isolado; começar de novo não copia seus custos', () => {
    const demo = exampleDraft(); expect(calculateExperience(demo).kind).toBe('sale'); expect(demo.ux?.entry).toBe('example');
    expect(newCalculationDraft().fields.grams).toBe(''); expect(newCalculationDraft().ux?.filament.amount).toBe('');
  });
  it('primeiro cálculo de custo não exige preço, venda ou cadastro Shopee', () => {
    const draft = realDraft(); draft.fields.price = ''; draft.fields.quantity = ''; draft.fields.seller = '';
    const output = calculateExperience(draft); expect(output.kind).toBe('cost');
    if (output.kind !== 'cost') throw new Error(); expect(output.cost).toMatchObject({ manufacturing: { perUnit: '4.00', total: '20.00' }, total: '20.00' });
    expect('data' in output).toBe(false);
  });
  it('material sem energia não inventa um tempo ausente ou impõe configuração de loja', () => {
    const draft = realDraft(); draft.fields.hours = ''; draft.fields.machine = ''; draft.ux!.machineIncluded = false;
    const output = calculateExperience(draft); expect(output.kind === 'cost' && output.cost.total).toBe('10.00'); expect(draft.fields.hours).toBe('');
  });
  it('cinco peças fabricadas e duas vendidas alocam apenas dois quintos do lote', () => {
    const draft = realDraft(); draft.ux!.intent = 'sale';
    const output = calculateExperience(draft); expect(output.kind).toBe('sale');
    if (output.kind !== 'sale') throw new Error(); expect(output.data.production.total).toBe('20.00');
    expect(output.data.result).toMatchObject({ manufacturing: { total: '8.00' }, grossSales: '39.80', operatingProfit: '31.80' });
  });
  it('bobina usa preço pago e peso líquido, inclusive quando não tem 1 kg', () => {
    const draft = realDraft(); draft.ux!.filament = { mode: 'spool', amount: '60', netGrams: '750' }; draft.ux!.machineIncluded = false;
    const output = calculateExperience(draft); expect(output.kind === 'cost' && output.cost.total).toBe('8.00');
    expect(spoolRates('60', '750')).toEqual({ perGram: '0.08', perKg: '80' }); expect(() => spoolRates('60', '0')).toThrow();
  });
  it('não perde meio centavo usando um equivalente por kg arredondado', () => {
    const manufacturing = { ...sale().manufacturing, grams: '1.5', filamentPurchase: { amount: '0.01', netGrams: '3' } };
    expect(calculateManufacturing(manufacturing, 1).total).toBe('0.01');
  });
  it('pacote de embalagem preserva frações até o total do pedido', () => {
    expect(calculatePackaging({ quantity: 3, packagingPerUnit: '0', packagingPerOrder: '0', packagingPurchase: { amount: '0.01', units: 3 } })).toBe('0.01');
    expect(() => calculatePackaging({ quantity: 1, packagingPerUnit: '0', packagingPerOrder: '0', packagingPurchase: { amount: '1', units: 0 } })).toThrow();
  });
  it('mão de obra pode ser conscientemente zerada, excluída ou remunerada', () => {
    const draft = realDraft(); draft.ux!.labor = 'zero'; expect(calculateExperience(draft).kind).toBe('cost');
    draft.ux!.labor = 'paid'; expect(() => calculateExperience(draft)).toThrow();
    Object.assign(draft.fields, { laborMinutes: '60', laborHour: '0' }); const zero = calculateExperience(draft); expect(zero.kind === 'cost' && zero.cost.total).toBe('20.00');
    draft.fields.laborHour = '10'; const paid = calculateExperience(draft); expect(paid.kind === 'cost' && paid.cost.total).toBe('30.00');
  });
  it('impressora completa e energia detalhada são modelos exclusivos', () => {
    const draft = realDraft(); Object.assign(draft.fields, { hours: '2', machineMode: 'detailed', watts: '100', kwh: '1' });
    const detailed = calculateExperience(draft); expect(detailed.kind === 'cost' && detailed.cost.total).toBe('10.20');
    draft.fields.machineMode = 'all-in'; const full = calculateExperience(draft); expect(full.kind === 'cost' && full.cost.total).toBe('14.00');
  });
  it('peças em kits afetam fabricação, mas tarifas por unidade comercial não são duplicadas', () => {
    const draft = cpfDraft(); draft.ux!.saleUnit = 'kit'; draft.ux!.partsPerKit = '2'; const output = calculateExperience(draft);
    if (output.kind !== 'sale') throw new Error(); expect(output.data.input.quantity).toBe(2);
    expect(output.data.production.total).toBe('20.00'); expect(output.data.result).toMatchObject({ manufacturing: { perUnit: '8.00', total: '16.00' }, knownMarketplaceFees: '16.96', operatingProfit: '6.84' });
  });
  it('perfis de impressora e filamento não alteram preço, peças, quantidade vendida ou loja', () => {
    const current = cpfDraft(); const profile = realDraft(); profile.fields.machine = '4'; profile.ux!.filament = { mode: 'spool', amount: '90', netGrams: '600' };
    const printer = applyProfile(current, profile, 'printer'); expect(printer.fields).toMatchObject({ machine: '4', price: '19.90', pieces: '5', quantity: '2', seller: 'CPF' });
    const filament = applyProfile(current, profile, 'filament'); expect(filament.ux?.filament).toEqual(profile.ux!.filament); expect(filament.fields.grams).toBe('100'); expect(filament.fields.machine).toBe('2');
  });
});

describe('precificação automática com o mesmo motor documental', () => {
  it('CPF admite condição qualitativa explícita sem inventar um número de pedidos', () => {
    const draft = cpfDraft(); const output = calculateExperience(draft);
    if (output.kind !== 'sale') throw new Error(); expect(output.data.result).toMatchObject({ confidence: 'provisional', knownMarketplaceFees: '16.96', marketplaceNet: '22.84' });
    expect(output.data.input.facts.cpfVolumeStatement).toBe('450:below'); expect(draft.fields.orders).toBe('');
  });
  it('Não sei não vira ausência de cobrança; condição de outra data/limite exige nova confirmação', () => {
    const draft = cpfDraft(); draft.ux!.volume.answer = 'unknown';
    for (const change of [() => {}, () => { draft.ux!.volume = { answer: 'below', threshold: 451, date: '2026-11-22' }; }, () => { draft.ux!.volume = { answer: 'below', threshold: 450, date: '2026-11-21' }; }]) {
      change(); const output = calculateExperience(draft); if (output.kind !== 'sale') throw new Error(); expect(output.data.result.operatingProfit).toBeNull(); expect(output.data.result.pending.some(item => item.id === 'shopee:cpf-volume')).toBe(true);
    }
  });
  it('loja ativa desconhecida e frete desconhecido continuam impedindo lucro completo', () => {
    const draft = cpfDraft(); draft.fields.ads = 'unknown'; draft.ux!.shipping = 'unknown';
    const output = calculateExperience(draft); if (output.kind !== 'sale') throw new Error(); expect(output.data.result).toMatchObject({ status: 'partial', operatingProfit: null, marketplaceNet: null });
  });
  it('meta de lucro ou margem não exige um preço fictício para começar a busca', () => {
    const draft = realDraft(); draft.ux!.intent = 'sale'; Object.assign(draft.fields, { calculation: 'profit', price: '', targetProfit: '5', minPrice: '0.01', maxPrice: '100' });
    const profit = calculateExperience(draft); if (profit.kind !== 'sale') throw new Error(); expect(profit.data.input.unitPrice).toBe('6.50'); expect(profit.data.result.operatingProfit).toBe('5.00');
    expect(calculationSignature(draft)).toBe(calculationSignature(profit.draft));
    Object.assign(draft.fields, { calculation: 'margin', targetMargin: '0.20' }); const margin = calculateExperience(draft); if (margin.kind !== 'sale') throw new Error(); expect(margin.data.input.unitPrice).toBe('5.00'); expect(margin.data.result.margin).toBe('0.200000000000');
  });
  it('busca interrompida não apresenta o preço final arbitrário como sugestão', () => {
    const draft = cpfDraft(); Object.assign(draft.fields, { calculation: 'profit', price: '', targetProfit: '5', minPrice: '0.01', maxPrice: '100' });
    expect(calculateExperience(draft).kind).toBe('blocked-search'); draft.fields.minPrice = '12'; const output = calculateExperience(draft); if (output.kind !== 'sale') throw new Error(); expect(output.data.input.unitPrice).toBe('13.75');
  });
  it('modo simples/avançado e navegação não duplicam nem alteram dados financeiros', () => {
    const simple = realDraft(); const advanced = { ...simple, ux: { ...simple.ux!, mode: 'advanced' as const, stage: 'result' as const } };
    expect(calculationSignature(simple)).toBe(calculationSignature(advanced));
    const a = calculateExperience(simple); const b = calculateExperience(advanced); expect(a.kind === 'cost' && a.cost.total).toBe(b.kind === 'cost' && b.cost.total);
  });
  it('alertas de faixa dependem das bandas documentadas, sem inventar degrau em 500', () => {
    expect(tariffHints(bundledTables[0]!, '79.99')[0]).toContain('80,00'); expect(tariffHints(bundledTables[0]!, '500')).toEqual([]);
  });
});

describe('arquivo fatiado e origem sem inventar dados', () => {
  it('importa .gcode.3mf, mantém placas e materiais separados e não presume preço ou quantidade vendida', () => {
    const bytes = zipSync({ 'Metadata/slice_info.config': strToU8('<config><plate><metadata key="index" value="1"/><metadata key="prediction" value="5400"/><metadata key="object_count" value="5"/><filament type="PLA" used_g="20"/><filament type="PETG" used_g="10"/></plate><plate><metadata key="index" value="2"/></plate></config>') });
    const parsed = importPrintFile('orca.gcode.3mf', bytes); const draft = applyImportedPlate(newCalculationDraft(), parsed, parsed.plates[0]!);
    expect(draft.fields).toMatchObject({ hours: '1.5', pieces: '5', quantity: '', filament: '' }); expect(draft.materials).toHaveLength(2); expect(draft.materials.every(item => item.pricePerKg === '')).toBe(true); expect(draft.ux?.origin).toMatchObject({ fileName: 'orca.gcode.3mf', plateCount: 2, plateId: '1' });
  });
  it('geometria sem fatiamento preserva ausências para preenchimento manual', () => {
    const data = importPrintFile('modelo.3mf', zipSync({ '3D/3dmodel.model': strToU8('<model/>') }));
    expect(data.sliced).toBe(false); const draft = applyImportedPlate(newCalculationDraft(), data, { id: 'manual', name: 'Manual', grams: null, seconds: null, pieces: null, materials: [] });
    expect(draft.fields).toMatchObject({ grams: '', hours: '', pieces: '', quantity: '' }); expect(draft.ux?.origin?.grams).toBeNull(); expect(() => calculateExperience(draft)).toThrow();
  });
});
