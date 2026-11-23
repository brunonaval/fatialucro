import { D, decimal, money } from './decimal';
import { calculatePricing } from './pricing';
import { solvePrice } from './solver';
import type { PricingResult, SaleInput, TariffCatalog } from './types';

export function breakEvenPrice(input: Omit<SaleInput, 'unitPrice'>, catalogAt: (price: string) => TariffCatalog,
  range = { min: '0.01', max: '1000.00' }) {
  return solvePrice(input, catalogAt, { kind: 'profit', amount: '0' }, range);
}

export function comparePrices(input: Omit<SaleInput, 'unitPrice'>, catalogAt: (price: string) => TariffCatalog, prices: readonly string[]) {
  if (!prices.length || prices.length > 20) throw new Error('Compare entre 1 e 20 preços.');
  return [...new Set(prices.map(value => money(value).toFixed(2)))].map(unitPrice => ({
    unitPrice, result: calculatePricing({ ...input, unitPrice }, catalogAt(unitPrice)),
  }));
}

export function financialAlerts(result: PricingResult, lowMarginRatio = '0.10'): string[] {
  const threshold = decimal(lowMarginRatio);
  if (threshold.gt(1)) throw new Error('Alerta de margem deve estar entre zero e 1.');
  if (result.status === 'partial') return ['Há cobranças indeterminadas; lucro e preço não podem ser concluídos.'];
  if (new D(result.operatingProfit!).lt(0)) return ['Prejuízo estimado: o preço não cobre os custos e as despesas informadas.'];
  if (result.margin !== null && new D(result.margin).lt(threshold)) return ['Margem estimada baixa para o limite de alerta configurado.'];
  return [];
}

export function depreciationPerHour(purchasePrice: string, usefulHours: string): string {
  const hours = decimal(usefulHours);
  if (hours.isZero()) throw new Error('Vida útil em horas precisa ser maior que zero.');
  return money(purchasePrice).div(hours).toDecimalPlaces(12).toFixed();
}
