import { describe, expect, it } from 'vitest';
import { calculateExperience, newCalculationDraft } from '../src/app/experience';
import { guidedIssues } from '../src/ui/guided-validation';
import { bundledTables } from '../src/marketplaces/catalogs/bundled';
import type { CalculatorDraft } from '../src/app/model';

const states = ['inactive', 'active', 'unknown'] as const;
const returns = ['inactive', 'trial', 'billable', 'unknown'] as const;
const shipping = ['no', 'yes', 'unknown'] as const;
const packaging = ['include', 'exclude', 'unknown'] as const;
const modes = ['direct', 'profit', 'margin', 'equilibrium'] as const;
function scenario(): CalculatorDraft {
  const d = newCalculationDraft(new Date(2026, 10, 23));
  Object.assign(d.fields, { grams: '55.8', hours: '2.266666666667', machine: '0.30', quantity: '1', price: '35.00', targetProfit: '4', targetMargin: '0.20', minPrice: '35.00', maxPrice: '35.00', marketplace: 'shopee', shipping: '0', packagingUnit: '0.35' });
  Object.assign(d.ux!, { entry: 'manual', intent: 'sale', stage: 'result', machineIncluded: true, filament: { mode: 'spool', amount: '140', netGrams: '1000' } });
  return d;
}
describe('Matriz exaustiva de opções Shopee', () => {
  for (const seller of ['CPF', 'CNPJ'] as const) for (const mode of modes) {
    it(seller + ' / ' + mode + ': todas as combinações válidas de programas, frete, volume e embalagem', () => {
      const volumes = seller === 'CPF' ? ['above', 'below', 'equal', 'unknown'] as const : ['unknown'] as const;
      let total = 0; let failures = 0; const examples: string[] = [];
      for (const ret of returns) for (const highlight of states) for (const ads of states) for (const affiliates of states) for (const advance of states)
      for (const ship of shipping) for (const vol of volumes) for (const pack of packaging) {
        const d = scenario();
        Object.assign(d.fields, { seller, calculation: mode, returns: ret, highlight, ads, affiliates, advance, shipping: ship === 'yes' ? '2.50' : ship === 'unknown' ? '' : '0', shippingConfirmed: ship !== 'unknown' });
        Object.assign(d.ux!, { shipping: ship, volume: { answer: vol, threshold: 450, date: '2026-11-23' }, packagingDecision: pack, packagingIncluded: pack === 'include' });
        const before = JSON.stringify(d); total++;
        try {
          const issues = guidedIssues(d);
          if (issues.length) throw new Error('campos válidos bloqueados: ' + issues.map(i => i.field).join(','));
          const result = calculateExperience(d, bundledTables);
          if (result.kind === 'cost') throw new Error('resultado de venda ausente');
          if (mode !== 'direct' && result.data.solution?.status !== 'found' && !result.referencePreview) throw new Error('preço de referência ausente');
          if (mode === 'direct' && !Number.isFinite(Number(result.data.result.operatingCosts))) throw new Error('custos ausentes');
          if (JSON.stringify(d) !== before) throw new Error('respostas modificadas');
          if (result.data.result.status === 'partial' && result.data.result.operatingProfit !== null) throw new Error('lucro incompleto tratado como confirmado');
        } catch (err) {
          failures++;
          if (examples.length < 12) examples.push([ret, highlight, ads, affiliates, advance, ship, vol, pack].join('/') + ': ' + String(err));
        }
      }
      console.info('MATRIZ ' + seller + ' ' + mode + ': ' + total + ' casos, ' + failures + ' falhas; ' + examples.join(' | '));
      expect(total).toBe(4 * 81 * 3 * volumes.length * 3);
      expect(failures, examples.join('\n')).toBe(0);
    }, 240000);
  }
  it('aceita campos opcionais vazios e preserva valores informados quando o usuário não sabe', () => {
    const d = scenario(); d.fields.seller = 'CPF'; d.fields.calculation = 'margin';
    d.fields.minPrice = ''; d.fields.maxPrice = '';
    d.ux!.shipping = 'unknown'; d.fields.shipping = '';
    d.ux!.packagingDecision = 'unknown'; d.ux!.packagingIncluded = false;
    for (const key of ['highlight', 'ads', 'affiliates', 'advance', 'returns']) d.fields[key] = 'unknown';
    expect(guidedIssues(d)).toEqual([]);
    const result = calculateExperience(d, bundledTables);
    expect(result.kind).toBe('blocked-search');
    if (result.kind !== 'blocked-search') throw new Error('expected conditional estimate');
    expect(result.referencePreview).toBeDefined();
    expect(result.referencePreview!.hypotheticalConditions.join(' ')).toContain('Embalagem');
    expect(result.referencePreview!.hypotheticalConditions.join(' ')).toContain('Frete');
    expect(d.fields.minPrice).toBe('');
    expect(d.fields.shipping).toBe('');
  });
  it('mantém a taxa conhecida de destaque e a taxa manual válida quando outros programas são desconhecidos', () => {
    const d = scenario();
    Object.assign(d.fields, { seller: 'CPF', calculation: 'margin', minPrice: '12', maxPrice: '60', returns: 'billable', highlight: 'active', ads: 'active', affiliates: 'unknown', advance: 'inactive', 'shopee:adsEasy:manual': true, 'shopee:adsEasy:kind': 'fixed', 'shopee:adsEasy:value': '2.00', 'shopee:adsEasy:scope': 'order', 'shopee:adsEasy:base': 'gross-sales', 'shopee:adsEasy:reference': 'Valor informado no pedido de teste' });
    Object.assign(d.ux!, { shipping: 'no', volume: { answer: 'below', threshold: 450, date: '2026-11-23' }, packagingDecision: 'include', packagingIncluded: true });
    const output = calculateExperience(d);
    if (output.kind !== 'blocked-search' || !output.referencePreview) throw new Error('missing estimate');
    expect(output.referencePreview.excludedActivePrograms).toEqual([]);
    expect(output.referencePreview.lower).toBe(output.referencePreview.upper);
    const before = Number(output.referencePreview.lower);
    d.fields.highlight = 'inactive';
    const withoutHighlight = calculateExperience(d);
    if (withoutHighlight.kind !== 'blocked-search' || !withoutHighlight.referencePreview) throw new Error('missing estimate');
    expect(Number(withoutHighlight.referencePreview.lower)).toBeLessThan(before);
    d.fields['shopee:adsEasy:manual'] = false;
    const withoutManual = calculateExperience(d);
    if (withoutManual.kind !== 'blocked-search' || !withoutManual.referencePreview) throw new Error('missing estimate');
    expect(Number(withoutManual.referencePreview.lower)).toBeLessThan(Number(withoutHighlight.referencePreview.lower));
    expect(withoutManual.referencePreview.excludedActivePrograms).toContain('Ads Fácil');
  });
  it('permite venda direta com embalagem desconhecida sem fingir que o lucro final é conhecido', () => {
    const d = scenario(); d.fields.marketplace = 'direct'; d.fields.calculation = 'profit';
    d.ux!.packagingDecision = 'unknown'; d.ux!.packagingIncluded = false;
    expect(guidedIssues(d)).toEqual([]);
    const result = calculateExperience(d);
    if (result.kind !== 'blocked-search') throw new Error('expected conditional estimate');
    expect(result.referencePreview).toBeDefined();
    expect(result.data.result.operatingProfit).toBeNull();
  });
  it('valida limites, metas e taxa personalizada somente quando a opção correspondente está ativa', () => {
    const d = scenario(); d.fields.seller = 'CPF'; d.fields.calculation = 'margin'; d.fields.targetMargin = '1';
    expect(guidedIssues(d).some(i => i.field === 'targetMargin')).toBe(true);
    d.fields.targetMargin = '0.20'; d.fields.minPrice = '40'; d.fields.maxPrice = '20';
    expect(guidedIssues(d).some(i => i.field === 'maxPrice')).toBe(true);
    d.fields.minPrice = '12'; d.fields.maxPrice = '60';
    d.fields.ads = 'inactive'; d.fields['shopee:adsEasy:manual'] = true;
    expect(guidedIssues(d).some(i => i.field.startsWith('shopee:adsEasy:'))).toBe(false);
    d.fields.ads = 'active';
    expect(guidedIssues(d).some(i => i.field === 'shopee:adsEasy:value')).toBe(true);
    expect(guidedIssues(d).some(i => i.field === 'shopee:adsEasy:scope')).toBe(true);
  });
  it('marca exatamente o campo obrigatório e aceita o frete desconhecido', () => {
    const d = scenario(); d.fields.seller = 'CPF'; d.fields.calculation = 'margin'; d.ux!.shipping = 'yes'; d.fields.shipping = '';
    expect(guidedIssues(d).some(i => i.field === 'shipping' && i.stage === 'sale')).toBe(true);
    d.ux!.shipping = 'unknown';
    expect(guidedIssues(d).some(i => i.field === 'shipping')).toBe(false);
    d.fields.targetMargin = '';
    expect(guidedIssues(d).some(i => i.field === 'targetMargin')).toBe(true);
    d.fields.targetMargin = '0.20'; d.fields.quantity = '';
    expect(guidedIssues(d).some(i => i.field === 'quantity')).toBe(true);
    d.fields.quantity = '1'; d.fields.seller = '';
    expect(guidedIssues(d).some(i => i.field === 'seller')).toBe(true);
  });
});
