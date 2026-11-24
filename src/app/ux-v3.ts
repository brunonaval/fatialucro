import type { CalculatorDraft } from './model';
import { text } from './model';
import type { ExperienceState } from './experience-types';
import type { Pending } from '../engine';
import { money } from '../engine/decimal';

export const programQuestions = [
  { field: 'returns', name: 'Devolução Fácil' },
  { field: 'highlight', name: 'Campanha de Destaque' },
  { field: 'ads', name: 'Ads Fácil' },
  { field: 'affiliates', name: 'Afiliados' },
  { field: 'advance', name: 'Shopee Acelera' },
] as const;
export function declarePrograms(draft: CalculatorDraft, answer: 'none' | 'some' | 'unknown'): CalculatorDraft {
  if (!draft.ux) throw new Error('Abra o cenário antes de responder.');
  const fields = { ...draft.fields };
  if (answer !== 'some') for (const program of programQuestions) fields[program.field] = answer === 'none' ? 'inactive' : 'unknown';
  return { ...draft, fields, ux: { ...draft.ux, programDeclaration: { answer, date: text(draft, 'date'), programs: programQuestions.map(program => program.field) } } };
}
export function scenarioPrograms(draft: CalculatorDraft): CalculatorDraft['fields'] {
  const declaration = draft.ux?.programDeclaration;
  if (!declaration || declaration.date === text(draft, 'date')) return draft.fields;
  return { ...draft.fields, ...Object.fromEntries(declaration.programs.map(field => [field, 'unknown'])) };
}
export function calculationStages(ux: ExperienceState) {
  return (['print', 'costs', ...(ux.intent === 'sale' ? ['sale'] : []), 'result'] as ExperienceState['stage'][]);
}
export function beginSale(draft: CalculatorDraft): CalculatorDraft {
  if (!draft.ux) throw new Error('Cenário indisponível.');
  return { ...draft, fields: { ...draft.fields, quantity: text(draft, 'quantity') || '1' }, ux: { ...draft.ux, intent: 'sale', stage: 'sale' } };
}
export function applyFinalPrice(draft: CalculatorDraft, price: string): CalculatorDraft {
  money(price.replace(',', '.'));
  return { ...draft, fields: { ...draft.fields, calculation: 'direct', price } };
}
export function changeScenarioDate(draft: CalculatorDraft, date: string): CalculatorDraft {
  if (date === text(draft, 'date')) return draft;
  return { ...draft, fields: { ...draft.fields, date, orders: '', shippingConfirmed: false, acceptValidity: false, acceptRounding: false, acceptPrecedence: false }, ...(draft.ux ? { ux: { ...draft.ux, shipping: 'unknown' as const, ...(draft.ux.programPricing ? { programPricing: { ...draft.ux.programPricing, affiliateAttribution: 'unknown' as const, advanceShare: '' } } : {}), programDeclaration: draft.ux.programDeclaration ?? { answer: 'some' as const, date: text(draft, 'date'), programs: programQuestions.filter(program => !draft.ux!.persistentPrograms?.includes(program.field) || ['highlight', 'affiliates'].includes(program.field) || draft.fields[program.field] === 'trial').map(program => program.field) } } } : {}) };
}
export function acceptHypotheses(draft: CalculatorDraft, tableId: string, accepted: ('validity' | 'rounding' | 'precedence')[]): CalculatorDraft {
  if (!draft.ux || !tableId || !accepted.length) throw new Error('Confira as hipóteses e a referência antes de aceitar.');
  return { ...draft, fields: { ...draft.fields, ...Object.fromEntries(accepted.map(kind => [`accept${kind[0]!.toUpperCase()}${kind.slice(1)}`, true])) }, ux: { ...draft.ux, assumptionReview: { date: text(draft, 'date'), tableId, accepted: [...accepted] } } };
}
export function costExclusions(draft: CalculatorDraft): string[] {
  const ux = draft.ux; if (!ux) return [];
  return [ux.materialIncluded === false ? 'Material não incluído' : '', !ux.machineIncluded ? 'Máquina/energia não incluídas' : draft.fields.machineMode === 'detailed' && !ux.wearIncluded ? 'Manutenção e depreciação não incluídas' : '', ux.labor === 'excluded' ? 'Mão de obra não incluída' : '', !ux.packagingIncluded ? ux.packagingDecision === 'unknown' && ux.intent === 'sale' ? 'Embalagem ainda não confirmada' : 'Embalagem não incluída' : (ux.packagingExtraIncluded === false ? 'Embalagem adicional por pedido não incluída' : ''), !ux.extrasIncluded ? 'Consumíveis e reserva de perdas não incluídos' : '',
    ux.intent === 'sale' && ux.discountIncluded === false ? 'Descontos adicionais do vendedor não incluídos' : '',
    ux.intent === 'sale' && ux.otherCostsIncluded === false ? 'Outras despesas/tributos não incluídos' : '',
    ux.intent === 'sale' && draft.fields.marketplace === 'direct' && ux.directShippingIncluded === false ? 'Frete de venda direta não incluído' : ''].filter(Boolean);
}
export function profileSignature(draft: CalculatorDraft, kind: 'filament' | 'printer' | 'store') {
  const keys = kind === 'filament' ? ['filament', 'materialName'] : kind === 'printer' ? ['printerName', 'machineMode', 'machine', 'watts', 'kwh', 'maintenance', 'depreciation'] : ['seller', ...programQuestions.map(program => program.field)];
  return JSON.stringify({ fields: keys.map(key => draft.fields[key]), options: kind === 'filament' ? draft.ux?.filament : kind === 'printer' ? [draft.ux?.machineIncluded, draft.ux?.wearIncluded] : draft.ux?.programPricing ?? null });
}
export function profileSource(draft: CalculatorDraft, kind: 'filament' | 'printer' | 'store') {
  const origin = draft.ux?.profileOrigins?.[kind];
  return origin ? `${profileSignature(draft, kind) === origin.signature ? 'Perfil' : 'Editado por você após aplicar o perfil'}: ${origin.name}` : 'Informado por você';
}
export function pendingAction(pending: Pending): { label: string; target: string } {
  if (pending.id.includes('shipping')) return { label: 'Conferir frete', target: 'shop-shipping' };
  if (pending.id.includes('returns')) return { label: 'Confirmar Devolução Fácil', target: 'shop-programs' };
  if (pending.id.includes('cpf-volume') || pending.id.includes('cpf-450')) return { label: 'Conferir volume de pedidos', target: 'shop-volume' };
  if (pending.id.includes('cpf') || pending.id.includes('seller')) return { label: 'Ver condições de CPF/CNPJ', target: 'shop-seller' };
  if (pending.id.includes('packaging')) return { label: 'Conferir embalagem', target: 'packaging-cost' };
  if (/assumption|validity|rounding|precedence/.test(pending.id)) return { label: 'Conferir hipóteses', target: 'simulation-review' };
  return { label: 'Conferir condições e taxas', target: 'shop-programs' };
}
