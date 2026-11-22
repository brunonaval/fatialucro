import { date } from './decimal';
import type { FeeRule, SimpleFormula, TariffCatalog } from './types';

export interface ManualFee {
  formula: SimpleFormula;
  base: FeeRule['base'];
  scope: FeeRule['scope'];
  reference: string;
  effectiveFrom: string;
  effectiveUntil: string;
}

/** Replaces only named charges, keeping obligation, conditions and containment.
 * Never clears missing enrolment, profile, shipping or document-window checks.
 */
export function applyManualFees(catalog: TariffCatalog, overrides: Readonly<Record<string, ManualFee>>): TariffCatalog {
  for (const [id, manual] of Object.entries(overrides)) {
    if (!catalog.rules.some(rule => rule.id === id)) throw new Error(`Cobrança personalizada desconhecida ou inaplicável: ${id}.`);
    if (!manual.reference.trim()) throw new Error(`Informe a origem dos parâmetros personalizados de ${id}.`);
    date(manual.effectiveFrom); date(manual.effectiveUntil);
    if (manual.effectiveUntil < manual.effectiveFrom) throw new Error('Período personalizado invertido.');
    if (!['item', 'order'].includes(manual.scope) || !['gross-sales', 'after-seller-discount'].includes(manual.base)) throw new Error('Base ou incidência personalizada inválida.');
    // Fixed and percentage components of a manual bundle remain separate rules.
  }
  const rules = catalog.rules.map(rule => {
    const manual = overrides[rule.id];
    if (!manual) return rule;
    return { ...rule, formula: manual.formula, base: manual.base, scope: manual.scope,
      effectiveFrom: manual.effectiveFrom, effectiveUntil: manual.effectiveUntil,
      version: `${rule.version}:custom:${manual.effectiveFrom}:${manual.effectiveUntil}`,
      evidence: { id: `${rule.id}:custom`, reference: manual.reference.trim(), urls: [], capturedAt: null, verification: 'custom' as const },
      override: { originalFormula: rule.formula, originalEvidence: rule.evidence, reason: manual.reference.trim() },
    };
  });
  const pending = catalog.pending.filter(issue => !issue.manualRuleIds?.length || !issue.manualRuleIds.every(id => overrides[id] !== undefined));
  return { ...catalog, rules, pending };
}
