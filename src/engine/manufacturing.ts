import { cash, D, decimal, money, quantity } from './decimal';
import type { Dec } from './decimal';
import type { CostLine, ManufacturingInput } from './types';

export function calculateManufacturing(input: ManufacturingInput, count: number) {
  quantity(count);
  if (input.machine.mode !== 'all-in' && input.machine.mode !== 'detailed') throw new Error('Modo de máquina inválido.');
  if (input.basis !== undefined && input.basis !== 'unit' && input.basis !== 'batch') throw new Error('Base de fabricação inválida.');
  const batch = input.basis === 'batch';
  const pieces = batch ? input.piecesPerBatch : 1;
  if (pieces === undefined) throw new Error('Informe a quantidade de peças produzidas no lote.');
  quantity(pieces);
  const parts = input.partsPerUnit ?? 1;
  quantity(parts);
  if (input.manualCostPerPiece !== undefined) {
    if (batch) throw new Error('Custo direto deve ser informado por peça física.');
    const unit = money(input.manualCostPerPiece, 'custo direto por peça').mul(parts);
    const perUnit = cash(unit), total = cash(unit.mul(count));
    return { lines: [{ id: 'manual-production', name: 'Custo de produção informado', formula: 'Custo informado por peça física × peças por unidade comercial', rawPerUnit: unit.toFixed(), perUnit, quantity: count, total }], perUnit, total };
  }
  const hours = decimal(input.printHours, 'horas de impressão');
  const lines: CostLine[] = [];
  const add = (id: string, name: string, formula: string, raw: Dec, alreadyPerUnit = false) => {
    const allocate = batch && !alreadyPerUnit;
    const physical = allocate ? new D(cash(raw)).div(pieces) : raw;
    const allocated = parts === 1 ? physical : (allocate ? physical : new D(cash(physical))).mul(parts);
    const perUnit = cash(allocated);
    lines.push({ id, name, formula: `${allocate ? `${formula}; custo do lote arredondado / ${pieces} peças` : formula}${parts > 1 ? `; ${parts} peças por kit comercial` : ''}`,
      rawPerUnit: allocated.toFixed(), perUnit, quantity: count,
      total: cash((allocate ? allocated : new D(perUnit)).mul(count)),
      ...(allocate ? { allocation: { piecesPerBatch: pieces, roundedBatchCost: cash(raw) } } : {}),
    });
  };
  const material = (id: string, name: string, grams: string, pricePerKg: string, purchase?: { amount: string; netGrams: string }) => {
    if (purchase) {
      const net = decimal(purchase.netGrams, 'peso líquido da bobina');
      if (net.isZero()) throw new Error('Peso líquido da bobina precisa ser maior que zero.');
      add(id, name, `${grams} g × R$${purchase.amount} / ${purchase.netGrams} g comprados`, decimal(grams).mul(money(purchase.amount)).div(net));
    } else add(id, name, 'gramas / 1000 × preço por kg', decimal(grams).div(1000).mul(money(pricePerKg)));
  };
  if (input.materials !== undefined) {
    if (!input.materials.length || input.materials.length > 32 || new Set(input.materials.map(material => material.id)).size !== input.materials.length) throw new Error('Informe entre 1 e 32 materiais com identificadores únicos.');
    for (const item of input.materials) material(`material:${item.id}`, `Filamento — ${item.name}`, item.grams, item.pricePerKg, item.purchase);
  } else material('material', 'Filamento', input.grams, input.filamentPerKg, input.filamentPurchase);
  if (input.machine.mode === 'all-in') {
    add('machine', 'Máquina (custo completo)', 'horas × custo completo por hora', hours.mul(decimal(input.machine.perHour)));
  } else {
    add('energy', 'Energia', 'watts / 1000 × horas × preço kWh', decimal(input.machine.watts).div(1000).mul(hours).mul(decimal(input.machine.energyPerKwh)));
    add('maintenance', 'Manutenção', 'horas × manutenção por hora', hours.mul(decimal(input.machine.maintenancePerHour)));
    add('depreciation', 'Depreciação', 'horas × depreciação por hora', hours.mul(decimal(input.machine.depreciationPerHour)));
  }
  add('labor', 'Mão de obra', 'minutos / 60 × valor por hora', decimal(input.laborMinutes).div(60).mul(money(input.laborPerHour)));
  add('consumables', 'Consumíveis', 'valor explícito por unidade', money(input.consumablesPerUnit), true);
  add('failure-reserve', 'Reserva de falhas (estimativa)', 'reserva explícita por unidade; não é taxa observada de falha', money(input.failureReservePerUnit), true);
  const perUnit = lines.reduce((sum, line) => sum.plus(line.perUnit), new D(0));
  const total = lines.reduce((sum, line) => sum.plus(line.total), new D(0));
  return { lines, perUnit: batch ? cash(total.div(count)) : cash(perUnit), total: cash(total) };
}
