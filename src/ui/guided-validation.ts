import { D, date } from '../engine/decimal';
import { programPercent } from '../marketplaces/shopee/programs';
import type { CalculatorDraft } from '../app/model';
import { manualIds, saleExtraSelected, text } from '../app/model';
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
  if (ux.manualProduction?.enabled) check('manualProductionCost', ux.manualProduction.amount, 'costs', 'Custo de produção por peça', 'money');
  else {
  if (text(draft, 'basis') === 'batch') count('pieces', text(draft, 'pieces'), 'print', 'Quantidade de peças da impressão');
  if (ux.materialIncluded !== false) {
    if (draft.materials.length) {
      for (const item of draft.materials) {
        check(item.id + '-g', item.grams, 'costs', 'Peso de ' + item.name, 'weight', true);
        if (item.purchase) {
          if (numericIssue(normalizeNumeric(item.purchase.amount, 'money'), 'money')
            || numericIssue(normalizeNumeric(item.purchase.netGrams, 'weight'), 'weight')
            || Number(item.purchase.netGrams.replace(',', '.')) <= 0)
            add(item.id + '-purchase', 'costs', 'Compra de ' + item.name, 'O preço ou o peso desta bobina está inválido. Use Corrigir custo desta bobina ou selecione outro filamento salvo.');
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
    if (text(draft, 'marketplace') === 'shopee' && !['CPF', 'CNPJ'].includes(text(draft, 'seller')))
      add('seller', 'sale', 'CPF ou CNPJ', 'Selecione o tipo de cadastro da sua loja para aplicar as tarifas.');
    try { date(text(draft, 'date')); } catch { add('date', 'sale', 'Data do cenário', 'Informe uma data válida.'); }
    if (['profit', 'margin', 'equilibrium'].includes(calculation)) {
      const min = text(draft, 'minPrice').trim() || '0.01';
      const max = text(draft, 'maxPrice').trim() || '100.00';
      const low = normalizeNumeric(min, 'money');
      const high = normalizeNumeric(max, 'money');
      check('minPrice', min, 'sale', 'Início do intervalo de busca', 'money', true);
      check('maxPrice', max, 'sale', 'Fim do intervalo de busca', 'money', true);
      if (!numericIssue(low, 'money') && !numericIssue(high, 'money')) {
        if (new D(high).lt(low)) add('maxPrice', 'sale', 'Fim do intervalo de busca', 'O preço final deve ser maior ou igual ao preço inicial.');
        else if (new D(high).minus(low).gte(1000)) add('maxPrice', 'sale', 'Fim do intervalo de busca', 'Reduza o intervalo para menos de R$ 1.000,00.');
      }
    }
    if (calculation === 'compare') {
      const values = text(draft, 'comparison').split(';').map(s => s.trim());
      if (values.length > 20 || values.some(value => numericIssue(normalizeNumeric(value, 'money'), 'money') || new D(normalizeNumeric(value, 'money')).lte(0)))
        add('comparison', 'sale', 'Preços para comparar', 'Informe de 1 a 20 preços positivos separados por ponto e vírgula.');
    }
    if (calculation === 'margin' && !numericIssue(text(draft, 'targetMargin'), 'ratio') && new D(text(draft, 'targetMargin').replace(',', '.')).gte(1))
      add('targetMargin', 'sale', 'Margem desejada', 'Escolha uma margem inferior a 100%.');
    if (text(draft, 'marketplace') === 'shopee') {
      const requiredText = (field: string, label: string) => { if (!text(draft, field).trim()) add(field, 'sale', label, 'Informe ' + label.toLowerCase() + '.'); };
      const enumField = (field: string, label: string, allowed: string[]) => { if (!allowed.includes(text(draft, field))) add(field, 'sale', label, 'Selecione uma opção válida.'); };
      const enabled = manualIds.filter(id => draft.fields[id + ':manual'] === true &&
        (id === 'shopee:cpf-extra' ? text(draft, 'seller') === 'CPF' :
          id === 'shopee:returns-protection' ? text(draft, 'returns') === 'billable' :
          text(draft, ({ 'shopee:highlight': 'highlight', 'shopee:adsEasy': 'ads', 'shopee:affiliates': 'affiliates', 'shopee:cashAdvance': 'advance' } as Record<string, string>)[id] ?? '') === 'active'));
      if (draft.fields.manualBasic === true) {
        check('manualRate', text(draft, 'manualRate'), 'sale', 'Comissão percentual personalizada', 'percent');
        check('manualFixed', text(draft, 'manualFixed'), 'sale', 'Tarifa fixa personalizada', 'money');
        enumField('manualRateScope', 'Incidência do percentual', ['item', 'order']);
        enumField('manualFixedScope', 'Incidência da tarifa fixa', ['item', 'order']);
        enumField('manualBase', 'Base da comissão', ['gross-sales', 'after-seller-discount']);
        requiredText('manualReference', 'Origem ou motivo da personalização');
      }
      for (const id of enabled) {
        const label = ({ 'shopee:cpf-extra': 'Adicional CPF', 'shopee:returns-protection': 'Devolução Fácil', 'shopee:highlight': 'Campanha de Destaque', 'shopee:adsEasy': 'Ads Fácil', 'shopee:affiliates': 'Afiliados', 'shopee:cashAdvance': 'Shopee Acelera' } as Record<string, string>)[id]!;
        check(id + ':value', text(draft, id + ':value'), 'sale', 'Valor personalizado de ' + label, text(draft, id + ':kind') === 'percentage' ? 'percent' : 'money');
        enumField(id + ':kind', 'Fórmula de ' + label, ['fixed', 'percentage']);
        enumField(id + ':scope', 'Incidência de ' + label, ['item', 'order']);
        enumField(id + ':base', 'Base de ' + label, ['gross-sales', 'after-seller-discount']);
        requiredText(id + ':reference', 'Origem dos parâmetros de ' + label);
      }
      if (enabled.length || draft.fields.manualBasic === true) {
        for (const [field, label] of [['manualFrom', 'Início do período personalizado'], ['manualUntil', 'Fim do período personalizado']] as const) {
          try { date(text(draft, field)); } catch { add(field, 'sale', label, 'Informe uma data válida.'); }
        }
        if (text(draft, 'manualUntil') < text(draft, 'manualFrom'))
          add('manualUntil', 'sale', 'Fim do período personalizado', 'O fim não pode ser anterior ao início.');
      }
      const p = ux.programPricing ?? {};
      for (const [field, program, label, max] of [['adsRate','ads','Percentual Ads Fácil',5],['affiliateRate','affiliates','Comissão de afiliados',100],['affiliateExtraRate','affiliates','Encargo de afiliados',100],['advanceShare','advance','Parcela antecipada',100]] as const) {
        if (text(draft, program) === 'active' && p[field]?.trim() && programPercent(p[field], max) === undefined) add(field, 'sale', label, 'Informe um percentual de 0 a ' + max + ' ou deixe em branco se não souber.');
      }
      const orders = text(draft, 'orders');
      if (text(draft, 'seller') === 'CPF' && orders.trim() && (!/^\d+$/.test(orders) || !Number.isSafeInteger(Number(orders))))
        add('orders', 'sale', 'Número exato de pedidos em 90 dias', 'Informe um inteiro não negativo ou apague para usar a opção de volume.');
    }
    if (calculation === 'direct' || calculation === 'compare') check('price', text(draft, 'price'), 'sale', 'Preço de venda', 'money', true);
    if (calculation === 'profit') check('targetProfit', text(draft, 'targetProfit'), 'sale', 'Lucro desejado', 'money');
    if (calculation === 'margin') check('targetMargin', text(draft, 'targetMargin'), 'sale', 'Margem desejada', 'ratio');
    if (saleExtraSelected(draft, 'discount')) check('discount', text(draft, 'discount'), 'sale', 'Desconto do vendedor', 'money');
    if (saleExtraSelected(draft, 'other')) check('other', text(draft, 'other'), 'sale', 'Outras despesas', 'money');
    if (draft.fields.advertisingEnabled === true) {
      if (ux.advertisingPercent !== undefined) check('advertisingPercent', ux.advertisingPercent, 'sale', 'Percentual de publicidade', 'percent');
      else check('advertising', text(draft, 'advertising'), 'sale', 'Publicidade', 'money');
    }
    if ((text(draft, 'marketplace') === 'direct' && saleExtraSelected(draft, 'shipping')) ||
      (text(draft, 'marketplace') === 'shopee' && ux.shipping === 'yes'))
      check('shipping', text(draft, 'shipping'), 'sale', 'Frete líquido', 'money');
  }
  return issues;
}
