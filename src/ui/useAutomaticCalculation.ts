import { useEffect, useState } from 'react';
import { AutomaticCalculation } from '../app/automatic';
import type { AutomaticState } from '../app/automatic';
import { calculationSignature } from '../app/experience';
import type { ExperienceOutput } from '../app/experience';
import type { CalculatorDraft } from '../app/model';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
type Input = { draft: CalculatorDraft; tables: readonly ShopeeTable[] };
export function useAutomaticCalculation(draft: CalculatorDraft, tables: readonly ShopeeTable[], enabled: boolean) {
  const signature = `${calculationSignature(draft)}|${tables.map(table => `${table.id}@${table.version}`).join(',')}`;
  const [state, setState] = useState<AutomaticState<ExperienceOutput>>({ signature: '', phase: 'waiting' });
  const [controller] = useState(() => new AutomaticCalculation<Input, ExperienceOutput>((input, done, fail) => {
    const task = new Worker(new URL('../app/calculation-worker.ts', import.meta.url), { type: 'module' });
    task.onmessage = (event: MessageEvent<{ output?: ExperienceOutput; error?: string }>) => { task.terminate(); if (event.data.output) done(event.data.output); else fail(event.data.error ?? 'Confira os dados do cálculo.'); };
    task.onerror = () => { task.terminate(); fail('Não foi possível processar este cálculo local. Seus dados continuam no formulário.'); };
    task.postMessage(input); return () => task.terminate();
  }, setState));
  useEffect(() => {
    if (enabled) controller.schedule(signature, { draft, tables }); else controller.cancel();
    return () => controller.cancel();
    // Financial signature includes all calculation fields; presentation changes do not restart work.
  }, [signature, tables, enabled, controller]);
  return { state: state.signature === signature ? state : { signature, phase: 'waiting' as const }, runNow: () => controller.schedule(signature, { draft, tables }, true) };
}
