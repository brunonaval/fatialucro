import { D, decimal, money } from '../engine/decimal';
import { applyProfile, newCalculationDraft, spoolRates, withExperience } from './experience';
import { numeric, text } from './model';
import type { CalculatorDraft } from './model';
import type { SavedEntry } from './storage';
import { applySavedStore } from './preferences';

export function validateProfile(draft: CalculatorDraft, kind: 'printer' | 'filament') {
  const ux = withExperience(draft).ux;
  if (kind === 'filament') {
    if (ux.filament.mode === 'spool') spoolRates(ux.filament.amount, ux.filament.netGrams);
    else money(numeric(text(draft, 'filament'), 'Preço por kg'));
  } else if (ux.machineIncluded) {
    if (draft.fields.machineMode === 'all-in') decimal(numeric(text(draft, 'machine'), 'Custo completo por hora'));
    else { decimal(numeric(text(draft, 'watts'), 'Potência')); decimal(numeric(text(draft, 'kwh'), 'Preço da energia')); if (ux.wearIncluded) { decimal(numeric(text(draft, 'maintenance'), 'Manutenção')); decimal(numeric(text(draft, 'depreciation'), 'Depreciação')); } }
  }
}
export function workshopDefaults(draft: CalculatorDraft, entries: SavedEntry[]): CalculatorDraft {
  let result = draft;
  for (const [id, kind] of [['workshop-printer', 'printer'], ['workshop-filament', 'filament']] as const) {
    const profile = entries.find(entry => entry.id === id && !entry.deletedAt);
    if (profile) result = applyProfile(result, profile.draft, kind);
  }
  const recurring = entries.find(entry => entry.id === 'workshop-production' && !entry.deletedAt);
  if (recurring) result = applyRecurringCosts(result, recurring.draft);
  const store = entries.find(entry => entry.id === 'store-shopee' && !entry.deletedAt);
  if (store) result = applySavedStore(result, store.draft, store.updatedAt);
  // Production presets may contain old job dimensions. New jobs always keep their own inputs.
  return { ...result, fields: { ...result.fields, productName: text(draft, 'productName'), grams: text(draft, 'grams'), hours: text(draft, 'hours'), pieces: text(draft, 'pieces'), quantity: text(draft, 'quantity'), price: text(draft, 'price'), basis: text(draft, 'basis') }, materials: draft.materials };
}
export function applyRecurringCosts(current: CalculatorDraft, saved: CalculatorDraft): CalculatorDraft {
  const ux = withExperience(current).ux; const options = withExperience(saved).ux;
  return { ...current, fields: { ...current.fields, ...Object.fromEntries(['laborMinutes', 'laborHour', 'packagingUnit', 'packagingOrder', 'consumables', 'failure'].map(key => [key, saved.fields[key]!])) }, ux: { ...ux, labor: options.labor, packagingIncluded: options.packagingIncluded, packaging: structuredClone(options.packaging), extrasIncluded: options.extrasIncluded } };
}
export function workshopRecords(draft: CalculatorDraft, now = new Date().toISOString()): SavedEntry[] {
  const records: SavedEntry[] = []; const profileDraft = withExperience(draft);
  for (const kind of ['printer', 'filament'] as const) {
    try { validateProfile(profileDraft, kind); records.push({ id: `workshop-${kind}`, kind, name: text(draft, kind === 'printer' ? 'printerName' : 'materialName') || (kind === 'printer' ? 'Impressora da oficina' : 'Filamento da oficina'), updatedAt: now, draft: profileDraft }); } catch { /* Incomplete optional steps stay in the resumable wizard, not applied defaults. */ }
  }
  if (draft.fields.marketplace === 'shopee' && ['CPF', 'CNPJ'].includes(text(draft, 'seller'))) records.push({ id: 'store-shopee', kind: 'marketplace', name: 'Minha loja Shopee', updatedAt: now, draft: profileDraft });
  // Persist only explicitly selected recurring costs. Job dimensions remain blank in the preset.
  const ux = profileDraft.ux;
  if (ux.labor !== 'excluded' || ux.packagingIncluded || ux.extrasIncluded) {
    const base = newCalculationDraft(); const costs = ['laborMinutes', 'laborHour', 'packagingUnit', 'packagingOrder', 'consumables', 'failure'];
    records.push({ id: 'workshop-production', kind: 'production', name: 'Custos opcionais da oficina', updatedAt: now,
      draft: { ...base, fields: { ...base.fields, ...Object.fromEntries(costs.map(key => [key, draft.fields[key]!])) }, ux: { ...base.ux!, labor: ux.labor, packagingIncluded: ux.packagingIncluded, packaging: ux.packaging, extrasIncluded: ux.extrasIncluded } } });
  }
  return records;
}
export function physicalUnits(draft: CalculatorDraft) {
  const units = text(draft, 'quantity'); const parts = draft.ux?.saleUnit === 'kit' ? draft.ux.partsPerKit : '1';
  return /^\d+$/.test(units) && /^\d+$/.test(parts) ? new D(units).mul(parts).toFixed() : null;
}
