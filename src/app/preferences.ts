import { localDate, restoreProfile, text } from './model';
import type { CalculatorDraft } from './model';
import { programQuestions, profileSignature } from './ux-v3';
export type Theme = 'system' | 'light' | 'dark';
export function isTheme(value: unknown): value is Theme { return value === 'system' || value === 'light' || value === 'dark'; }
export function applySavedStore(current: CalculatorDraft, saved: CalculatorDraft, updatedAt: string): CalculatorDraft {
  const result = restoreProfile(current, saved, 'marketplace');
  const sameDate = text(saved, 'date') === text(current, 'date') && localDate(new Date(updatedAt)) === text(current, 'date');
  const fields: CalculatorDraft['fields'] = { ...result.fields, orders: current.fields.orders!, shippingConfirmed: current.fields.shippingConfirmed!, acceptValidity: current.fields.acceptValidity!, acceptRounding: current.fields.acceptRounding!, acceptPrecedence: current.fields.acceptPrecedence! };
  for (const { field } of programQuestions) {
    const state = saved.fields[field]!;
    const durable = saved.ux?.persistentPrograms?.includes(field) && state !== 'trial' && !['highlight', 'affiliates'].includes(field);
    fields[field] = sameDate || durable ? state : 'unknown';
  }
  const ux = current.ux ? { ...current.ux, persistentPrograms: saved.ux?.persistentPrograms ?? [], profileOrigins: { ...current.ux.profileOrigins } } : undefined;
  if (ux) {
    delete ux.programDeclaration;
    const p = saved.ux?.programPricing;
    if (p) {
      // Rates are reusable preferences; attribution and actual advanced share are per-order.
      ux.programPricing = { ...p, affiliateAttribution: 'unknown' as const, advanceShare: '' };
    } else delete ux.programPricing;
    if (sameDate && saved.ux?.programDeclaration) ux.programDeclaration = structuredClone(saved.ux.programDeclaration);
    ux.profileOrigins.store = { name: 'Minha loja Shopee', signature: profileSignature({ ...current, fields, ux }, 'store') };
  }
  return { ...current, fields, ...(ux ? { ux } : {}) };
}
