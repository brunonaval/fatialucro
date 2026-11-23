import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { newCalculationDraft, calculateExperience } from '../src/app/experience';
import type { CalculatorDraft } from '../src/app/model';
import { guidedIssues } from '../src/ui/guided-validation';
import type { GuidedIssue } from '../src/ui/guided-validation';
import { GuidedIssues } from '../src/ui/GuidedIssues';
import { FinancialSummary } from '../src/ui/FinancialSummary';
import { ExperienceResult } from '../src/ui/ExperienceResult';
import { currentFinancialState } from '../src/ui/useAutomaticCalculation';
import { FilamentFields } from '../src/ui/CostFields';
import { FormContext } from '../src/ui/Fields';
import { ExperienceContext } from '../src/ui/ExperienceContext';

function startCost(): CalculatorDraft {
  const draft = newCalculationDraft(new Date(2026, 10, 23));
  draft.ux!.entry = 'manual';
  draft.fields.grams = '22.31';
  draft.ux!.filament = { mode: 'spool', amount: '120', netGrams: '1000' };
  return draft;
}
function multicolorPla(): CalculatorDraft {
  const draft = newCalculationDraft(new Date(2026, 10, 23));
  draft.ux!.entry = 'import';
  draft.fields.basis = 'batch';
  draft.fields.pieces = '1';
  draft.materials = [
    { id: 'import-0', name: 'PLA', grams: '15', pricePerKg: '', purchase: { amount: '100', netGrams: '1000' } },
    { id: 'import-1', name: 'PLA', grams: '7.31', pricePerKg: '120' },
  ];
  return draft;
}
function costForm(draft: CalculatorDraft) {
  return renderToStaticMarkup(
    <FormContext value={{ draft, setField: () => {} }}>
      <ExperienceContext value={{ draft, update: () => {} }}>
        <FilamentFields entries={[]} onProfile={() => {}} />
      </ExperienceContext>
    </FormContext>,
  );
}

describe('Auditoria final UX — jornadas simples e recuperação de problemas', () => {
  it('primeiro custo: apenas 22,31 g + bobina de R$120/1000g, sem horário, loja ou máquina', () => {
    const draft = startCost();
    expect(draft.fields.hours).toBe('');
    expect(draft.fields.basis).toBe('unit');
    expect(guidedIssues(draft)).toEqual([]);
    const result = calculateExperience(draft);
    if (result.kind !== 'cost') throw new Error('O custo simples não foi concluído.');
    expect(result.cost.total).toBe('2.68');
  });

  it('primeira venda direta não exige perguntas da Shopee ou configurações de oficina', () => {
    const draft = startCost();
    draft.ux!.intent = 'sale'; draft.ux!.packagingDecision = 'exclude';
    draft.fields.marketplace = 'direct';
    draft.fields.price = '19.90'; draft.fields.quantity = '1';
    expect(guidedIssues(draft)).toEqual([]);
    const output = calculateExperience(draft);
    if (output.kind !== 'sale') throw new Error('Venda direta não calculada.');
    expect(output.data.result.status).toBe('complete');
    expect(output.data.result.sellerDiscount).toBe('0.00');
    expect(output.data.result.sellerShipping).toBe('0.00');
  });

  it('dois consumos PLA, de bobinas distintas, mantêm preços independentes', () => {
    const draft = multicolorPla();
    expect(guidedIssues(draft)).toEqual([]);
    const result = calculateExperience(draft);
    if (result.kind !== 'cost') throw new Error('Custos multi-material não calculados.');
    expect(result.cost.total).toBe('2.38');
    const html = costForm(draft);
    expect(html).toContain('Filamento 1:');
    expect(html).toContain('Filamento 2:');
    expect(html).toContain('Corrigir custo desta bobina');
    expect(html).toContain('name="import-0-purchase"');
    expect(html).toContain('name="import-1-kg"');
  });

  it('perfil com custo inválido oferece correção exatamente na bobina correspondente', () => {
    const draft = multicolorPla();
    draft.materials[0]!.purchase!.amount = 'preço incorreto';
    const issues = guidedIssues(draft);
    expect(issues.map(issue => issue.field)).toContain('import-0-purchase');
    const html = costForm(draft);
    expect(html).toContain('custo ou peso inválido');
    expect(html).toContain('name="import-0-purchase"');
    expect(html).toContain('informar outro preço por kg');
    const guided = renderToStaticMarkup(<GuidedIssues issues={issues} />);
    expect(guided).toContain('Compra de PLA');
  });

  it('resumo oferece corrigir o primeiro campo e não esconde permanentemente os demais', () => {
    const issues: GuidedIssue[] = Array.from({ length: 8 }, (_, i) => ({
      id: 'costs:' + i, stage: 'costs', field: 'campo-' + i, label: 'Campo ' + i, message: 'Informe o valor.',
    }));
    const html = renderToStaticMarkup(<GuidedIssues issues={issues} onFix={() => {}} />);
    expect(html).toContain('Faltam 8 informações');
    expect(html).toContain('Corrigir primeiro campo pendente');
    expect(html).toContain('Ver todas as 8 pendências');
    expect(html).toContain('Campo 0');
    expect(html).not.toContain('Campo 7:');
  });

  it('erro técnico não é apresentado como erro do campo e oferece tentar novamente', () => {
    const draft = startCost();
    const state = currentFinancialState({ signature: 'example', phase: 'invalid', error: 'Worker não inicializou' }, 'example');
    expect(state.errorKind).toBe('technical');
    const summary = renderToStaticMarkup(<FinancialSummary draft={draft} state={state} issues={[]} onRetry={() => {}} />);
    expect(summary).toContain('Tentar calcular novamente');
    expect(summary).toContain('Seus dados foram preservados');
    const page = renderToStaticMarkup(
      <FormContext value={{ draft, setField: () => {} }}>
        <ExperienceContext value={{ draft, update: () => {} }}>
          <ExperienceResult state={state} onRetry={() => {}} />
        </ExperienceContext>
      </FormContext>,
    );
    expect(page).toContain('O processamento local falhou');
    expect(page).toContain('Tentar calcular novamente');
  });

  it('erro de entrada, distinto do técnico, mantém a orientação dos campos', () => {
    const state = currentFinancialState({ signature: 'x', phase: 'ready', output: { preview: { lines: [], known: '0.00', total: null, perPiece: null, quantity: null }, finished: true, error: 'Informe o preço pago pela bobina.' } }, 'x');
    expect(state.phase).toBe('invalid');
    expect(state.errorKind).toBe('input');
  });
});
