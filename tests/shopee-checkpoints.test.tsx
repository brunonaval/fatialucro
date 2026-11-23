import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { newCalculationDraft } from '../src/app/experience';
import { shopeeCheckpoints } from '../src/app/shopee-checkpoints';
import { declarePrograms, changeScenarioDate } from '../src/app/ux-v3';
import { bundledTables } from '../src/marketplaces/catalogs/bundled';
import { ShopQuestions } from '../src/ui/ShopQuestions';
import { FormContext } from '../src/ui/Fields';
import { ExperienceContext } from '../src/ui/ExperienceContext';
import { cpfDraft } from './ux-helpers';

function readyCpf() {
  const draft = cpfDraft();
  draft.fields.shippingConfirmed = true;
  draft.fields.shipping = '0';
  return draft;
}

describe('UX V4 — conferência de condições da Shopee sem repetir todas as perguntas', () => {
  it('cadastro incompleto indica respostas pendentes sem presumir CPF nem programas inativos', () => {
    const draft = newCalculationDraft(new Date(2026, 10, 22));
    const checks = shopeeCheckpoints(draft, bundledTables);
    expect(checks.map(check => check.id)).toEqual(['shop-seller', 'shop-programs', 'shop-shipping']);
    expect(checks.filter(check => check.state === 'pending')).toHaveLength(1);
    expect(checks.filter(check => check.state === 'review')).toHaveLength(2);
    expect(draft.fields.returns).toBe('unknown');
    expect(draft.ux?.shipping).toBe('unknown');
  });

  it('CPF conhecido com programas inativos, volume confirmado e frete zero declarado resume só respostas dadas', () => {
    const checks = shopeeCheckpoints(readyCpf(), bundledTables);
    expect(checks.map(check => check.state)).toEqual(['answered', 'answered', 'answered', 'answered']);
    expect(checks.some(check => check.detail.includes('garante lucro'))).toBe(false);
  });

  it('CPF que não sabe volume ou frete continua com pendências', () => {
    const draft = readyCpf();
    draft.ux!.volume.answer = 'unknown';
    draft.ux!.shipping = 'unknown';
    draft.fields.shippingConfirmed = false;
    const checks = shopeeCheckpoints(draft, bundledTables);
    expect(checks.filter(check => check.state === 'review').map(check => check.id)).toEqual(['shop-volume', 'shop-shipping']);
  });

  it('exatamente no limite dos 90 dias exige revisão, sem afirmar cobrança automática', () => {
    const draft = readyCpf(); draft.ux!.volume.answer = 'equal';
    const volume = shopeeCheckpoints(draft, bundledTables).find(check => check.id === 'shop-volume');
    expect(volume?.state).toBe('review');
    expect(volume?.detail).toContain('incidência no limite');
  });

  it('mudar data reabre a conferência dos programas e das condições temporárias', () => {
    let draft = declarePrograms(readyCpf(), 'none');
    draft = changeScenarioDate(draft, '2026-11-23');
    const checks = shopeeCheckpoints(draft, bundledTables);
    expect(checks.find(check => check.id === 'shop-programs')?.state).toBe('pending');
    expect(checks.find(check => check.id === 'shop-volume')?.state).toBe('pending');
    expect(checks.find(check => check.id === 'shop-shipping')?.state).toBe('pending');
  });

  it('um programa ativo não é confundido com tarifa conhecida ou com adesão desconhecida', () => {
    const draft = readyCpf();
    draft.fields.ads = 'active';
    const checks = shopeeCheckpoints(draft, bundledTables);
    expect(checks.find(check => check.id === 'shop-programs')?.state).toBe('review');
    expect(checks.find(check => check.id === 'shop-programs')?.detail).toContain('cobrança ainda depende');
    draft.fields.affiliates = 'unknown';
    expect(shopeeCheckpoints(draft, bundledTables).find(check => check.id === 'shop-programs')?.state).toBe('review');
  });

  it('seleção de frete exige confirmação e número válido, sem converter desconhecido em zero', () => {
    const draft = readyCpf();
    draft.ux!.shipping = 'yes';
    draft.fields.shipping = '';
    expect(shopeeCheckpoints(draft, bundledTables).find(check => check.id === 'shop-shipping')?.state).toBe('pending');
    draft.fields.shipping = '0';
    expect(shopeeCheckpoints(draft, bundledTables).find(check => check.id === 'shop-shipping')?.state).toBe('pending');
    draft.fields.shipping = '4.50';
    expect(shopeeCheckpoints(draft, bundledTables).find(check => check.id === 'shop-shipping')?.state).toBe('answered');
    draft.ux!.shipping = 'unknown';
    expect(shopeeCheckpoints(draft, bundledTables).find(check => check.id === 'shop-shipping')?.state).toBe('pending');
  });

  it('contagem exata informada é mostrada como usada, não como Não sei', () => {
    const draft = readyCpf(); draft.fields.orders = '23';
    draft.ux!.volume.answer = 'unknown';
    const html = renderToStaticMarkup(
      <FormContext value={{ draft, setField: () => {} }}>
        <ExperienceContext value={{ draft, update: () => {} }}>
          <ShopQuestions tables={bundledTables} />
        </ExperienceContext>
      </FormContext>,
    );
    expect(html).toContain('Usando contagem exata de 23 pedidos');
    expect(shopeeCheckpoints(draft, bundledTables).find(check => check.id === 'shop-volume')?.state).toBe('answered');
  });

  it('CNPJ não solicita volume CPF', () => {
    const draft = readyCpf(); draft.fields.seller = 'CNPJ';
    expect(shopeeCheckpoints(draft, bundledTables).some(check => check.id === 'shop-volume')).toBe(false);
  });

  it('com perfil cadastrado, CPF fica compacto e 5 programas já informados não aparecem como 5 campos', () => {
    const draft = readyCpf();
    draft.ux!.profileOrigins = { store: { name: 'Minha loja', signature: 'perfil-confirmado' } };
    const html = renderToStaticMarkup(
      <FormContext value={{ draft, setField: () => {} }}>
        <ExperienceContext value={{ draft, update: () => {} }}>
          <ShopQuestions tables={bundledTables} />
        </ExperienceContext>
      </FormContext>,
    );
    expect(html).toContain('Conferência rápida da Shopee');
    expect(html).toContain('Minha loja cadastrada');
    expect(html).toContain('Alterar CPF ou CNPJ');
    expect(html).toContain('4 respostas já informadas');
    expect(html).not.toContain('Participa de Ads Fácil?');
    expect(html).toContain('não comprova as tarifas');
  });
});
