import { describe, expect, it } from 'vitest';
import { calculateManufacturing, calculatePricing, comparePrices, depreciationPerHour, financialAlerts, breakEvenPrice } from '../src/engine';
import { calculateWorkspace } from '../src/app/calculate';
import { applyPlate, buildScenario, defaultDraft, restoreProfile, validateDraft } from '../src/app/model';
import { sale, catalog, rule } from './helpers';

describe('fabricação por lote e análise financeira integrada', () => {
  it('preserva um centavo no rateio de três peças sem multiplicar o unitário exibido', () => {
    const manufacturing = { ...sale().manufacturing, basis: 'batch' as const, piecesPerBatch: 3, grams: '1', filamentPerKg: '10' };
    expect(calculateManufacturing(manufacturing, 3)).toMatchObject({ perUnit: '0.00', total: '0.01' });
    expect(calculateManufacturing(manufacturing, 2).total).toBe('0.01');
    expect(calculateManufacturing(manufacturing, 1).total).toBe('0.00');
  });
  it('rateia materiais, energia, manutenção, depreciação e trabalho; reservas continuam por peça', () => {
    const manufacturing = { ...sale().manufacturing, basis: 'batch' as const, piecesPerBatch: 4,
      materials: [{ id: 'a', name: 'PLA', grams: '100', pricePerKg: '100' }, { id: 'b', name: 'PETG', grams: '50', pricePerKg: '200' }],
      printHours: '2', machine: { mode: 'detailed' as const, watts: '100', energyPerKwh: '1', maintenancePerHour: '0.5', depreciationPerHour: '1' },
      laborMinutes: '60', laborPerHour: '8', consumablesPerUnit: '0.20', failureReservePerUnit: '0.10' };
    // Lote: materiais20 + energia0.20 + manutenção1 + depreciação2 + trabalho8 + reservas1.20 =32.40.
    expect(calculateManufacturing(manufacturing, 4)).toMatchObject({ perUnit: '8.10', total: '32.40' });
    expect(calculateManufacturing(manufacturing, 2).total).toBe('16.20');
  });
  it('recusa lote sem quantidade e materiais com identificadores repetidos', () => {
    expect(() => calculateManufacturing({ ...sale().manufacturing, basis: 'batch' }, 1)).toThrow('quantidade');
    expect(() => calculateManufacturing({ ...sale().manufacturing, basis: 'batch', piecesPerBatch: 0 }, 1)).toThrow();
    const item = { id: 'a', name: 'PLA', grams: '1', pricePerKg: '1' };
    expect(() => calculateManufacturing({ ...sale().manufacturing, materials: [item, item] }, 1)).toThrow('únicos');
  });
  it('permite taxas horárias fracionárias sem duplicar energia no custo completo', () => {
    expect(depreciationPerHour('1000', '3000')).toBe('0.333333333333');
    expect(() => depreciationPerHour('1000', '0')).toThrow('maior');
    const result = calculateManufacturing({ ...sale().manufacturing, printHours: '3', machine: { mode: 'all-in', perHour: depreciationPerHour('1000', '3000') } }, 1);
    expect(result.total).toBe('1.00'); expect(result.lines.some(item => item.id === 'energy')).toBe(false);
  });
  it('acha equilíbrio e compara perdas e margens usando os mesmos descontos, custos e frete', () => {
    const input = sale({ quantity: 2, sellerDiscount: '1', sellerShipping: '1', packagingPerUnit: '0.5', packagingPerOrder: '1', otherOperatingCosts: '2' });
    const result = breakEvenPrice(input, () => catalog(), { min: '0.01', max: '10' });
    expect(result).toMatchObject({ status: 'found', unitPrice: '3.00', result: { operatingProfit: '0.00' } });
    const rows = comparePrices(input, () => catalog(), ['2', '3', '3.00', '4']);
    expect(rows.map(row => row.result.operatingProfit)).toEqual(['-2.00', '0.00', '2.00']);
    expect(financialAlerts(rows[0]!.result)[0]).toContain('Prejuízo');
    expect(financialAlerts(rows[1]!.result)[0]).toContain('baixa');
    expect(financialAlerts(rows[2]!.result)).toEqual([]);
  });
  it('não atravessa faixa desconhecida na busca e não converte pendência em lucro na comparação', () => {
    const unknown = catalog([rule({ formula: null })]);
    expect(breakEvenPrice(sale(), () => unknown, { min: '1', max: '2' }).status).toBe('partial');
    const row = comparePrices(sale(), () => unknown, ['1'])[0]!;
    expect(row.result.operatingProfit).toBeNull(); expect(financialAlerts(row.result)[0]).toContain('indeterminadas');
    expect(() => comparePrices(sale(), () => catalog(), [])).toThrow();
    expect(() => comparePrices(sale(), () => catalog(), Array(21).fill('1'))).toThrow();
    expect(() => financialAlerts(calculatePricing(sale(), catalog()), '1.1')).toThrow();
  });
});

