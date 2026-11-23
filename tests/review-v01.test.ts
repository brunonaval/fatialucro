import { describe, expect, it } from 'vitest';
import { applyManualFees, calculatePricing, solvePrice } from '../src/engine';
import type { ManualFee, SaleInput } from '../src/engine';
import { createShopeeCatalog, shopeeFacts, shopeeSelections } from '../src/marketplaces/shopee/catalog';
import type { ShopeeContext } from '../src/marketplaces/shopee/catalog';
import { catalog, rule, sale } from './helpers';

const context: ShopeeContext = { seller: 'CPF', ordersLast90Days: 100, returnsProtection: 'inactive', highlightCampaign: 'inactive', adsEasy: 'inactive', affiliates: 'inactive', cashAdvance: 'inactive', shippingConfirmed: true };
const accepted = { validity: true, rounding: true, precedence: true };
const manual = (overrides: Partial<ManualFee> = {}): ManualFee => ({
  formula: { kind: 'fixed', amount: '4.50' }, scope: 'item', base: 'gross-sales', reference: 'Premissa explícita sintética de revisão; não é tarifa oficial.',
  effectiveFrom: '2026-11-22', effectiveUntil: '2026-11-22', ...overrides,
});
const basic = () => ({ 'shopee:commission': manual({ formula: { kind: 'percentage', rate: '20' } }), 'shopee:fixed': manual() });
function calculate(input: Partial<SaleInput> = {}, account = context, overrides: Record<string, ManualFee> = {}) {
  const values = sale({ unitPrice: '19.90', acceptedAssumptions: accepted, ...input, selections: shopeeSelections(account), facts: shopeeFacts(account) });
  return calculatePricing(values, createShopeeCatalog(account, values.unitPrice, values.sellerDiscount, values.date, overrides));
}

