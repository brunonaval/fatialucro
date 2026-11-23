import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { focusCorrectionTarget, focusPageStart } from '../src/ui/navigation';
import { FormContext, Field, Input } from '../src/ui/Fields';
import { newCalculationDraft } from '../src/app/experience';
import type { GuidedIssue } from '../src/ui/guided-validation';
import { UpdatePanel } from '../src/ui/UpdatePanel';
import { checkPublishedRelease } from '../src/app/app-updates';

describe('Auditoria UX — navegação correta e erros indicados no campo', () => {
  it('trocar Calcular e Configurações leva ao início da página, não ao centro', () => {
    const focus = vi.fn();
    const scrollTo = vi.fn();
    focusPageStart(
      { getElementById: () => ({ focus }) } as unknown as Document,
      { scrollTo } as unknown as Window,
    );
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('o menu principal usa navegação para o topo, e etapas não são posicionadas no centro', async () => {
    const { readFileSync } = await import('node:fs');
    const app = readFileSync(new URL('../src/ui/App.tsx', import.meta.url), 'utf8');
    expect(app).toContain('onClick={() => navigatePage(value)}');
    expect(app).toContain('useLayoutEffect(() => { focusPageStart(); }, [page])');
    expect(app).not.toContain("focusTarget.current ?? (page === 'calculate'");
  });

  it('o foco numa etapa começa pelo título, não pelo botão que estiver dentro dela', () => {
    class MockElement {
      attrs = new Map<string, string>();
      parentElement = null;
      focus = vi.fn();
      scrollIntoView = vi.fn();
      getAttribute(name: string) { return this.attrs.get(name) ?? null; }
      setAttribute(name: string, value: string) { this.attrs.set(name, value); }
      removeAttribute(name: string) { this.attrs.delete(name); }
      hasAttribute(name: string) { return this.attrs.has(name); }
      matches() { return false; }
      closest() { return null; }
    }
    vi.stubGlobal('HTMLElement', MockElement);
    vi.stubGlobal('HTMLDetailsElement', class extends MockElement {});
    try {
      const section = new MockElement();
      const doc = {
        querySelectorAll: () => [],
        getElementById: (id: string) => id === 'result-step' ? section : null,
      } as unknown as Document;
      expect(focusCorrectionTarget('result-step', doc)).toBe(true);
      expect(section.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
      expect(section.hasAttribute('tabindex')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('corrigir um campo abre cada seção recolhida, foca o campo exato e o destaca', () => {
    class FakeNode {
      parentElement: FakeNode | null = null;
      attrs = new Map<string, string>();
      focus = vi.fn();
      scrollIntoView = vi.fn();
      label: FakeNode | null = null;
      matches(_selector: string) { return true; }
      closest(selector: string) { return selector === 'label' ? this.label : null; }
      getAttribute(name: string) { return this.attrs.get(name) ?? null; }
      setAttribute(name: string, value: string) { this.attrs.set(name, value); }
      removeAttribute(name: string) { this.attrs.delete(name); }
      hasAttribute(name: string) { return this.attrs.has(name); }
    }
    class FakeDetails extends FakeNode { open = false; }
    vi.stubGlobal('HTMLElement', FakeNode);
    vi.stubGlobal('HTMLDetailsElement', FakeDetails);
    try {
      const label = new FakeNode();
      const field = new FakeNode(); field.label = label;
      field.setAttribute('name', 'spool-price');
      const nested = new FakeDetails(); const outer = new FakeDetails();
      field.parentElement = nested; nested.parentElement = outer;
      const doc = {
        querySelectorAll(selector: string) { return selector.includes('data-correction-target') ? [] : [field]; },
        getElementById() { return null; },
      } as unknown as Document;
      expect(focusCorrectionTarget('field:spool-price', doc)).toBe(true);
      expect(nested.open).toBe(true);
      expect(outer.open).toBe(true);
      expect(field.focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(field.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' });
      expect(label.getAttribute('data-correction-target')).toBe('true');
      expect(focusCorrectionTarget('field:inexistente', doc)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('os erros do resumo também aparecem junto aos inputs obrigatórios', () => {
    const draft = newCalculationDraft();
    const issues: GuidedIssue[] = [
      { id: 'print:grams', field: 'grams', stage: 'print', label: 'Peso do filamento', message: 'Informe o peso em gramas da impressão.' },
      { id: 'sale:quantity', field: 'quantity', stage: 'sale', label: 'Unidades vendidas', message: 'Informe a quantidade vendida.' },
    ];
    const markup = renderToStaticMarkup(
      <FormContext value={{ draft, setField: () => {}, issues, showErrors: true }}>
        <Field name="grams" label="Peso (g)" decimal />
        <Input name="quantity" label="Unidades vendidas" />
        <Input name="productName" label="Nome opcional da peça" required={false} />
      </FormContext>,
    );
    expect(markup).toContain('Informe o peso em gramas da impressão.');
    expect(markup).toContain('Informe a quantidade vendida.');
    expect(markup.match(/aria-invalid="true"/g)).toHaveLength(2);
    expect(markup).toContain('field-needs-attention');
    expect(markup).toContain('Obrigatório');
    expect(markup).toContain('Opcional');
  });

  it('o usuário não vê erro obrigatório antes de tentar concluir o cálculo', () => {
    const draft = newCalculationDraft();
    const issues: GuidedIssue[] = [{ id: 'print:grams', field: 'grams', stage: 'print', label: 'Peso', message: 'Informe o peso.' }];
    const markup = renderToStaticMarkup(
      <FormContext value={{ draft, setField: () => {}, issues, showErrors: false }}>
        <Field name="grams" label="Peso da impressão" />
      </FormContext>,
    );
    expect(markup).not.toContain('aria-invalid="true"');
    expect(markup).not.toContain('Informe o peso.');
  });

  it('o botão de atualizações está visível; consulta release sem download executável', async () => {
    const html = renderToStaticMarkup(<UpdatePanel />);
    expect(html).toContain('Buscar atualizações');
    expect(html).toContain('Versão instalada:');
    expect(html).toContain('Histórico de versões publicadas');
    const requester = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const checked = await checkPublishedRelease('0.1.1', requester);
    expect(checked.status).toBe('not-published');
    expect(requester).toHaveBeenCalledWith(
      'https://api.github.com/repos/brunonaval/fatialucro/releases/latest',
      { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' },
    );
  });
});
