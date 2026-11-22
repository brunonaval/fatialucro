export interface PurchaseDraft { amount: string; netGrams: string }
export interface ImportOrigin {
  fileName: string; printer: string | null; material: string | null; plateId: string;
  plateName: string; plateCount: number; grams: string | null; seconds: string | null;
  pieces: number | null; warnings: string[];
  materials: { name: string; grams: string | null }[];
}
export interface ExperienceState {
  version: 2;
  entry: 'none' | 'manual' | 'import' | 'example';
  intent: 'cost' | 'sale'; mode: 'simple' | 'advanced'; stage: 'print' | 'costs' | 'sale' | 'result';
  filament: { mode: 'kg' | 'spool'; amount: string; netGrams: string };
  packaging: { mode: 'unit' | 'pack'; amount: string; units: string };
  machineIncluded: boolean; wearIncluded: boolean; labor: 'excluded' | 'paid' | 'zero'; packagingIncluded: boolean; extrasIncluded: boolean;
  saleUnit: 'piece' | 'kit'; partsPerKit: string;
  shipping: 'unknown' | 'yes' | 'no';
  volume: { answer: 'above' | 'below' | 'equal' | 'unknown'; threshold: number | null; date: string };
  origin?: ImportOrigin;
}
