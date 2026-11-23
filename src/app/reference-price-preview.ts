import { calculateWorkspace } from './calculate';
import { saleExtraSelected, text } from './model';
import type { CalculatorDraft } from './model';
import { selectTable } from '../marketplaces/catalogs/select';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { acceptHypotheses, scenarioPrograms } from './ux-v3';
import { parseBrazilianMoney } from '../engine/decimal';

export interface ReferencePricePreview {
  lower: string | null;
  upper: string | null;
  unreachableScenarios: number;
  searchEnd: string;
  returnsUnconfirmed: boolean;
  searchStart: string;
  hypotheticalConditions: string[];
  excludedActivePrograms: string[];
}

/** A separate, non-persisted illustration. Never turns an unknown actual charge
 * into confirmed zero. Retain documented active fees and valid manual fees.
 * Two explicitly conditional scenarios cover known binary fee alternatives;
 * unquantified charges remain outside the illustrated prices. */
export function referencePricePreview(draft: CalculatorDraft, tables: readonly ShopeeTable[]): ReferencePricePreview | null {
  const channel = text(draft, 'marketplace');
  if (!['direct', 'shopee'].includes(channel) ||
      !['profit', 'margin', 'equilibrium'].includes(text(draft, 'calculation')) || !draft.ux) return null;
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
    const deferred = [
      ['ads', 'Ads Fácil', 'shopee:adsEasy'],
      ['affiliates', 'Afiliados', 'shopee:affiliates'],
      ['advance', 'Shopee Acelera', 'shopee:cashAdvance'],
    ] as const;
    for (const [field, name, id] of deferred) {
      if (fields[field] === 'unknown') {
        baseline.fields[field] = 'inactive';
        hypotheticalConditions.push(name + ': participação não informada, cobrança excluída apenas do preço-base');
      } else if (fields[field] === 'active' && fields[id + ':manual'] !== true) {
        baseline.fields[field] = 'inactive';
        excludedActivePrograms.push(name);
      }
    }
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
  const cases = returnsUnknown || highlightUnknown || volumeUncertain ? [false, true] : [false];
  const prices: string[] = [];
  let minimumStart: string | null = null;
  let maximumEnd: string | null = null;
  let unreachableScenarios = 0;
  try {
    for (const high of cases) {
      let illustration = structuredClone(baseline);
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
      illustration.fields.price = text(illustration, 'maxPrice');
      const calculation = calculateWorkspace(illustration, tables, referenceDiscountGross);
      const solution = calculation.solution;
      minimumStart = calculation.searchRange?.min ?? null;
      maximumEnd = calculation.searchRange?.max ?? null;
      if (!solution || solution.status === 'partial') return null;
      if (solution.status === 'not-found') { unreachableScenarios++; continue; }
      if (solution.result.status !== 'complete') return null;
      prices.push(solution.unitPrice);
    }
    const sorted = prices.sort((a, b) => Number(a) - Number(b));
    if (!minimumStart || !maximumEnd) return null;
    return { lower: sorted[0] ?? null, upper: sorted.at(-1) ?? null, unreachableScenarios, searchEnd: maximumEnd, returnsUnconfirmed: returnsUnknown, searchStart: minimumStart, hypotheticalConditions, excludedActivePrograms };
  } catch {
    return null;
  }
}
