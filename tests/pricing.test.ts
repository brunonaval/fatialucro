import { describe, expect, it } from 'vitest';
import { calculateManufacturing, calculatePricing, parseBrazilianMoney } from '../src/engine';
import { D } from '../src/engine/decimal';
import { catalog, rule, sale } from './helpers';

describe('custos e demonstrativo decimal', () => {
  it('detalha fabricação, embalagem, desconto, frete, líquido, lucro, margem e markup', () => {
    const input = sale({ quantity: 2, unitPrice: '25', sellerDiscount: '2', sellerShipping: '3', packagingPerUnit: '0.50', packagingPerOrder: '1', otherOperatingCosts: '2' });
    input.manufacturing = { ...input.manufacturing, grams: '25', filamentPerKg: '100', printHours: '1', machine: { mode: 'all-in', perHour: '2' }, laborMinutes: '30', laborPerHour: '0' };
    const result = calculatePricing(input, catalog([rule(), rule({ id: 'fixed', formula: { kind: 'fixed', amount: '4' } }), rule({ id: 'order', scope: 'order', formula: { kind: 'fixed', amount: '0.49' } })]));
    expect(result).toMatchObject({ status: 'complete', grossSales: '50.00', salesAfterDiscount: '48.00', manufacturing: { perUnit: '4.50', total: '9.00' }, packaging: '2.00', operatingCosts: '13.00', knownMarketplaceFees: '18.49', marketplaceNet: '26.51', operatingProfit: '13.51', margin: '0.281458333333', markup: '1.039230769231' });
    expect(result.fees[0]?.assessments[0]).toMatchObject({ base: '25.00', count: 2, rawAmount: '5', roundedPerOccurrence: '5.00', total: '10.00' });
    expect(result.manufacturing.lines.find(line => line.id === 'labor')?.total).toBe('0.00');
    const ledgerCost = result.manufacturing.lines.reduce((sum, line) => sum.plus(line.total), new D(0));
    expect(ledgerCost.toFixed(2)).toBe(result.manufacturing.total);
  });
  it('impede dupla contagem de energia no modo de máquina completo', () => {
    const base = sale().manufacturing;
    const detailed = calculateManufacturing({ ...base, printHours: '2', machine: { mode: 'detailed', watts: '150', energyPerKwh: '0.8', maintenancePerHour: '0.5', depreciationPerHour: '1' } }, 2);
    expect(detailed).toMatchObject({ perUnit: '3.24', total: '6.48' });
    expect(detailed.lines.map(line => line.id)).not.toContain('machine');
    const allIn = calculateManufacturing({ ...base, printHours: '2', machine: { mode: 'all-in', perHour: '2' } }, 1);
    expect(allIn.total).toBe('4.00');
    expect(allIn.lines.map(line => line.id)).not.toContain('energy');
  });
  it('arredonda meio centavo por ocorrência sem ponto flutuante monetário', () => {
    const result = calculatePricing(sale({ unitPrice: '0.05', quantity: 3 }), catalog([rule({ formula: { kind: 'percentage', rate: '10' } })]));
    expect(result.knownMarketplaceFees).toBe('0.03');
    const perOrder = calculatePricing(sale({ unitPrice: '0.05', quantity: 3 }), catalog([rule({ scope: 'order', formula: { kind: 'percentage', rate: '10' } })]));
    expect(perOrder.knownMarketplaceFees).toBe('0.02');
  });
  it('distribui centavos do desconto sem perder receita na base por unidade', () => {
    const result = calculatePricing(sale({ unitPrice: '10', quantity: 3, sellerDiscount: '0.01' }), catalog([rule({ base: 'after-seller-discount', formula: { kind: 'percentage', rate: '50' } })]));
    expect(result.fees[0]?.assessments).toMatchObject([{ base: '9.99', count: 1 }, { base: '10.00', count: 2 }]);
    expect(result.knownMarketplaceFees).toBe('15.00');
  });
  it('mantém perdas e denominadores nulos sem inventar percentuais', () => {
    const result = calculatePricing(sale({ unitPrice: '0', packagingPerOrder: '2' }), catalog());
    expect(result).toMatchObject({ operatingProfit: '-2.00', margin: null, markup: '-1.000000000000' });
    expect(calculatePricing(sale(), catalog()).markup).toBeNull();
  });
  it('aceita preço subsidiado sem custo de frete quando o valor líquido confirmado é zero', () => {
    expect(calculatePricing(sale({ sellerShipping: '0' }), catalog()).marketplaceNet).toBe('25.00');
  });
});

