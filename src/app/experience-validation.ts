import type { ExperienceState } from './experience-types';
export function validateExperience(value: unknown): asserts value is ExperienceState {
  if (!value || typeof value !== 'object') throw new Error('Rascunho de interface inválido.');
  const ux = value as ExperienceState;
  if (ux.version !== 2 || !['none', 'manual', 'import', 'example'].includes(ux.entry) || !['cost', 'sale'].includes(ux.intent) || !['simple', 'advanced'].includes(ux.mode) || !['print', 'costs', 'sale', 'result'].includes(ux.stage) || !['piece', 'kit'].includes(ux.saleUnit) || !['excluded', 'paid', 'zero'].includes(ux.labor)) throw new Error('Estado de interface incompatível.');
  if ([ux.machineIncluded, ux.wearIncluded, ux.packagingIncluded, ux.extrasIncluded].some(value => typeof value !== 'boolean') || typeof ux.partsPerKit !== 'string' || ux.partsPerKit.length > 20) throw new Error('Opções de custo inválidas.');
  if (!['unknown', 'yes', 'no'].includes(ux.shipping)) throw new Error('Estado de frete inválido.');
  if (!ux.volume || !['above', 'below', 'equal', 'unknown'].includes(ux.volume.answer) || (ux.volume.threshold !== null && (!Number.isSafeInteger(ux.volume.threshold) || ux.volume.threshold < 1)) || typeof ux.volume.date !== 'string' || ux.volume.date.length > 10) throw new Error('Condição de volume inválida.');
  if (!ux.filament || !['kg', 'spool'].includes(ux.filament.mode) || !ux.packaging || !['unit', 'pack'].includes(ux.packaging.mode)) throw new Error('Origem dos custos inválida.');
  for (const value of [ux.filament.amount, ux.filament.netGrams, ux.packaging.amount, ux.packaging.units]) if (typeof value !== 'string' || value.length > 300) throw new Error('Custo de compra inválido.');
  if (ux.origin) {
    for (const key of ['fileName', 'plateId', 'plateName'] as const) if (typeof ux.origin[key] !== 'string' || ux.origin[key].length > 500) throw new Error('Origem importada inválida.');
    if (!Number.isSafeInteger(ux.origin.plateCount) || ux.origin.plateCount < 0 || ux.origin.plateCount > 5000 || !Array.isArray(ux.origin.warnings) || ux.origin.warnings.length > 500 || ux.origin.warnings.some(value => typeof value !== 'string' || value.length > 2000)) throw new Error('Metadados de importação inválidos.');
    for (const value of [ux.origin.printer, ux.origin.material, ux.origin.grams, ux.origin.seconds]) if (value !== null && (typeof value !== 'string' || value.length > 500)) throw new Error('Valor importado inválido.');
    if (ux.origin.pieces !== null && (!Number.isSafeInteger(ux.origin.pieces) || ux.origin.pieces < 1 || ux.origin.pieces > 10000)) throw new Error('Contagem importada inválida.');
    if (!Array.isArray(ux.origin.materials) || ux.origin.materials.length > 32 || ux.origin.materials.some(item => !item || typeof item.name !== 'string' || item.name.length > 300 || (item.grams !== null && (typeof item.grams !== 'string' || item.grams.length > 300)))) throw new Error('Materiais de origem inválidos.');
  }
}
