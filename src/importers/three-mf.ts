import { Unzip, UnzipInflate } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { D, decimal } from '../engine/decimal';
import { MAX_GCODE_BYTES, parseGcode } from './gcode';
import type { ImportedPlate, PrintImport } from './types';
import { MAX_ARCHIVE_BYTES } from './limits';
export { MAX_ARCHIVE_BYTES } from './limits';
const MAX_METADATA_BYTES = 2 * 1024 * 1024;
const decoder = new TextDecoder('utf-8', { fatal: true });
type Node = Record<string, unknown>;
const object = (value: unknown): Node => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Node : {};
const array = (value: unknown): unknown[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const string = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim().slice(0, 300) : null;
const numeric = (value: unknown): string | null => typeof value === 'string' && /^\d{1,12}(?:\.\d{1,12})?$/.test(value) ? decimal(value).toFixed() : null;

function xml(value: string): Node {
  if (/<!DOCTYPE|<!ENTITY/i.test(value)) throw new Error('Declarações DTD e entidades externas não são aceitas.');
  if (XMLValidator.validate(value) !== true) throw new Error('Metadados XML inválidos.');
  const root: unknown = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false, parseAttributeValue: false, processEntities: false }).parse(value);
  let nodes = 0;
  const guard = (node: unknown, depth: number) => {
    if (++nodes > 30_000 || depth > 40) throw new Error('Metadados XML excedem a complexidade permitida.');
    if (node && typeof node === 'object') for (const [key, child] of Object.entries(node)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Chave não permitida em metadados.');
      guard(child, depth + 1);
    }
  };
  guard(root, 0);
  return object(root);
}

function metadata(node: Node): Map<string, string> {
  const entries = new Map<string, string>();
  for (const entry of array(node.metadata)) {
    const child = object(entry);
    const key = string(child['@key']); const value = string(child['@value']);
    if (key !== null && value !== null) {
      if (entries.has(key) && entries.get(key) !== value) throw new Error(`Metadado duplicado conflitante: ${key}.`);
      entries.set(key, value);
    }
  }
  return entries;
}