describe('regras, versões e segurança financeira', () => {
  it('não desativa cobrança obrigatória nem condicional pelo seletor', () => {
    for (const requirement of ['mandatory', 'conditional'] as const) {
      expect(() => calculatePricing(sale({ selections: { commission: false } }), catalog([rule({ requirement })]))).toThrow('não pode ser desativada');
    }
  });
  it('exige escolha explícita para opcionais', () => {
    const rules = catalog([rule({ requirement: 'optional' })]);
    expect(calculatePricing(sale(), rules).status).toBe('partial');
    expect(calculatePricing(sale({ selections: { commission: false } }), rules).knownMarketplaceFees).toBe('0.00');
    expect(calculatePricing(sale({ selections: { commission: true } }), rules).knownMarketplaceFees).toBe('5.00');
  });
  it('aplica condicionais só quando os fatos são conhecidos e verdadeiros', () => {
    const rules = catalog([rule({ requirement: 'conditional', conditions: [{ key: 'eligible', equals: true }] })]);
    expect(calculatePricing(sale(), rules).marketplaceNet).toBeNull();
    expect(calculatePricing(sale({ facts: { eligible: false } }), rules).knownMarketplaceFees).toBe('0.00');
    expect(calculatePricing(sale({ facts: { eligible: true } }), rules).knownMarketplaceFees).toBe('5.00');
  });
  it('exclui subcomponentes e impede hierarquias ambíguas', () => {
    const result = calculatePricing(sale(), catalog([rule({ includes: ['transaction'] }), rule({ id: 'transaction', formula: null })]));
    expect(result).toMatchObject({ status: 'complete', knownMarketplaceFees: '5.00' });
    expect(result.excluded[0]?.id).toBe('transaction');
    expect(() => calculatePricing(sale(), catalog([rule({ includes: ['x'] }), rule({ id: 'other', includes: ['x'] })]))).toThrow('mesmo componente');
    expect(() => calculatePricing(sale(), catalog([rule({ includes: ['other'] }), rule({ id: 'other', includes: ['commission'] })]))).toThrow('cíclica');
  });
  it('não toma fórmula desconhecida como zero', () => {
    expect(calculatePricing(sale(), catalog([rule({ formula: null })]))).toMatchObject({ status: 'partial', marketplaceNet: null, operatingProfit: null, margin: null, markup: null });
  });
  it('não trata data de captura como vigência', () => {
    const result = calculatePricing(sale(), catalog([rule({ effectiveFrom: null })]));
    expect(result.status).toBe('partial');
    expect(result.knownMarketplaceFees).toBe('5.00');
    expect(result.pending[0]?.id).toContain('effective-date');
  });
  it('seleciona versões sem extrapolar datas', () => {
    const rules = catalog([rule({ effectiveUntil: '2026-11-15' }), rule({ version: '2', effectiveFrom: '2026-11-16', formula: { kind: 'fixed', amount: '2' } })]);
    expect(calculatePricing(sale(), rules).knownMarketplaceFees).toBe('2.00');
    expect(calculatePricing(sale({ date: '2026-12-01' }), rules).status).toBe('partial');
    expect(calculatePricing(sale({ date: '2026-10-31' }), rules).fees).toHaveLength(0);
    expect(calculatePricing(sale({ purpose: 'historical' }), rules).fees).toHaveLength(0);
  });
  it('não exige vigência de programa opcional explicitamente inativo', () => {
    const result = calculatePricing(sale({ selections: { commission: false } }), catalog([rule({ requirement: 'optional', effectiveUntil: '2026-11-01' })]));
    expect(result.status).toBe('complete');
    expect(result.knownMarketplaceFees).toBe('0.00');
  });
  it('conserva cada centavo ao longo de quantidades e descontos distintos', () => {
    for (const quantity of [1, 2, 3, 7, 100]) {
      for (const sellerDiscount of ['0', '0.01', '0.07', '0.99']) {
        const result = calculatePricing(sale({ quantity, unitPrice: '1.01', sellerDiscount }), catalog([rule({ base: 'after-seller-discount', formula: { kind: 'percentage', rate: '17.5' } })]));
        const assessments = result.fees[0]!.assessments;
        const basis = assessments.reduce((sum, line) => sum.plus(new D(line.base).mul(line.count)), new D(0));
        expect(basis.toFixed(2)).toBe(result.salesAfterDiscount);
        const fees = assessments.reduce((sum, line) => sum.plus(line.total), new D(0));
        expect(fees.toFixed(2)).toBe(result.knownMarketplaceFees);
        expect(new D(result.marketplaceNet!).plus(fees).toFixed(2)).toBe(result.salesAfterDiscount);
      }
    }
  });
  it('rejeita duplicatas e versões sobrepostas', () => {
    expect(() => calculatePricing(sale(), catalog([rule(), rule()]))).toThrow('duplicada');
    expect(() => calculatePricing(sale(), catalog([rule(), rule({ version: '2' })]))).toThrow('sobrepostas');
  });
  it('respeita limites de faixa, lacunas e tetos', () => {
    const rules = catalog([rule({ formula: { kind: 'tiered', bands: [
      { from: '0', to: '10', formula: { kind: 'fixed', amount: '1' } },
      { from: '10.01', to: null, formula: { kind: 'percentage', rate: '20', cap: '3' } },
    ] } })]);
    expect(calculatePricing(sale({ unitPrice: '9.99' }), rules).knownMarketplaceFees).toBe('1.00');
    expect(calculatePricing(sale({ unitPrice: '10' }), rules).status).toBe('partial');
    expect(calculatePricing(sale({ unitPrice: '10.01' }), rules).knownMarketplaceFees).toBe('2.00');
    expect(calculatePricing(sale({ unitPrice: '100' }), rules).knownMarketplaceFees).toBe('3.00');
  });
});