describe('distinção entre cálculo documentado, simulação provisória e indeterminação', () => {
  it('mantém 8,48 documentais e libera resultado provisório só com premissas aceitas', () => {
    const result = calculate();
    expect(result).toMatchObject({ status: 'complete', confidence: 'provisional', settlement: 'not-confirmed', documentedMarketplaceFees: '8.48', customMarketplaceFees: '0.00', marketplaceNet: '11.42' });
    expect(result.excluded.some(line => line.id === 'shopee:transaction')).toBe(true);
    expect(result.assumptions.every(item => item.accepted)).toBe(true);
    expect(result.fees.every(line => line.rule.effectiveFrom === null)).toBe(true);
  });
  it.each([{ validity: false, rounding: true }, { validity: true, rounding: false }, {}])('não aceita uma premissa implicitamente: %s', acceptedAssumptions => {
    expect(calculate({ acceptedAssumptions })).toMatchObject({ status: 'partial', confidence: 'indeterminate', marketplaceNet: null, operatingProfit: null });
  });
  it('não presume CNPJ quando o cadastro está vazio', () => {
    const result = calculate({}, { ...context, seller: null });
    expect(result.pending.some(item => item.id === 'shopee:seller')).toBe(true);
    expect(result.fees).toHaveLength(0);
    expect(result.operatingProfit).toBeNull();
  });
  it('exige a premissa explícita de precedência para a divergência CPF de 4 versus 4,50', () => {
    const result = calculate({ acceptedAssumptions: { validity: true, rounding: true } });
    expect(result.status).toBe('partial');
    expect(result.pending.some(item => item.id === 'shopee:cpf-fixed-precedence')).toBe(true);
    expect(calculate({}, { ...context, seller: 'CNPJ' }).assumptions.some(item => item.kind === 'precedence')).toBe(false);
  });
  it.each(['80', '100', '200', '500'])('aceitação respeita a evidência revisada da fronteira %s', unitPrice => {
    expect(calculate({ unitPrice }).confidence).toBe(unitPrice === '500' ? 'provisional' : 'indeterminate');
    if (unitPrice === '500') expect(calculate({ unitPrice }).knownMarketplaceFees).toBe('96.00');
    expect(calculate({ unitPrice }, context, basic())).toMatchObject({ status: 'complete', confidence: 'provisional' });
  });
  it('a regressão CPF exige todos os componentes explícitos, inclusive adicional zero', () => {
    expect(calculate({ unitPrice: '7.90' }).status).toBe('partial');
    expect(calculate({ unitPrice: '7.90' }, context, basic()).status).toBe('partial');
    const result = calculate({ unitPrice: '7.90' }, context, { ...basic(), 'shopee:cpf-extra': manual({ formula: { kind: 'fixed', amount: '0' } }) });
    expect(result).toMatchObject({ status: 'complete', confidence: 'provisional', customMarketplaceFees: '6.08' });
    expect(result.fees.find(line => line.rule.id === 'shopee:cpf-extra')?.rule.evidence.verification).toBe('custom');
  });
  it('volume desconhecido e exatamente 450 não são apagados pela aceitação', () => {
    for (const ordersLast90Days of [null, 450]) {
      expect(calculate({}, { ...context, ordersLast90Days }).status).toBe('partial');
      expect(calculate({}, { ...context, ordersLast90Days }, { 'shopee:cpf-extra': manual({ formula: { kind: 'fixed', amount: '3' } }) }).status).toBe('complete');
    }
  });
  it('não trata estado ausente ou confirmação textual inválida como opção inativa/confirmada', () => {
    expect(() => calculate({}, { ...context, returnsProtection: undefined as unknown as ShopeeContext['returnsProtection'] })).toThrow('participação');
    expect(() => calculate({}, { ...context, shippingConfirmed: 'false' as unknown as boolean })).toThrow('frete');
  });
  it('um fato com tipo incorreto continua pendente em vez de excluir a cobrança', () => {
    const result = calculatePricing(sale({ facts: { eligible: 'false' } }), catalog([rule({ requirement: 'conditional', conditions: [{ key: 'eligible', equals: true }] })]));
    expect(result.status).toBe('partial');
    expect(result.excluded).toHaveLength(0);
  });
  it('desconto deixa percentual e parcela dependente de faixa indeterminados', () => {
    const result = calculate({ unitPrice: '80.01', sellerDiscount: '1' });
    expect(result.fees).toHaveLength(0);
    expect(result.status).toBe('partial');
    const overrides = basic();
    overrides['shopee:commission'] = manual({ formula: { kind: 'percentage', rate: '20' }, base: 'after-seller-discount' });
    const custom = calculate({ unitPrice: '25', quantity: 2, sellerDiscount: '2', sellerShipping: '3', packagingPerOrder: '2' }, context, overrides);
    expect(custom).toMatchObject({ confidence: 'provisional', knownMarketplaceFees: '18.60', marketplaceNet: '26.40', operatingProfit: '24.40' });
    expect(custom.fees[0]?.rule.override?.originalFormula).toBeNull();
  });
  it('inclui custos e admite lucro negativo sem esconder uma perda', () => {
    const result = calculate({ unitPrice: '12', sellerShipping: '3', packagingPerOrder: '5', otherOperatingCosts: '2' });
    expect(result).toMatchObject({ status: 'complete', operatingProfit: '-4.90', margin: '-0.408333333333' });
  });
  it('subsídio confirmado que zera frete não vira despesa', () => {
    const result = calculate({ sellerShipping: '0' });
    expect(result.marketplaceNet).toBe('11.42');
    expect(result.sellerShipping).toBe('0.00');
  });
  it('mantém programas independentes e a incidência de Devolução Fácil por pedido', () => {
    const account = { ...context, returnsProtection: 'billable' as const, highlightCampaign: 'active' as const };
    const result = calculate({ quantity: 2 }, account);
    expect(result.knownMarketplaceFees).toBe('19.45'); // 16.96 + 0.49 + 2 × 1.00.
    expect(result.fees.find(line => line.rule.id === 'shopee:returns-protection')?.amount).toBe('0.49');
    expect(calculate({ quantity: 2 }, { ...account, highlightCampaign: 'inactive' }).knownMarketplaceFees).toBe('17.45');
    expect(calculate({ quantity: 2 }, { ...account, returnsProtection: 'trial' }).knownMarketplaceFees).toBe('18.96');
  });
  it('programa ativo pode receber valor personalizado; adesão desconhecida continua bloqueando', () => {
    const overrides = { 'shopee:adsEasy': manual({ formula: { kind: 'percentage', rate: '3' }, scope: 'order' }) };
    expect(calculate({}, { ...context, adsEasy: 'active' }).status).toBe('partial');
    const result = calculate({}, { ...context, adsEasy: 'active' }, overrides);
    expect(result).toMatchObject({ status: 'complete', confidence: 'provisional', customMarketplaceFees: '0.60', knownMarketplaceFees: '9.08' });
    expect(calculate({}, { ...context, affiliates: 'unknown' }, basic()).status).toBe('partial');
    expect(calculate({}, { ...context, shippingConfirmed: false }, basic()).status).toBe('partial');
  });
  it('mantém metadados de substituição sem mudar a obrigatoriedade nem duplicar transação', () => {
    const values = sale({ selections: { 'shopee:commission': false }, acceptedAssumptions: accepted });
    const configured = createShopeeCatalog(context, '25', '0', values.date, basic());
    expect(() => calculatePricing(values, configured)).toThrow('não pode ser desativada');
    const result = calculate({}, context, basic());
    expect(result.fees[0]?.rule).toMatchObject({ requirement: 'mandatory', evidence: { verification: 'custom', urls: [] }, override: { originalFormula: { kind: 'percentage', rate: '20' } } });
    expect(result.knownMarketplaceFees).toBe('8.48');
    expect(result.documentedMarketplaceFees).toBe('0.00');
  });
  it('reutiliza como referência provisória explícita, sem alterar verificação, e preserva períodos personalizados', () => {
    expect(calculate({ date: '2026-11-23' })).toMatchObject({ status: 'complete', confidence: 'provisional' });
    expect(createShopeeCatalog(context, '19.90', '0', '2026-11-23').provenance).toMatchObject({ selection: 'reference', lastVerified: '2026-11-22', effectiveFrom: null });
    const overrides = Object.fromEntries(Object.entries(basic()).map(([id, value]) => [id, { ...value, effectiveFrom: '2026-11-23', effectiveUntil: '2026-11-24' }]));
    expect(calculate({ date: '2026-11-23' }, context, overrides)).toMatchObject({ status: 'complete', confidence: 'provisional' });
    expect(calculate({ date: '2026-11-25' }, context, overrides).status).toBe('partial');
    expect(calculate({ date: '2026-11-23' }, { ...context, returnsProtection: 'billable' }, overrides)).toMatchObject({ status: 'complete', confidence: 'provisional', documentedMarketplaceFees: '0.49' });
  });
});

