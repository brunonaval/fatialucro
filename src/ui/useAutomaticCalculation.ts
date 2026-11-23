import { useEffect, useState } from 'react';
import { AutomaticCalculation } from '../app/automatic';
import type { AutomaticState } from '../app/automatic';
import { calculationSignature } from '../app/experience';
import type { ExperienceOutput } from '../app/experience';
import type { CalculatorDraft } from '../app/model';
import type { CostPreview } from '../app/cost-preview';
import type { ShopeeTable } from '../marketplaces/catalogs/types';

type Input = { draft: CalculatorDraft; tables: readonly ShopeeTable[] };
export type FinancialState = AutomaticState<ExperienceOutput> & { preview?: CostPreview; errorKind?: 'technical' | 'input' };
interface Envelope { preview: CostPreview; finished: boolean; output?: ExperienceOutput; error?: string }
export function currentFinancialState(state: AutomaticState<Envelope>, signature: string): FinancialState {
  if (state.signature !== signature) return { signature, phase: 'waiting' };
  const envelope = state.phase === 'ready' ? state.output : undefined;
  return envelope ? { signature, phase: !envelope.finished ? 'processing' : envelope.error ? 'invalid' : 'ready', preview: envelope.preview, ...(envelope.output ? { output: envelope.output } : {}), ...(envelope.error ? { error: envelope.error, errorKind: 'input' as const } : {}) } : { signature, phase: state.phase, ...(state.error ? { error: state.error, errorKind: 'technical' as const } : {}) };
}
export function useAutomaticCalculation(draft: CalculatorDraft, tables: readonly ShopeeTable[], enabled: boolean) {
  const signature = `${calculationSignature(draft)}|${tables.map(table => `${table.id}@${table.version}`).join(',')}`;
  const [state, setState] = useState<AutomaticState<Envelope>>({ signature: '', phase: 'waiting' });
  const [controller] = useState(() => new AutomaticCalculation<Input, Envelope>((input, done, fail) => {
    const task = new Worker(new URL('../app/calculation-worker.ts', import.meta.url), { type: 'module' });
    task.onmessage = (event: MessageEvent<Envelope>) => { if (event.data.finished) task.terminate(); done(event.data); };
    task.onerror = () => { task.terminate(); fail('Não foi possível processar este cálculo local. Seus dados continuam no formulário.'); };
    task.postMessage(input); return () => task.terminate();
  }, setState));
  useEffect(() => {
    if (enabled) controller.schedule(signature, { draft, tables }); else controller.cancel();
    return () => controller.cancel();
    // Signature covers financial inputs; changing presentation never restarts work.
  }, [signature, tables, enabled, controller]);
  return { state: currentFinancialState(state, signature), runNow: () => controller.schedule(signature, { draft, tables }, true) };
}
