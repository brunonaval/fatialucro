import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editableNumeric, formattedNumeric, normalizeNumeric, numericIssue } from '../src/ui/format';
import { NumericInput } from '../src/ui/Fields';
import { FinancialSummary } from '../src/ui/FinancialSummary';
import { App } from '../src/ui/App';
import { calculateExperience } from '../src/app/experience';
import { defaultDraft } from '../src/app/model';

describe('formatação decimal de campos e estrutura acessível sem navegador', () => {
  it('formata moeda e aceita colagem brasileira sem arredondar centavos inválidos', () => {
    expect(formattedNumeric('123456789012345678.12', 'money')).toBe('123.456.789.012.345.678,12');
    expect(normalizeNumeric('R$ 1.234,56', 'money')).toBe('1234.56');
    expect(numericIssue('1.234', 'money')).toContain('duas');
  });
  it('mostra 20% e mantém razão 0,20 no motor, sem reescalar percentuais das tarifas', () => {
    expect(formattedNumeric('0.20', 'ratio')).toBe('20'); expect(normalizeNumeric('20%', 'ratio')).toBe('0.2');
    expect(normalizeNumeric('20%', 'percent')).toBe('20'); expect(numericIssue('101', 'percent')).not.toBe('');
  });
  it('converte duração com precisão e rejeita minutos/segundos inválidos', () => {
    expect(normalizeNumeric('1:30:00', 'duration')).toBe('1.5'); expect(editableNumeric('1.03', 'duration')).toBe('1:01:48');
    const exact = '0.333333333333'; expect(normalizeNumeric(editableNumeric(exact, 'duration'), 'duration')).toBe(exact);
    expect(numericIssue(normalizeNumeric('1:60:00', 'duration'), 'duration')).not.toBe('');
    expect(normalizeNumeric('22,310 g', 'weight')).toBe('22.310'); expect(formattedNumeric('22.310', 'weight')).toBe('22,31');
  });
  it('renderiza rótulo associado, dica e affordance de moeda em HTML estático', () => {
    const html = renderToStaticMarkup(createElement(NumericInput, { value: '19.90', onValue: () => {}, kind: 'money', name: 'price', label: 'Preço unitário' }));
    const id = html.match(/id="([^"]+)"/)?.[1]; expect(id).toBeTruthy(); expect(html).toContain(`for="${id}"`); expect(html).toContain('aria-describedby='); expect(html).toContain('19,90');
  });
  it('estrutura principal tem navegação, tema e link de salto; IDs são únicos', () => {
    const html = renderToStaticMarkup(createElement(App));
    for (const label of ['Pular para o conteúdo', 'Simulação rápida', 'Simulação completa detalhada', 'Meus produtos', 'Configurações', 'Comece pela sua impressão', 'Importar impressão']) expect(html).toContain(label);
    expect(html).toContain('aria-current="page"'); const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]); expect(new Set(ids).size).toBe(ids.length);
  });
  it('resumo distingue ausência, custo parcial e prejuízo estimado', () => {
    const draft = defaultDraft();
    const empty = renderToStaticMarkup(createElement(FinancialSummary, { draft, state: { signature: 'empty', phase: 'waiting' } })); expect(empty).toContain('Valores antigos');
    draft.fields.marketplace = 'shopee'; const output = calculateExperience(draft);
    const partial = renderToStaticMarkup(createElement(FinancialSummary, { draft, state: { signature: 'partial', phase: 'ready', output } })); expect(partial).toContain('tarifas conhecidas'); expect(partial).toContain('Ainda não podemos determinar'); expect(partial).toContain('Pendente');
    draft.fields.marketplace = 'direct'; draft.fields.price = '1';
    const loss = renderToStaticMarkup(createElement(FinancialSummary, { draft, state: { signature: 'loss', phase: 'ready', output: calculateExperience(draft) } })); expect(loss).toContain('loss'); expect(loss).toContain('Prejuízo');

  });
  it('tokens de texto e estados preservam contraste WCAG AA nos dois temas', () => {
    const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
    const blocks = [css.match(/:root \{([\s\S]*?)\}/)![1]!, css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\}/)![1]!];
    const luminance = (hex: string) => { const rgb = hex.match(/[0-9a-f]{2}/gi)!.map(channel => { const n = parseInt(channel, 16) / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }); return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722; };
    for (const block of blocks) {
      const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(match => [match[1], match[2]!]));
      for (const [foreground, background] of [['text', 'surface'], ['muted', 'surface'], ['accent', 'surface'], ['on-accent', 'accent'], ['error', 'error-bg'], ['warning-text', 'warning-bg'], ['success-text', 'success-bg']]) {
        const a = luminance(tokens[foreground!]!); const b = luminance(tokens[background!]!); expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