describe('incidência personalizada, arredondamento e períodos', () => {
  it('separa arredondamento de percentual e fixo por unidade versus pedido', () => {
    const perUnit = basic();
    perUnit['shopee:commission'] = manual({ formula: { kind: 'percentage', rate: '10' } });
    perUnit['shopee:fixed'] = manual({ formula: { kind: 'fixed', amount: '1' } });
    const account = { ...context, seller: 'CNPJ' as const };
    expect(calculate({ unitPrice: '0.05', quantity: 3 }, account, perUnit).knownMarketplaceFees).toBe('3.03');
    const perOrder = Object.fromEntries(Object.entries(perUnit).map(([id, value]) => [id, { ...value, scope: 'order' as const }]));
    expect(calculate({ unitPrice: '0.05', quantity: 3 }, account, perOrder).knownMarketplaceFees).toBe('1.02');
  });
  it('aplica a versão da tarifa na data exata de transição sem alterar resultados anteriores', () => {
    const tariffs = catalog([rule({ effectiveUntil: '2026-11-21', formula: { kind: 'fixed', amount: '4' } }),
      rule({ version: '2', effectiveFrom: '2026-11-22', formula: { kind: 'fixed', amount: '4.50' } })]);
    expect(calculatePricing(sale({ date: '2026-11-21', quantity: 2 }), tariffs).knownMarketplaceFees).toBe('8.00');
    expect(calculatePricing(sale({ date: '2026-11-22', quantity: 2 }), tariffs).knownMarketplaceFees).toBe('9.00');
  });
  it('rejeita ausência de origem, números inválidos, incidência inválida e override estranho', () => {
    expect(() => applyManualFees(catalog([rule()]), { commission: manual({ reference: '  ' }) })).toThrow('origem');
    expect(() => applyManualFees(catalog([rule()]), { unknown: manual() })).toThrow('desconhecida');
    expect(() => applyManualFees(catalog([rule()]), { commission: manual({ scope: 'other' as 'order' }) })).toThrow('incidência');
    expect(() => calculate({}, context, { 'shopee:commission': manual({ formula: { kind: 'percentage', rate: '101' } }) })).toThrow('100%');
    expect(() => calculate({}, context, { 'shopee:fixed': manual({ formula: { kind: 'fixed', amount: '-1' } }) })).toThrow();
    expect(() => calculate({}, context, { 'shopee:commission': manual({ formula: { kind: 'percentage', rate: '0' } }), 'shopee:fixed': manual({ formula: { kind: 'fixed', amount: '0' } }) })).toThrow('não pode ser eliminada');
  });
});

