import { D } from '../engine/decimal';
export type FieldKind = 'money' | 'decimal' | 'weight' | 'duration' | 'percent' | 'ratio';
const numeric = /^\d{1,18}(?:[,.]\d{1,12})?$/;
export function normalizeNumeric(value: string, kind: FieldKind): string {
  let text = value.trim().replace(/^R\$\s*/, '').replace(/\s*(%|g|h)$/, '').trim();
  if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(text)) text = text.replaceAll('.', '');
  if (kind === 'duration' && /^\d{1,18}:\d{2}(?::\d{2}(?:[,.]\d{1,10})?)?$/.test(text)) {
    const [hours, minutes, seconds = '0'] = text.split(':');
    if (new D(minutes!).gte(60) || new D(seconds.replace(',', '.')).gte(60)) return value;
    return new D(hours!).plus(new D(minutes!).div(60)).plus(new D(seconds.replace(',', '.')).div(3600)).toDecimalPlaces(12).toFixed();
  }
  if (!numeric.test(text)) return value;
  text = text.replace(',', '.');
  return kind === 'ratio' ? new D(text).div(100).toFixed() : text;
}
export function numericIssue(value: string, kind: FieldKind): string {
  if (!value) return 'Preencha este campo.';
  if (!numeric.test(value)) return kind === 'duration' ? 'Use horas decimais ou hh:mm:ss, com minutos e segundos abaixo de 60.' : 'Informe um valor não negativo, com vírgula decimal.';
  const number = new D(value.replace(',', '.'));
  if (kind === 'money' && number.decimalPlaces() > 2) return 'Use no máximo duas casas decimais.';
  if ((kind === 'percent' && number.gt(100)) || (kind === 'ratio' && number.gt(1))) return 'Use uma porcentagem entre 0 e 100.';
  return '';
}
export function editableNumeric(value: string, kind: FieldKind): string {
  if (!numeric.test(value)) return value;
  const number = new D(value.replace(',', '.'));
  if (kind === 'duration') {
    const seconds = number.mul(3600); const hours = seconds.div(3600).floor(); const minutes = seconds.mod(3600).div(60).floor(); const remaining = seconds.mod(60);
    const clockSeconds = remaining.toFixed().split('.');
    return `${hours.toFixed()}:${minutes.toFixed().padStart(2, '0')}:${clockSeconds[0]!.padStart(2, '0')}${clockSeconds[1] ? `,${clockSeconds[1]}` : ''}`;
  }
  return (kind === 'ratio' ? number.mul(100).toFixed() : value).replace('.', ',');
}
export function formattedNumeric(value: string, kind: FieldKind): string {
  if (numericIssue(value, kind)) return value;
  if (kind === 'duration') return editableNumeric(value, kind);
  const number = new D(value.replace(',', '.')); const display = kind === 'ratio' ? number.mul(100) : number;
  const [integer, fraction] = (kind === 'money' ? display.toFixed(2) : display.toFixed()).split('.');
  return `${integer!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${fraction ? `,${fraction}` : ''}`;
}
export function kindForField(name: string, decimal = false): FieldKind {
  if (name === 'hours') return 'duration'; if (name === 'grams') return 'weight';
  if (['targetMargin', 'lowMargin'].includes(name)) return 'ratio';
  if (name === 'manualRate' || name.endsWith(':value') && decimal) return 'percent';
  return decimal ? 'decimal' : 'money';
}
