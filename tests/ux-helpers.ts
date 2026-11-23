import { newCalculationDraft } from '../src/app/experience';
import type { CalculatorDraft } from '../src/app/model';

export function realDraft(): CalculatorDraft {
  const draft = newCalculationDraft(new Date(2026, 10, 22));
  Object.assign(draft.fields, { basis: 'batch', productName: 'Produto de teste', grams: '100', pieces: '5', hours: '5', machine: '2', quantity: '2', price: '19.90' });
  draft.ux = { ...draft.ux!, entry: 'manual', machineIncluded: true, filament: { mode: 'spool', amount: '100', netGrams: '1000' } }; delete draft.ux.packagingDecision; return draft;
}
export function cpfDraft(): CalculatorDraft {
  const draft = realDraft(); Object.assign(draft.fields, { marketplace: 'shopee', seller: 'CPF', returns: 'inactive', highlight: 'inactive', ads: 'inactive', affiliates: 'inactive', advance: 'inactive', acceptValidity: true, acceptRounding: true, acceptPrecedence: true });
  draft.ux = { ...draft.ux!, intent: 'sale', shipping: 'no', volume: { answer: 'below', threshold: 450, date: '2026-11-22' } }; return draft;
}
