import { D, money, parseBrazilianMoney } from '../engine/decimal';
import { selectTable } from '../marketplaces/catalogs/select';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import type { CalculatorDraft } from './model';
import { text } from './model';

export interface AppliedSearchRange {
  min: string;
  max: string;
  automaticFloor: string | null;
}

/**
 * Price search is intentionally exhaustive and must not cross undocumented
 * regions. The brand-new wizard supplies 0,01 as a generic starting point;
 * CPF sales cannot use it when the low-price regressive charge is unknown.
 * Move ONLY that unmodified generic default to the documented regular band,
 * while reporting the range explicitly. User-specified lows are never replaced.
 */
export function appliedSearchRange(draft: CalculatorDraft, tables: readonly ShopeeTable[]): AppliedSearchRange {
  const min = money(parseBrazilianMoney(text(draft, 'minPrice')));
  const max = money(parseBrazilianMoney(text(draft, 'maxPrice')));
  const regular = text(draft, 'marketplace') === 'shopee' && text(draft, 'seller') === 'CPF'
    ? selectTable(text(draft, 'date'), tables)?.table.cpf.regressiveBelow ?? null : null;
  if (!regular || text(draft, 'minPrice') !== '0,01' && text(draft, 'minPrice') !== '0.01') {
    return { min: min.toFixed(2), max: max.toFixed(2), automaticFloor: null };
  }
  const cutoff = new D(regular);
  if (min.lt(cutoff) && max.gte(cutoff)) {
    return { min: cutoff.toFixed(2), max: max.toFixed(2), automaticFloor: cutoff.toFixed(2) };
  }
  return { min: min.toFixed(2), max: max.toFixed(2), automaticFloor: null };
}
