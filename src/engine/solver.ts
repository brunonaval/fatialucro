import { D, date, decimal, money, quantity } from './decimal';
import { calculatePricing } from './pricing';
import type { AssessedAssumption, Pending, PricingResult, SaleInput, TariffCatalog } from './types';

export type PriceTarget = { kind: 'profit'; amount: string } | { kind: 'margin'; ratio: string };
export type PriceSolution =
  | { status: 'found'; unitPrice: string; result: PricingResult; examined: number; confidence: PricingResult['confidence']; assumptions: AssessedAssumption[] }
  | { status: 'not-found'; examined: number; confidence: PricingResult['confidence']; assumptions: AssessedAssumption[] }
  | { status: 'partial'; examined: number; pending: Pending[] };

/** Exhaustive cent search: correct even with discontinuous tiers and rounding dips.
 * Does not cross an unknown region and claim that a later result is a minimum.
 * Bounded at 100000 candidates; no unproven monotonicity or closed-form shortcut.
 */
export function solvePrice(
  input: Omit<SaleInput, 'unitPrice'>,
  catalogAt: (unitPrice: string) => TariffCatalog,
  target: PriceTarget,
  range = { min: '0.01', max: '1000.00' },
): PriceSolution {
  date(input.date);
  quantity(input.quantity);
  const discount = money(input.sellerDiscount);
  const low = money(range.min).mul(100);
  const high = money(range.max).mul(100);
  if (high.lt(low) || high.minus(low).gte(100_000)) throw new Error('Busca exige intervalo ordenado de até 100000 preços em centavos.');
  const goal = target.kind === 'profit' ? money(target.amount) : decimal(target.ratio);
  if (target.kind === 'margin' && goal.gte(1)) throw new Error('Margem desejada deve ser menor que 1 (100%).');
  let examined = 0;
  const assumptions = new Map<string, AssessedAssumption>();
  for (let cents = low; cents.lte(high); cents = cents.plus(1)) {
    const price = cents.div(100).toFixed(2);
    // A fixed seller-funded discount makes smaller gross prices inadmissible.
    if (new D(price).mul(input.quantity).lt(discount)) continue;
    const result = calculatePricing({ ...input, unitPrice: price }, catalogAt(price));
    examined++;
    if (result.status === 'partial') return { status: 'partial', examined, pending: result.pending };
    for (const assumption of result.assumptions) assumptions.set(`${assumption.id}:${assumption.message}`, assumption);
    const passes = target.kind === 'profit'
      ? new D(result.operatingProfit!).gte(goal)
      : !new D(result.salesAfterDiscount).isZero() && new D(result.operatingProfit!).gte(new D(result.salesAfterDiscount).mul(goal));
    if (passes) return { status: 'found', unitPrice: price, result, examined,
      confidence: assumptions.size ? 'provisional' : 'documented', assumptions: [...assumptions.values()] };
  }
  return { status: 'not-found', examined, confidence: assumptions.size ? 'provisional' : 'documented', assumptions: [...assumptions.values()] };
}
