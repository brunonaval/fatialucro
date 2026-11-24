import { D } from '../../engine/decimal';
import type { Evidence } from '../../engine/types';

export interface ProgramPricing {
  adsRate?: string;
  affiliateRate?: string;
  affiliateAttribution?: 'none' | 'direct' | 'indirect' | 'unknown';
  affiliateDynamic?: 'off' | 'low' | 'base' | 'high' | 'unknown';
  affiliateExtraRate?: string; // percentage of affiliate commission, only if reported by seller
  advanceTier?: 'official' | 'indicated' | 'other' | 'unknown';
  advanceShare?: string; // effective share of eligible receivable advanced (0 = not advanced)
}
export const programReference = { adsMax: '5', affiliateIllustration: '4', advanceRates: { official: '1', indicated: '2.5', other: '3.5' } } as const;
export function programPercent(value: string | undefined, max = 100): string | undefined {
  if (typeof value !== 'string' || !/^\d{1,3}(?:[,.]\d{1,6})?$/.test(value)) return undefined;
  const n = new D(value.replace(',', '.'));
  return n.lte(max) ? n.toFixed() : undefined;
}
export function automaticProgramRates(p: ProgramPricing = {}) {
  const ads = programPercent(p.adsRate, 5);
  const base = programPercent(p.affiliateRate);
  const extra = programPercent(p.affiliateExtraRate);
  const attribution = p.affiliateAttribution;
  const dynamic = p.affiliateDynamic;
  let affiliate: string | undefined;
  if (attribution === 'none') affiliate = '0';
  else if (base !== undefined && extra !== undefined && (attribution === 'direct' || attribution === 'indirect') && dynamic && dynamic !== 'unknown') {
    const rate = new D(base).mul(attribution === 'indirect' ? '0.3' : '1').mul(dynamic === 'low' ? '0.5' : dynamic === 'high' ? '1.5' : '1').mul(new D(extra).div(100).plus(1));
    if (rate.lte(100)) affiliate = rate.toDecimalPlaces(12).toFixed();
  }
  const share = programPercent(p.advanceShare);
  const tier = p.advanceTier;
  const advance = share === '0' ? '0' : share !== undefined && tier && tier !== 'unknown' ? new D(programReference.advanceRates[tier]).mul(share).div(100).toDecimalPlaces(12).toFixed() : undefined;
  return { ads, affiliate, advance };
}
const article = (id: string, urls: string[], reference: string): Evidence => ({
  id: 'shopee-programs-20261122:' + id, urls: urls.map(u => 'https://seller.shopee.com.br/edu/article/' + u),
  capturedAt: '2026-11-22', verification: 'documented', reference,
});
export const programEvidence = {
  adsEasy: article('ads', ['23254/FAQ-Ads-Facil'], 'Ads Fácil: percentual selecionado na adesão, até 5% da venda concluída; crédito de publicidade, não dinheiro. Base com cupom e arredondamento não confirmados.'),
  affiliates: article('affiliates', ['24596/Solucao-de-marketing-de-afiliados-Campanha','24595/Conheca-a-solucao-de-marketing-de-afiliados','27736/Afiliados-do-Vendedor-Campanhas-Dinamicas','27737/Afiliados-do-vendedor-Fluxo-de-repasse-de-comissoes','27688/Termos-e-Condicoes-Afiliados-Shopee'], 'Comissão extra configurada por produto/loja; atribuição direta 100%, indireta elegível 30%; dinâmica até ±50%. Encargo adicional informado pelo vendedor, não universal. Base de desconto e arredondamento não comprovados.'),
  cashAdvance: article('advance', ['25973/O-que-e-Shopee-Acelera','25990/duvidas-frequentes-sobre-shopee-acelera','25992/onde-consultar-as-taxas-do-shopee-acelera-por-pedido'], 'Taxa de 1%, 2,5% ou 3,5% sobre a parcela resgatada rapidamente; base após comissão e possíveis taxas adicionais, não preço bruto. Proporção efetiva por pedido e arredondamento são parâmetros de simulação. Cashback em créditos não é dinheiro.'),
};
