import { calculatePricing, parseBrazilianMoney } from '../engine';
import { D } from '../engine/decimal';
import { percentageAdvertising } from '../engine/pricing';
import type { ManualFee, ManufacturingInput, SaleInput } from '../engine';
import type { ExperienceState, PurchaseDraft } from './experience-types';
import { directSaleCatalog } from '../marketplaces/custom';
import { createShopeeCatalog, SHOPEE_SNAPSHOT, shopeeFacts, shopeeSelections } from '../marketplaces/shopee/catalog';
import type { Participation, ShopeeContext } from '../marketplaces/shopee/catalog';
import type { ImportedPlate } from '../importers/types';
import { bundledTables } from '../marketplaces/catalogs/bundled';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { validateExperience } from './experience-validation';
import { scenarioPrograms } from './ux-v3';
import { selectTable } from '../marketplaces/catalogs/select';

export const manualIds = ['shopee:cpf-extra', 'shopee:returns-protection', 'shopee:highlight', 'shopee:adsEasy', 'shopee:affiliates', 'shopee:cashAdvance'];
const initialFields: Record<string, string | boolean> = {
  productName: '', marketplace: 'direct', date: SHOPEE_SNAPSHOT, price: '19,90', quantity: '1',
  discount: '0', shipping: '0', other: '0', advertising: '0', advertisingEnabled: false, shippingConfirmed: false,
  basis: 'batch', pieces: '1', grams: '22,31', filament: '120', hours: '1,03', materialName: 'Material de exemplo',
  machineMode: 'all-in', machine: '2', watts: '150', kwh: '0,80', maintenance: '0', depreciation: '0',
  printerName: '', printerPurchase: '0', printerLife: '10000',
  laborMinutes: '0', laborHour: '0', consumables: '0', failure: '0', packagingUnit: '0', packagingOrder: '0',
  seller: '', orders: '', returns: 'unknown', highlight: 'unknown', ads: 'unknown', affiliates: 'unknown', advance: 'unknown',
  acceptValidity: false, acceptRounding: false, acceptPrecedence: false, manualBasic: false,
  manualRate: '', manualRateScope: '', manualFixed: '', manualFixedScope: '', manualBase: '', manualReference: '',
  manualFrom: SHOPEE_SNAPSHOT, manualUntil: SHOPEE_SNAPSHOT,
  calculation: 'direct', targetProfit: '5', targetMargin: '0,20', minPrice: '0,01', maxPrice: '100',
  comparison: '15; 19,90; 25', lowMargin: '0,10',
};
for (const id of manualIds) Object.assign(initialFields, {
  [`${id}:manual`]: false, [`${id}:kind`]: 'fixed', [`${id}:value`]: '', [`${id}:scope`]: '', [`${id}:base`]: 'gross-sales', [`${id}:reference`]: '',
});
export interface MaterialDraft { id: string; name: string; grams: string; pricePerKg: string; purchase?: PurchaseDraft }
export interface CalculatorDraft { fields: Record<string, string | boolean>; materials: MaterialDraft[]; ux?: ExperienceState }
export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export const defaultDraft = (now = new Date()): CalculatorDraft => ({ fields: { ...initialFields, date: localDate(now), manualFrom: localDate(now), manualUntil: localDate(now) }, materials: [] });
export function text(draft: CalculatorDraft, name: string): string { return String(draft.fields[name] ?? ''); }
export function numeric(value: string, name: string): string {
  if (!/^\d{1,18}([,.]\d{1,12})?$/.test(value)) throw new Error(`${name}: informe um decimal não negativo, sem separador de milhar.`);
  return value.replace(',', '.');
}
function integer(value: string, name: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${name}: informe um inteiro.`);
  return Number(value);
}
/**
 * Disabled sale expenses do not require values. Old drafts without these switches
 * retain values already supplied; old API callers without UX are unaffected.
 */
export function saleExtraSelected(draft: CalculatorDraft, kind: 'discount' | 'other' | 'shipping'): boolean {
  if (!draft.ux) return true;
  const selected = kind === 'discount' ? draft.ux.discountIncluded : kind === 'other' ? draft.ux.otherCostsIncluded : draft.ux.directShippingIncluded;
  return selected ?? text(draft, kind === 'discount' ? 'discount' : kind === 'other' ? 'other' : 'shipping').trim() !== '';
}
export function expenseBreakdown(draft: CalculatorDraft) {
  return { other: saleExtraSelected(draft, 'other') ? parseBrazilianMoney(text(draft, 'other')) : '0.00',
    advertising: draft.fields.advertisingEnabled === true ? draft.ux?.advertisingPercent !== undefined ? percentageAdvertising(new D(parseBrazilianMoney(text(draft, 'price'))).mul(integer(text(draft, 'quantity'), 'Quantidade vendida')).toFixed(2), numeric(draft.ux.advertisingPercent, 'Publicidade')) : parseBrazilianMoney(text(draft, 'advertising')) : '0.00' };
}
export function buildManufacturing(draft: CalculatorDraft): ManufacturingInput {
  const t = (name: string) => text(draft, name);
  const value = (name: string) => numeric(t(name), ({ grams: 'Peso de filamento', hours: 'Tempo de impressão', machine: 'Custo da impressora' } as Record<string, string>)[name] ?? name);
  const cashValue = (name: string) => parseBrazilianMoney(t(name));
  const ux = draft.ux;
  if (ux?.manualProduction?.enabled) return { basis: 'unit', piecesPerBatch: 1, manualCostPerPiece: parseBrazilianMoney(ux.manualProduction.amount), grams: '0', filamentPerKg: '0', printHours: '0', machine: { mode: 'all-in', perHour: '0' }, laborMinutes: '0', laborPerHour: '0', consumablesPerUnit: '0', failureReservePerUnit: '0', ...(ux.saleUnit === 'kit' && ux.intent === 'sale' ? { partsPerUnit: integer(ux.partsPerKit, 'Peças dentro de cada kit') } : {}) };
  const materialSelected = ux?.materialIncluded !== false;
  if (materialSelected && !draft.materials.length && ux?.filament.mode === 'spool') {
    if (!ux.filament.amount) throw new Error('Informe o preço pago pela bobina.');
    if (!ux.filament.netGrams) throw new Error('Informe o peso líquido de filamento comprado, sem o carretel.');
  }
  const purchase = materialSelected && !draft.materials.length && ux?.filament.mode === 'spool' ? { amount: parseBrazilianMoney(ux.filament.amount), netGrams: numeric(ux.filament.netGrams, 'Peso líquido da bobina') } : undefined;
  if (!['all-in', 'detailed'].includes(t('machineMode')) || !['unit', 'batch'].includes(t('basis'))) throw new Error('Modo de fabricação inválido.');
  return {
    basis: t('basis') as 'unit' | 'batch', piecesPerBatch: t('basis') === 'batch' ? integer(t('pieces'), 'Peças produzidas') : 1,
    grams: !materialSelected || draft.materials.length ? '0' : value('grams'), filamentPerKg: !materialSelected || draft.materials.length || purchase ? '0' : cashValue('filament'), printHours: ux?.machineIncluded === false ? '0' : value('hours'),
    ...(purchase && !draft.materials.length ? { filamentPurchase: purchase } : {}),
    ...(ux?.saleUnit === 'kit' && ux.intent === 'sale' ? { partsPerUnit: integer(ux.partsPerKit, 'Peças dentro de cada kit') } : {}),
    ...(materialSelected && draft.materials.length ? { materials: draft.materials.map(item => ({ id: item.id, name: item.name, grams: numeric(item.grams, item.name), pricePerKg: item.purchase ? '0' : parseBrazilianMoney(item.pricePerKg), ...(item.purchase ? { purchase: { amount: parseBrazilianMoney(item.purchase.amount), netGrams: numeric(item.purchase.netGrams, 'Peso líquido') } } : {}) })) } : {}),
    machine: ux?.machineIncluded === false ? { mode: 'all-in', perHour: '0' } : t('machineMode') === 'all-in' ? { mode: 'all-in', perHour: value('machine') } : { mode: 'detailed', watts: value('watts'), energyPerKwh: value('kwh'), maintenancePerHour: ux && !ux.wearIncluded ? '0' : value('maintenance'), depreciationPerHour: ux && !ux.wearIncluded ? '0' : value('depreciation') },
    laborMinutes: ux?.labor === 'excluded' || ux?.labor === 'zero' ? '0' : value('laborMinutes'), laborPerHour: ux?.labor === 'excluded' || ux?.labor === 'zero' ? '0' : cashValue('laborHour'),
    consumablesPerUnit: ux && !ux.extrasIncluded ? '0' : cashValue('consumables'), failureReservePerUnit: ux && !ux.extrasIncluded ? '0' : cashValue('failure'),
  };
}
export function packagingInput(draft: CalculatorDraft): Pick<SaleInput, 'packagingPerUnit' | 'packagingPerOrder' | 'packagingPurchase'> {
  if (draft.ux && !draft.ux.packagingIncluded) return { packagingPerUnit: '0', packagingPerOrder: '0' };
  // Legacy drafts keep their additional cost if nonempty. New drafts opt in explicitly.
  const extraIncluded = draft.ux?.packagingExtraIncluded ?? text(draft, 'packagingOrder').trim() !== '';
  const perOrder = extraIncluded ? parseBrazilianMoney(text(draft, 'packagingOrder')) : '0';
  if (draft.ux?.packaging.mode === 'pack') return { packagingPerUnit: '0', packagingPerOrder: perOrder, packagingPurchase: { amount: parseBrazilianMoney(draft.ux.packaging.amount), units: integer(draft.ux.packaging.units, 'Embalagens no pacote') } };
  return { packagingPerUnit: parseBrazilianMoney(text(draft, 'packagingUnit')), packagingPerOrder: perOrder };
}

export function buildScenario(draft: CalculatorDraft, tables: readonly ShopeeTable[] = bundledTables, referenceDiscountGross = false) {
  const programFields = scenarioPrograms(draft);
  draft = { ...draft, fields: programFields };
  const t = (name: string) => text(draft, name);
  const labels: Record<string, string> = { grams: 'Peso de filamento', hours: 'Tempo de impressão', machine: 'Custo completo por hora', filament: 'Preço por kg', watts: 'Potência média', kwh: 'Preço da energia', maintenance: 'Manutenção por hora', depreciation: 'Depreciação por hora', laborMinutes: 'Trabalho manual', laborHour: 'Valor da mão de obra', price: 'Preço de venda', packagingUnit: 'Embalagem individual', packagingOrder: 'Embalagem do pedido', discount: 'Desconto do vendedor', shipping: 'Frete líquido', consumables: 'Consumíveis', failure: 'Reserva de falhas', manualFixed: 'Tarifa fixa personalizada', manualRate: 'Comissão percentual personalizada' };
  const m = (name: string) => { try { return parseBrazilianMoney(t(name)); } catch { throw new Error(`${labels[name] ?? 'Valor personalizado'}: informe um valor em reais, com até duas casas decimais.`); } };
  const v = (name: string) => numeric(t(name), labels[name] ?? 'Parâmetro personalizado');
  const yes = (name: string) => draft.fields[name] === true;
  if (!['direct', 'shopee'].includes(t('marketplace'))) throw new Error('Canal inválido.');
  if (!['all-in', 'detailed'].includes(t('machineMode')) || !['unit', 'batch'].includes(t('basis'))) throw new Error('Modo de fabricação inválido.');
  const context: ShopeeContext = {
    seller: t('seller') === '' ? null : t('seller') as ShopeeContext['seller'],
    ordersLast90Days: t('marketplace') !== 'shopee' || t('seller') !== 'CPF' || t('orders') === '' ? null : integer(t('orders'), 'Pedidos em 90 dias'),
    returnsProtection: t('returns') as ShopeeContext['returnsProtection'], highlightCampaign: t('highlight') as Participation,
    adsEasy: t('ads') as Participation, affiliates: t('affiliates') as Participation, cashAdvance: t('advance') as Participation,
    ...(draft.ux?.programPricing ? { programPricing: draft.ux.programPricing } : {}),
    shippingConfirmed: draft.ux ? draft.ux.shipping !== 'unknown' : yes('shippingConfirmed'),
    ...(draft.ux ? { volumeStatement: { relation: draft.ux.volume.date === t('date') ? draft.ux.volume.answer : 'unknown' as const, threshold: draft.ux.volume.threshold ?? 0 } } : {}),
  };
  const overrides: Record<string, ManualFee> = {};
  const scope = (name: string) => {
    const value = t(name);
    if (value !== 'item' && value !== 'order') throw new Error('Selecione explicitamente a incidência personalizada.');
    return value;
  };
  const base = (name: string) => {
    const value = t(name);
    if (value !== 'gross-sales' && value !== 'after-seller-discount') throw new Error('Selecione explicitamente a base personalizada.');
    return value;
  };
  if (t('marketplace') === 'shopee') {
    const period = { effectiveFrom: t('manualFrom'), effectiveUntil: t('manualUntil') };
    if (yes('manualBasic')) {
      overrides['shopee:commission'] = { ...period, reference: t('manualReference'), formula: { kind: 'percentage', rate: v('manualRate') }, scope: scope('manualRateScope'), base: base('manualBase') };
      overrides['shopee:fixed'] = { ...period, reference: t('manualReference'), formula: { kind: 'fixed', amount: m('manualFixed') }, scope: scope('manualFixedScope'), base: base('manualBase') };
    }
    for (const id of manualIds) if (yes(`${id}:manual`) &&
      (id === 'shopee:cpf-extra' ? context.seller === 'CPF' : id === 'shopee:returns-protection' ? context.returnsProtection === 'billable' :
        ({ 'shopee:highlight': context.highlightCampaign, 'shopee:adsEasy': context.adsEasy, 'shopee:affiliates': context.affiliates, 'shopee:cashAdvance': context.cashAdvance } as Record<string, string>)[id] === 'active')) {
      if (!['fixed', 'percentage'].includes(t(`${id}:kind`))) throw new Error('Fórmula personalizada inválida.');
      overrides[id] = { ...period, reference: t(`${id}:reference`),
        formula: t(`${id}:kind`) === 'fixed' ? { kind: 'fixed', amount: m(`${id}:value`) } : { kind: 'percentage', rate: v(`${id}:value`) },
        scope: scope(`${id}:scope`), base: base(`${id}:base`) };
    }
  }
  // Unknown shipping may have an empty or stale amount. Only a valid partial
  // amount is used in the known-cost subtotal; the catalog keeps the shipping
  // uncertainty pending. An explicitly selected 'yes' still requires a value.
  const shopeeShipping = () => {
    if (draft.ux?.shipping === 'no') return '0.00';
    if (draft.ux?.shipping === 'unknown') {
      try { return m('shipping'); } catch { return '0.00'; }
    }
    return m('shipping');
  };
  const input: SaleInput = {
    date: t('date'), purpose: 'simulation', unitPrice: m('price'), quantity: integer(t('quantity'), 'Quantidade vendida'),
    manufacturing: buildManufacturing(draft),
    ...packagingInput(draft), sellerDiscount: saleExtraSelected(draft, 'discount') ? m('discount') : '0.00', sellerShipping: t('marketplace') === 'shopee' ? shopeeShipping() : (saleExtraSelected(draft, 'shipping') ? m('shipping') : '0.00'),
    otherOperatingCosts: new D(expenseBreakdown(draft).other).plus(yes('advertisingEnabled') && draft.ux?.advertisingPercent !== undefined ? '0' : expenseBreakdown(draft).advertising).toFixed(2),
    ...(yes('advertisingEnabled') && draft.ux?.advertisingPercent !== undefined ? { advertisingPercent: numeric(draft.ux.advertisingPercent, 'Publicidade') } : {}),
    selections: t('marketplace') === 'shopee' ? shopeeSelections(context) : {}, facts: t('marketplace') === 'shopee' ? shopeeFacts(context) : {},
    acceptedAssumptions: Object.fromEntries((['validity', 'rounding', 'precedence'] as const).map(kind => [kind, yes(`accept${kind[0]!.toUpperCase()}${kind.slice(1)}`) && (!draft.ux?.assumptionReview || (draft.ux.assumptionReview.date === t('date') && draft.ux.assumptionReview.tableId === selectTable(t('date'), tables)?.table.id && draft.ux.assumptionReview.accepted.includes(kind)))])),
  };
  const catalogAt = (price: string) => {
    const catalog = t('marketplace') === 'shopee' ? createShopeeCatalog(context, price, input.sellerDiscount, input.date, overrides, tables, referenceDiscountGross) : directSaleCatalog();
    return draft.ux?.packagingDecision === 'unknown' ? { ...catalog, pending: [...(catalog.pending ?? []), { id: 'cost:packaging', message: 'Confirme a embalagem: informe seu custo ou escolha explicitamente não incluir neste cálculo. Embalagem desconhecida não foi considerada zero.' }] } : catalog;
  };
  return { input, catalogAt };
}

export function applyPlate(draft: CalculatorDraft, plate: ImportedPlate): CalculatorDraft {
  const single = plate.materials.length === 1 && plate.grams !== null && plate.materials[0]!.grams !== null;
  return { fields: { ...draft.fields, basis: 'batch', grams: plate.grams ?? '',
    hours: plate.seconds === null ? '' : new D(plate.seconds).div(3600).toDecimalPlaces(12).toFixed(),
    pieces: plate.pieces === null ? '' : String(plate.pieces), filament: '',
    ...(single ? { materialName: plate.materials[0]!.name } : {}) },
    // A single consumed filament uses the simple price-of-bobbin workflow. Real
    // multiple consumptions remain separate even when the type label matches.
    materials: !single && plate.materials.length ? plate.materials.map((item, index) => ({ id: `import-${index}`, name: item.name, grams: item.grams ?? '', pricePerKg: '' })) : [],
  };
}

export type SavedKind = 'product' | 'printer' | 'filament' | 'production' | 'marketplace' | 'simulation' | 'cost-simulation';
const productionKeys = ['basis', 'pieces', 'grams', 'filament', 'hours', 'materialName', 'machineMode', 'machine', 'watts', 'kwh', 'maintenance', 'depreciation', 'printerName', 'printerPurchase', 'printerLife', 'laborMinutes', 'laborHour', 'consumables', 'failure', 'packagingUnit', 'packagingOrder'];
const printerKeys = ['printerName', 'machineMode', 'machine', 'watts', 'kwh', 'maintenance', 'depreciation', 'printerPurchase', 'printerLife'];
export function restoreProfile(current: CalculatorDraft, saved: CalculatorDraft, kind: SavedKind): CalculatorDraft {
  if (kind === 'product' || kind === 'simulation') return structuredClone(saved);
  const keys = kind === 'printer' ? printerKeys : kind === 'filament' ? ['filament', 'materialName'] : kind === 'production' ? productionKeys : Object.keys(initialFields).filter(key => ['seller', 'orders', 'returns', 'highlight', 'ads', 'affiliates', 'advance', 'shippingConfirmed', 'marketplace', 'acceptValidity', 'acceptRounding', 'acceptPrecedence'].includes(key) || key.startsWith('manual') || key.startsWith('shopee:'));
  return { fields: { ...current.fields, ...Object.fromEntries(keys.map(key => [key, saved.fields[key]!])) }, materials: kind === 'production' ? structuredClone(saved.materials) : current.materials };
}

export function validateDraft(value: unknown): asserts value is CalculatorDraft {
  if (!value || typeof value !== 'object') throw new Error('Cadastro inválido.');
  const draft = value as CalculatorDraft;
  if (!draft.fields || typeof draft.fields !== 'object' || Array.isArray(draft.fields) || !Array.isArray(draft.materials) || draft.materials.length > 32) throw new Error('Estrutura de cadastro inválida.');
  const keys = Object.keys(initialFields);
  if (Object.keys(draft.fields).length !== keys.length || keys.some(key => typeof draft.fields[key] !== typeof initialFields[key] || (typeof draft.fields[key] === 'string' && String(draft.fields[key]).length > 2000))) throw new Error('Campos de cadastro incompatíveis.');
  if (draft.materials.some(item => !item || (['id', 'name', 'grams', 'pricePerKg'] as const).some(key => typeof item[key] !== 'string' || item[key].length > 300))) throw new Error('Materiais inválidos.');
  for (const item of draft.materials) if (item.purchase && (typeof item.purchase.amount !== 'string' || typeof item.purchase.netGrams !== 'string' || item.purchase.amount.length > 300 || item.purchase.netGrams.length > 300)) throw new Error('Compra de filamento inválida.');
  if (draft.ux !== undefined) validateExperience(draft.ux);
}
export function evaluateDraft(draft: CalculatorDraft) {
  const { input, catalogAt } = buildScenario(draft); const catalog = catalogAt(input.unitPrice);
  return { input, catalog, result: calculatePricing(input, catalog) };
}
