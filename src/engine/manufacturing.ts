import { cash, D, decimal, money, quantity } from './decimal';
import type { Dec } from './decimal';
import type { CostLine, ManufacturingInput } from './types';

export function calculateManufacturing(input: ManufacturingInput, count: number) {
  quantity(count);
  const hours = decimal(input.printHours, 'horas de impressão');
  const lines: CostLine[] = [];
  const add = (id: string, name: string, formula: string, raw: Dec) => {
    const perUnit = cash(raw);
    lines.push({ id, name, formula, rawPerUnit: raw.toFixed(), perUnit, quantity: count, total: cash(new D(perUnit).mul(count)) });
  };
  add('material', 'Filamento', 'gramas / 1000 × preço por kg', decimal(input.grams).div(1000).mul(money(input.filamentPerKg)));
  if (input.machine.mode === 'all-in') {
    add('machine', 'Máquina (custo completo)', 'horas × custo completo por hora', hours.mul(money(input.machine.perHour)));
  } else {
    add('energy', 'Energia', 'watts / 1000 × horas × preço kWh', decimal(input.machine.watts).div(1000).mul(hours).mul(decimal(input.machine.energyPerKwh)));
    add('maintenance', 'Manutenção', 'horas × manutenção por hora', hours.mul(money(input.machine.maintenancePerHour)));
    add('depreciation', 'Depreciação', 'horas × depreciação por hora', hours.mul(money(input.machine.depreciationPerHour)));
  }
  add('labor', 'Mão de obra', 'minutos / 60 × valor por hora', decimal(input.laborMinutes).div(60).mul(money(input.laborPerHour)));
  add('consumables', 'Consumíveis', 'valor explícito por unidade', money(input.consumablesPerUnit));
  add('failure-reserve', 'Reserva de falhas (estimativa)', 'reserva explícita por unidade; não é taxa observada de falha', money(input.failureReservePerUnit));
  const perUnit = lines.reduce((sum, line) => sum.plus(line.perUnit), new D(0));
  return { lines, perUnit: cash(perUnit), total: cash(perUnit.mul(count)) };
}
