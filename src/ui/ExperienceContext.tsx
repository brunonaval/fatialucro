import { createContext, useContext } from 'react';
import type { CalculatorDraft } from '../app/model';
import type { ExperienceState } from '../app/experience-types';
export const ExperienceContext = createContext<{ draft: CalculatorDraft; update: (draft: CalculatorDraft) => void } | null>(null);
export function useExperience() {
  const value = useContext(ExperienceContext); if (!value || !value.draft.ux) throw new Error('Contexto do cálculo indisponível.');
  const { draft, update } = value; const ux = draft.ux!;
  return { draft, ux, update, patch: (changes: Partial<ExperienceState>) => update({ ...draft, ux: { ...ux, ...changes } }) };
}
