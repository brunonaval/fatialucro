import { date, money } from '../../engine/decimal';
import type { ShopeeTable } from './types';
import { validateTables } from './validation';

export function selectTable(scenarioDate: string, tables: readonly ShopeeTable[]) {
  date(scenarioDate); validateTables(tables);
  const retired = new Set(tables.filter(table => table.confirmation === 'confirmed' ? table.effectiveFrom! <= scenarioDate : table.observedAt <= scenarioDate).flatMap(table => table.supersedes));
  const available = tables.filter(table => !retired.has(table.id));
  const effective = available.filter(table => table.confirmation === 'confirmed' && table.effectiveFrom !== null && table.effectiveFrom <= scenarioDate && (table.effectiveUntil === null || scenarioDate <= table.effectiveUntil));
  if (effective.length) return { table: effective.sort((a, b) => b.revision - a.revision)[0]!, mode: 'effective' as const };
  // References are clearly identified. Observation is never a legal start date.
  const reference = available.filter(table => table.confirmation === 'documentary' && table.observedAt <= scenarioDate && (table.effectiveFrom === null || table.effectiveFrom <= scenarioDate) && (table.effectiveUntil === null || scenarioDate <= table.effectiveUntil)).sort((a, b) => b.observedAt.localeCompare(a.observedAt) || b.revision - a.revision)[0];
  return reference ? { table: reference, mode: 'reference' as const } : null;
}
export function priceBand(table: ShopeeTable, unitPrice: string) {
  const price = money(unitPrice);
  return table.bands.find(band => (band.includeFrom ? price.gte(band.from) : price.gt(band.from)) && (band.to === null || (band.includeTo ? price.lte(band.to) : price.lt(band.to))));
}
export function catalogIndicator(scenarioDate: string, tables: readonly ShopeeTable[]) {
  const selection = selectTable(scenarioDate, tables);
  if (!selection) return { title: 'Sem tabela para esta data', detail: 'Nenhum período comprovado ou referência documental aplicável.', tone: 'warning' as const };
  const { table, mode } = selection;
  return { title: mode === 'effective' ? 'Período documentado selecionado' : 'Referência documental selecionada',
    detail: `Versão ${table.version} · verificação documental ${table.lastVerified.split('-').reverse().join('/')} · ${mode === 'reference' ? 'vigência não comprovada; simulação exige premissa' : `vigência ${table.effectiveFrom} a ${table.effectiveUntil ?? 'sem fim declarado'}`}. Selecionar não confirma atualização ao vivo.`, tone: mode === 'reference' ? 'warning' as const : 'neutral' as const };
}
