import { useState } from 'react';
import { selectTable } from '../marketplaces/catalogs/select';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { text } from '../app/model';
import { acceptHypotheses } from '../app/ux-v3';
import { useExperience } from './ExperienceContext';

export function SimulationReview({ tables }: { tables: readonly ShopeeTable[] }) {
  const { draft, ux, update } = useExperience(); const [reviewing, setReviewing] = useState(false);
  let table: ShopeeTable | undefined;
  try { table = selectTable(text(draft, 'date'), tables)?.table; } catch { /* A date still being typed does not select a table. */ }
  const hypotheses = [{ id: 'validity', field: 'acceptValidity', description: `Usar a referência documental de ${table?.lastVerified ?? 'data não disponível'}, sem confirmação de que a Shopee continua cobrando esses valores na data do cenário.` }, { id: 'rounding', field: 'acceptRounding', description: 'Arredondar cada cobrança para centavos antes de somar. Esta é uma convenção da simulação, ainda sem homologação da Shopee.' }, ...(draft.fields.seller === 'CPF' && table?.cpf.fixedConflict ? [{ id: 'precedence', field: 'acceptPrecedence', description: 'Na faixa comum de CPF, priorizar a tabela de R$ 4,50, embora outro trecho arquivado mencione R$ 4,00. A divergência continua aberta e pode alterar o valor efetivo.' }] : [])];
  const accepted = ux.assumptionReview?.date === text(draft, 'date') && ux.assumptionReview.tableId === table?.id && hypotheses.every(item => ux.assumptionReview?.accepted.includes(item.id) && draft.fields[item.field] === true);
  return <div id="simulation-review" className="simulation-review" tabIndex={-1}><h3>Sobre esta simulação</h3><p>Esta é uma simulação baseada na documentação arquivada em {table?.lastVerified ?? 'data ainda não determinada'}. Algumas regras atuais ainda não foram confirmadas. Aceitar hipóteses não garante o valor efetivo que a Shopee cobrará.</p>
    <button type="button" className="text-button" aria-expanded={reviewing} onClick={() => setReviewing(!reviewing)}>Ver hipóteses{accepted ? ' aceitas' : ''}</button>
    {reviewing && <div className="hypotheses"><ul>{hypotheses.map(item => <li key={item.id}>{item.description}</li>)}</ul><p>Cadastros, adesões, frete, embalagem, faixas ou fórmulas desconhecidas continuam pendentes mesmo após este aceite.</p>
      <button type="button" className="secondary" disabled={!table || accepted} onClick={() => update(acceptHypotheses(draft, table!.id, hypotheses.map(item => item.id as 'validity' | 'rounding' | 'precedence')))}>{accepted ? 'Hipóteses específicas aceitas' : 'Aceitar estas hipóteses e simular provisoriamente'}</button>
      {accepted && <button type="button" className="text-button" onClick={() => { const next = { ...ux }; delete next.assumptionReview; update({ ...draft, fields: { ...draft.fields, acceptValidity: false, acceptRounding: false, acceptPrecedence: false }, ux: next }); }}>Retirar meu aceite</button>}
    </div>}
  </div>;
}
