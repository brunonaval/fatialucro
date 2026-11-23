import { D, date, decimal, money } from '../../engine/decimal';
import { applyManualFees } from '../../engine/manual';
import type { ManualFee } from '../../engine/manual';
import type { Evidence, FeeRule, Pending, TariffCatalog } from '../../engine/types';
import { bundledTables } from '../catalogs/bundled';
import { priceBand, selectTable } from '../catalogs/select';
import type { ShopeeTable } from '../catalogs/types';

export const SHOPEE_SNAPSHOT = '2026-11-22';
export type Participation = 'inactive' | 'active' | 'unknown';
export interface ShopeeContext {
  seller: 'CPF' | 'CNPJ' | null;
  ordersLast90Days: number | null;
  volumeStatement?: { relation: 'above' | 'below' | 'equal' | 'unknown'; threshold: number };
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

/** Versioned documentary adapter. Observation and selection never prove validity. */
export function createShopeeCatalog(context: ShopeeContext, unitPrice: string, sellerDiscount: string, saleDate: string,
  overrides: Readonly<Record<string, ManualFee>> = {}, tables: readonly ShopeeTable[] = bundledTables): TariffCatalog {
  date(saleDate);
  const selection = selectTable(saleDate, tables);
  const table = selection?.table ?? tables.filter(item => item.confirmation !== 'withdrawn').sort((a, b) => b.revision - a.revision)[0];
  if (!table) return { marketplace: 'shopee-br', version: 'unavailable', purpose: 'simulation', simulationFrom: saleDate, simulationUntil: saleDate, rules: [], pending: [{ id: 'catalog-date', message: 'Nenhuma tabela disponível para esta data. Consulte um catálogo documental revisado.' }] };
  const sourceFor = (key: keyof typeof shopeeSources): Evidence => {
    const original = shopeeSources[key];
    const ids = key === 'commission' ? ['commission', 'cnpj'] : key === 'campaign' ? ['campaign'] : [key];
    return { ...original, id: `${table.id}:${key}`, capturedAt: table.observedAt,
      urls: table.sources.filter(item => ids.includes(item.id)).map(item => item.url),
      reference: `Tabela ${table.version}; verificação documental ${table.lastVerified}. ${table.review.reference}. Seleção por data não comprova atualização ao vivo ou adesão da loja.` };
  };
  const sources = { commission: sourceFor('commission'), cpf: sourceFor('cpf'), returns: sourceFor('returns'), campaign: sourceFor('campaign') };
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
  if (!['inactive', 'trial', 'billable', 'unknown'].includes(context.returnsProtection) ||
    [context.highlightCampaign, context.adsEasy, context.affiliates, context.cashAdvance].some(value => !['inactive', 'active', 'unknown'].includes(value))) {
    throw new Error('Estado de participação inválido ou ausente; use desconhecido quando não houver confirmação.');
  }
  if (typeof context.shippingConfirmed !== 'boolean') throw new Error('Confirmação de frete inválida; use verdadeiro ou falso explicitamente.');
  if (context.ordersLast90Days !== null && (!Number.isSafeInteger(context.ordersLast90Days) || context.ordersLast90Days < 0)) {
    throw new Error('Pedidos em 90 dias deve ser inteiro não negativo ou desconhecido.');
  }
  if (context.volumeStatement && (!['above', 'below', 'equal', 'unknown'].includes(context.volumeStatement.relation) || !Number.isSafeInteger(context.volumeStatement.threshold) || context.volumeStatement.threshold < (context.volumeStatement.relation === 'unknown' ? 0 : 1))) throw new Error('Condição de volume declarada inválida.');
  const volume = context.ordersLast90Days === null ? context.volumeStatement?.threshold === table.cpf.volumeThreshold ? context.volumeStatement.relation : 'unknown' : context.ordersLast90Days > table.cpf.volumeThreshold ? 'above' : context.ordersLast90Days === table.cpf.volumeThreshold ? 'equal' : 'below';
  const rules: FeeRule[] = [];
  const pending: Pending[] = [];
  const add = (id: string, name: string, formula: FeeRule['formula'], evidence: Evidence, options: Partial<FeeRule> = {}) => {
    rules.push({ id, name, version: table.version, formula, base: 'gross-sales', scope: 'item',
      requirement: 'mandatory', conditions: [], includes: [], effectiveFrom: table.effectiveFrom, effectiveUntil: table.effectiveUntil, evidence, ...options });
  };
  if (!discount.isZero()) {
    pending.push({ id: 'shopee:discount-base', message: 'A base e a faixa de comissão com desconto/cupom não foram comprovadas. Informe parâmetros personalizados para os dois componentes da comissão básica.', manualRuleIds: ['shopee:commission', 'shopee:fixed'] });
  }
  const band = priceBand(table, unitPrice);
  const boundary = !band;
  const cpfLow = context.seller === 'CPF' && price.lt(table.cpf.regressiveBelow);
  if (context.seller === null) {
    pending.push({ id: 'shopee:seller', message: 'Selecione explicitamente CPF ou CNPJ; nenhum enquadramento foi presumido.' });
  } else if (boundary) {
    pending.push({ id: 'shopee:price-boundary', message: `Preço ${unitPrice}: faixa/fronteira não esclarecida nesta versão. ${table.boundaryReview.find(item => price.eq(item.price))?.note ?? 'Sem regra documental aplicável.'}`, manualRuleIds: ['shopee:commission', 'shopee:fixed'] });
  } else if (cpfLow) {
    pending.push({ id: 'shopee:cpf-regressive', message: `CPF abaixo de R$ ${table.cpf.regressiveBelow}: fórmula regressiva e abrangência por volume não determinadas; não houve interpolação. Uma simulação exige os três componentes personalizados, inclusive adicional CPF explícito.`, manualRuleIds: ['shopee:commission', 'shopee:fixed', 'shopee:cpf-extra'] });
  } else {
    const rate = band!.percent;
    const fixed = band!.fixed;
    add('shopee:commission', 'Comissão percentual (já contempla transação)', discount.isZero() ? { kind: 'percentage', rate } : null,
      sources.commission, { includes: ['shopee:transaction'] });
    add('shopee:fixed', context.seller === 'CNPJ' && price.lt(table.cnpjLow.below) ? 'Parcela proporcional de baixo valor CNPJ' : 'Parcela fixa por item',
      !discount.isZero() ? null : context.seller === 'CNPJ' && price.lt(table.cnpjLow.below) ? { kind: 'percentage', rate: table.cnpjLow.fixedPercent } : { kind: 'fixed', amount: fixed }, sources.commission);
  }
  // Named unresolved placeholders let a user replace precisely these charges.
  // Accepting validity or rounding alone cannot supply their missing formulas.
  if (context.seller !== null && !rules.some(rule => rule.id === 'shopee:commission')) {
    add('shopee:commission', 'Comissão percentual: regra não determinada para este cenário', null, sources.commission, { includes: ['shopee:transaction'] });
    add('shopee:fixed', 'Parcela fixa: regra não determinada para este cenário', null, sources.commission);
  }
  // Explanatory child: excluded by the containing commission before evaluating its null formula.
  if (rules.some(rule => rule.id === 'shopee:commission')) {
    add('shopee:transaction', 'Transação: componente incluído', null, sources.commission);
  }
  if (context.seller === 'CPF') {
    if (volume === 'unknown') pending.push({ id: 'shopee:cpf-volume', message: 'Confirme se o volume em 90 dias está acima, abaixo ou exatamente no limite da tabela. Você encontra os pedidos na Central do Vendedor. Sem confirmação, o adicional CPF continua desconhecido.', manualRuleIds: ['shopee:cpf-extra'] });
    else if (volume === 'equal' && table.cpf.thresholdInclusive === null) pending.push({ id: 'shopee:cpf-450', message: `Exatamente ${table.cpf.volumeThreshold} pedidos: incidência do adicional CPF não esclarecida nesta versão.`, manualRuleIds: ['shopee:cpf-extra'] });
    else if ((volume === 'above' || (table.cpf.thresholdInclusive === true && volume === 'equal')) && !cpfLow) {
      add('shopee:cpf-extra', 'Adicional CPF de alto volume', { kind: 'fixed', amount: table.cpf.extra }, sources.cpf,
        { requirement: 'conditional', conditions: [{ key: 'isCpf', equals: true }] });
    }
    if ((cpfLow || volume === 'unknown' || (volume === 'equal' && table.cpf.thresholdInclusive === null)) && !rules.some(rule => rule.id === 'shopee:cpf-extra')) {
      add('shopee:cpf-extra', 'Adicional CPF: incidência ou valor não determinado', null, sources.cpf,
        { requirement: 'conditional', conditions: [{ key: 'isCpf', equals: true }] });
    }
  }
  if (context.returnsProtection === 'unknown') pending.push({ id: 'shopee:returns-enrollment', message: 'Confirme se Devolução Fácil está inativo, em teste ou cobrável neste pedido pago.' });
  else {
    add('shopee:returns-protection', 'Devolução Fácil: pedido pago fora da gratuidade', { kind: 'fixed', amount: table.programs.returnsPerOrder }, sources.returns,
      { requirement: 'optional', scope: 'order', conditions: [{ key: 'returnsBillable', equals: true }] });
  }
  if (context.highlightCampaign === 'unknown') pending.push({ id: 'shopee:campaign-enrollment', message: 'Confirme a adesão efetiva e o período da Campanha de Destaque.' });
  else add('shopee:highlight', 'Campanha de Destaque: todas as vendas da loja durante adesão', discount.isZero() ? { kind: 'percentage', rate: table.programs.highlightPercent } : null,
    sources.campaign, { requirement: 'optional', conditions: [{ key: 'highlightActive', equals: true }] });
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
  const catalog = applyManualFees({ marketplace: 'shopee-br', version: `${table.id}:${table.version}`, purpose: 'simulation',
    simulationFrom: table.effectiveFrom ?? table.observedAt, simulationUntil: table.effectiveUntil ?? '9999-12-31', rules, pending }, overrides);
  const selections: Readonly<Record<string, boolean>> = shopeeSelections(context);
  const included = new Set(catalog.rules.flatMap(rule => rule.includes));
  const activeCharges = catalog.rules.filter(rule => !included.has(rule.id) && selections[rule.id] !== false);
  const hasDocumentedCharge = activeCharges.some(rule => rule.formula !== null && rule.evidence.verification === 'documented');
  const cpfFixedConflict = table.cpf.fixedConflict && context.seller === 'CPF' && activeCharges.some(rule => rule.id === 'shopee:fixed' && rule.evidence.verification === 'documented' && rule.formula?.kind === 'fixed');
  // A wholly user-defined scenario uses the intersection of personal periods.
  // Documentary references remain provisional, without inventing legal dates.
  const whollyCustom = catalog.pending.length === 0 && activeCharges.length > 0 && activeCharges.every(rule => rule.evidence.verification === 'custom');
  const personalFrom = whollyCustom ? activeCharges.map(rule => rule.effectiveFrom!).sort().at(-1)! : catalog.simulationFrom;
  const personalUntil = whollyCustom ? activeCharges.map(rule => rule.effectiveUntil!).sort()[0]! : catalog.simulationUntil;
  return { ...catalog,
    provenance: { tableId: table.id, version: table.version, revision: table.revision, lastVerified: table.lastVerified, effectiveFrom: table.effectiveFrom, effectiveUntil: table.effectiveUntil, confirmation: table.confirmation, selection: selection?.mode ?? 'unavailable' },
    ...(!selection && !whollyCustom ? { rules: [], pending: [...catalog.pending, { id: 'catalog-date', message: 'Nenhuma tabela aplicável à data. Não foram extrapoladas regras anteriores à observação ou fora da vigência.' }] } : {}),
    ...(whollyCustom ? { version: `shopee-br-custom-scenario-v01:${personalFrom}:${personalUntil}`, simulationFrom: personalFrom, simulationUntil: personalUntil } : {}),
    assumptions: [
    ...(hasDocumentedCharge && (selection?.mode !== 'effective' || table.effectiveUntil === null || saleDate > table.lastVerified) ? [{ id: 'shopee:validity', kind: 'validity' as const, message: `Premissa: simular com a tabela ${table.version}, verificada documentalmente em ${table.lastVerified}; ${selection?.mode === 'effective' ? 'período declarado, sem confirmação ao vivo de continuidade' : 'vigência não comprovada'}. A data do cenário não atualiza a verificação. Não é confirmação de repasse.` }] : []),
    ...(cpfFixedConflict ? [{ id: 'shopee:cpf-fixed-precedence', kind: 'precedence' as const, message: `Premissa CPF: priorizar a parcela fixa da tabela ${table.version} diante da divergência entre fontes. Consulte ${table.review.reference}. A origem arquivada contém R$4 versus R$4,50; nenhuma seleção resolve esse conflito oficialmente.` }] : []),
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
    ...(context.volumeStatement ? { cpfVolumeStatement: `${context.volumeStatement.threshold}:${context.volumeStatement.relation}` } : {}),
  };
}
