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
