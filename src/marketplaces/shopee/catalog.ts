import { D, date, decimal, money } from '../../engine/decimal';
import { applyManualFees } from '../../engine/manual';
import type { ManualFee } from '../../engine/manual';
import type { Evidence, FeeRule, Pending, TariffCatalog } from '../../engine/types';

export const SHOPEE_SNAPSHOT = '2026-11-22';
export type Participation = 'inactive' | 'active' | 'unknown';
export interface ShopeeContext {
  seller: 'CPF' | 'CNPJ' | null;
  ordersLast90Days: number | null;
  returnsProtection: 'inactive' | 'trial' | 'billable' | 'unknown';
  highlightCampaign: Participation;
  adsEasy: Participation;
  affiliates: Participation;
  cashAdvance: Participation;
  // An actual seller-funded shipping amount is supplied in SaleInput.
  shippingConfirmed: boolean;
}

const source = (id: string, articles: readonly string[]): Evidence => ({
  id,
  reference: 'Auditoria 0.4 e MHTML oficiais arquivados conferidos localmente em 22/11/2026, com hashes HTML iguais ao inventário. Não comprova vigência nem adesão da conta. Originais não redistribuídos.',
  urls: articles.map(article => `https://seller.shopee.com.br/edu/article/${article}`),
  capturedAt: SHOPEE_SNAPSHOT,
  verification: 'documented',
});

export const shopeeSources = {
  commission: source('shopee-commission-20261122', ['26839/Comissao-para-vendedores-CNPJ-e-CPF-em-2026', '18483/como-funciona-a-politica-de-comissao-para-vendedores-shopee']),
  cpf: source('shopee-cpf-20261122', ['18484/como-funciona-o-adicional-de-comissao-para-vendedores-CPF']),
  returns: source('shopee-returns-20261122', ['26700/Devolucao-Facil-Shopee', '27298']),
  campaign: source('shopee-campaign-20261122', ['18712/pacotes-de-campanhas-shopee']),
};

/** Own synthesis of the supplied audit. Capture dates never become effective dates.
 * Only the capture-day scenario is admitted, always with unresolved validity and
 * rounding. This is a documentary preview, not a confirmed settlement forecast.
 */
