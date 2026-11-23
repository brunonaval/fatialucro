import { calculateWorkspace } from './calculate';
import { text } from './model';
import type { CalculatorDraft } from './model';
import { selectTable } from '../marketplaces/catalogs/select';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { acceptHypotheses, scenarioPrograms } from './ux-v3';

export interface ReferencePricePreview {
  lower: string;
  upper: string;
  returnsUnconfirmed: boolean;
  searchStart: string;
}

/**
 * An *illustration* using known documentary tariffs, never an accepted,
 * payable, guaranteed or stored financial result. It runs only for scenarios
 * with quantifiable fees. Unknown optional programs, shipping or other real
 * costs are not silently assumed to be zero.
 *
 * For unknown Devolução Fácil, both inactive and billable cases are evaluated
 * independently, producing an explicit conditional interval.
 */
export function referencePricePreview(draft: CalculatorDraft, tables: readonly ShopeeTable[]): ReferencePricePreview | null {
  if (text(draft, 'marketplace') !== 'shopee' ||
      !['profit', 'margin', 'equilibrium'].includes(text(draft, 'calculation')) ||
      !['CPF', 'CNPJ'].includes(text(draft, 'seller')) ||
      !draft.ux || draft.ux.shipping === 'unknown' ||
      draft.ux.packagingDecision === 'unknown') return null;

  const fields = scenarioPrograms(draft);
  if (['highlight', 'ads', 'affiliates', 'advance'].some(key => fields[key] === 'unknown')) return null;
  if (text(draft, 'seller') === 'CPF') {
    const count = text(draft, 'orders');
    const exactCount = /^\d+$/.test(count) && Number.isSafeInteger(Number(count));
    const volume = draft.ux.volume;
    if (!exactCount && (volume.answer === 'unknown' || volume.date !== text(draft, 'date'))) return null;
  }

  let table: ShopeeTable | undefined;
  try { table = selectTable(text(draft, 'date'), tables)?.table; } catch { return null; }
  if (!table) return null;
  const review = ['validity', 'rounding', ...(text(draft, 'seller') === 'CPF' && table.cpf.fixedConflict ? ['precedence'] : [])] as ('validity' | 'rounding' | 'precedence')[];
  const unknownReturns = fields.returns === 'unknown';
  const statuses = unknownReturns ? ['inactive', 'billable'] as const : [fields.returns] as const;
  if (statuses.some(value => !['inactive', 'trial', 'billable'].includes(String(value)))) return null;

  const prices: string[] = [];
  let minimumStart: string | null = null;
  try {
    for (const status of statuses) {
      const illustration = structuredClone(draft);
      illustration.fields.returns = status;
      // Only this in-memory illustration uses the tariff hypotheses. The
      // original user draft, flags, acknowledgements and stored data stay intact.
      const prepared = acceptHypotheses(illustration, table.id, review);
      prepared.fields.price = text(prepared, 'maxPrice');
      const calculation = calculateWorkspace(prepared, tables);
      const solution = calculation.solution;
      if (!solution || solution.status !== 'found' || solution.result.status !== 'complete') return null;
      prices.push(solution.unitPrice);
      minimumStart = calculation.searchRange?.min ?? null;
    }
    const sorted = prices.sort((a, b) => Number(a) - Number(b));
    if (!sorted[0] || !sorted.at(-1) || !minimumStart) return null;
    return { lower: sorted[0], upper: sorted.at(-1)!, returnsUnconfirmed: unknownReturns, searchStart: minimumStart };
  } catch {
    return null; // An unresolved monetary input or rule never yields an invented price.
  }
}
