import { calculatePricing, parseBrazilianMoney } from '../engine';
import { D } from '../engine/decimal';
import type { ManualFee, SaleInput } from '../engine';
import { directSaleCatalog } from '../marketplaces/custom';
import { createShopeeCatalog, SHOPEE_SNAPSHOT, shopeeFacts, shopeeSelections } from '../marketplaces/shopee/catalog';
import type { Participation, ShopeeContext } from '../marketplaces/shopee/catalog';
import type { ImportedPlate } from '../importers/types';

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
export interface MaterialDraft { id: string; name: string; grams: string; pricePerKg: string }
export interface CalculatorDraft { fields: Record<string, string | boolean>; materials: MaterialDraft[] }
export const defaultDraft = (): CalculatorDraft => ({ fields: { ...initialFields }, materials: [] });
export function text(draft: CalculatorDraft, name: string): string { return String(draft.fields[name] ?? ''); }
export function numeric(value: string, name: string): string {
  if (!/^\d{1,18}([,.]\d{1,12})?$/.test(value)) throw new Error(`${name}: informe um decimal não negativo, sem separador de milhar.`);
  return value.replace(',', '.');
}
function integer(value: string, name: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${name}: informe um inteiro.`);
  return Number(value);
}
export function expenseBreakdown(draft: CalculatorDraft) {
  return { other: parseBrazilianMoney(text(draft, 'other')), advertising: draft.fields.advertisingEnabled === true ? parseBrazilianMoney(text(draft, 'advertising')) : '0.00' };
}

export function buildScenario(draft: CalculatorDraft) {
  const t = (name: string) => text(draft, name);
  const m = (name: string) => parseBrazilianMoney(t(name));
  const v = (name: string) => numeric(t(name), name);
  const yes = (name: string) => draft.fields[name] === true;
  if (!['direct', 'shopee'].includes(t('marketplace'))) throw new Error('Canal inválido.');
  if (!['all-in', 'detailed'].includes(t('machineMode')) || !['unit', 'batch'].includes(t('basis'))) throw new Error('Modo de fabricação inválido.');
  const context: ShopeeContext = {
    seller: t('seller') === '' ? null : t('seller') as ShopeeContext['seller'],
    ordersLast90Days: t('marketplace') !== 'shopee' || t('seller') !== 'CPF' || t('orders') === '' ? null : integer(t('orders'), 'Pedidos em 90 dias'),
    returnsProtection: t('returns') as ShopeeContext['returnsProtection'], highlightCampaign: t('highlight') as Participation,
    adsEasy: t('ads') as Participation, affiliates: t('affiliates') as Participation, cashAdvance: t('advance') as Participation,
    shippingConfirmed: yes('shippingConfirmed'),
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
  const input: SaleInput = {
    date: t('date'), purpose: 'simulation', unitPrice: m('price'), quantity: integer(t('quantity'), 'Quantidade vendida'),
    manufacturing: {
      basis: t('basis') as 'unit' | 'batch', piecesPerBatch: t('basis') === 'batch' ? integer(t('pieces'), 'Peças produzidas') : 1,
      grams: draft.materials.length ? '0' : v('grams'), filamentPerKg: draft.materials.length ? '0' : m('filament'), printHours: v('hours'),
      ...(draft.materials.length ? { materials: draft.materials.map(item => ({ ...item, grams: numeric(item.grams, item.name), pricePerKg: parseBrazilianMoney(item.pricePerKg) })) } : {}),
      machine: t('machineMode') === 'all-in' ? { mode: 'all-in', perHour: v('machine') } : { mode: 'detailed', watts: v('watts'), energyPerKwh: v('kwh'), maintenancePerHour: v('maintenance'), depreciationPerHour: v('depreciation') },
      laborMinutes: v('laborMinutes'), laborPerHour: m('laborHour'), consumablesPerUnit: m('consumables'), failureReservePerUnit: m('failure'),
    },
    packagingPerUnit: m('packagingUnit'), packagingPerOrder: m('packagingOrder'), sellerDiscount: m('discount'), sellerShipping: m('shipping'),
    otherOperatingCosts: new D(expenseBreakdown(draft).other).plus(expenseBreakdown(draft).advertising).toFixed(2),
    selections: t('marketplace') === 'shopee' ? shopeeSelections(context) : {}, facts: t('marketplace') === 'shopee' ? shopeeFacts(context) : {},
    acceptedAssumptions: { validity: yes('acceptValidity'), rounding: yes('acceptRounding'), precedence: yes('acceptPrecedence') },
  };
  const catalogAt = (price: string) => t('marketplace') === 'shopee' ? createShopeeCatalog(context, price, input.sellerDiscount, input.date, overrides) : directSaleCatalog();
  return { input, catalogAt };
}

export function applyPlate(draft: CalculatorDraft, plate: ImportedPlate): CalculatorDraft {
  return { fields: { ...draft.fields, basis: 'batch', grams: plate.grams ?? '',
    hours: plate.seconds === null ? '' : new D(plate.seconds).div(3600).toDecimalPlaces(12).toFixed(),
    pieces: plate.pieces === null ? '' : String(plate.pieces), filament: '' },
    // A file never supplies a price per kg. Require a profile or explicit price.
    materials: plate.materials.length ? plate.materials.map((item, index) => ({ id: `import-${index}`, name: item.name, grams: item.grams ?? '', pricePerKg: '' })) : [],
  };
}

export type SavedKind = 'product' | 'printer' | 'filament' | 'production' | 'marketplace' | 'simulation';
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
  if (draft.materials.some(item => !item || ['id', 'name', 'grams', 'pricePerKg'].some(key => typeof item[key as keyof MaterialDraft] !== 'string' || item[key as keyof MaterialDraft].length > 300))) throw new Error('Materiais inválidos.');
}
export function evaluateDraft(draft: CalculatorDraft) {
  const { input, catalogAt } = buildScenario(draft); const catalog = catalogAt(input.unitPrice);
  return { input, catalog, result: calculatePricing(input, catalog) };
}
