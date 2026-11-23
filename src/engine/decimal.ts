import { Decimal } from 'decimal.js';

// Isolated configuration: callers cannot change the engine's rounding policy.
export const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

export function decimal(value: string, field = 'valor'): Dec {
  if (typeof value !== 'string' || !/^\d{1,18}(\.\d{1,12})?$/.test(value)) {
    throw new Error(`${field}: informe um decimal não negativo em texto, com ponto e sem separadores de milhar.`);
  }
  return new D(value);
}

export function money(value: string, field = 'valor'): Dec {
  const result = decimal(value, field);
  if (result.decimalPlaces() > 2) throw new Error(`${field}: moeda aceita no máximo dois decimais.`);
  return result;
}

export function cash(value: Dec): string {
  return value.toDecimalPlaces(2, D.ROUND_HALF_UP).toFixed(2);
}

export function quantity(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10_000) {
    throw new Error('Quantidade deve ser um inteiro entre 1 e 10000.');
  }
}

export function date(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error('Data inválida; use AAAA-MM-DD.');
  }
}

export function parseBrazilianMoney(value: string): string {
  if (!/^\d{1,18}([,.]\d{1,2})?$/.test(value)) throw new Error('Use valores como 19,90, sem separador de milhar.');
  return money(value.replace(',', '.')).toFixed(2);
}
