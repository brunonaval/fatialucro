import { describe, expect, it } from 'vitest';
import { calculatePricing } from '../src/engine';
import { createShopeeCatalog, shopeeFacts, shopeeSelections } from '../src/marketplaces/shopee/catalog';
import type { ShopeeContext } from '../src/marketplaces/shopee/catalog';
import { sale } from './helpers';

const standard: ShopeeContext = { seller: 'CNPJ', ordersLast90Days: null, returnsProtection: 'inactive', highlightCampaign: 'inactive', adsEasy: 'inactive', affiliates: 'inactive', cashAdvance: 'inactive', shippingConfirmed: true };
function calculate(price = '19.90', context = standard, quantity = 1, date = '2026-11-22', sellerDiscount = '0') {
  return calculatePricing(sale({ unitPrice: price, quantity, date, sellerDiscount, selections: shopeeSelections(context), facts: shopeeFacts(context) }), createShopeeCatalog(context, price, sellerDiscount, date));
}

describe('Shopee documental de novembro: sem certeza indevida', () => {
  it('calcula a parte conhecida de R$ 19,90, sem duplicar transação', () => {
    const result = calculate();
    expect(result).toMatchObject({ status: 'partial', knownMarketplaceFees: '8.48', marketplaceNet: null, operatingProfit: null });
    expect(result.excluded.some(line => line.id === 'shopee:transaction')).toBe(true);
    expect(result.pending.some(line => line.id === 'shopee:validity')).toBe(true);
    expect(result.pending.some(line => line.id === 'shopee:rounding')).toBe(true);
    expect(result.fees[0]?.rule.effectiveFrom).toBeNull();
  });
  it.each([['9.00', '6.30'], ['25.00', '9.50'], ['79.99', '20.50'], ['80.01', '27.20'], ['99.99', '30.00'], ['100.01', '34.00'], ['199.99', '48.00'], ['200.01', '54.00'], ['499.99', '96.00'], ['500.01', '96.00']])('documenta preço %s → subtotal %s', (price, expected) => {
    expect(calculate(price).knownMarketplaceFees).toBe(expected);
  });
  it.each(['80', '100', '200', '500'])('bloqueia a borda exata %s', price => {
    const result = calculate(price);
    expect(result.pending.some(line => line.id === 'shopee:price-boundary')).toBe(true);
    expect(result.marketplaceNet).toBeNull();
    expect(result.fees).toHaveLength(0);
  });
  it('distingue CNPJ abaixo de 9 e CPF abaixo de 12 sem interpolar', () => {
    expect(calculate('8').knownMarketplaceFees).toBe('5.60');
    for (const volume of [0, 450, 451, null]) {
      const result = calculate('8', { ...standard, seller: 'CPF', ordersLast90Days: volume });
      expect(result.fees).toHaveLength(0);
      expect(result.pending.some(line => line.id === 'shopee:cpf-regressive')).toBe(true);
    }
  });
  it('resolve adicional CPF só com volume conhecido e mantém exatamente 450 pendente', () => {
    expect(calculate('12', { ...standard, seller: 'CPF', ordersLast90Days: 449 }).knownMarketplaceFees).toBe('6.90');
    expect(calculate('12', { ...standard, seller: 'CPF', ordersLast90Days: 451 }, 2).knownMarketplaceFees).toBe('19.80');
    expect(calculate('12', { ...standard, seller: 'CPF', ordersLast90Days: 450 }).pending.some(line => line.id === 'shopee:cpf-450')).toBe(true);
    expect(calculate('12', { ...standard, seller: 'CPF' }).pending.some(line => line.id === 'shopee:cpf-volume')).toBe(true);
  });
  it('cobra Devolução Fácil uma vez por pedido pago fora do teste', () => {
    const active = calculate('25', { ...standard, returnsProtection: 'billable' }, 2);
    expect(active.knownMarketplaceFees).toBe('19.49');
    expect(active.fees.find(line => line.rule.id === 'shopee:returns-protection')?.rule.scope).toBe('order');
    expect(calculate('25', { ...standard, returnsProtection: 'trial' }, 2).knownMarketplaceFees).toBe('19.00');
    expect(calculate('25', { ...standard, returnsProtection: 'unknown' }).pending.some(line => line.id === 'shopee:returns-enrollment')).toBe(true);
  });
  it('cobra Destaque quando a loja está efetivamente na campanha', () => {
    expect(calculate('25', { ...standard, highlightCampaign: 'active' }).knownMarketplaceFees).toBe('10.75');
    expect(calculate('25', { ...standard, highlightCampaign: 'unknown' }).pending.some(line => line.id === 'shopee:campaign-enrollment')).toBe(true);
  });
  it('não inventa base de comissão com descontos', () => {
    const result = calculate('25', standard, 1, '2026-11-22', '1');
    expect(result.pending.some(line => line.id === 'shopee:discount-base')).toBe(true);
    expect(result.fees.some(line => line.rule.id === 'shopee:commission')).toBe(false);
    expect(result.operatingProfit).toBeNull();
  });
  it('não extrapola a captura para junho ou para o dia seguinte', () => {
    expect(calculate('25', standard, 1, '2026-06-15').fees).toHaveLength(0);
    expect(calculate('25', standard, 1, '2026-11-23').fees).toHaveLength(0);
  });
  it('registra adesões e frete desconhecidos em vez de zerá-los', () => {
    const result = calculate('25', { ...standard, adsEasy: 'active', affiliates: 'unknown', cashAdvance: 'active', shippingConfirmed: false });
    for (const id of ['adsEasy', 'affiliates', 'cashAdvance', 'shipping']) {
      expect(result.pending.some(line => line.id === `shopee:${id}`)).toBe(true);
    }
  });
});