describe('modelo da interface sem navegador', () => {
  it('calcula o exemplo direto e mantém produção e venda independentes', () => {
    const draft = defaultDraft(); Object.assign(draft.fields, { pieces: '2', quantity: '1' });
    const output = calculateWorkspace(draft);
    expect(output.input.manufacturing.basis).toBe('batch');
    expect(output.production.total).toBe('4.74'); expect(output.result.manufacturing.total).toBe('2.37');
    expect(output.result.operatingProfit).toBe('17.53'); expect(output.result.settlement).toBe('not-confirmed');
  });
  it('publicidade explícita não duplica o frete e aceita trabalho zero', () => {
    const draft = defaultDraft(); Object.assign(draft.fields, { advertisingEnabled: true, advertising: '2', other: '1', shipping: '3', laborHour: '0' });
    const output = calculateWorkspace(draft); const result = output.result;
    expect(output.expenses).toEqual({ advertising: '2.00', other: '1.00' });
    expect(result).toMatchObject({ sellerShipping: '3.00', otherOperatingCosts: '3.00', marketplaceNet: '16.90', operatingProfit: '9.16' });
  });
  it('executa lucro, margem, equilíbrio e comparação sem mudar a classificação', () => {
    for (const calculation of ['profit', 'margin', 'equilibrium']) {
      const draft = defaultDraft(); Object.assign(draft.fields, { calculation, minPrice: '0.01', maxPrice: '20' });
      expect(calculateWorkspace(draft).solution?.status).toBe('found');
    }
    const draft = defaultDraft(); draft.fields.calculation = 'compare';
    expect(calculateWorkspace(draft).comparison).toHaveLength(3);
  });
  it('CPF e CNPJ exigem seleção e adesões; R$19,90 continua com R$8,48 básicos', () => {
    const draft = defaultDraft(); draft.fields.marketplace = 'shopee';
    expect(calculateWorkspace(draft).result).toMatchObject({ confidence: 'indeterminate', operatingProfit: null });
    for (const seller of ['CPF', 'CNPJ']) {
      Object.assign(draft.fields, { seller, orders: '100', returns: 'inactive', highlight: 'inactive', ads: 'inactive', affiliates: 'inactive', advance: 'inactive', shippingConfirmed: true, acceptValidity: true, acceptRounding: true, acceptPrecedence: true });
      const result = calculateWorkspace(draft).result;
      expect(result).toMatchObject({ confidence: 'provisional', knownMarketplaceFees: '8.48', marketplaceNet: '11.42' });
      expect(result.fees.some(item => item.rule.id === 'shopee:transaction')).toBe(false);
    }
  });
  it('armazena personalização percentual, fixa, incidência e origem sem eliminar obrigação', () => {
    const draft = defaultDraft(); Object.assign(draft.fields, { marketplace: 'shopee', seller: 'CNPJ', returns: 'inactive', highlight: 'inactive', ads: 'inactive', affiliates: 'inactive', advance: 'inactive', shippingConfirmed: true, manualBasic: true,
      manualRate: '10', manualFixed: '2', manualRateScope: 'item', manualFixedScope: 'order', manualBase: 'gross-sales', manualReference: 'Premissa sintética', acceptValidity: true, acceptRounding: true });
    const output = calculateWorkspace(draft);
    expect(output.result).toMatchObject({ confidence: 'provisional', customMarketplaceFees: '3.99' });
    expect(output.catalog.rules.find(item => item.id === 'shopee:fixed')).toMatchObject({ scope: 'order', requirement: 'mandatory', evidence: { verification: 'custom' } });
  });
  it('desativar programa ignora o override antigo, sem contaminar outro programa', () => {
    const draft = defaultDraft(); Object.assign(draft.fields, { marketplace: 'shopee', seller: 'CNPJ', ads: 'inactive', 'shopee:adsEasy:manual': true });
    expect(() => buildScenario(draft).catalogAt('19.90')).not.toThrow();
    Object.assign(draft.fields, { ads: 'active' }); expect(() => buildScenario(draft)).toThrow();
  });
  it('aplicar placa mantém dados ausentes vazios e preço por kg manual; venda não é sobrescrita', () => {
    const draft = defaultDraft(); draft.fields.quantity = '2';
    const applied = applyPlate(draft, { id: '1', name: 'Placa', grams: null, seconds: null, pieces: null, materials: [{ name: 'PLA', grams: null }] });
    expect(applied.fields).toMatchObject({ grams: '', hours: '', pieces: '', quantity: '2', basis: 'batch' });
    expect(applied.materials[0]).toMatchObject({ grams: '', pricePerKg: '' });
    expect(() => buildScenario(applied)).toThrow();
    const timed = applyPlate(draft, { id: '1', name: 'Placa', grams: '10', seconds: '5400', pieces: 3, materials: [] });
    expect(timed.fields.hours).toBe('1.5');
  });
  it('perfil de impressora preserva preço, filamento e enquadramento; produto restaura tudo', () => {
    const current = defaultDraft(); current.fields.seller = 'CPF';
    const saved = defaultDraft(); Object.assign(saved.fields, { seller: 'CNPJ', machine: '3', price: '50', filament: '200' });
    expect(restoreProfile(current, saved, 'printer').fields).toMatchObject({ machine: '3', seller: 'CPF', price: '19,90', filament: '120' });
    expect(restoreProfile(current, saved, 'product')).toEqual(saved);
    expect(restoreProfile(current, saved, 'marketplace').fields).toMatchObject({ seller: 'CNPJ', machine: '2' });
  });
  it('valida esquema e rejeita campos ausentes, tipos errados e valores de custo inválidos', () => {
    expect(() => validateDraft(defaultDraft())).not.toThrow();
    expect(() => validateDraft({ fields: {}, materials: [] })).toThrow();
    const draft = defaultDraft(); draft.fields.price = true; expect(() => validateDraft(draft)).toThrow();
    draft.fields.price = '-1'; expect(() => calculateWorkspace(draft)).toThrow();
    draft.fields.price = '19,90'; draft.fields.pieces = ''; draft.fields.basis = 'unit'; expect(() => calculateWorkspace(draft)).not.toThrow();
  });
});
