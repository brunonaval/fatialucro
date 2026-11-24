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
import { profileSignature } from './ux-v3';
import { referencePricePreview } from './reference-price-preview';
import type { ReferencePricePreview } from './reference-price-preview';

export const initialExperience = (): ExperienceState => ({ version: 2, entry: 'none', intent: 'cost', mode: 'simple', stage: 'print', filament: { mode: 'spool', amount: '', netGrams: '' }, packaging: { mode: 'unit', amount: '', units: '' }, machineIncluded: true, wearIncluded: false, labor: 'excluded', packagingIncluded: false, extrasIncluded: false, saleUnit: 'piece', partsPerKit: '', discountIncluded: false, otherCostsIncluded: false, directShippingIncluded: false, shipping: 'unknown', volume: { answer: 'unknown', threshold: null, date: '' } });
export function newCalculationDraft(now = new Date()): CalculatorDraft {
  const draft = defaultDraft(now);
  for (const key of ['price', 'quantity', 'pieces', 'grams', 'filament', 'hours', 'machine', 'watts', 'kwh', 'materialName', 'printerName', 'targetProfit', 'targetMargin', 'comparison', 'printerLife', 'printerPurchase', 'laborMinutes', 'laborHour', 'maintenance', 'depreciation', 'consumables', 'failure', 'packagingUnit', 'packagingOrder']) draft.fields[key] = '';
  draft.fields.basis = 'unit';
  return { ...draft, ux: { ...initialExperience(), machineIncluded: false, packagingDecision: 'unknown' } };
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
  const ux = draft.ux ?? { ...initialExperience(), entry: 'manual' as const, intent: 'sale' as const, filament: { mode: 'kg' as const, amount: '', netGrams: '' }, wearIncluded: true, labor: 'paid' as const, packagingIncluded: true, extrasIncluded: true, shipping };
  return { ...draft, ux: ux.intent === 'cost' && ux.stage === 'sale' ? { ...ux, stage: 'costs' } : ux };
}
export function applyImportedPlate(draft: CalculatorDraft, data: PrintImport, plate: ImportedPlate): CalculatorDraft {
  const updated = applyPlate(draft, plate); const ux = withExperience(draft).ux;
  const material = [...new Set(plate.materials.map(item => item.name))].join('; ') || null;
  // A newly imported material cannot inherit the previous spool's provenance.
  // Reuse only after checking a saved profile against this particular plate.
  const profileOrigins = { ...ux.profileOrigins }; delete profileOrigins.filament;
  return { ...updated, ux: { ...ux, profileOrigins, entry: 'import', stage: 'print', filament: { mode: 'spool', amount: '', netGrams: '' }, origin: { fileName: data.fileName, printer: data.printer, material, plateId: plate.id, plateName: plate.name, plateCount: data.plates.length, grams: plate.grams, seconds: plate.seconds, pieces: plate.pieces, warnings: data.warnings, materials: plate.materials } } };
}
export function validateReusableProfile(draft: CalculatorDraft, kind: 'filament' | 'printer') {
  const ux = withExperience(draft).ux;
  if (kind === 'filament') {
    if (ux.filament.mode === 'spool') spoolRates(ux.filament.amount, ux.filament.netGrams);
    else money(numeric(text(draft, 'filament'), 'Preço por kg'));
  } else {
    if (!ux.machineIncluded) throw new Error('Para salvar ou aplicar uma impressora, informe seu custo por hora ou seus componentes. Você pode continuar calculando sem perfil.');
    if (draft.fields.machineMode === 'all-in') decimal(numeric(text(draft, 'machine'), 'Custo completo por hora'));
    else { decimal(numeric(text(draft, 'watts'), 'Potência')); decimal(numeric(text(draft, 'kwh'), 'Preço da energia')); if (ux.wearIncluded) { decimal(numeric(text(draft, 'maintenance'), 'Manutenção')); decimal(numeric(text(draft, 'depreciation'), 'Depreciação')); } }
  }
}
export function applyProfile(draft: CalculatorDraft, saved: CalculatorDraft, kind: 'filament' | 'printer' | 'production' | 'marketplace', name?: string): CalculatorDraft {
  if (kind === 'filament' || kind === 'printer') validateReusableProfile(saved, kind);
  const result = restoreProfile(draft, saved, kind); const ux = withExperience(draft).ux;
  const profile = withExperience(saved).ux;
  const updated = { ...result, ux: { ...ux, ...(kind === 'filament' || kind === 'production' ? { filament: structuredClone(profile.filament) } : {}), ...(kind === 'printer' || kind === 'production' ? { machineIncluded: profile.machineIncluded, wearIncluded: profile.wearIncluded } : {}), ...(kind === 'production' ? { packaging: structuredClone(profile.packaging), packagingIncluded: profile.packagingIncluded, ...(profile.packagingDecision ? { packagingDecision: profile.packagingDecision } : {}), labor: profile.labor, extrasIncluded: profile.extrasIncluded } : {}) } };
  if (kind === 'filament' || kind === 'printer') updated.ux.profileOrigins = { ...ux.profileOrigins, [kind]: { name: name ?? (text(saved, kind === 'filament' ? 'materialName' : 'printerName') || 'Perfil salvo'), signature: profileSignature(updated, kind) } };
  return updated;
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
export type ExperienceOutput = { kind: 'cost'; draft: CalculatorDraft; input: CostSnapshot; cost: ReturnType<typeof calculateCostSnapshot> } | { kind: 'sale' | 'blocked-search'; draft: CalculatorDraft; data: CalculationOutput; referencePreview?: ReferencePricePreview };
export function calculateExperience(draft: CalculatorDraft, tables: readonly ShopeeTable[] = bundledTables): ExperienceOutput {
  validateDraft(draft); const normalized = withExperience(structuredClone(draft));
  if (normalized.ux.entry === 'none') throw new Error('Importe uma impressão ou escolha o preenchimento manual.');
  if (normalized.ux.intent === 'cost') {
    const input = buildCostSnapshot(normalized);
    return { kind: 'cost', draft: normalized, input, cost: calculateCostSnapshot(input) };
  }
  const searching = ['profit', 'margin', 'equilibrium'].includes(text(normalized, 'calculation'));
  // These advanced fields are optional. Blank restores the documented default
  // in the calculation copy, never in the editable user draft.
  if (searching) {
    if (!text(normalized, 'minPrice').trim()) normalized.fields.minPrice = '0.01';
    if (!text(normalized, 'maxPrice').trim()) normalized.fields.maxPrice = '100.00';
  }
  const prepared = searching ? { ...normalized, fields: { ...normalized.fields, price: text(normalized, 'maxPrice') } } : normalized;
  const data = calculateWorkspace(prepared, tables);
  if (searching && data.solution?.status !== 'found') {
    const illustration = referencePricePreview(normalized, tables);
    return { kind: 'blocked-search', draft: normalized, data, ...(illustration ? { referencePreview: illustration } : {}) };
  }
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
  const directReference = text(normalized, 'calculation') === 'direct' && data.result.status === 'partial' ? referencePricePreview(normalized, tables) : null;
  return { kind: 'sale', draft: normalized, data, ...(directReference ? { referencePreview: directReference } : {}) };
}
export function calculationSignature(draft: CalculatorDraft): string {
  const ux = draft.ux;
  const searching = ['profit', 'margin', 'equilibrium'].includes(text(draft, 'calculation'));
  return JSON.stringify({ fields: { ...draft.fields, productName: undefined, ...(searching ? { price: undefined } : {}) }, materials: draft.materials, ...(ux ? { ux: { ...ux, stage: undefined, mode: undefined } } : {}) });
}
