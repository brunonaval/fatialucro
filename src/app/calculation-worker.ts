import { calculateExperience } from './experience';
import { calculateCostPreview } from './cost-preview';
import type { CalculatorDraft } from './model';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
self.onmessage = (event: MessageEvent<{ draft: CalculatorDraft; tables: ShopeeTable[] }>) => {
  const preview = calculateCostPreview(event.data.draft);
  self.postMessage({ preview, finished: false });
  try { self.postMessage({ preview, finished: true, output: calculateExperience(event.data.draft, event.data.tables) }); }
  catch (error) { self.postMessage({ preview, finished: true, error: error instanceof Error ? error.message : 'Falha no cálculo.' }); }
};
