import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import type { CalculatorDraft } from '../src/app/model';
import { calculateExperience, exampleDraft } from '../src/app/experience';
import { FormContext } from '../src/ui/Fields';
import { ExperienceContext } from '../src/ui/ExperienceContext';
import { ExperienceResult } from '../src/ui/ExperienceResult';
import { ShopQuestions } from '../src/ui/ShopQuestions';
import { PrintImport } from '../src/ui/PrintImport';
import { bundledTables } from '../src/marketplaces/catalogs/bundled';
import { realDraft, cpfDraft } from './ux-helpers';

function render(draft: CalculatorDraft, children: ReactNode) {
  return renderToStaticMarkup(<FormContext value={{ draft, setField: () => {} }}><ExperienceContext value={{ draft, update: () => {} }}>{children}</ExperienceContext></FormContext>);
}
describe('UX V2: semântica e comunicação do resultado em HTML estático', () => {
  it('custo sem venda não exibe cartões de repasse e lucro nem preço fictício', () => {
    const draft = realDraft(); const html = render(draft, <ExperienceResult frozen={calculateExperience(draft)} />);
    expect(html).toContain('Total dos custos selecionados'); expect(html).not.toContain('<dt>Repasse'); expect(html).not.toContain('<dt>Lucro'); expect(html).not.toContain('headline-price');
    expect(html).toContain('Mão de obra não incluída');
  });
  it('resultado parcial nunca rotula um subtotal calculável como lucro final', () => {
    const draft = cpfDraft(); draft.fields.ads = 'unknown'; const html = render(draft, <ExperienceResult frozen={calculateExperience(draft)} />);
    expect(html).toContain('Parcial'); expect(html).toContain('Subtotal de tarifas conhecidas — incompleto'); expect(html).toContain('Lucro final indisponível'); expect(html).toContain('Pendente'); expect(html).not.toContain('result-total loss');
  });
  it('erro ou edição ocultam a saída mesmo que um resultado anterior ainda exista no objeto', () => {
    const draft = realDraft(); const previous = calculateExperience(draft);
    const html = render(draft, <ExperienceResult state={{ signature: 'changed', phase: 'waiting', output: previous }} />);
    expect(html).toContain('sendo atualizado'); expect(html).not.toContain('result-metrics');
    const error = render(draft, <ExperienceResult state={{ signature: 'invalid', phase: 'invalid', error: 'Informe o peso', output: previous }} />);
    expect(error).toContain('Informe o peso'); expect(error).not.toContain('result-metrics');
  });
  it('busca bloqueada não publica o preço máximo usado internamente para validar as entradas', () => {
    const draft = cpfDraft(); draft.fields.calculation = 'profit'; draft.fields.targetProfit = '5'; draft.fields.maxPrice = '40';
    const output = calculateExperience(draft); expect(output.kind).toBe('blocked-search');
    const html = render(draft, <ExperienceResult frozen={output} />); expect(html).toContain('Busca não concluída'); expect(html).not.toContain('headline-price'); expect(html).not.toContain('result-metrics');
  });
  it('demonstração declara origem fictícia e não oferece salvar como produto real', () => {
    const draft = exampleDraft(); const html = render(draft, <ExperienceResult state={{ signature: 'demo', phase: 'ready', output: calculateExperience(draft) }} />);
    expect(html).toContain('Exemplo fictício'); expect(html).toContain('não serão salvos'); expect(html).not.toContain('Salvar produto e simulação');
  });
  it('perguntas preservam Não sei e a comissão obrigatória está marcada e bloqueada', () => {
    const draft = cpfDraft(); const html = render(draft, <ShopQuestions tables={bundledTables} />);
    expect(html).toContain('Não sei'); expect(html).toContain('Auditoria completa'); expect(html).toContain('Entenda as taxas'); expect(html).toMatch(/<input[^>]*disabled=""[^>]*aria-label="Comissão básica obrigatória"[^>]*checked=""/);
    expect(html).toContain('frete efetivamente'); expect(html).toContain('Central do Vendedor');
    const permanent = render(draft, <ShopQuestions tables={bundledTables} permanentOnly />); expect(permanent).not.toContain('frete efetivamente'); expect(permanent).not.toContain('ultrapassou');
  });
  it('seleção local tem botão nativo e rótulo associado; arrastar não é a única alternativa', () => {
    const html = renderToStaticMarkup(<PrintImport draft={realDraft()} onApply={() => {}} primary />);
    expect(html).toContain('type="button"'); expect(html).toContain('Selecionar arquivo'); expect(html).toContain('.gcode.3mf'); expect(html).toContain('Nada é enviado');
    const id = html.match(/<input[^>]*id="([^"]+)"/)?.[1]; expect(id).toBeTruthy(); expect(html).toContain(`for="${id}"`);
  });
});
