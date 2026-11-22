import { calculateWorkspace } from './calculate';
import type { CalculatorDraft } from './model';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
self.onmessage = (event: MessageEvent<{ draft: CalculatorDraft; tables: ShopeeTable[] }>) => {
  try { self.postMessage({ output: calculateWorkspace(event.data.draft, event.data.tables) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Falha no cálculo.' }); }
};
