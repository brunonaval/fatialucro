import { breakEvenPrice, calculateManufacturing, calculatePricing, comparePrices, solvePrice } from '../engine';
import type { PriceSolution } from '../engine';
import { buildScenario, expenseBreakdown, numeric, text } from './model';
import { parseBrazilianMoney } from '../engine/decimal';
import type { CalculatorDraft } from './model';
import { appliedSearchRange } from './search-range';
import { bundledTables } from '../marketplaces/catalogs/bundled';
import type { ShopeeTable } from '../marketplaces/catalogs/types';

export function calculateWorkspace(draft: CalculatorDraft, tables: readonly ShopeeTable[] = bundledTables) {
  const { input, catalogAt } = buildScenario(draft, tables);
  const catalog = catalogAt(input.unitPrice); const result = calculatePricing(input, catalog);
  const operation = text(draft, 'calculation');
  let solution: PriceSolution | null = null;
  let comparison: ReturnType<typeof comparePrices> = [];
  const searchRange = ['profit', 'margin', 'equilibrium'].includes(operation)
    ? appliedSearchRange(draft, tables) : null;
  if (searchRange) {
    const range = { min: searchRange.min, max: searchRange.max };
    solution = operation === 'equilibrium' ? breakEvenPrice(input, catalogAt, range) : solvePrice(input, catalogAt,
      operation === 'margin' ? { kind: 'margin', ratio: numeric(text(draft, 'targetMargin'), 'Margem desejada') } : { kind: 'profit', amount: parseBrazilianMoney(text(draft, 'targetProfit')) }, range);
  } else if (operation === 'compare') comparison = comparePrices(input, catalogAt, text(draft, 'comparison').split(';').map(value => parseBrazilianMoney(value.trim())));
  else if (operation !== 'direct') throw new Error('Operação inválida.');
  const production = calculateManufacturing({ ...input.manufacturing, ...(input.manufacturing.partsPerUnit === undefined ? {} : { partsPerUnit: 1 }) }, input.manufacturing.basis === 'batch' ? input.manufacturing.piecesPerBatch! : 1);
  return { input, catalog, result, production, expenses: expenseBreakdown(draft), solution, comparison, searchRange };
}
export type CalculationOutput = ReturnType<typeof calculateWorkspace>;
