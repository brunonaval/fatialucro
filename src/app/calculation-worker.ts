import { calculateExperience } from './experience';
import type { CalculatorDraft } from './model';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
self.onmessage = (event: MessageEvent<{ draft: CalculatorDraft; tables: ShopeeTable[] }>) => {
  try { self.postMessage({ output: calculateExperience(event.data.draft, event.data.tables) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Falha no cálculo.' }); }
};
