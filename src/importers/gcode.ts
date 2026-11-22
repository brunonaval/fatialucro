import { D, decimal } from '../engine/decimal';
import type { PrintImport } from './types';
import { MAX_GCODE_BYTES } from './limits';
export { MAX_GCODE_BYTES } from './limits';

export function durationSeconds(value: string): string | null {
  const input = value.trim();
  const matches = [...input.matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/gi)];
  if (!matches.length || input.replace(/(\d+(?:\.\d+)?)\s*[dhms]/gi, '').trim() !== '') return null;
  let total = new D(0);
  const seen = new Set<string>();
  for (const match of matches) {
    const unit = match[2]!.toLowerCase();
    if (seen.has(unit)) return null;
    seen.add(unit);
    total = total.plus(decimal(match[1]!).mul(({ d: 86400, h: 3600, m: 60, s: 1 } as Record<string, number>)[unit]!));
  }
  return total.toFixed();
}

function numeric(value: string | undefined): string | null {
  if (value === undefined || !/^\d{1,12}(?:\.\d{1,12})?$/.test(value.trim())) return null;
  return decimal(value.trim()).toFixed();
}

export function parseGcode(text: string, fileName = 'impressao.gcode'): PrintImport {
  if (new TextEncoder().encode(text).byteLength > MAX_GCODE_BYTES) throw new Error('G-code excede o limite de 20 MB.');
  if (text.includes('\0')) throw new Error('G-code binário não é suportado. Use G-code textual ou 3MF fatiado.');
  const values = new Map<string, string[]>();
  // Only metadata comments are read. Instructions and extrusion are never executed
  // or used to infer consumption without mass/density evidence.
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*;\s*([^:=]{1,100})\s*[:=]\s*(.*?)\s*$/);
    if (match) {
      const key = match[1]!.trim().toLowerCase();
      const bucket = values.get(key) ?? [];
      bucket.push(match[2]!); values.set(key, bucket);
    }
  }
  const warnings: string[] = [];
  const unique = (keys: string[]) => {
    const found = keys.flatMap(key => values.get(key) ?? []);
    const distinct = [...new Set(found)];
    if (distinct.length > 1) { warnings.push(`Metadados conflitantes para ${keys[0]}; preencha esse campo manualmente.`); return null; }
    return distinct[0];
  };
  const duration = unique(['estimated printing time (normal mode)', 'model printing time', 'estimated printing time']);
  const seconds = duration === undefined ? numeric(unique(['time']) ?? undefined) : duration === null ? null : durationSeconds(duration);
  const totalMass = unique(['total filament used [g]', 'total filament weight [g]']);
  const perTool = unique(['filament used [g]', 'filament used [g] (including supports)']);
  let grams = numeric(totalMass ?? undefined);
  let weights: string[] = [];
  if (perTool !== undefined && perTool !== null) {
    const parsed = perTool.split(';').map(value => numeric(value));
    if (parsed.every(value => value !== null)) {
      weights = parsed as string[];
      const sum = weights.reduce((total, value) => total.plus(value), new D(0));
      if (totalMass === undefined) grams = sum.toFixed();
      else if (grams === null || !sum.eq(grams)) { grams = null; weights = []; warnings.push('Massa total e massas individuais divergentes ou inválidas. Confira manualmente.'); }
    }
  }
  const material = unique(['filament_type', 'material']) ?? null;
  const names = material?.split(';').map(name => name.trim().slice(0, 300)).filter(Boolean) ?? [];
  const printer = unique(['printer_model', 'printer model', 'printer_settings_id', 'machine_model']) ?? null;
  const count = numeric(unique(['total object count', 'object_count', 'number of objects']) ?? undefined);
  const pieces = count !== null && new D(count).isInteger() && new D(count).gte(1) && new D(count).lte(10_000) ? new D(count).toNumber() : null;
  if (seconds === null) warnings.push('Tempo não encontrado em metadados compatíveis. Preencha manualmente.');
  if (grams === null) warnings.push('Massa em gramas não encontrada. Comprimento de filamento não foi convertido usando densidade presumida.');
  if (pieces === null) warnings.push('Quantidade de peças não declarada; não foi presumida uma unidade.');
  if (names.length > 1 && weights.length !== names.length) warnings.push('Há vários materiais sem massas individuais completas; confira a composição e os preços por kg.');
  if (weights.length > 32) throw new Error('Mais de 32 materiais não são suportados.');
  return { fileName, format: 'gcode', sliced: seconds !== null || grams !== null, printer: printer?.slice(0, 300) ?? null, material: material?.slice(0, 300) ?? null,
    plates: [{ id: '1', name: 'Impressão', seconds, grams, pieces,
      materials: weights.length > 1 && weights.length === names.length ? weights.map((weight, index) => ({ name: names[index]!, grams: weight })) : [{ name: material ?? 'Material não identificado', grams }] }], warnings };
}
