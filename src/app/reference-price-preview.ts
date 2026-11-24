import { calculateWorkspace } from './calculate';
import { saleExtraSelected, text } from './model';
import type { CalculatorDraft } from './model';
import { selectTable } from '../marketplaces/catalogs/select';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { acceptHypotheses, scenarioPrograms } from './ux-v3';
import { parseBrazilianMoney } from '../engine/decimal';
import { automaticProgramRates, programPercent, programReference } from '../marketplaces/shopee/programs';
import type { ProgramPricing } from '../marketplaces/shopee/programs';
import type { PricingResult } from '../engine/types';

export interface ReferencePricePreview {
  lower: string | null;
  upper: string | null;
  unreachableScenarios: number;
  searchEnd: string;
  returnsUnconfirmed: boolean;
  searchStart: string;
  hypotheticalConditions: string[];
  excludedActivePrograms: string[];
  example?: PricingResult;
  exampleUnitPrice?: string;
  profitRange?: { lower: string; upper: string };
}

/** A separate, non-persisted illustration. Never turns an unknown actual charge
 * into confirmed zero. Retain documented active fees and valid manual fees.
 * Two explicitly conditional scenarios cover known binary fee alternatives;
 * unquantified charges remain outside the illustrated prices. */
export function referencePricePreview(draft: CalculatorDraft, tables: readonly ShopeeTable[]): ReferencePricePreview | null {
  const channel = text(draft, 'marketplace');
  if (!['direct', 'shopee'].includes(channel) ||
      !['direct', 'profit', 'margin', 'equilibrium'].includes(text(draft, 'calculation')) || !draft.ux) return null;
  const directPrice = text(draft, 'calculation') === 'direct';
  const shopee = channel === 'shopee';
  const seller = text(draft, 'seller');
  if (shopee && !['CPF', 'CNPJ'].includes(seller)) return null;
  let table: ShopeeTable | undefined;
  if (shopee) {
    try { table = selectTable(text(draft, 'date'), tables)?.table; } catch { return null; }
    if (!table) return null;
  }
  const fields = scenarioPrograms(draft);
  const baseline = structuredClone(draft);
  baseline.fields = { ...fields };
  // In this transient scenario the materialized effective program answers
  // must not be reset by a stale date-bound declaration.
  delete baseline.ux!.programDeclaration;
  const hypotheticalConditions: string[] = [];
  const excludedActivePrograms: string[] = [];
  const referenceDiscountGross = shopee && saleExtraSelected(draft, 'discount') && Number(text(draft, 'discount').replace(',', '.')) > 0 && fields.manualBasic !== true;
  if (referenceDiscountGross) hypotheticalConditions.push('Desconto do vendedor: nesta referência, a faixa e a comissão usam o preço bruto; o cupom é deduzido da receita. A regra real de incidência não foi comprovada.');
  if (draft.ux.packagingDecision === 'unknown') {
    baseline.ux!.packagingDecision = 'exclude';
    baseline.ux!.packagingIncluded = false;
    hypotheticalConditions.push('Embalagem desconhecida: custo não incluído somente nesta referência');
  }
  if (shopee) {
    // The conditional scenarios below use documented ceilings where available
    // and explicitly illustrative affiliate assumptions (NOT a maximum).
    if (draft.ux.shipping === 'unknown') {
      let amount = '0';
      try { amount = parseBrazilianMoney(text(draft, 'shipping')); } catch { /* No usable estimate supplied. */ }
      baseline.ux!.shipping = Number(amount) > 0 ? 'yes' : 'no';
      baseline.fields.shippingConfirmed = true;
      baseline.fields.shipping = amount;
      hypotheticalConditions.push('Frete desconhecido: apenas o valor parcial informado, se válido, foi incluído; o débito real pode ser maior');
    }
  }
  const count = text(draft, 'orders');
  const exactCount = /^\d+$/.test(count) && Number.isSafeInteger(Number(count));
  const vol = draft.ux.volume;
  const volume = exactCount && table ? Number(count) === table.cpf.volumeThreshold ? 'equal' : Number(count) > table.cpf.volumeThreshold ? 'above' : 'below'
    : table && vol.date === text(draft, 'date') && vol.threshold === table.cpf.volumeThreshold ? vol.answer : 'unknown';
  const volumeUncertain = shopee && seller === 'CPF' && !!table &&
    (volume === 'unknown' || (volume === 'equal' && table.cpf.thresholdInclusive === null)) && fields['shopee:cpf-extra:manual'] !== true;
  if (volumeUncertain) hypotheticalConditions.push('Volume de pedidos desconhecido ou incidência no limite não confirmada: cenários com e sem o adicional CPF documentado');
  const returnsUnknown = shopee && fields.returns === 'unknown';
  const highlightUnknown = shopee && fields.highlight === 'unknown';
  if (highlightUnknown) hypotheticalConditions.push('Campanha de Destaque: cenários com e sem a cobrança documentada');
  const programInput = draft.ux.programPricing ?? {};
  const rates = automaticProgramRates(programInput);
  const activeUnknown = (field: string, id: string, rate: string | undefined) => shopee && (fields[field] === 'unknown' || (fields[field] === 'active' && fields[id + ':manual'] !== true && rate === undefined));
  const adsUncertain = activeUnknown('ads','shopee:adsEasy',rates.ads);
  const affiliateUncertain = activeUnknown('affiliates','shopee:affiliates',rates.affiliate);
  const advanceUncertain = activeUnknown('advance','shopee:cashAdvance',rates.advance);
  if (adsUncertain) hypotheticalConditions.push('Ads Fácil: cenários de adesão/cobrança até 5%; percentual efetivo a conferir.');
  if (affiliateUncertain) hypotheticalConditions.push('Afiliados: cenário ilustrativo com comissão de 4% se não informada, atribuição direta e possível variação de até +50%; não é teto. Encargos não informados não são estimados.');
  if (advanceUncertain) hypotheticalConditions.push('Shopee Acelera: cenários com até 3,5% sobre a parcela líquida resgatada, supondo 100% se a proporção não for informada.');
  const cases = returnsUnknown || highlightUnknown || volumeUncertain || adsUncertain || affiliateUncertain || advanceUncertain ? [false, true] : [false];
  const prices: string[] = [];
  let minimumStart: string | null = null;
  let maximumEnd: string | null = null;
  let unreachableScenarios = 0;
  const profits: string[] = [];
  let example: PricingResult | undefined;
  let exampleUnitPrice: string | undefined;
  try {
    for (const high of cases) {
      let illustration = structuredClone(baseline);
      const p: ProgramPricing = { ...programInput };
      if (adsUncertain) { illustration.fields.ads = high || fields.ads === 'active' ? 'active' : 'inactive'; p.adsRate = programPercent(p.adsRate, 5) ?? (high ? programReference.adsMax : '0'); }
      if (affiliateUncertain) {
        illustration.fields.affiliates = high || fields.affiliates === 'active' ? 'active' : 'inactive';
        p.affiliateRate = programPercent(p.affiliateRate) ?? programReference.affiliateIllustration;
        p.affiliateAttribution = p.affiliateAttribution && p.affiliateAttribution !== 'unknown' ? p.affiliateAttribution : high ? 'direct' : 'none';
        p.affiliateDynamic = p.affiliateDynamic && p.affiliateDynamic !== 'unknown' ? p.affiliateDynamic : high ? 'high' : 'low';
        p.affiliateExtraRate = programPercent(p.affiliateExtraRate) ?? '0';
      }
      if (advanceUncertain) { illustration.fields.advance = high || fields.advance === 'active' ? 'active' : 'inactive'; p.advanceTier = p.advanceTier && p.advanceTier !== 'unknown' ? p.advanceTier : high ? 'other' : 'official'; p.advanceShare = programPercent(p.advanceShare) ?? (high ? '100' : '0'); }
      if (shopee) illustration.ux!.programPricing = p;
      if (returnsUnknown) illustration.fields.returns = high ? 'billable' : 'inactive';
      if (highlightUnknown) illustration.fields.highlight = high ? 'active' : 'inactive';
      if (volumeUncertain && table) {
        illustration.fields.orders = '';
        illustration.ux!.volume = { answer: high ? 'above' : 'below', threshold: table.cpf.volumeThreshold, date: text(draft, 'date') };
      }
      if (table) {
        const review: ('validity' | 'rounding' | 'precedence')[] = ['validity', 'rounding'];
        if (seller === 'CPF' && table.cpf.fixedConflict) review.push('precedence');
        illustration = acceptHypotheses(illustration, table.id, review);
      }
      if (!directPrice) illustration.fields.price = text(illustration, 'maxPrice');
      const calculation = calculateWorkspace(illustration, tables, referenceDiscountGross);
      if (directPrice) {
        if (calculation.result.status !== 'complete' || calculation.result.operatingProfit === null) return null;
        const price = calculation.input.unitPrice;
        prices.push(price); profits.push(calculation.result.operatingProfit);
        minimumStart = maximumEnd = price;
        if (!example || Number(calculation.result.operatingProfit) < Number(example.operatingProfit)) { example = calculation.result; exampleUnitPrice = price; }
        continue;
      }
      const solution = calculation.solution;
      minimumStart = calculation.searchRange?.min ?? null;
      maximumEnd = calculation.searchRange?.max ?? null;
      if (!solution || solution.status === 'partial') return null;
      if (solution.status === 'not-found') { unreachableScenarios++; continue; }
      if (solution.result.status !== 'complete') return null;
      prices.push(solution.unitPrice);
      if (!exampleUnitPrice || Number(solution.unitPrice) >= Number(exampleUnitPrice)) { example = solution.result; exampleUnitPrice = solution.unitPrice; }
    }
    const sorted = prices.sort((a, b) => Number(a) - Number(b));
    if (!minimumStart || !maximumEnd) return null;
    return { lower: sorted[0] ?? null, upper: sorted.at(-1) ?? null, unreachableScenarios, searchEnd: maximumEnd, returnsUnconfirmed: returnsUnknown, searchStart: minimumStart, hypotheticalConditions, excludedActivePrograms, ...(example && exampleUnitPrice ? { example, exampleUnitPrice } : {}), ...(profits.length ? { profitRange: { lower: [...profits].sort((a,b)=>Number(a)-Number(b))[0]!, upper: [...profits].sort((a,b)=>Number(b)-Number(a))[0]! } } : {}) };
  } catch {
    return null;
  }
}
