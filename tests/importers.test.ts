import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { durationSeconds } from '../src/importers/gcode';
import { importPrintFile, parseGcode, parseThreeMf } from '../src/importers';
import { applyImportedPlate } from '../src/app/experience';
import { defaultDraft } from '../src/app/model';

const archive = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([name, value]) => [name, strToU8(value)])));
const slice = `<config><plate><metadata key="index" value="1"/><metadata key="prediction" value="5400"/><metadata key="object_count" value="3"/><filament id="1" type="PLA" used_g="20.5"/><filament id="2" type="PETG" used_g="10"/></plate><plate><metadata key="index" value="2"/><metadata key="prediction" value="600"/><filament type="PLA" used_g="5"/></plate></config>`;

describe('importação local de metadados, sem fatiar geometria', () => {
  it('extrai placas independentes, massas por material, tempo e quantidade Bambu', () => {
    const parsed = parseThreeMf(archive({ 'Metadata/slice_info.config': slice,
      'Metadata/project_settings.config': JSON.stringify({ printer_model: 'Bambu A1', filament_type: ['PLA', 'PETG'] }),
      'Metadata/model_settings.config': '<config><plate><metadata key="plater_id" value="2"/><model_instance><metadata key="object_id" value="5"/></model_instance><model_instance/></plate></config>',
      '3D/3dmodel.model': 'geometry ignored', 'Metadata/plate_1.gcode': '; TIME: 999' }));
    expect(parsed).toMatchObject({ sliced: true, printer: 'Bambu A1', material: 'PLA; PETG' });
    expect(parsed.plates).toMatchObject([{ id: '1', seconds: '5400', grams: '30.5', pieces: 3, materials: [{ name: 'PLA', grams: '20.5' }, { name: 'PETG', grams: '10' }] }, { id: '2', pieces: 2, grams: '5' }]);
    expect(parsed.warnings.some(item => item.includes('instâncias'))).toBe(true);
  });
  it('3MF somente geométrico não inventa tempo, massa nem uma peça', () => {
    const parsed = parseThreeMf(archive({ '3D/3dmodel.model': '<model><resources/></model>' }));
    expect(parsed).toMatchObject({ sliced: false, plates: [] }); expect(parsed.warnings[0]).toContain('manualmente');
  });
  it('metadados parciais preservam cada ausência', () => {
    const parsed = parseThreeMf(archive({ 'Metadata/slice_info.config': '<config><plate><metadata key="index" value="1"/><filament type="PLA"/></plate></config>' }));
    expect(parsed.plates[0]).toMatchObject({ seconds: null, grams: null, pieces: null, materials: [{ name: 'PLA', grams: null }] });
    expect(parsed.warnings).toHaveLength(3);
  });
  it('não arredonda massas antes de somar nem assume peça quando contagem é zero', () => {
    const parsed = parseThreeMf(archive({ 'Metadata/slice_info.config': '<config><plate><metadata key="index" value="1"/><metadata key="object_count" value="0"/><filament used_g="0.005"/><filament used_g="0.005"/></plate></config>' }));
    expect(parsed.plates[0]).toMatchObject({ grams: '0.01', pieces: null });
  });
  it('usa G-code interno como fallback sem somar placas novamente', () => {
    const parsed = parseThreeMf(archive({ 'Metadata/plate_3.gcode': '; TIME: 3600\n; filament used [g] = 12.5\n; object_count = 2' }));
    expect(parsed.plates).toMatchObject([{ id: '3', seconds: '3600', grams: '12.5', pieces: 2 }]);
  });
  it('extrai G-code Bambu/Prusa com múltiplos materiais sem presumir densidade', () => {
    const parsed = parseGcode('; estimated printing time (normal mode) = 1h 2m 3s\n; filament used [g] = 1.25; 2.5\n; filament_type = PLA;PETG\n; printer_model = A1\n; object_count = 2\nG1 E5000');
    expect(parsed).toMatchObject({ printer: 'A1', material: 'PLA;PETG', plates: [{ seconds: '3723', grams: '3.75', pieces: 2, materials: [{ name: 'PLA', grams: '1.25' }, { name: 'PETG', grams: '2.5' }] }] });
  });
  it('quatro PLA configurados, mas só um consumido, viram um único material na placa', () => {
    const parsed = parseThreeMf(archive({
      'Metadata/project_settings.config': JSON.stringify({ printer_model: 'Bambu A1', filament_type: ['PLA', 'PLA', 'PLA', 'PLA'] }),
      'Metadata/slice_info.config': '<config><plate><metadata key="index" value="1"/><metadata key="prediction" value="3600"/><metadata key="object_count" value="1"/><filament id="1" type="PLA" used_g="0"/><filament id="2" type="PLA" used_g="22.31"/><filament id="3" type="PLA" used_g="0"/><filament id="4" type="PLA" used_g="0"/></plate></config>',
    }));
    expect(parsed.material).toBe('PLA');
    expect(parsed.plates[0]).toMatchObject({ grams: '22.31', materials: [{ name: 'PLA', grams: '22.31' }] });
    const draft = applyImportedPlate(defaultDraft(), parsed, parsed.plates[0]!);
    expect(draft.materials).toHaveLength(1);
    expect(draft.ux?.origin?.material).toBe('PLA');
  });
  it('PLA realmente consumidos em dois filamentos permanecem separados para a precificação', () => {
    const parsed = parseThreeMf(archive({
      'Metadata/project_settings.config': JSON.stringify({ filament_type: ['PLA', 'PLA', 'PLA', 'PLA'] }),
      'Metadata/slice_info.config': '<config><plate><metadata key="index" value="1"/><filament id="1" type="PLA" color="#000000" used_g="12.3"/><filament id="2" type="PLA" color="#FFFFFF" used_g="8.2"/><filament id="3" type="PLA" used_g="0"/><filament id="4" type="PLA" used_g="0"/></plate></config>',
    }));
    expect(parsed.material).toBe('PLA');
    expect(parsed.plates[0]).toMatchObject({ grams: '20.5', materials: [{ name: 'PLA', grams: '12.3' }, { name: 'PLA', grams: '8.2' }] });
    expect(applyImportedPlate(defaultDraft(), parsed, parsed.plates[0]!).materials).toHaveLength(2);
  });
  it('projeto geométrico com quatro slots PLA não é confundido com quatro materiais consumidos', () => {
    const parsed = parseThreeMf(archive({
      'Metadata/project_settings.config': JSON.stringify({ filament_type: ['PLA', 'PLA', 'PLA', 'PLA'] }),
    }));
    expect(parsed.material).toBe('PLA');
    expect(parsed.sliced).toBe(false);
    expect(parsed.plates).toEqual([]);
  });
  it('G-code de quatro slots mostra PLA uma vez e descarta pesos zero', () => {
    const parsed = parseGcode('; filament_type = PLA;PLA;PLA;PLA\\n; filament used [g] = 22.31;0;0;0\\n; TIME:3600');
    expect(parsed.material).toBe('PLA');
    expect(parsed.plates[0]?.materials).toEqual([{ name: 'PLA', grams: '22.31' }]);
    expect(parsed.plates[0]?.grams).toBe('22.31');
  });
  it('Cura TIME em segundos é aceito; comprimento e extrusão não viram peso', () => {
    const parsed = parseGcode(';TIME:120.5\n;Filament used: 2m\nG1 E5000\n; object_count = 1');
    expect(parsed.plates[0]).toMatchObject({ seconds: '120.5', grams: null, pieces: 1 });
    expect(parsed.warnings.join(' ')).toContain('densidade');
  });
  it('G-code sem metadados não fabrica estimativas', () => {
    expect(parseGcode('G28\nG1 X10 Y20 E30').plates[0]).toMatchObject({ grams: null, seconds: null, pieces: null });
  });
  it('metadados contraditórios não recorrem a um número alternativo silenciosamente', () => {
    const parsed = parseGcode('; estimated printing time = 1h\n; estimated printing time = 2h\n; TIME:300\n; total filament used [g] = 10\n; total filament used [g] = 20\n; filament used [g] = 10');
    expect(parsed.plates[0]).toMatchObject({ seconds: null, grams: null });
    expect(parsed.warnings.join(' ')).toContain('conflitantes');
  });
  it('preserva massas individuais consistentes com o total; divergências ficam manuais', () => {
    const prefix = '; filament_type = PLA;PETG\n; filament used [g] = 2;3\n';
    expect(parseGcode(`${prefix}; total filament used [g] = 5`).plates[0]?.materials).toHaveLength(2);
    expect(parseGcode(`${prefix}; total filament used [g] = 6`).plates[0]?.grams).toBeNull();
  });
  it.each(['-1h', '12 bananas', '1h 2h', '10:30', 'NaN', ''])('não interpreta duração inválida %s', value => {
    expect(durationSeconds(value)).toBeNull();
  });
  it('converte dias, minutos e segundos decimais de forma decimal', () => { expect(durationSeconds('1d 2h 3m 4.5s')).toBe('93784.5'); });
  it('recusa arquivo binário e extensão não suportada', () => {
    expect(() => parseGcode('G1\0')).toThrow('binário');
    expect(() => importPrintFile('obj.stl', strToU8('abc'))).toThrow('Formato');
    expect(() => importPrintFile('obj.gcode', new Uint8Array([255]))).toThrow();
    expect(() => parseThreeMf(strToU8('abc'))).toThrow('válido');
  });
  it('recusa caminhos relativos perigosos e placas duplicadas', () => {
    expect(() => parseThreeMf(archive({ '../Metadata/slice_info.config': slice }))).toThrow('Caminho');
    expect(() => parseThreeMf(archive({ 'Metadata/slice_info.config': '<config><plate index="1"/><plate index="1"/></config>' }))).toThrow('duplicada');
  });
  it('bloqueia entidades externas e XML inválido', () => {
    expect(() => parseThreeMf(archive({ 'Metadata/slice_info.config': '<!DOCTYPE x [<!ENTITY z SYSTEM "file:///private">]><config/>' }))).toThrow('DTD');
    expect(() => parseThreeMf(archive({ 'Metadata/slice_info.config': '<config><plate></config>' }))).toThrow('XML');
  });
  it('limita expansão de metadados e rejeita arquivos truncados', () => {
    expect(() => parseThreeMf(archive({ 'Metadata/slice_info.config': 'x'.repeat(2 * 1024 * 1024 + 1) }))).toThrow('2 MB');
    const bytes = archive({ 'Metadata/slice_info.config': slice });
    expect(() => parseThreeMf(bytes.subarray(0, 60))).toThrow();
    expect(() => parseThreeMf(bytes.subarray(0, bytes.length - 22))).toThrow('truncado');
  });
});
