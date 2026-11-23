import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { newCalculationDraft, applyImportedPlate, calculateExperience } from '../src/app/experience';
import { guidedIssues } from '../src/ui/guided-validation';
import { GuidedIssues } from '../src/ui/GuidedIssues';
import { normalizeNumeric, numericIssue } from '../src/ui/format';
import { expenseBreakdown, packagingInput, saleExtraSelected } from '../src/app/model';
import { parseThreeMf } from '../src/importers/three-mf';
import { strToU8, zipSync } from 'fflate';
import { App } from '../src/ui/App';
import { SaleStep } from '../src/ui/SaleStep';
import { FormContext } from '../src/ui/Fields';
import { ExperienceContext } from '../src/ui/ExperienceContext';
const archive = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([name, value]) => [name, strToU8(value)])));

describe('UX V4: primeira impressão e validação assistida', () => {
  it('primeiro acesso apresenta 3 objetivos sem configurar oficina ou Shopee', () => {
    const html = renderToStaticMarkup(<App />);
    for (const label of ['Quanto devo cobrar?', 'Quanto custa imprimir?', 'Já tenho um preço: quanto vou lucrar?']) expect(html).toContain(label);
  });
  it('peso e preço de bobina bastam para cálculo material-only, sem tempo', () => {
    const draft = newCalculationDraft(); draft.ux!.entry = 'manual'; draft.fields.grams = '22.31';
    draft.ux!.filament = { mode: 'spool', amount: '120', netGrams: '1000' };
    expect(guidedIssues(draft)).toEqual([]);
    const result = calculateExperience(draft); expect(result.kind).toBe('cost');
    if (result.kind === 'cost') expect(result.cost.total).toBe('2.68');
  });
  it('indicadores de erro apontam os campos corretos e sua etapa', () => {
    const draft = newCalculationDraft(); draft.ux!.entry = 'manual'; draft.fields.grams = '22.31';
    const issues = guidedIssues(draft);
    expect(issues).toMatchObject([{ field: 'spool-price', stage: 'costs' }, { field: 'spool-weight', stage: 'costs' }]);
    const markup = renderToStaticMarkup(<GuidedIssues issues={issues} />);
    expect(markup).toContain('Faltam 2 informações'); expect(markup).toContain('Preço da bobina');
  });
  it('campos de máquina não bloqueiam quando máquina não é incluída', () => {
    const draft = newCalculationDraft(); draft.ux!.entry = 'manual'; draft.ux!.materialIncluded = false;
    draft.fields.hours = 'abc'; draft.fields.machine = ''; draft.fields.kwh = '';
    expect(guidedIssues(draft)).toEqual([]);
  });
  it('a embalagem adicional é opcional sem converter custo desconhecido em preço de bobina', () => {
    const draft = newCalculationDraft(); draft.ux!.entry = 'manual'; draft.ux!.materialIncluded = false;
    draft.ux!.packagingIncluded = true; draft.ux!.packagingDecision = 'include'; draft.ux!.packaging.mode = 'unit';
    draft.fields.packagingUnit = '0.50';
    expect(packagingInput(draft)).toMatchObject({ packagingPerUnit: '0.50', packagingPerOrder: '0' });
    expect(guidedIssues(draft)).toEqual([]);
    draft.ux!.packagingExtraIncluded = true;
    expect(guidedIssues(draft).map(issue => issue.field)).toContain('packagingOrder');
  });
  it('importa formatação natural mas não transforma entradas inválidas em zero', () => {
    expect(normalizeNumeric('1h15min', 'duration')).toBe('1.25');
    expect(normalizeNumeric('75 min', 'duration')).toBe('1.25');
    expect(normalizeNumeric('R$ 1.234,56', 'money')).toBe('1234.56');
    expect(normalizeNumeric('22 g', 'weight')).toBe('22');
    expect(numericIssue(normalizeNumeric('abc', 'money'), 'money')).not.toBe('');
  });
  it('quatro PLA configurados e um consumido abrem o formulário simples', () => {
    const parsed = parseThreeMf(archive({
      'Metadata/project_settings.config': JSON.stringify({ filament_type: ['PLA', 'PLA', 'PLA', 'PLA'] }),
      'Metadata/slice_info.config': '<config><plate><metadata key="index" value="1"/><metadata key="prediction" value="3600"/><metadata key="object_count" value="1"/><filament id="1" type="PLA" used_g="22.31"/><filament id="2" type="PLA" used_g="0"/></plate></config>',
    }));
    const draft = applyImportedPlate(newCalculationDraft(), parsed, parsed.plates[0]!);
    expect(draft.materials).toEqual([]);
    expect(draft.fields).toMatchObject({ grams: '22.31', materialName: 'PLA' });
    expect(draft.ux?.origin?.material).toBe('PLA');
  });
  it('venda direta sem extras ativos ignora campos antigos vazios e inválidos', () => {
    const draft = newCalculationDraft(); draft.ux!.entry = 'manual'; draft.ux!.intent = 'sale';
    draft.ux!.materialIncluded = false; draft.ux!.packagingDecision = 'exclude';
    draft.fields.quantity = '1'; draft.fields.price = '19.90';
    draft.fields.discount = ''; draft.fields.other = 'texto inválido'; draft.fields.shipping = '';
    expect(saleExtraSelected(draft, 'discount')).toBe(false);
    expect(expenseBreakdown(draft).other).toBe('0.00');
    expect(guidedIssues(draft)).toEqual([]);
    const output = calculateExperience(draft);
    if (output.kind !== 'sale') throw new Error('Venda direta deveria ser calculável.');
    expect(output.data.result).toMatchObject({ sellerDiscount: '0.00', sellerShipping: '0.00', otherOperatingCosts: '0.00' });
    expect(output.data.result.status).toBe('complete');
  });
  it('despesas ativadas exigem valor e apontam campos editáveis', () => {
    const draft = newCalculationDraft(); draft.ux!.entry = 'manual'; draft.ux!.intent = 'sale';
    draft.ux!.materialIncluded = false; draft.fields.quantity = '1'; draft.fields.price = '19.90';
    draft.fields.discount = ''; draft.fields.other = ''; draft.fields.shipping = '';
    draft.ux!.discountIncluded = true; draft.ux!.otherCostsIncluded = true; draft.ux!.directShippingIncluded = true;
    expect(guidedIssues(draft).map(item => item.field)).toEqual(['discount', 'other', 'shipping']);
    const markup = renderToStaticMarkup(<FormContext value={{ draft, setField: () => {} }}>
      <ExperienceContext value={{ draft, update: () => {} }}><SaleStep tables={[]} onSaveShop={() => {}} /></ExperienceContext>
    </FormContext>);
    for (const field of ['discount', 'other', 'shipping']) expect(markup).toContain('name="' + field + '"');
    expect(() => calculateExperience(draft)).toThrow();
  });
  it('rascunhos antigos sem novos indicadores mantêm despesas previamente registradas', () => {
    const draft = newCalculationDraft(); draft.ux!.entry = 'manual'; draft.ux!.intent = 'sale';
    draft.ux!.materialIncluded = false; draft.ux!.packagingDecision = 'exclude';
    draft.fields.quantity = '1'; draft.fields.price = '19.90';
    delete draft.ux!.discountIncluded; delete draft.ux!.otherCostsIncluded; delete draft.ux!.directShippingIncluded;
    draft.fields.discount = '1.50'; draft.fields.other = '2.00'; draft.fields.shipping = '3.00';
    expect(saleExtraSelected(draft, 'discount')).toBe(true);
    const output = calculateExperience(draft);
    if (output.kind !== 'sale') throw new Error('Falha no rascunho histórico.');
    expect(output.data.result).toMatchObject({ sellerDiscount: '1.50', sellerShipping: '3.00', otherOperatingCosts: '2.00' });
  });
  it('venda direta não solicita dados da Shopee quando há custo conscientemente excluído', () => {
    const draft = newCalculationDraft(); draft.ux!.entry = 'manual'; draft.ux!.intent = 'sale';
    draft.ux!.materialIncluded = false; draft.fields.quantity = '1'; draft.fields.price = '19.90';
    expect(guidedIssues(draft)).toEqual([]);
  });
});
