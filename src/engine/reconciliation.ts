import { cash, money } from './decimal';

/** Aggregate comparison only: a difference never implies its cause is known. */
export function reconcileFees(calculated: string, observed: string) {
  const delta = money(calculated).minus(money(observed));
  return { status: delta.isZero() ? 'matched' as const : 'divergent' as const, difference: cash(delta),
    explanation: delta.isZero() ? 'Totais coincidem; isso não comprova a decomposição das tarifas.' : 'Divergência não explicada. Obter detalhamento antes de alterar a fórmula.' };
}
