import { MAX_GCODE_BYTES, parseGcode } from './gcode';
import { MAX_ARCHIVE_BYTES, parseThreeMf } from './three-mf';
export type * from './types';
export { parseGcode, parseThreeMf, MAX_ARCHIVE_BYTES, MAX_GCODE_BYTES };

export function importPrintFile(fileName: string, bytes: Uint8Array) {
  if (/\.3mf$/i.test(fileName)) return parseThreeMf(bytes, fileName);
  if (/\.(gcode|gco|g)$/i.test(fileName)) {
    if (bytes.byteLength > MAX_GCODE_BYTES) throw new Error('G-code excede 20 MB.');
    return parseGcode(new TextDecoder('utf-8', { fatal: true }).decode(bytes), fileName);
  }
  throw new Error('Formato não suportado. Selecione 3MF fatiado ou G-code textual.');
}
