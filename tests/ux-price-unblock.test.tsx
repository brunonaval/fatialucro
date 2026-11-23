import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { newCalculationDraft, calculateExperience } from '../src/app/experience';
import { appliedSearchRange } from '../src/app/search-range';
import { acceptHypotheses } from '../src/app/ux-v3';
import { bundledTables } from '../src/marketplaces/catalogs/bundled';
import { SaleStep } from '../src/ui/SaleStep';
import { ShopQuestions } from '../src/ui/ShopQuestions';
import { FilamentFields } from '../src/ui/CostFields';
import { FormContext } from '../src/ui/Fields';
import { ExperienceContext } from '../src/ui/ExperienceContext';
import type { CalculatorDraft } from '../src/app/model';

function screenshotScenario(): CalculatorDraft {
  const draft = newCalculationDraft(new Date(2026, 10, 23));
  draft.ux!.entry = 'manual'; draft.ux!.intent = 'sale';
  draft.fields.basis = 'unit'; draft.fields.grams = '55.8'; draft.fields.hours = '2.266666666667';
  draft.ux!.filament = { mode: 'spool', amount: '140', netGrams: '1000' };
  draft.ux!.machineIncluded = true; draft.fields.machineMode = 'all-in'; draft.fields.machine = '0.3';
  draft.ux!.packagingDecision = 'include'; draft.ux!.packagingIncluded = true;
  draft.fields.packagingUnit = '0.35';
  draft.ux!.labor = 'zero';
  draft.fields.marketplace = 'shopee'; draft.fields.seller = 'CPF'; draft.fields.quantity = '1';
  draft.fields.calculation = 'margin'; draft.fields.targetMargin = '0.20';
  draft.fields.minPrice = '0,01'; draft.fields.maxPrice = '100';
  draft.fields.returns = 'billable';
  draft.fields.highlight = 'inactive'; draft.fields.ads = 'inactive'; draft.fields.affiliates = 'inactive'; draft.fields.advance = 'inactive';
  draft.ux!.volume = { answer: 'below', threshold: 450, date: '2026-11-23' };
  draft.ux!.shipping = 'no'; draft.fields.shippingConfirmed = true; draft.fields.shipping = '0';
  return acceptHypotheses(draft, bundledTables[0]!.id, ['validity', 'rounding', 'precedence']);
}
function html(draft: CalculatorDraft, child: React.ReactNode): string {
  return renderToStaticMarkup(<FormContext value={{ draft, setField: () => {} }}>
    <ExperienceContext value={{ draft, update: () => {} }}>{child}</ExperienceContext>
  </FormContext>);
}
describe('UX V4: desbloquear o preço sem exigir cadastros ocultos', () => {
  it('corrige a busca padrão do CPF a partir da faixa documentada, sem alterar campos do usuário', () => {
    const draft = screenshotScenario();
    const range = appliedSearchRange(draft, bundledTables);
    expect(range).toEqual({ min: '12.00', max: '100.00', automaticFloor: '12.00' });
    expect(draft.fields.minPrice).toBe('0,01');
    const output = calculateExperience(draft);
    if (output.kind !== 'sale') throw new Error('O preço deveria ser calculável na faixa documentada.');
    expect(output.data.searchRange).toEqual(range);
    expect(output.data.solution).toMatchObject({ status: 'found', unitPrice: '23.05' });
    expect(output.data.result).toMatchObject({ status: 'complete', operatingProfit: '4.61' });
    expect(output.data.result.manufacturing.total).toBe('8.49');
    expect(output.data.result.packaging).toBe('0.35');
  });
  it('não oculta o trecho desconhecido se o usuário escolheu explicitamente uma faixa baixa', () => {
    const draft = screenshotScenario();
    draft.fields.minPrice = '10';
    expect(appliedSearchRange(draft, bundledTables)).toMatchObject({ min: '10.00', automaticFloor: null });
    const result = calculateExperience(draft);
    expect(result.kind).toBe('blocked-search');
    if (result.kind === 'blocked-search') {
      expect(result.data.solution?.status).toBe('partial');
      expect(result.data.solution?.pending.some(x => x.id.includes('regressive'))).toBe(true);
    }
  });
  it('não troca automaticamente a faixa do CNPJ nem da venda direta', () => {
    const draft = screenshotScenario(); draft.fields.seller = 'CNPJ';
    expect(appliedSearchRange(draft, bundledTables).automaticFloor).toBeNull();
    draft.fields.marketplace = 'direct'; draft.fields.seller = 'CPF';
    expect(appliedSearchRange(draft, bundledTables).automaticFloor).toBeNull();
  });
  it('não inventa tarifas se não houver respostas de participação ou hipóteses aceitas', () => {
    const draft = screenshotScenario();
    draft.fields.ads = 'unknown';
    const result = calculateExperience(draft);
    expect(result.kind).toBe('blocked-search');
    if (result.kind === 'blocked-search') expect(result.data.solution?.status).toBe('partial');
  });
  it('a interface simples preserva os detalhes, mas os exibe recolhidos por padrão', () => {
    const draft = screenshotScenario();
    const sale = html(draft, <SaleStep tables={bundledTables} onSaveShop={() => {}} />);
    expect(sale).toContain('Por quanto vender?');
    expect(sale).toContain('a busca começará em');
    expect(sale).toContain('Alterar data ou vender em kit');
    expect(sale).toContain('Embalagem incluída — editar custo');
    const shop = html(draft, <ShopQuestions tables={bundledTables} />);
    expect(shop).toContain('<details');
    expect(shop).toContain('Conferir ou alterar CPF, programas, frete e tarifas');
    expect(shop).toContain('Conferência rápida da Shopee');
    const costs = html(draft, <FilamentFields entries={[]} onProfile={() => {}} onSave={async () => {}} />);
    expect(costs).toContain('Salvar esta bobina para usar novamente');
    expect(costs).toContain('spool-price');
  });
});