function extract(bytes: Uint8Array, warnings: string[]): Map<string, string> {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error('3MF excede o limite de 100 MB.');
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('O arquivo não é um 3MF/ZIP válido.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { end = offset; break; }
  }
  if (end < 0) throw new Error('3MF truncado: diretório ZIP ausente.');
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== view.getUint16(end + 10, true)) throw new Error('ZIP dividido em volumes não é suportado.');
  const declaredEntries = view.getUint16(end + 10, true);
  if (declaredEntries > 5000 || view.getUint32(end + 12, true) + view.getUint32(end + 16, true) !== end) throw new Error('Diretório ZIP inválido ou ZIP64 não suportado.');
  let central = view.getUint32(end + 16, true);
  for (let index = 0; index < declaredEntries; index++) {
    if (central + 46 > end || view.getUint32(central, true) !== 0x02014b50) throw new Error('Diretório ZIP incompleto.');
    if (view.getUint16(central + 8, true) & 1) throw new Error('3MF criptografado não é suportado.');
    central += 46 + view.getUint16(central + 28, true) + view.getUint16(central + 30, true) + view.getUint16(central + 32, true);
  }
  if (central !== end) throw new Error('Tamanho do diretório ZIP inconsistente.');
  const names = new Set<string>(); const output = new Map<string, string>();
  let entries = 0; let total = 0;
  const pending = new Set<string>();
  const unzip = new Unzip(file => {
    if (++entries > 5000) throw new Error('3MF contém entradas demais.');
    const name = file.name.replaceAll('\\', '/').toLowerCase();
    if (name.startsWith('/') || name.includes(':') || name.split('/').includes('..') || name.includes('\0') || name.length > 500) throw new Error('Caminho inválido no 3MF.');
    if (names.has(name)) throw new Error('Entradas duplicadas no 3MF.');
    names.add(name);
    const config = /^metadata\/(slice_info|model_settings|project_settings)\.config$/.test(name);
    const gcode = /^metadata\/plate_\d+\.gcode$/.test(name);
    if (!config && !gcode) return;
    const cap = config ? MAX_METADATA_BYTES : MAX_GCODE_BYTES;
    if (file.originalSize !== undefined && file.originalSize > cap) {
      if (config) throw new Error('Metadados 3MF excedem o limite de 2 MB por entrada.');
      warnings.push(`${name}: G-code interno maior que 20 MB não foi expandido; os metadados de fatiamento continuam sendo usados quando disponíveis.`);
      return;
    }
    let size = 0; const chunks: Uint8Array[] = []; pending.add(name);
    file.ondata = (error, data, final) => {
      if (error) throw new Error('Não foi possível descompactar os metadados do 3MF.');
      size += data.length; total += data.length;
      if (size > cap || total > 48 * 1024 * 1024) throw new Error('Expansão do 3MF excede os limites permitidos.');
      chunks.push(data.slice());
      if (final) {
        if (file.originalSize !== undefined && size !== file.originalSize) throw new Error('Tamanho expandido do 3MF diverge do declarado.');
        const joined = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
        output.set(name, decoder.decode(joined)); pending.delete(name);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 4096) unzip.push(bytes.subarray(offset, offset + 4096), offset + 4096 >= bytes.length);
  if (pending.size) throw new Error('3MF truncado ou incompleto.');
  if (entries !== declaredEntries) throw new Error('Contagem de entradas ZIP inconsistente.');
  return output;
}

export function parseThreeMf(bytes: Uint8Array, fileName = 'impressao.3mf'): PrintImport {
  const warnings: string[] = [];
  const files = extract(bytes, warnings);
  let settings: Node = {};
  const rawSettings = files.get('metadata/project_settings.config');
  if (rawSettings) {
    try { settings = object(JSON.parse(rawSettings)); } catch { warnings.push('Configurações JSON do projeto inválidas; impressora/material podem exigir preenchimento manual.'); }
  }
  const printer = string(settings.printer_model) ?? string(settings.printer_settings_id);
  // Project settings list configured slots, not necessarily filaments consumed on this plate.
  const configuredMaterial = [...new Set(array(settings.filament_type).map(string).filter((item): item is string => item !== null))].join('; ') || null;
  const model = files.get('metadata/model_settings.config');
  const modelPlates = model ? array(object(xml(model).config).plate).map(object) : [];
  const slice = files.get('metadata/slice_info.config');
  const plates: ImportedPlate[] = [];
  if (slice) {
    const sliceRoot = xml(slice);
    const root = object(sliceRoot.config ?? sliceRoot.slice_info);
    const ids = new Set<string>();
    for (const entry of array(root.plate)) {
      const plate = object(entry); const meta = metadata(plate);
      const id = meta.get('index') ?? string(plate['@index']);
      if (id === null || id === undefined || !/^\d+$/.test(id) || ids.has(id)) throw new Error('Placa sem índice válido ou duplicada no 3MF.');
      ids.add(id);
      const declaredMaterials = array(plate.filament).map(value => {
        const filament = object(value);
        return { name: string(filament['@type']) ?? 'Material não identificado', grams: numeric(filament['@used_g']) };
      });
      // Bambu may list empty AMS/project slots with used_g=0. They must not become billable rows.
      // Keep entries with missing mass: unknown consumption must never silently become zero.
      const materials = declaredMaterials.filter(item => item.grams === null || new D(item.grams).gt(0));
      const grams = materials.length && declaredMaterials.every(item => item.grams !== null)
        ? declaredMaterials.reduce((sum, item) => sum.plus(item.grams!), new D(0)).toFixed() : null;
      if (declaredMaterials.length && !materials.length) warnings.push(`Placa ${id}: nenhum filamento com consumo positivo foi identificado. Confira os dados de fatiamento.`);
      const matching = modelPlates.find(value => metadata(value).get('plater_id') === id || metadata(value).get('index') === id);
      const declaredCount = numeric(meta.get('object_count') ?? meta.get('number_of_objects'));
      const instances = matching ? array(matching.model_instance).length : 0;
      const count = declaredCount === null ? instances || null : new D(declaredCount).isInteger() ? new D(declaredCount).toNumber() : null;
      const pieces = count !== null && Number.isSafeInteger(count) && count > 0 && count <= 10_000 ? count : null;
      if (instances && declaredCount === null) warnings.push(`Placa ${id}: quantidade obtida das instâncias do modelo; confirme se corresponde às peças comerciais.`);
      const seconds = numeric(meta.get('prediction'));
      if (grams === null) warnings.push(`Placa ${id}: massa em gramas incompleta. Nenhum peso foi inferido por volume ou comprimento.`);
      if (seconds === null) warnings.push(`Placa ${id}: tempo de fatiamento ausente.`);
      if (pieces === null) warnings.push(`Placa ${id}: quantidade de peças ausente; preencha manualmente.`);
      plates.push({ id, name: meta.get('plate_name') ?? (matching ? metadata(matching).get('plater_name') : undefined) ?? `Placa ${id}`, seconds, grams, pieces, materials });
    }
  }
  if (!plates.length) {
    for (const [name, text] of files) if (/\.gcode$/.test(name)) {
      const parsed = parseGcode(text, name); const plate = parsed.plates[0]!;
      plates.push({ ...plate, id: name.match(/plate_(\d+)/)![1]!, name }); warnings.push(...parsed.warnings);
    }
  }
  if (!plates.length) warnings.push('Este 3MF não contém dados de fatiamento compatíveis. Informe peso, tempo e quantidade manualmente; geometria não foi convertida em estimativa de consumo.');
  // Prefer actual per-plate consumption over the entire project's configured slot list.
  // Preserve separate consumed entries for pricing even if their material types are equal.
  const consumedTypes = [...new Set(plates.flatMap(plate => plate.materials.map(item => item.name)))];
  const material = plates.length ? consumedTypes.join('; ') || null : configuredMaterial;
  return { fileName, format: '3mf', sliced: plates.length > 0, printer, material, plates, warnings: [...new Set(warnings)] };
}