export function createShopeeCatalog(context: ShopeeContext, unitPrice: string, sellerDiscount: string, saleDate: string,
  overrides: Readonly<Record<string, ManualFee>> = {}): TariffCatalog {
  date(saleDate);
  const price = money(unitPrice);
  const discount = money(sellerDiscount);
  const isZeroManual = (id: string) => {
    const formula = overrides[id]?.formula;
    return formula !== undefined && decimal(formula.kind === 'fixed' ? formula.amount : formula.rate).isZero();
  };
  if (isZeroManual('shopee:commission') && isZeroManual('shopee:fixed')) {
    throw new Error('A comissão básica obrigatória não pode ser eliminada zerando os dois componentes personalizados.');
  }
  if (context.seller !== null && context.seller !== 'CPF' && context.seller !== 'CNPJ') throw new Error('Perfil deve ser CPF ou CNPJ.');
  if (context.ordersLast90Days !== null && (!Number.isSafeInteger(context.ordersLast90Days) || context.ordersLast90Days < 0)) {
    throw new Error('Pedidos em 90 dias deve ser inteiro não negativo ou desconhecido.');
  }
  const rules: FeeRule[] = [];
  const pending: Pending[] = [];
  const add = (id: string, name: string, formula: FeeRule['formula'], evidence: Evidence, options: Partial<FeeRule> = {}) => {
    rules.push({ id, name, version: 'documentary-2026-11-22-v1-review1', formula, base: 'gross-sales', scope: 'item',
      requirement: 'mandatory', conditions: [], includes: [], effectiveFrom: null, effectiveUntil: null, evidence, ...options });
  };
  if (!discount.isZero()) {
    pending.push({ id: 'shopee:discount-base', message: 'A base e a faixa de comissão com desconto/cupom não foram comprovadas. Informe parâmetros personalizados para os dois componentes da comissão básica.', manualRuleIds: ['shopee:commission', 'shopee:fixed'] });
  }
  const boundary = ['80.00', '100.00', '200.00', '500.00'].some(value => price.eq(value));
  const cpfLow = context.seller === 'CPF' && price.lt(12);
  if (context.seller === null) {
    pending.push({ id: 'shopee:seller', message: 'Selecione explicitamente CPF ou CNPJ; nenhum enquadramento foi presumido.' });
  } else if (boundary) {
    pending.push({ id: 'shopee:price-boundary', message: 'Preço exatamente em 80, 100, 200 ou 500 reais: fronteira documental não esclarecida.', manualRuleIds: ['shopee:commission', 'shopee:fixed'] });
  } else if (cpfLow) {
    pending.push({ id: 'shopee:cpf-regressive', message: 'CPF abaixo de R$ 12: fórmula regressiva e abrangência por volume não determinadas; não houve interpolação. Uma simulação exige os três componentes personalizados, inclusive adicional CPF explícito.', manualRuleIds: ['shopee:commission', 'shopee:fixed', 'shopee:cpf-extra'] });
  } else {
    const rate = price.lt(80) ? '20' : '14';
    const fixed = price.lt(80) ? '4.50' : price.lt(100) ? '16.00' : price.lt(200) ? '20.00' : '26.00';
    add('shopee:commission', 'Comissão percentual (já contempla transação)', discount.isZero() ? { kind: 'percentage', rate } : null,
      shopeeSources.commission, { includes: ['shopee:transaction'] });
    add('shopee:fixed', context.seller === 'CNPJ' && price.lt(9) ? 'Parcela de baixo valor CNPJ: metade do preço' : 'Parcela fixa por item',
      !discount.isZero() ? null : context.seller === 'CNPJ' && price.lt(9) ? { kind: 'percentage', rate: '50' } : { kind: 'fixed', amount: fixed }, shopeeSources.commission);
  }
  // Named unresolved placeholders let a user replace precisely these charges.
  // Accepting validity or rounding alone cannot supply their missing formulas.
  if (context.seller !== null && !rules.some(rule => rule.id === 'shopee:commission')) {
    add('shopee:commission', 'Comissão percentual: regra não determinada para este cenário', null, shopeeSources.commission, { includes: ['shopee:transaction'] });
    add('shopee:fixed', 'Parcela fixa: regra não determinada para este cenário', null, shopeeSources.commission);
  }
  // Explanatory child: excluded by the containing commission before evaluating its null formula.
  if (rules.some(rule => rule.id === 'shopee:commission')) {
    add('shopee:transaction', 'Transação: componente incluído', null, shopeeSources.commission);
  }
  if (context.seller === 'CPF') {
    if (context.ordersLast90Days === null) pending.push({ id: 'shopee:cpf-volume', message: 'Informe os pedidos em 90 dias para avaliar o adicional CPF ou forneça explicitamente seu valor personalizado.', manualRuleIds: ['shopee:cpf-extra'] });
    else if (context.ordersLast90Days === 450) pending.push({ id: 'shopee:cpf-450', message: 'Exatamente 450 pedidos: documentos divergem sobre a incidência do adicional CPF.', manualRuleIds: ['shopee:cpf-extra'] });
    else if (context.ordersLast90Days > 450 && !cpfLow) {
      add('shopee:cpf-extra', 'Adicional CPF de alto volume', { kind: 'fixed', amount: '3.00' }, shopeeSources.cpf,
        { requirement: 'conditional', conditions: [{ key: 'cpfHighVolume', equals: true }] });
    }
    if ((cpfLow || context.ordersLast90Days === null || context.ordersLast90Days === 450) && !rules.some(rule => rule.id === 'shopee:cpf-extra')) {
      add('shopee:cpf-extra', 'Adicional CPF: incidência ou valor não determinado', null, shopeeSources.cpf,
        { requirement: 'conditional', conditions: [{ key: 'isCpf', equals: true }] });
    }
  }
  if (context.returnsProtection === 'unknown') pending.push({ id: 'shopee:returns-enrollment', message: 'Confirme se Devolução Fácil está inativo, em teste ou cobrável neste pedido pago.' });
  else {
    add('shopee:returns-protection', 'Devolução Fácil: pedido pago fora da gratuidade', { kind: 'fixed', amount: '0.49' }, shopeeSources.returns,
      { requirement: 'optional', scope: 'order', conditions: [{ key: 'returnsBillable', equals: true }] });
  }
  if (context.highlightCampaign === 'unknown') pending.push({ id: 'shopee:campaign-enrollment', message: 'Confirme a adesão efetiva e o período da Campanha de Destaque.' });
  else add('shopee:highlight', 'Campanha de Destaque: todas as vendas da loja durante adesão', discount.isZero() ? { kind: 'percentage', rate: '5' } : null,
    shopeeSources.campaign, { requirement: 'optional', conditions: [{ key: 'highlightActive', equals: true }] });
  const deferred = [
    ['adsEasy', 'Ads Fácil', ['23254/FAQ-Ads-Facil']],
    ['affiliates', 'Afiliados', ['24596/Solucao-de-marketing-de-afiliados-Campanha', '20749/principais-duvidas-sobre-o-programa-de-afiliados']],
    ['cashAdvance', 'Antecipação Shopee Acelera', ['25990/duvidas-frequentes-sobre-shopee-acelera']],
  ] as const;
  for (const [key, name, articles] of deferred) {
    if (context[key] !== 'inactive') {
      pending.push({ id: `shopee:${key}`, message: `${name}: ${context[key] === 'unknown' ? 'participação desconhecida' : 'módulo automático ainda não implementado; informe valor personalizado apurado, com base e incidência explícitas'}. Nenhum valor zero foi presumido.`,
        ...(context[key] === 'active' ? { manualRuleIds: [`shopee:${key}`] } : {}) });
      if (context[key] === 'active') add(`shopee:${key}`, `${name}: cobrança adicional`, null,
        { ...source(`shopee:${key}:unimplemented`, articles), verification: 'undetermined',
          reference: 'Referências registradas na auditoria; fórmula e base específicas deste cenário não implementadas. Nenhuma tarifa automática foi presumida.' },
        { requirement: 'optional', conditions: [{ key: `${key}Active`, equals: true }] });
    }
  }
  if (!context.shippingConfirmed) pending.push({ id: 'shopee:shipping', message: 'Frete/coparticipação do vendedor ainda não confirmado; o valor informado é apenas parcial.' });
  const catalog = applyManualFees({ marketplace: 'shopee-br', version: 'shopee-br-documentary-2026-11-22-v1-review1', purpose: 'simulation',
    simulationFrom: SHOPEE_SNAPSHOT, simulationUntil: SHOPEE_SNAPSHOT, rules, pending }, overrides);
  const selections: Readonly<Record<string, boolean>> = shopeeSelections(context);
  const included = new Set(catalog.rules.flatMap(rule => rule.includes));
  const activeCharges = catalog.rules.filter(rule => !included.has(rule.id) && selections[rule.id] !== false);
  const hasDocumentedCharge = activeCharges.some(rule => rule.formula !== null && rule.evidence.verification === 'documented');
  const cpfFixedConflict = context.seller === 'CPF' && activeCharges.some(rule => rule.id === 'shopee:fixed' && rule.evidence.verification === 'documented' && rule.formula?.kind === 'fixed' && rule.formula.amount === '4.50');
  // Only a wholly user-defined scenario may use the user's own period outside
  // the documentary snapshot. Mixed scenarios never extrapolate archived fees.
  const whollyCustom = catalog.pending.length === 0 && activeCharges.length > 0 && activeCharges.every(rule => rule.evidence.verification === 'custom');
  const personalFrom = whollyCustom ? activeCharges.map(rule => rule.effectiveFrom!).sort().at(-1)! : catalog.simulationFrom;
  const personalUntil = whollyCustom ? activeCharges.map(rule => rule.effectiveUntil!).sort()[0]! : catalog.simulationUntil;
  return { ...catalog,
    ...(whollyCustom ? { version: `shopee-br-custom-scenario-v01:${personalFrom}:${personalUntil}`, simulationFrom: personalFrom, simulationUntil: personalUntil } : {}),
    assumptions: [
    ...(hasDocumentedCharge ? [{ id: 'shopee:validity', kind: 'validity' as const, message: 'Premissa: usar a tabela arquivada no cenário da captura, sem vigência inicial comprovada. Não é confirmação de repasse.' }] : []),
    ...(cpfFixedConflict ? [{ id: 'shopee:cpf-fixed-precedence', kind: 'precedence' as const, message: 'Premissa CPF: priorizar R$4,50 da tabela do artigo 26839 apesar do trecho de R$4 no artigo 18484. A divergência textual continua sem esclarecimento oficial.' }] : []),
    { id: 'shopee:rounding', kind: 'rounding', message: 'Premissa: HALF_UP por ocorrência; a política de arredondamento da Shopee não foi comprovada.' },
  ] };
}

export function shopeeSelections(context: ShopeeContext) {
  return {
    'shopee:returns-protection': context.returnsProtection === 'billable',
    'shopee:highlight': context.highlightCampaign === 'active',
    'shopee:adsEasy': context.adsEasy === 'active',
    'shopee:affiliates': context.affiliates === 'active',
    'shopee:cashAdvance': context.cashAdvance === 'active',
  };
}

export function shopeeFacts(context: ShopeeContext) {
  return {
    isCpf: context.seller === 'CPF',
    cpfHighVolume: context.seller === 'CPF' && context.ordersLast90Days !== null && new D(context.ordersLast90Days).gt(450),
    returnsBillable: context.returnsProtection === 'billable',
    highlightActive: context.highlightCampaign === 'active',
    adsEasyActive: context.adsEasy === 'active',
    affiliatesActive: context.affiliates === 'active',
    cashAdvanceActive: context.cashAdvance === 'active',
  };
}