describe('validação das entradas', () => {
  it.each([-1, 0, 0.5, 10_001, Number.NaN, Number.MAX_SAFE_INTEGER])('rejeita quantidade %s', quantity => {
    expect(() => calculatePricing(sale({ quantity }), catalog())).toThrow('Quantidade');
  });
  it.each(['-1', 'NaN', 'Infinity', '1e2', '1,00', '1.001', '', '1 000', '1.000,00'])('rejeita moeda inválida %s', unitPrice => {
    expect(() => calculatePricing(sale({ unitPrice }), catalog())).toThrow();
  });
  it('rejeita moeda numérica em runtime', () => {
    expect(() => calculatePricing(sale({ unitPrice: 0.1 as unknown as string }), catalog())).toThrow();
  });
  it.each(['2026-02-30', '2026-13-01', '22/11/2026', 'invalid'])('rejeita data %s', date => {
    expect(() => calculatePricing(sale({ date }), catalog())).toThrow('Data');
  });
  it('rejeita desconto acima da venda e taxas negativas', () => {
    expect(() => calculatePricing(sale({ sellerDiscount: '26' }), catalog())).toThrow('Desconto');
    expect(() => calculatePricing(sale(), catalog([rule({ formula: { kind: 'fixed', amount: '-1' } })]))).toThrow();
  });
  it('normaliza valores pt-BR sem converter ambiguidades', () => {
    expect(parseBrazilianMoney('19,90')).toBe('19.90');
    expect(parseBrazilianMoney('19.9')).toBe('19.90');
    expect(() => parseBrazilianMoney('1.234,56')).toThrow();
  });
});
