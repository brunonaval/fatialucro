import { D, date, money } from '../../engine/decimal';
import type { Evidence, FeeRule, Pending, TariffCatalog } from '../../engine/types';

export const SHOPEE_SNAPSHOT = '2026-11-22';
export type Participation = 'inactive' | 'active' | 'unknown';
export interface ShopeeContext {
  seller: 'CPF' | 'CNPJ';
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
  reference: 'Auditoria documental 0.4, capturada em 22/11/2026; síntese secundária de páginas oficiais arquivadas, sem MHTML originais neste projeto.',
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
export function createShopeeCatalog(context: ShopeeContext, unitPrice: string, sellerDiscount: string, saleDate: string): TariffCatalog {
  date(saleDate);
  const price = money(unitPrice);
  const discount = money(sellerDiscount);
  if (context.seller !== 'CPF' && context.seller !== 'CNPJ') throw new Error('Perfil deve ser CPF ou CNPJ.');
  if (context.ordersLast90Days !== null && (!Number.isSafeInteger(context.ordersLast90Days) || context.ordersLast90Days < 0)) {
    throw new Error('Pedidos em 90 dias deve ser inteiro não negativo ou desconhecido.');
  }
  const rules: FeeRule[] = [];
  const pending: Pending[] = [
    { id: 'shopee:validity', message: 'A captura e as datas de atualização não comprovam o início da vigência das tarifas. A prévia não é um recebimento confirmado.' },
    { id: 'shopee:rounding', message: 'Critério e unidade de arredondamento da Shopee ainda não validados; a prévia usa HALF_UP por ocorrência.' },
  ];
  const add = (id: string, name: string, formula: FeeRule['formula'], evidence: Evidence, options: Partial<FeeRule> = {}) => {
    rules.push({ id, name, version: 'documentary-2026-11-22-v1', formula, base: 'gross-sales', scope: 'item',
      requirement: 'mandatory', conditions: [], includes: [], effectiveFrom: null, effectiveUntil: null, evidence, ...options });
  };
  if (!discount.isZero()) {
    pending.push({ id: 'shopee:discount-base', message: 'A base de comissão com desconto/cupom não foi comprovada. Comissão percentual não calculada neste cenário.' });
  }
  const boundary = ['80.00', '100.00', '200.00', '500.00'].some(value => price.eq(value));
  const cpfLow = context.seller === 'CPF' && price.lt(12);
  if (boundary) {
    pending.push({ id: 'shopee:price-boundary', message: 'Preço exatamente em 80, 100, 200 ou 500 reais: fronteira documental não esclarecida.' });
  } else if (cpfLow) {
    pending.push({ id: 'shopee:cpf-regressive', message: 'CPF abaixo de R$ 12: fórmula regressiva e abrangência por volume não determinadas; não houve interpolação.' });
  } else {
    const rate = price.lt(80) ? '20' : '14';
    const fixed = price.lt(80) ? '4.50' : price.lt(100) ? '16.00' : price.lt(200) ? '20.00' : '26.00';
    add('shopee:commission', 'Comissão percentual (já contempla transação)', discount.isZero() ? { kind: 'percentage', rate } : null,
      shopeeSources.commission, { includes: ['shopee:transaction'] });
    add('shopee:fixed', context.seller === 'CNPJ' && price.lt(9) ? 'Parcela de baixo valor CNPJ: metade do preço' : 'Parcela fixa por item',
      context.seller === 'CNPJ' && price.lt(9) ? { kind: 'percentage', rate: '50' } : { kind: 'fixed', amount: fixed }, shopeeSources.commission);
  }
  // Explanatory child: excluded by the containing commission before evaluating its null formula.
  if (rules.some(rule => rule.id === 'shopee:commission')) {
    add('shopee:transaction', 'Transação: componente incluído', null, shopeeSources.commission);
  }
  if (context.seller === 'CPF') {
    if (context.ordersLast90Days === null) pending.push({ id: 'shopee:cpf-volume', message: 'Informe os pedidos em 90 dias para avaliar o adicional CPF.' });
    else if (context.ordersLast90Days === 450) pending.push({ id: 'shopee:cpf-450', message: 'Exatamente 450 pedidos: documentos divergem sobre a incidência do adicional CPF.' });
    else if (context.ordersLast90Days > 450 && !cpfLow) {
      add('shopee:cpf-extra', 'Adicional CPF de alto volume', { kind: 'fixed', amount: '3.00' }, shopeeSources.cpf,
        { requirement: 'conditional', conditions: [{ key: 'cpfHighVolume', equals: true }] });
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
  const deferred = [['adsEasy', 'Ads Fácil'], ['affiliates', 'Afiliados'], ['cashAdvance', 'Antecipação Shopee Acelera']] as const;
  for (const [key, name] of deferred) {
    if (context[key] !== 'inactive') pending.push({ id: `shopee:${key}`, message: `${name}: ${context[key] === 'unknown' ? 'participação desconhecida' : 'módulo ainda não implementado; faltam parâmetros e base efetiva'}. Nenhum valor zero foi presumido.` });
  }
  if (!context.shippingConfirmed) pending.push({ id: 'shopee:shipping', message: 'Frete/coparticipação do vendedor ainda não confirmado; o valor informado é apenas parcial.' });
  return { marketplace: 'shopee-br', version: 'shopee-br-documentary-2026-11-22-v1', purpose: 'simulation',
    simulationFrom: SHOPEE_SNAPSHOT, simulationUntil: SHOPEE_SNAPSHOT, rules, pending };
}

export function shopeeSelections(context: ShopeeContext) {
  return {
    'shopee:returns-protection': context.returnsProtection === 'billable',
    'shopee:highlight': context.highlightCampaign === 'active',
  };
}

export function shopeeFacts(context: ShopeeContext) {
  return {
    cpfHighVolume: context.seller === 'CPF' && context.ordersLast90Days !== null && new D(context.ordersLast90Days).gt(450),
    returnsBillable: context.returnsProtection === 'billable',
    highlightActive: context.highlightCampaign === 'active',
  };
}
