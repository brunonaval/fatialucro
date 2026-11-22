import { breakEvenPrice, calculateManufacturing, calculatePricing, comparePrices, solvePrice } from '../engine';
import type { PriceSolution } from '../engine';
import { buildScenario, expenseBreakdown, numeric, text } from './model';
import type { CalculatorDraft } from './model';
import { parseBrazilianMoney } from '../engine/decimal';

export function calculateWorkspace(draft: CalculatorDraft) {
  const { input, catalogAt } = buildScenario(draft);
  const catalog = catalogAt(input.unitPrice); const result = calculatePricing(input, catalog);
  const operation = text(draft, 'calculation');
  let solution: PriceSolution | null = null;
  let comparison: ReturnType<typeof comparePrices> = [];
  if (['profit', 'margin', 'equilibrium'].includes(operation)) {
    const range = { min: parseBrazilianMoney(text(draft, 'minPrice')), max: parseBrazilianMoney(text(draft, 'maxPrice')) };
    solution = operation === 'equilibrium' ? breakEvenPrice(input, catalogAt, range) : solvePrice(input, catalogAt,
      operation === 'margin' ? { kind: 'margin', ratio: numeric(text(draft, 'targetMargin'), 'Margem desejada') } : { kind: 'profit', amount: parseBrazilianMoney(text(draft, 'targetProfit')) }, range);
  } else if (operation === 'compare') comparison = comparePrices(input, catalogAt, text(draft, 'comparison').split(';').map(value => parseBrazilianMoney(value.trim())));
  else if (operation !== 'direct') throw new Error('Operação inválida.');
  const production = calculateManufacturing(input.manufacturing, input.manufacturing.basis === 'batch' ? input.manufacturing.piecesPerBatch! : 1);
  return { input, catalog, result, production, expenses: expenseBreakdown(draft), solution, comparison };
}
export type CalculationOutput = ReturnType<typeof calculateWorkspace>;
