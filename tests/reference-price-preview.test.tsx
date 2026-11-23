import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { newCalculationDraft, calculateExperience } from '../src/app/experience';
import type { CalculatorDraft } from '../src/app/model';
import { bundledTables } from '../src/marketplaces/catalogs/bundled';
import { ExperienceResult } from '../src/ui/ExperienceResult';
import { FinancialSummary } from '../src/ui/FinancialSummary';
import { FormContext } from '../src/ui/Fields';
import { ExperienceContext } from '../src/ui/ExperienceContext';

function capturedScenario(): CalculatorDraft {
  const d = newCalculationDraft(new Date(2026, 10, 23));
  d.ux!.entry = 'manual';
  d.ux!.intent = 'sale';
  d.fields.grams = '55.8';
  d.fields.hours = '2.266666666667';
  d.ux!.filament = { mode: 'spool', amount: '140', netGrams: '1000' };
  d.ux!.machineIncluded = true;
  d.fields.machineMode = 'all-in';
  d.fields.machine = '0.30';
  d.ux!.packagingIncluded = true;
  d.ux!.packagingDecision = 'include';
  d.fields.packagingUnit = '0.35';
  d.fields.marketplace = 'shopee';
  d.fields.seller = 'CPF';
  d.fields.quantity = '1';
  d.fields.calculation = 'margin';
  d.fields.targetMargin = '0.20';
  d.fields.minPrice = '0,01';
  d.fields.maxPrice = '100';
  d.ux!.volume = { answer: 'below', threshold: 450, date: '2026-11-23' };
  d.ux!.shipping = 'no';
  d.fields.shippingConfirmed = true;
  d.fields.shipping = '0';
  d.fields.returns = 'unknown';
  for (const field of ['highlight', 'ads', 'affiliates', 'advance']) d.fields[field] = 'inactive';
  return d;
}
function view(d: CalculatorDraft, child: React.ReactNode) {
  return renderToStaticMarkup(
    <FormContext value={{ draft: d, setField: () => {} }}>
      <ExperienceContext value={{ draft: d, update: () => {} }}>{child}</ExperienceContext>
    </FormContext>,
  );
}
describe('Prévia orientativa sem alterar declarações da Shopee', () => {
  it('com a Devolução Fácil ainda desconhecida, apresenta as duas alternativas e mantém lucro oficial bloqueado', () => {
    const d = capturedScenario();
    const before = structuredClone(d);
    const result = calculateExperience(d, bundledTables);
    expect(result.kind).toBe('blocked-search');
    if (result.kind !== 'blocked-search') return;
    expect(result.referencePreview).toMatchObject({
      lower: '22.24', upper: '23.05', returnsUnconfirmed: true, searchStart: '12.00',
    });
    expect(result.data.solution?.status).toBe('partial');
    expect(d).toEqual(before);
    expect(d.fields.acceptValidity).toBe(false);
    expect(d.fields.acceptRounding).toBe(false);
    expect(d.fields.acceptPrecedence).toBe(false);
    expect(d.fields.returns).toBe('unknown');
    const html = view(d, <ExperienceResult frozen={result} />);
    expect(html).toContain('Preço orientativo');
    expect(html).toContain('R$ 22,24 a R$ 23,05');
    expect(html).toContain('não é preço garantido');
    expect(html).not.toContain('headline-price');
    const summary = view(d, <FinancialSummary draft={d} state={{ signature: 'test', phase: 'ready', output: result }} />);
    expect(summary).toContain('Preço orientativo da Shopee');
  });
  it('quando Devolução Fácil está definida, a prévia vira um valor único, sem aceite persistido', () => {
    const d = capturedScenario(); d.fields.returns = 'billable';
    const result = calculateExperience(d);
    expect(result.kind).toBe('blocked-search');
    if (result.kind !== 'blocked-search') return;
    expect(result.referencePreview).toMatchObject({ lower: '23.05', upper: '23.05', returnsUnconfirmed: false });
  });
  it('programa adicional ou frete desconhecido não ganha preço fictício', () => {
    const d = capturedScenario(); d.fields.ads = 'unknown';
    const a = calculateExperience(d);
    if (a.kind !== 'blocked-search') throw new Error('Programa desconhecido não pode concluir o cenário.');
    expect(a.referencePreview).toBeUndefined();
    d.fields.ads = 'inactive'; d.ux!.shipping = 'unknown';
    const b = calculateExperience(d);
    if (b.kind !== 'blocked-search') throw new Error('Frete desconhecido não pode concluir o cenário.');
    expect(b.referencePreview).toBeUndefined();
  });
  it('se o cliente definiu manualmente uma faixa abaixo de 12, não afirma preço mínimo seguro', () => {
    const d = capturedScenario(); d.fields.minPrice = '10';
    const r = calculateExperience(d);
    if (r.kind !== 'blocked-search') throw new Error('Faixa inferior indeterminada não pode ser pulada.');
    expect(r.referencePreview).toBeUndefined();
  });
});
