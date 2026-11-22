import { D, date, decimal, money } from '../../engine/decimal';
import type { CatalogManifest, ShopeeTable } from './types';
type ObjectValue = Record<string, unknown>;
export function record(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objeto de catálogo inválido.');
  return value as ObjectValue;
}
function keys(value: unknown, required: string[]): ObjectValue {
  const obj = record(value);
  if (Object.keys(obj).length !== required.length || required.some(key => !Object.hasOwn(obj, key))) throw new Error('Esquema de catálogo incompatível: campos ausentes ou desconhecidos.');
  return obj;
}
function string(value: unknown, limit = 1000): asserts value is string { if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error('Texto inválido no catálogo.'); }
function list(value: unknown, max: number): unknown[] { if (!Array.isArray(value) || !value.length || value.length > max) throw new Error('Lista inválida no catálogo.'); return value; }
function day(value: unknown) { string(value, 10); date(value); }
function amount(value: unknown, percent = false) { string(value, 32); if (percent ? decimal(value).gt(100) : money(value).lt(0)) throw new Error('Valor de tarifa inválido.'); }
function integer(value: unknown) { if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('Versão ou revisão inválida.'); }
function review(value: unknown) { const obj = keys(value, ['status', 'reference']); if (obj.status !== 'reviewed') throw new Error('Revisão documental obrigatória.'); string(obj.reference); }
function hash(value: unknown) { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('SHA-256 inválido.'); }
function safeTree(value: unknown, depth = 0) {
  if (depth > 20) throw new Error('Catálogo complexo demais.');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Chave proibida no catálogo.');
    safeTree(child, depth + 1);
  }
}
export function parseManifest(text: string): CatalogManifest {
  if (new TextEncoder().encode(text).length > 64 * 1024) throw new Error('Manifesto grande demais.');
  const value: unknown = JSON.parse(text); safeTree(value);
  const obj = keys(value, ['schemaVersion', 'releaseSequence', 'publishedAt', 'review', 'files']);
  if (obj.schemaVersion !== 1) throw new Error('Versão de esquema não suportada.'); integer(obj.releaseSequence); day(obj.publishedAt); review(obj.review);
  const ids = new Set<string>(); const paths = new Set<string>();
  for (const file of list(obj.files, 32)) {
    const item = keys(file, ['id', 'version', 'revision', 'path', 'sha256', 'bytes']);
    string(item.id, 100); string(item.version, 100); integer(item.revision); hash(item.sha256); integer(item.bytes);
    if (!/^[a-z][a-z0-9-]{0,99}$/.test(item.id)) throw new Error('Identificador de tabela inválido.');
    if (typeof item.path !== 'string' || !/^catalogs\/shopee-br\/[a-z0-9-]+\.json$/.test(item.path) || (item.bytes as number) > 512 * 1024 || ids.has(item.id) || paths.has(item.path)) throw new Error('Entrada de manifesto inválida ou duplicada.');
    ids.add(item.id); paths.add(item.path);
  }
  return value as CatalogManifest;
}
export function parseTable(text: string): ShopeeTable {
  if (new TextEncoder().encode(text).length > 512 * 1024) throw new Error('Tabela grande demais.');
  const value: unknown = JSON.parse(text); safeTree(value);
  const obj = keys(value, ['schemaVersion', 'adapter', 'id', 'marketplace', 'version', 'revision', 'effectiveFrom', 'effectiveUntil', 'confirmation', 'observedAt', 'lastVerified', 'review', 'supersedes', 'sources', 'bands', 'cnpjLow', 'cpf', 'programs', 'boundaryReview']);
  if (obj.schemaVersion !== 1 || obj.adapter !== 'shopee-v1' || obj.marketplace !== 'shopee-br' || !['documentary', 'confirmed', 'withdrawn'].includes(String(obj.confirmation))) throw new Error('Tabela ou adaptador não suportado.');
  string(obj.id, 100); string(obj.version, 100); integer(obj.revision); day(obj.observedAt); day(obj.lastVerified); review(obj.review);
  if (!/^[a-z][a-z0-9-]{0,99}$/.test(obj.id)) throw new Error('Identificador de tabela inválido.');
  if (String(obj.lastVerified) < String(obj.observedAt)) throw new Error('Verificação anterior à evidência.');
  if (obj.effectiveFrom !== null) day(obj.effectiveFrom); if (obj.effectiveUntil !== null) day(obj.effectiveUntil);
  if (obj.effectiveUntil !== null && (obj.effectiveFrom === null || String(obj.effectiveUntil) < String(obj.effectiveFrom))) throw new Error('Vigência invertida ou incompleta.');
  if (obj.confirmation === 'confirmed' && obj.effectiveFrom === null) throw new Error('Vigência confirmada exige início comprovado.');
  if (!Array.isArray(obj.supersedes) || obj.supersedes.length > 32 || obj.supersedes.some(id => typeof id !== 'string' || id.length > 100 || id === obj.id)) throw new Error('Substituições inválidas.');
  const sources = new Set<string>();
  for (const source of list(obj.sources, 20)) {
    const item = keys(source, ['id', 'url', 'htmlSha256', 'checkedAt']); string(item.id, 100); string(item.url); hash(item.htmlSha256); day(item.checkedAt);
    const url = new URL(item.url); if (url.origin !== 'https://seller.shopee.com.br' || !/^\/edu\/article\/\d+(?:\/[^?#]*)?$/.test(url.pathname) || url.search || url.hash || url.username || url.password || sources.has(item.id) || String(item.checkedAt) > String(obj.lastVerified)) throw new Error('Fonte oficial inválida.');
    sources.add(item.id);
  }
  for (const id of ['commission', 'cnpj', 'cpf', 'returns', 'campaign']) if (!sources.has(id)) throw new Error('Fonte obrigatória ausente.');
  let previous: { to: string | null; includeTo: boolean } | undefined;
  for (const band of list(obj.bands, 20)) {
    const item = keys(band, ['from', 'includeFrom', 'to', 'includeTo', 'percent', 'fixed']); amount(item.from); if (item.to !== null) amount(item.to); amount(item.percent, true); amount(item.fixed);
    if (typeof item.includeFrom !== 'boolean' || typeof item.includeTo !== 'boolean' || (item.to !== null && new D(String(item.to)).lt(String(item.from)))) throw new Error('Faixa inválida.');
    if (previous && (previous.to === null || new D(String(item.from)).lt(previous.to) || (new D(String(item.from)).eq(previous.to) && previous.includeTo && item.includeFrom))) throw new Error('Faixas sobrepostas ou fora de ordem.');
    previous = { to: item.to as string | null, includeTo: item.includeTo };
  }
  const low = keys(obj.cnpjLow, ['below', 'fixedPercent']); amount(low.below); amount(low.fixedPercent, true);
  const cpf = keys(obj.cpf, ['regressiveBelow', 'volumeThreshold', 'extra', 'thresholdInclusive', 'fixedConflict']); amount(cpf.regressiveBelow); integer(cpf.volumeThreshold); amount(cpf.extra);
  if ((cpf.thresholdInclusive !== null && typeof cpf.thresholdInclusive !== 'boolean') || typeof cpf.fixedConflict !== 'boolean') throw new Error('Condição CPF inválida.');
  const programs = keys(obj.programs, ['returnsPerOrder', 'highlightPercent']); amount(programs.returnsPerOrder); amount(programs.highlightPercent, true);
  for (const entry of list(obj.boundaryReview, 20)) {
    const item = keys(entry, ['price', 'status', 'note', 'sourceIds']); amount(item.price); string(item.note);
    if (!['confirmed', 'unresolved'].includes(String(item.status)) || list(item.sourceIds, 20).some(id => typeof id !== 'string' || !sources.has(id))) throw new Error('Revisão de fronteira inválida.');
  }
  return value as ShopeeTable;
}
export function validateTables(tables: readonly ShopeeTable[]): void {
  const ids = new Set<string>(); const revisions = new Set<number>();
  for (const table of tables) {
    if (ids.has(table.id) || revisions.has(table.revision)) throw new Error('Identidade ou revisão repetida.'); ids.add(table.id); revisions.add(table.revision);
    for (const id of table.supersedes) { const old = tables.find(item => item.id === id); if (!old || old.revision >= table.revision || old.lastVerified > table.lastVerified) throw new Error('Substituição regressiva ou sem versão original.'); }
    for (const other of tables) if (table.revision > other.revision && table.confirmation === 'confirmed' && other.confirmation === 'confirmed' &&
      table.effectiveFrom! <= (other.effectiveUntil ?? '9999-12-31') && other.effectiveFrom! <= (table.effectiveUntil ?? '9999-12-31') && !table.supersedes.includes(other.id)) throw new Error('Vigências ambíguas: declare a substituição revisada.');
  }
}
