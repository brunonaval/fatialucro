import { D } from '../engine/decimal';
import type { CalculatorDraft } from '../app/model';
import { saleExtraSelected, text } from '../app/model';
import { normalizeNumeric, numericIssue } from './format';
import type { FieldKind } from './format';

export type GuidedStage = 'print' | 'costs' | 'sale';
export interface GuidedIssue {
  id: string;
  field: string;
  stage: GuidedStage;
  label: string;
  message: string;
}

/** UI guidance only. The financial engine still validates the actual operation. */
export function guidedIssues(draft: CalculatorDraft): GuidedIssue[] {
  const ux = draft.ux;
  if (!ux || ux.entry === 'none' || ux.entry === 'example') return [];
  const issues: GuidedIssue[] = [];
  const add = (field: string, stage: GuidedStage, label: string, message: string) =>
    issues.push({ id: stage + ':' + field, field, stage, label, message });
  const check = (field: string, value: string, stage: GuidedStage, label: string, kind: FieldKind, positive = false) => {
    const normalized = kind === 'ratio' ? value : normalizeNumeric(value, kind);
    const problem = numericIssue(normalized, kind);
    if (problem) {
      add(field, stage, label, !value.trim() ? 'Informe ' + label.toLowerCase() + '.' : label + ': ' + problem);
      return;
    }
    if (positive && new D(normalized).lte(0)) add(field, stage, label, label + ' deve ser maior que zero.');
  };
  const count = (field: string, value: string, stage: GuidedStage, label: string) => {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 10000)
      add(field, stage, label, 'Informe ' + label.toLowerCase() + ' como número inteiro entre 1 e 10.000.');
  };
  if (text(draft, 'basis') === 'batch') count('pieces', text(draft, 'pieces'), 'print', 'Quantidade de peças da impressão');
  if (ux.materialIncluded !== false) {
    if (draft.materials.length) {
      for (const item of draft.materials) {
        check(item.id + '-g', item.grams, 'costs', 'Peso de ' + item.name, 'weight', true);
        if (item.purchase) {
          if (numericIssue(normalizeNumeric(item.purchase.amount, 'money'), 'money')
            || numericIssue(normalizeNumeric(item.purchase.netGrams, 'weight'), 'weight')
            || Number(item.purchase.netGrams.replace(',', '.')) <= 0)
            add(item.id + '-name', 'costs', 'Perfil de ' + item.name, 'Confira a compra no perfil deste filamento.');
        } else check(item.id + '-kg', item.pricePerKg, 'costs', 'Preço por kg de ' + item.name, 'money', true);
      }
    } else {
      check('grams', text(draft, 'grams'), 'print', 'Peso do filamento (g)', 'weight', true);
      if (ux.filament.mode === 'spool') {
        check('spool-price', ux.filament.amount, 'costs', 'Preço da bobina', 'money', true);
        check('spool-weight', ux.filament.netGrams, 'costs', 'Peso líquido da bobina (g)', 'weight', true);
      } else check('filament', text(draft, 'filament'), 'costs', 'Preço por kg', 'money', true);
    }
  }
  if (ux.machineIncluded) {
    check('hours', text(draft, 'hours'), 'print', 'Tempo de impressão', 'duration', true);
    if (text(draft, 'machineMode') === 'all-in') check('machine', text(draft, 'machine'), 'costs', 'Custo por hora da impressora', 'decimal');
    else {
      check('watts', text(draft, 'watts'), 'costs', 'Potência da impressora', 'decimal');
      check('kwh', text(draft, 'kwh'), 'costs', 'Preço da energia', 'decimal');
      if (ux.wearIncluded) {
        check('maintenance', text(draft, 'maintenance'), 'costs', 'Manutenção por hora', 'decimal');
        check('depreciation', text(draft, 'depreciation'), 'costs', 'Depreciação por hora', 'decimal');
      }
    }
  }
  if (ux.labor === 'paid') {
    check('laborMinutes', text(draft, 'laborMinutes'), 'costs', 'Tempo de trabalho manual', 'decimal');
    check('laborHour', text(draft, 'laborHour'), 'costs', 'Valor da hora de trabalho', 'money');
  }
  if (ux.extrasIncluded) {
    check('consumables', text(draft, 'consumables'), 'costs', 'Consumíveis por peça', 'money');
    check('failure', text(draft, 'failure'), 'costs', 'Reserva para falhas', 'money');
  }
  if (ux.packagingIncluded) {
    const stage = ux.intent === 'cost' ? 'costs' : 'sale';
    if (ux.packaging.mode === 'pack') {
      check('package-price', ux.packaging.amount, stage, 'Preço do pacote de embalagens', 'money', true);
      count('package-units', ux.packaging.units, stage, 'Embalagens no pacote');
    } else check('packagingUnit', text(draft, 'packagingUnit'), stage, 'Custo por embalagem', 'money');
    if (ux.packagingExtraIncluded ?? text(draft, 'packagingOrder').trim() !== '')
      check('packagingOrder', text(draft, 'packagingOrder'), stage, 'Embalagem adicional por pedido', 'money');
  }
  if (ux.intent === 'sale') {
    count('quantity', text(draft, 'quantity'), 'sale', 'Unidades vendidas');
    if (ux.saleUnit === 'kit') count('partsPerKit', ux.partsPerKit, 'sale', 'Peças por kit');
    const calculation = text(draft, 'calculation');
    if (calculation === 'direct' || calculation === 'compare') check('price', text(draft, 'price'), 'sale', 'Preço de venda', 'money', true);
    if (calculation === 'profit') check('targetProfit', text(draft, 'targetProfit'), 'sale', 'Lucro desejado', 'money');
    if (calculation === 'margin') check('targetMargin', text(draft, 'targetMargin'), 'sale', 'Margem desejada', 'ratio');
    if (saleExtraSelected(draft, 'discount')) check('discount', text(draft, 'discount'), 'sale', 'Desconto do vendedor', 'money');
    if (saleExtraSelected(draft, 'other')) check('other', text(draft, 'other'), 'sale', 'Outras despesas', 'money');
    if (draft.fields.advertisingEnabled === true) check('advertising', text(draft, 'advertising'), 'sale', 'Publicidade', 'money');
    if ((text(draft, 'marketplace') === 'direct' && saleExtraSelected(draft, 'shipping')) ||
      (text(draft, 'marketplace') === 'shopee' && ux.shipping === 'yes'))
      check('shipping', text(draft, 'shipping'), 'sale', 'Frete líquido', 'money');
  }
  return issues;
}
