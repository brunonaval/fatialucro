export interface ImportedMaterial {
  name: string;
  grams: string | null;
}
export interface ImportedPlate {
  id: string;
  name: string;
  seconds: string | null;
  grams: string | null;
  pieces: number | null;
  materials: ImportedMaterial[];
}
export interface PrintImport {
  fileName: string;
  format: '3mf' | 'gcode';
  sliced: boolean;
  printer: string | null;
  material: string | null;
  plates: ImportedPlate[];
  warnings: string[];
}
