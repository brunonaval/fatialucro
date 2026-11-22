import { calculateWorkspace } from './calculate';
import type { CalculatorDraft } from './model';
self.onmessage = (event: MessageEvent<CalculatorDraft>) => {
  try { self.postMessage({ output: calculateWorkspace(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Falha no cálculo.' }); }
};