describe('cálculo inverso com classificação de evidência', () => {
  it('encontra preço provisório CPF na faixa documentada e valida o centavo anterior', () => {
    const input = sale({ acceptedAssumptions: accepted, packagingPerOrder: '5.37', selections: shopeeSelections(context), facts: shopeeFacts(context) });
    const at = (price: string) => createShopeeCatalog(context, price, '0', input.date);
    const solution = solvePrice(input, at, { kind: 'profit', amount: '5' }, { min: '12', max: '30' });
    expect(solution).toMatchObject({ status: 'found', confidence: 'provisional', unitPrice: '18.59', result: { operatingProfit: '5.00' } });
    expect(calculatePricing({ ...input, unitPrice: '18.58' }, at('18.58')).operatingProfit).toBe('4.99');
  });
  it('não atravessa a regressão CPF nem uma premissa não aceita', () => {
    const input = sale({ acceptedAssumptions: accepted, selections: shopeeSelections(context), facts: shopeeFacts(context) });
    const at = (price: string) => createShopeeCatalog(context, price, '0', input.date);
    expect(solvePrice(input, at, { kind: 'profit', amount: '5' }, { min: '0.01', max: '30' }).status).toBe('partial');
    expect(solvePrice({ ...input, acceptedAssumptions: {} }, at, { kind: 'profit', amount: '5' }, { min: '12', max: '30' }).status).toBe('partial');
  });
  it('preserva premissas de candidatos anteriores, mesmo se o preço encontrado usa outra regra', () => {
    const input = sale();
    const first = catalog([rule({ formula: { kind: 'fixed', amount: '10' } })]);
    const second = catalog([{ ...rule({ formula: { kind: 'fixed', amount: '0' } }), evidence: { ...rule().evidence, verification: 'documented' } }]);
    const solution = solvePrice(input, price => price === '1.00' ? first : second, { kind: 'profit', amount: '1' }, { min: '1', max: '1.01' });
    expect(solution).toMatchObject({ status: 'found', unitPrice: '1.01', confidence: 'provisional', result: { confidence: 'documented' } });
    if (solution.status === 'found') expect(solution.assumptions.some(item => item.kind === 'custom-parameters')).toBe(true);
  });
});
