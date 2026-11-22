import { localDate, restoreProfile, text } from './model';
import type { CalculatorDraft } from './model';
export type Theme = 'system' | 'light' | 'dark';
export function isTheme(value: unknown): value is Theme { return value === 'system' || value === 'light' || value === 'dark'; }
export function applySavedStore(current: CalculatorDraft, saved: CalculatorDraft, updatedAt: string): CalculatorDraft {
  const result = restoreProfile(current, saved, 'marketplace');
  return { ...result, fields: { ...result.fields,
    shippingConfirmed: false,
    // Moving 90-day volume and shipping are scenario data, never permanent facts.
    orders: localDate(new Date(updatedAt)) === text(current, 'date') ? text(saved, 'orders') : '',
  } };
}
