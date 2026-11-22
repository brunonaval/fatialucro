import { cash, D, date, money, quantity } from './decimal';
import { calculateManufacturing } from './manufacturing';
import { calculateFees } from './rules';
import type { PricingResult, SaleInput, TariffCatalog } from './types';

export function calculatePricing(input: SaleInput, catalog: TariffCatalog): PricingResult {
  date(input.date);
  quantity(input.quantity);
  const gross = money(input.unitPrice, 'preço unitário').mul(input.quantity);
  const discount = money(input.sellerDiscount, 'desconto do vendedor');
  if (discount.gt(gross)) throw new Error('Desconto não pode superar a receita bruta.');
  const net = gross.minus(discount);
  const manufacturing = calculateManufacturing(input.manufacturing, input.quantity);
  const packaging = money(input.packagingPerUnit).mul(input.quantity).plus(money(input.packagingPerOrder));
  const shipping = money(input.sellerShipping, 'frete líquido efetivamente suportado pelo vendedor');
  const other = money(input.otherOperatingCosts, 'outros custos operacionais');
  const costs = new D(manufacturing.total).plus(packaging).plus(other);
  const { fees, pending, excluded } = calculateFees(input, catalog, gross, net);
  const knownFees = fees.reduce((sum, line) => sum.plus(line.amount), new D(0));
  const complete = pending.length === 0;
  const marketplaceNet = net.minus(knownFees).minus(shipping);
  const profit = marketplaceNet.minus(costs);
  return {
    status: complete ? 'complete' : 'partial',
    catalog: { marketplace: catalog.marketplace, version: catalog.version, purpose: catalog.purpose },
    rounding: 'HALF_UP_PER_OCCURRENCE',
    grossSales: cash(gross), sellerDiscount: cash(discount), salesAfterDiscount: cash(net),
    manufacturing, packaging: cash(packaging), operatingCosts: cash(costs),
    sellerShipping: cash(shipping), otherOperatingCosts: cash(other), fees, excluded,
    knownMarketplaceFees: cash(knownFees), pending,
    warnings: ['Lucro operacional estimado antes de tributos não informados. Markup usa custos operacionais; margem usa receita após desconto do vendedor.',
      ...(fees.some(line => line.rule.evidence.verification !== 'custom') ? ['Arredondamento HALF_UP é convenção de simulação; não comprova a política do marketplace.'] : [])],
    marketplaceNet: complete ? cash(marketplaceNet) : null,
    operatingProfit: complete ? cash(profit) : null,
    margin: complete && !net.isZero() ? profit.div(net).toFixed(12) : null,
    markup: complete && !costs.isZero() ? profit.div(costs).toFixed(12) : null,
  };
}
