import { calculateManufacturing, calculatePricing } from '../engine';
import { calculationSignature, calculateCostSnapshot, withExperience } from './experience';
import type { ExperienceOutput } from './experience';
import { expenseBreakdown, text } from './model';
import type { CalculatorDraft } from './model';
import type { SavedEntry } from './storage';
export interface EditingContext { productId?: string; parentId?: string }
export function recordsForResult(draft: CalculatorDraft, output: ExperienceOutput, entries: SavedEntry[], context: EditingContext,
  now = new Date().toISOString(), id: () => string = () => crypto.randomUUID()): SavedEntry[] {
  if (draft.ux?.entry === 'example') throw new Error('O exemplo é fictício. Comece um cálculo com seus dados para salvar.');
  const name = text(draft, 'productName').trim(); if (!name) throw new Error('Dê um nome ao produto para salvar este cálculo.');
  if (output.kind === 'blocked-search') throw new Error('A busca não encontrou um preço completo. Salve o produto ou confirme as pendências.');
  if (calculationSignature(draft) !== calculationSignature(output.draft)) throw new Error('As entradas mudaram. Aguarde o recálculo antes de salvar.');
  const productId = context.productId ?? id();
  if (entries.some(entry => entry.id === productId && entry.deletedAt)) throw new Error('Este produto está na lixeira. Restaure ou duplique antes de salvar uma nova revisão.');
  const captured = { ...structuredClone(output.draft), fields: { ...output.draft.fields, productName: name }, ux: { ...withExperience(draft).ux, stage: 'result' as const } };
  const revision = Math.max(0, ...entries.filter(entry => entry.productId === productId).map(entry => entry.revision ?? 1)) + 1;
  return [{ id: productId, kind: 'product', name, updatedAt: now, draft: captured }, {
    id: id(), kind: output.kind === 'cost' ? 'cost-simulation' : 'simulation', name, productId, revision, updatedAt: now, draft: captured,
    ...(context.parentId ? { parentId: context.parentId } : {}),
    ...(output.kind === 'cost' ? { costSnapshot: structuredClone(output.input) } : { snapshot: { input: structuredClone(output.data.input), catalog: structuredClone(output.data.catalog) } }),
  }];
}
export function frozenResult(entry: SavedEntry): ExperienceOutput | null {
  if (entry.costSnapshot) return { kind: 'cost', draft: entry.draft, input: entry.costSnapshot, cost: calculateCostSnapshot(entry.costSnapshot) };
  if (!entry.snapshot) return null;
  const { input, catalog } = entry.snapshot; const result = calculatePricing(input, catalog);
  return { kind: 'sale', draft: entry.draft, data: { input, catalog, result,
    production: calculateManufacturing({ ...input.manufacturing, ...(input.manufacturing.partsPerUnit === undefined ? {} : { partsPerUnit: 1 }) }, input.manufacturing.basis === 'batch' ? input.manufacturing.piecesPerBatch! : 1),
    expenses: expenseBreakdown(entry.draft), solution: null, comparison: [] } };
}
export function groupProducts(entries: SavedEntry[]) {
  const active = entries.filter(entry => !entry.deletedAt); const products = active.filter(entry => entry.kind === 'product');
  const simulations = active.filter(entry => entry.kind === 'simulation' || entry.kind === 'cost-simulation');
  return { products: products.map(product => ({ product, simulations: simulations.filter(entry => entry.productId === product.id) })), ungrouped: simulations.filter(entry => !entry.productId || !products.some(product => product.id === entry.productId)) };
}
