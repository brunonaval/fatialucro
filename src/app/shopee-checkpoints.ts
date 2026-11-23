import type { CalculatorDraft } from './model';
import { text } from './model';
import { programQuestions, scenarioPrograms } from './ux-v3';
import { selectTable } from '../marketplaces/catalogs/select';
import type { ShopeeTable } from '../marketplaces/catalogs/types';

export type ShopeeCheckpointId = 'shop-seller' | 'shop-programs' | 'shop-volume' | 'shop-shipping';
export interface ShopeeCheckpoint {
  id: ShopeeCheckpointId;
  label: string;
  state: 'answered' | 'pending' | 'review';
  detail: string;
}

/**
 * This is a UI checklist of shop answers, never a claim that tariff formulas
 * are known, officially effective or that operating profit can be calculated.
 */
export function shopeeCheckpoints(draft: CalculatorDraft, tables: readonly ShopeeTable[]): ShopeeCheckpoint[] {
  const date = text(draft, 'date');
  const seller = text(draft, 'seller');
  const ux = draft.ux;
  const fields = scenarioPrograms(draft);
  const checks: ShopeeCheckpoint[] = [{
    id: 'shop-seller',
    label: 'Tipo da loja',
    state: seller === 'CPF' || seller === 'CNPJ' ? 'answered' : 'pending',
    detail: seller === 'CPF' || seller === 'CNPJ' ? `Informado: ${seller}` : 'Informe se você vende como CPF ou CNPJ.',
  }];

  const pending = programQuestions.filter(program => fields[program.field] === 'unknown');
  const active = programQuestions.filter(program => !['inactive', 'unknown'].includes(String(fields[program.field])));
  checks.push({
    id: 'shop-programs',
    label: 'Programas adicionais',
    state: pending.length ? 'review' : active.length ? 'review' : 'answered',
    detail: pending.length
      ? `Você respondeu “Não sei” sobre ${pending.length} programa(s). O cenário orientativo usa hipóteses explícitas; para confirmar o lucro, confira as adesões.`
      : active.length
        ? `${active.length} programa(s) informado(s) como ativo(s) ou em teste. A cobrança ainda depende das regras aplicáveis.`
        : 'Você informou que não participa dos cinco programas listados.',
  });

  if (seller === 'CPF') {
    let threshold: number | null = null;
    try { threshold = selectTable(date, tables)?.table.cpf.volumeThreshold ?? null; }
    catch { /* Invalid or unfinished scenario date remains pending. */ }
    const count = text(draft, 'orders');
    const exact = /^\d+$/.test(count) && Number.isSafeInteger(Number(count));
    const current = ux?.volume.date === date && ux.volume.threshold === threshold && ux.volume.answer !== 'unknown';
    checks.push({
      id: 'shop-volume',
      label: 'Pedidos dos últimos 90 dias',
      state: threshold === null ? 'pending' : exact ? 'answered' : current && ux?.volume.answer === 'equal' ? 'review' : current ? 'answered' : 'review',
      detail: threshold === null
        ? 'O limite documental para esta data ainda não está disponível.'
        : exact ? `${count} pedido(s) informado(s) para o período.`
        : current && ux?.volume.answer === 'equal'
          ? `Você informou exatamente ${threshold} pedidos; a incidência no limite pode continuar pendente.`
          : current ? 'Condição de volume informada para esta data.'
          : `Você respondeu “Não sei” sobre o volume. A estimativa pode usar um cenário identificado; para lucro determinado, confira o volume real.`,
    });
  }

  const amount = text(draft, 'shipping');
  const amountKnown = /^\d{1,18}(?:[.,]\d{1,2})?$/.test(amount);
  const knownNo = ux?.shipping === 'no' && draft.fields.shippingConfirmed === true && (amount === '0' || amount === '0.00' || amount === '0,00');
  const knownYes = ux?.shipping === 'yes' && draft.fields.shippingConfirmed === true && amountKnown && Number(amount.replace(',', '.')) > 0;
  checks.push({
    id: 'shop-shipping',
    label: 'Frete descontado da venda',
    state: knownNo || knownYes ? 'answered' : ux?.shipping === 'unknown' ? 'review' : 'pending',
    detail: knownNo ? 'Você confirmou que não há débito líquido de frete.'
      : knownYes ? 'Valor líquido de frete informado por você.'
        : ux?.shipping === 'yes' ? 'Informe quanto foi efetivamente debitado do seu repasse.'
          : 'Você respondeu “Não sei” sobre o frete. A estimativa ilustrativa não presume que o débito real seja zero.',
  });
  return checks;
}
