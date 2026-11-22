import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { catalogIndicator, selectTable } from '../marketplaces/catalogs/select';
import { text } from '../app/model';
import { BaseField, Check, Field, Input, ManualFeeFields, ScopeField, Select } from './Fields';
import { useExperience } from './ExperienceContext';

export function ShopQuestions({ tables, permanentOnly = false }: { tables: readonly ShopeeTable[]; permanentOnly?: boolean }) {
  const { draft, ux, update } = useExperience();
  let threshold: number | null = null; let indicator: ReturnType<typeof catalogIndicator> | null = null;
  try { const table = selectTable(text(draft, 'date'), tables); threshold = table?.table.cpf.volumeThreshold ?? null; indicator = catalogIndicator(text(draft, 'date'), tables); } catch { /* Invalid date is shown with other input errors. */ }
  const programs = [{ name: 'highlight', label: 'Está participando de Campanha de Destaque com cobrança adicional?', id: 'shopee:highlight' }, { name: 'ads', label: 'Sua loja usa Ads Fácil?', id: 'shopee:adsEasy' }, { name: 'affiliates', label: 'Há comissão de afiliados nesta venda?', id: 'shopee:affiliates' }, { name: 'advance', label: 'Usa antecipação Shopee Acelera?', id: 'shopee:cashAdvance' }];
  return <div className="shop-questions">
    <div className="fields"><Select name="seller" label="Você vende como CPF ou CNPJ?"><option value="">Ainda não informei</option><option value="CPF">CPF — pessoa física</option><option value="CNPJ">CNPJ — pessoa jurídica</option></Select>
      <Select name="returns" label="Sua loja participa da Devolução Fácil?"><option value="unknown">Não sei</option><option value="inactive">Não</option><option value="trial">Sim, durante teste gratuito</option><option value="billable">Sim, com cobrança ativa</option></Select></div>
    <details><summary>Campanhas e programas opcionais da loja</summary><div className="fields">{programs.map(program => <Select key={program.name} name={program.name} label={program.label}><option value="unknown">Não sei</option><option value="inactive">Não</option><option value="active">Sim</option></Select>)}</div><p>Essas respostas descrevem sua adesão; não alteram programas na Shopee. Confira mudanças na sua loja.</p></details>
    {!permanentOnly && <>
      {draft.fields.seller === 'CPF' && <label>Nos últimos 90 dias, sua loja ultrapassou {threshold ?? 'o limite de'} pedidos?<select value={ux.volume.date === text(draft, 'date') && ux.volume.threshold === threshold ? ux.volume.answer : 'unknown'} onChange={event => update({ ...draft, fields: { ...draft.fields, orders: '' }, ux: { ...ux, volume: { answer: event.target.value as typeof ux.volume.answer, threshold, date: text(draft, 'date') } } })}><option value="unknown">Não sei</option><option value="above" disabled={threshold === null}>Sim, mais de {threshold ?? '…'}</option><option value="below" disabled={threshold === null}>Não, menos de {threshold ?? '…'}</option><option value="equal" disabled={threshold === null}>Exatamente {threshold ?? '…'}</option></select><small className="field-hint">Consulte os pedidos da loja para o período da data do cenário. Exatamente no limite continua sujeito à pendência documental.</small></label>}
      <label>Há frete efetivamente descontado do seu repasse?<select value={ux.shipping} onChange={event => update({ ...draft, fields: { ...draft.fields, shippingConfirmed: event.target.value !== 'unknown', ...(event.target.value === 'no' ? { shipping: '0' } : event.target.value === 'yes' && ux.shipping !== 'yes' ? { shipping: '' } : {}) }, ux: { ...ux, shipping: event.target.value as typeof ux.shipping } })}><option value="unknown">Não sei</option><option value="no">Não — confirmei que o custo líquido é zero</option><option value="yes">Sim — vou informar o valor líquido</option></select></label>
      {ux.shipping === 'yes' && <Field name="shipping" label="Frete líquido debitado neste pedido" />}
      <p className="muted">Desconte apenas o que realmente sai do seu repasse, após subsídios e pagamentos do comprador. Frete pago fora da plataforma entra em outras despesas.</p>
    </>}
    <p className="help-box">Respondeu “Não sei”? O custo continua desconhecido. Consulte a adesão ao programa e o detalhamento financeiro do pedido na <a href="https://seller.shopee.com.br/" target="_blank" rel="noreferrer">Central do Vendedor</a>. Não informe uma taxa de concorrentes como se fosse a sua.</p>
    {indicator && <div className={`tariff-status ${indicator.tone}`}><strong>{indicator.title}</strong><p>{indicator.detail}</p></div>}
    <details className="simulation-assumptions"><summary>Simulação provisória: premissas que precisam de sua aceitação</summary><p>As regras conhecidas entram automaticamente. Para concluir com uma referência não homologada, você precisa aceitar explicitamente estas condições. Isso não resolve cobranças desconhecidas.</p>
      <Check name="acceptValidity">Aceito usar a referência selecionada na data do cenário, sabendo que sua vigência/continuidade não foi confirmada ao vivo.</Check>
      <Check name="acceptRounding">Aceito a convenção de arredondar cada cobrança para centavos. O cálculo completo identifica a regra e a limitação documental.</Check>
      {draft.fields.seller === 'CPF' && <Check name="acceptPrecedence">Na faixa comum, aceito priorizar a tabela de R$ 4,50 apesar de outro trecho arquivado mencionar R$ 4. A divergência continua aberta.</Check>}
    </details>
    <details><summary>Entenda as taxas</summary><p><input type="checkbox" checked disabled aria-label="Comissão básica obrigatória" /> Comissão básica obrigatória: percentual e parcela fixa por unidade comercial; transação já incluída.</p>
      <details><summary>Auditoria completa e parâmetros personalizados</summary><p>Percentuais, incidência, fontes, vigência e arredondamentos aparecem no cálculo completo do resultado. Use personalização somente com origem e período identificados.</p>
        {draft.fields.seller === 'CPF' && <><Input name="orders" label="Número exato de pedidos em 90 dias (opcional, tem prioridade sobre a resposta resumida)" required={false} /><ManualFeeFields id="shopee:cpf-extra" label="Adicional CPF condicional" /></>}
        <Check name="manualBasic">Informar minha comissão básica personalizada</Check>{draft.fields.manualBasic === true && <div className="fields"><Field name="manualRate" label="Comissão percentual personalizada" decimal /><ScopeField name="manualRateScope" label="Incidência do percentual" /><Field name="manualFixed" label="Tarifa fixa personalizada" /><ScopeField name="manualFixedScope" label="Incidência da tarifa fixa" /><BaseField name="manualBase" /><Input name="manualReference" label="Origem ou motivo da personalização" /></div>}
        {draft.fields.returns === 'billable' && <ManualFeeFields id="shopee:returns-protection" label="Devolução Fácil" />}{programs.filter(program => draft.fields[program.name] === 'active').map(program => <ManualFeeFields key={program.id} id={program.id} label={program.label} />)}
        <div className="fields"><Input type="date" name="manualFrom" label="Início do período personalizado" /><Input type="date" name="manualUntil" label="Fim do período personalizado" /></div><p>Personalização substitui somente a cobrança nomeada. Obrigatórias não podem ser desligadas. Valores desconhecidos nunca são preenchidos com zero.</p>
      </details>
    </details>
    {ux.mode === 'advanced' && <p className="muted">Fórmulas são compartilhadas com o modo simples. Nenhuma alteração na apresentação modifica as tarifas.</p>}
  </div>;
}
