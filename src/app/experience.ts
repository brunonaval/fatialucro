import { calculateManufacturing, calculatePackaging, calculatePricing } from '../engine';
import { D, decimal, money } from '../engine/decimal';
import type { ManufacturingInput } from '../engine';
import { calculateWorkspace } from './calculate';
import type { CalculationOutput } from './calculate';
import { buildManufacturing, buildScenario, defaultDraft, numeric, packagingInput, text, validateDraft } from './model';
import type { CalculatorDraft } from './model';
import type { ExperienceState } from './experience-types';
import { bundledTables } from '../marketplaces/catalogs/bundled';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import type { ImportedPlate, PrintImport } from '../importers';
import { applyPlate, restoreProfile } from './model';

export const initialExperience = (): ExperienceState => ({ version: 2, entry: 'none', intent: 'cost', mode: 'simple', stage: 'print', filament: { mode: 'spool', amount: '', netGrams: '' }, packaging: { mode: 'unit', amount: '', units: '' }, machineIncluded: true, wearIncluded: false, labor: 'excluded', packagingIncluded: false, extrasIncluded: false, saleUnit: 'piece', partsPerKit: '', shipping: 'unknown', volume: { answer: 'unknown', threshold: null, date: '' } });
export function newCalculationDraft(now = new Date()): CalculatorDraft {
  const draft = defaultDraft(now);
  for (const key of ['price', 'quantity', 'pieces', 'grams', 'filament', 'hours', 'machine', 'watts', 'kwh', 'materialName', 'printerName', 'targetProfit', 'targetMargin', 'comparison', 'printerLife', 'printerPurchase', 'laborMinutes', 'laborHour', 'maintenance', 'depreciation', 'consumables', 'failure', 'packagingUnit', 'packagingOrder']) draft.fields[key] = '';
  return { ...draft, ux: initialExperience() };
}
export function exampleDraft(): CalculatorDraft {
  const draft = defaultDraft();
  return { ...draft, ux: { ...initialExperience(), entry: 'example', intent: 'sale', stage: 'result', filament: { mode: 'kg', amount: '', netGrams: '' } }, fields: { ...draft.fields, productName: 'Suporte de mesa — exemplo fictício' } };
}
export function withExperience(draft: CalculatorDraft): CalculatorDraft & { ux: ExperienceState } {
  let shipping: ExperienceState['shipping'] = 'unknown';
  if (draft.fields.shippingConfirmed === true) {
    try { shipping = new D(numeric(text(draft, 'shipping'), 'Frete')).isZero() ? 'no' : 'yes'; } catch { /* An incomplete legacy draft must remain editable. */ }
  }
  return { ...draft, ux: draft.ux ?? { ...initialExperience(), entry: 'manual', intent: 'sale', filament: { mode: 'kg', amount: '', netGrams: '' }, wearIncluded: true, labor: 'paid', packagingIncluded: true, extrasIncluded: true, shipping } };
}
export function applyImportedPlate(draft: CalculatorDraft, data: PrintImport, plate: ImportedPlate): CalculatorDraft {
  const updated = applyPlate(draft, plate); const ux = withExperience(draft).ux;
  return { ...updated, ux: { ...ux, entry: 'import', stage: 'print', filament: { mode: 'spool', amount: '', netGrams: '' }, origin: { fileName: data.fileName, printer: data.printer, material: data.material, plateId: plate.id, plateName: plate.name, plateCount: data.plates.length, grams: plate.grams, seconds: plate.seconds, pieces: plate.pieces, warnings: data.warnings, materials: plate.materials } } };
}
export function applyProfile(draft: CalculatorDraft, saved: CalculatorDraft, kind: 'filament' | 'printer' | 'production' | 'marketplace'): CalculatorDraft {
  const result = restoreProfile(draft, saved, kind); const ux = withExperience(draft).ux;
  const profile = withExperience(saved).ux;
  return { ...result, ux: { ...ux, ...(kind === 'filament' || kind === 'production' ? { filament: structuredClone(profile.filament) } : {}), ...(kind === 'printer' || kind === 'production' ? { machineIncluded: profile.machineIncluded, wearIncluded: profile.wearIncluded } : {}), ...(kind === 'production' ? { packaging: structuredClone(profile.packaging), packagingIncluded: profile.packagingIncluded, labor: profile.labor, extrasIncluded: profile.extrasIncluded } : {}) } };
}
export function spoolRates(amount: string, netGrams: string) {
  const paid = money(amount.replace(',', '.')); const grams = decimal(numeric(netGrams, 'Peso líquido'));
  if (!grams.isFinite() || grams.lte(0)) throw new Error('Informe o peso líquido real da bobina, maior que zero.');
  return { perGram: paid.div(grams).toDecimalPlaces(12).toFixed(), perKg: paid.mul(1000).div(grams).toDecimalPlaces(12).toFixed() };
}
export interface CostSnapshot { manufacturing: ManufacturingInput; quantity: number; packagingPerUnit: string; packagingPerOrder: string; packagingPurchase?: { amount: string; units: number } }
export function buildCostSnapshot(draft: CalculatorDraft): CostSnapshot {
  const manufacturing = { ...buildManufacturing(draft), partsPerUnit: 1 };
  return { manufacturing, quantity: manufacturing.basis === 'batch' ? manufacturing.piecesPerBatch! : 1, ...packagingInput(draft) };
}
export function calculateCostSnapshot(input: CostSnapshot) {
  const manufacturing = calculateManufacturing(input.manufacturing, input.quantity);
  const packaging = calculatePackaging(input); return { manufacturing, packaging, total: new D(manufacturing.total).plus(packaging).toFixed(2) };
}
export type ExperienceOutput = { kind: 'cost'; draft: CalculatorDraft; input: CostSnapshot; cost: ReturnType<typeof calculateCostSnapshot> } | { kind: 'sale' | 'blocked-search'; draft: CalculatorDraft; data: CalculationOutput };
export function calculateExperience(draft: CalculatorDraft, tables: readonly ShopeeTable[] = bundledTables): ExperienceOutput {
  validateDraft(draft); const normalized = withExperience(structuredClone(draft));
  if (normalized.ux.entry === 'none') throw new Error('Importe uma impressão ou escolha o preenchimento manual.');
  if (normalized.ux.intent === 'cost') {
    const input = buildCostSnapshot(normalized);
    return { kind: 'cost', draft: normalized, input, cost: calculateCostSnapshot(input) };
  }
  const searching = ['profit', 'margin', 'equilibrium'].includes(text(normalized, 'calculation'));
  const prepared = searching ? { ...normalized, fields: { ...normalized.fields, price: text(normalized, 'maxPrice') } } : normalized;
  const data = calculateWorkspace(prepared, tables);
  if (searching && data.solution?.status !== 'found') return { kind: 'blocked-search', draft: normalized, data };
  if (data.solution?.status === 'found') {
    const unitPrice = data.solution.unitPrice;
    const updated = { ...normalized, fields: { ...normalized.fields, price: unitPrice } };
    // Preserve all search assumptions, while the snapshot keeps the exact final tariff rules.
    const { catalogAt } = buildScenario(updated, tables); const selected = catalogAt(unitPrice);
    const assumptions = [...(selected.assumptions ?? [])];
    for (const item of data.solution.assumptions) if (!assumptions.some(old => old.id === item.id && old.message === item.message)) assumptions.push({ id: item.id, kind: item.kind, message: item.message });
    const catalog = { ...selected, assumptions }; const result = calculatePricing({ ...data.input, unitPrice }, catalog);
    return { kind: 'sale', draft: updated, data: { ...data, input: { ...data.input, unitPrice }, catalog, result } };
  }
  return { kind: 'sale', draft: normalized, data };
}
export function calculationSignature(draft: CalculatorDraft): string {
  const ux = draft.ux;
  const searching = ['profit', 'margin', 'equilibrium'].includes(text(draft, 'calculation'));
  return JSON.stringify({ fields: { ...draft.fields, productName: undefined, ...(searching ? { price: undefined } : {}) }, materials: draft.materials, ...(ux ? { ux: { ...ux, stage: undefined, mode: undefined } } : {}) });
}
