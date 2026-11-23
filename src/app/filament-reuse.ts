import { D } from '../engine/decimal';
import { applyProfile, newCalculationDraft, validateReusableProfile, withExperience } from './experience';
import type { CalculatorDraft } from './model';
import { text } from './model';
import type { SavedEntry } from './storage';

/** Material type alone is insufficient to prove identical spool prices or colors. */
export function normalizeFilamentName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
export function matchingFilamentProfiles(draft: CalculatorDraft, entries: readonly SavedEntry[]): SavedEntry[] {
  const origin = draft.ux?.origin;
  if (!origin || draft.materials.length !== 0 || origin.materials.length !== 1) return [];
  const importedName = normalizeFilamentName(origin.materials[0]!.name);
  if (!importedName || importedName === 'material não identificado') return [];
  return entries.filter(entry => {
    if (entry.kind !== 'filament' || entry.deletedAt) return false;
    if (normalizeFilamentName(text(entry.draft, 'materialName') || entry.name) !== importedName) return false;
    try {
      validateReusableProfile(entry.draft, 'filament');
      const ux = withExperience(entry.draft).ux;
      const amount = ux.filament.mode === 'spool' ? ux.filament.amount : text(entry.draft, 'filament');
      return new D(amount.replace(',', '.')).gt(0);
    } catch { return false; }
  });
}
export function reuseUniqueFilamentProfile(draft: CalculatorDraft, entries: readonly SavedEntry[]): {
  draft: CalculatorDraft; matched: number; applied: string | null;
} {
  const candidates = matchingFilamentProfiles(draft, entries);
  if (candidates.length !== 1) return { draft, matched: candidates.length, applied: null };
  const entry = candidates[0]!;
  return { draft: applyProfile(draft, entry.draft, 'filament', entry.name), matched: 1, applied: entry.name };
}
/** Only retain reusable material costs. Never archive sale prices or shop data inside a filament profile. */
export function filamentProfileDraft(draft: CalculatorDraft): CalculatorDraft {
  validateReusableProfile(draft, 'filament');
  const clean = newCalculationDraft();
  const name = text(draft, 'materialName').trim() || 'Meu filamento';
  return { ...clean, fields: { ...clean.fields, materialName: name, filament: text(draft, 'filament') },
    ux: { ...clean.ux!, filament: structuredClone(withExperience(draft).ux.filament) } };
}
