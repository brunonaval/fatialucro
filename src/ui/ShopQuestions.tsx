import { useId, useState } from 'react';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { catalogIndicator, selectTable } from '../marketplaces/catalogs/select';
import { text } from '../app/model';
import { declarePrograms, programQuestions, scenarioPrograms, profileSource } from '../app/ux-v3';
import { BaseField, Check, Field, Input, ManualFeeFields, ScopeField, Select, useForm } from './Fields';
import { useExperience } from './ExperienceContext';
import { SimulationReview } from './SimulationReview';
import { shopeeCheckpoints } from '../app/shopee-checkpoints';
import type { ShopeeCheckpointId } from '../app/shopee-checkpoints';
import { ShopSetupGuide } from './ShopSetupGuide';
import { ProgramPricingFields } from './ProgramPricingFields';
import { focusCorrectionTarget } from './navigation';

export function ShopQuestions({ tables, permanentOnly = false }: { tables: readonly ShopeeTable[]; permanentOnly?: boolean }) {
  const { draft, ux, update } = useExperience(); const prefix = useId(); const sectionId = (id: string) => permanentOnly ? `${prefix}-${id}` : id; const [showPrograms, setShowPrograms] = useState(false); const [editSeller, setEditSeller] = useState(false);
  let threshold: number | null = null; let indicator: ReturnType<typeof catalogIndicator> | null = null;
  try { const table = selectTable(text(draft, 'date'), tables); threshold = table?.table.cpf.volumeThreshold ?? null; indicator = catalogIndicator(text(draft, 'date'), tables); } catch { /* Date validation is shown in the form. */ }
  const programs = [{ name: 'highlight', label: 'Campanha de Destaque', id: 'shopee:highlight' }, { name: 'ads', label: 'Ads Fácil', id: 'shopee:adsEasy' }, { name: 'affiliates', label: 'Afiliados', id: 'shopee:affiliates' }, { name: 'advance', label: 'Shopee Acelera', id: 'shopee:cashAdvance' }];
  const declaration = ux.programDeclaration; const fields = scenarioPrograms(draft);
  const group = declaration?.date === text(draft, 'date') ? declaration.answer
    : programQuestions.every(program => fields[program.field] === 'inactive') ? 'none'
    : programQuestions.every(program => fields[program.field] === 'unknown') ? 'unknown' : 'some';
  function changeProgram(name: string, value: string) { const next = declarePrograms({ ...draft, fields: { ...fields, [name]: value } }, 'some'); update(next); }
  const savedSeller = Boolean(ux.profileOrigins?.store && ['CPF', 'CNPJ'].includes(text(draft, 'seller')));
  // A saved shop does not require opening all five programs on every quote.
  const form = useForm();
  const individual = showPrograms || (group === 'some' && (!savedSeller || (form.showErrors && form.issues?.some(i => ['adsRate','affiliateRate','affiliateExtraRate','advanceShare'].includes(i.field)))));
  function navigate(target: ShopeeCheckpointId) {
    const wrapper = document.getElementById(sectionId('shop-conditions-options'));
    if (wrapper instanceof HTMLDetailsElement) wrapper.open = true;
    if (target === 'shop-programs') setShowPrograms(true);
    if (target === 'shop-seller') setEditSeller(true);
    window.requestAnimationFrame(() => { focusCorrectionTarget(sectionId(target)); });
  }
  const checks = permanentOnly ? [] : shopeeCheckpoints(draft, tables);
  const exactOrders = text(draft, 'orders');
  const exactCountEntered = /^\d+$/.test(exactOrders) && Number.isSafeInteger(Number(exactOrders));
  const ConditionsContainer = permanentOnly ? 'div' : 'details';
  return <div className="shop-questions">
    {!permanentOnly && <ShopSetupGuide checks={checks} onNavigate={navigate} />}
    <ConditionsContainer id={sectionId('shop-conditions-options')} className="shop-conditions" {...(ux.mode === 'advanced' && !permanentOnly ? { open: true } : {})}>
      {!permanentOnly && <summary>Conferir ou alterar CPF, programas, frete e tarifas (opcional)</summary>}
    <div id={sectionId('shop-seller')} tabIndex={-1}>
      {savedSeller && !editSeller
        ? <div className="shop-saved-seller"><p>Minha loja cadastrada: <strong>{text(draft, 'seller')}</strong> · {profileSource(draft, 'store')}</p><button type="button" className="text-button" onClick={() => setEditSeller(true)}>Alterar CPF ou CNPJ</button></div>
        : <Select name="seller" label="Você vende como CPF ou CNPJ?"><option value="">Ainda não informei</option><option value="CPF">CPF — pessoa física</option><option value="CNPJ">CNPJ — pessoa jurídica</option></Select>}
    </div>
    <div id={sectionId('shop-programs')} className="cost-block" tabIndex={-1}><h3>Programas e cobranças adicionais</h3>
      <label>Sua loja participa de programas que podem cobrar taxas adicionais?<select value={group} onChange={event => { update(declarePrograms(draft, event.target.value as 'none' | 'some' | 'unknown')); setShowPrograms(event.target.value === 'some'); }}><option value="unknown">Não sei</option><option value="none">Não participo de nenhum dos programas listados</option><option value="some">Sim, participo de alguns / conferir individualmente</option></select></label>
      <p className="program-list">Programas considerados nesta declaração: {programQuestions.map(program => program.name).join(', ')}.</p>
      {group === 'none' && <p className="help-box">Você declarou esses cinco programas inativos em {text(draft, 'date')}. Isso não elimina comissão básica, condições de CPF, frete ou pendências documentais.</p>}
      {group === 'unknown' && <p className="notice">Não saber não significa não participar. As cobranças continuam desconhecidas até sua confirmação.</p>}
      {!individual && <button type="button" className="text-button" onClick={() => setShowPrograms(true)}>Conferir cada programa</button>}
      {individual && savedSeller && <button type="button" className="text-button" onClick={() => setShowPrograms(false)}>Recolher programas já conferidos</button>}
      {individual && <div className="program-questions">
        <label>Sua loja participa da Devolução Fácil?<select value={String(fields.returns)} onChange={event => changeProgram('returns', event.target.value)}><option value="unknown">Não sei</option><option value="inactive">Não</option><option value="trial">Sim, durante teste gratuito</option><option value="billable">Sim, com cobrança ativa</option></select></label>
        {programs.map(program => <div key={program.name}><label>Participa de {program.label}?<select value={String(fields[program.name])} onChange={event => changeProgram(program.name, event.target.value)}><option value="unknown">Não sei</option><option value="inactive">Não</option><option value="active">Sim</option></select></label>{fields[program.name] === 'active' && <ProgramPricingFields program={program.name} permanentOnly={permanentOnly} />}</div>)}
      </div>}
      {permanentOnly && <details><summary>Quais adesões podem ser reutilizadas em outras datas?</summary><p>Campanhas, afiliados da venda, testes gratuitos, volume e frete não são fatos permanentes. Mesmo uma adesão contínua precisa ser conferida se sua loja mudar.</p>{programQuestions.filter(program => ['returns', 'ads', 'advance'].includes(program.field)).map(program => <label className="check" key={program.field}><input type="checkbox" checked={ux.persistentPrograms?.includes(program.field) ?? false} disabled={fields[program.field] === 'unknown' || fields[program.field] === 'trial'} onChange={event => update({ ...draft, ux: { ...ux, persistentPrograms: event.target.checked ? [...(ux.persistentPrograms ?? []), program.field] : (ux.persistentPrograms ?? []).filter(field => field !== program.field) } })} />Confirmei que a adesão/não adesão a {program.name} é contínua</label>)}</details>}
      <details><summary>Como descubro isso?</summary><p>Na Central do Vendedor, confira adesão e cobrança de cada programa e o detalhamento financeiro dos pedidos. As respostas aqui não alteram sua loja na Shopee.</p><a href="https://seller.shopee.com.br/" target="_blank" rel="noreferrer">Abrir Central do Vendedor por minha iniciativa</a></details>
    </div>
    {!permanentOnly && <>
      {draft.fields.seller === 'CPF' && <div id={sectionId('shop-volume')} tabIndex={-1}><label>Nos últimos 90 dias, sua loja ultrapassou {threshold ?? 'o limite de'} pedidos?<select value={exactCountEntered ? 'exact' : ux.volume.date === text(draft, 'date') && ux.volume.threshold === threshold ? ux.volume.answer : 'unknown'} onChange={event => update({ ...draft, fields: { ...draft.fields, orders: '' }, ux: { ...ux, volume: { answer: event.target.value as typeof ux.volume.answer, threshold, date: text(draft, 'date') } } })}><option value="unknown">Não sei</option><option value="exact" disabled>Usando contagem exata de {exactOrders} pedidos</option><option value="above" disabled={threshold === null}>Sim, mais de {threshold ?? '…'}</option><option value="below" disabled={threshold === null}>Não, menos de {threshold ?? '…'}</option><option value="equal" disabled={threshold === null}>Exatamente {threshold ?? '…'}</option></select></label><details><summary>Como descubro o volume?</summary><p>Confira os pedidos nos 90 dias relevantes à data deste cenário. Exatamente no limite continua sujeito à pendência documental. Sem limite comprovado na tabela, esta pergunta não presume um número.</p><Input name="orders" label="Número exato de pedidos no período (opcional, tem prioridade)" required={false} /></details></div>}
      <div id={sectionId('shop-shipping')} tabIndex={-1}><label>Há frete efetivamente descontado do seu repasse?<select value={ux.shipping} onChange={event => update({ ...draft, fields: { ...draft.fields, shippingConfirmed: event.target.value !== 'unknown', ...(event.target.value === 'no' ? { shipping: '0' } : event.target.value === 'yes' && ux.shipping !== 'yes' ? { shipping: '' } : {}) }, ux: { ...ux, shipping: event.target.value as typeof ux.shipping } })}><option value="unknown">Não sei</option><option value="no">Não — confirmei custo líquido zero</option><option value="yes">Sim — informar o valor líquido</option></select></label>
      {ux.shipping === 'yes' && <Field name="shipping" label="Frete líquido debitado neste pedido" />}
      <details><summary>Como descubro o frete líquido?</summary><p>Confira o débito real no detalhamento financeiro do pedido, após pagamentos do comprador e subsídios. Frete pago por fora é outra despesa, informada uma única vez. Se não conferiu, escolha “Não sei”.</p></details></div>
    </>}
    {indicator && <div className={`tariff-status ${indicator.tone}`}><strong>{indicator.title}</strong><p>{indicator.detail}</p></div>}
    {!permanentOnly && <SimulationReview tables={tables} />}
    <details className="tariffs-explained"><summary>Entenda as taxas cobradas</summary><p><input type="checkbox" checked disabled aria-label="Comissão básica obrigatória" /> Comissão básica obrigatória: percentual e parcela fixa individualizados por unidade comercial; transação já incluída.</p><p>Auditoria completa: consulte “Ver cálculo completo” no Resultado para valor, fórmula, origem, incidência, arredondamento, período e pendências de cada cobrança. As condições não confirmadas impedem concluir lucro e repasse.</p></details>
      <details className="manual-tariffs"><summary>Informar taxas personalizadas (avançado)</summary><p>Percentuais, incidência, fontes, vigência e arredondamentos aparecem no cálculo completo do resultado. Use personalização somente com origem e período identificados.</p>
        {draft.fields.seller === 'CPF' && <ManualFeeFields inline id="shopee:cpf-extra" label="Adicional CPF condicional" />}
        <Check name="manualBasic">Informar minha comissão básica personalizada</Check>{draft.fields.manualBasic === true && <div className="fields"><Field name="manualRate" label="Comissão percentual personalizada" decimal /><ScopeField name="manualRateScope" label="Incidência do percentual" /><Field name="manualFixed" label="Tarifa fixa personalizada" /><ScopeField name="manualFixedScope" label="Incidência da tarifa fixa" /><BaseField name="manualBase" /><Input name="manualReference" label="Origem ou motivo da personalização" /></div>}
        {draft.fields.returns === 'billable' && <ManualFeeFields inline id="shopee:returns-protection" label="Devolução Fácil" />}{programs.filter(program => draft.fields[program.name] === 'active').map(program => <ManualFeeFields inline key={program.id} id={program.id} label={program.label} />)}
        <div className="fields"><Input type="date" name="manualFrom" label="Início do período personalizado" /><Input type="date" name="manualUntil" label="Fim do período personalizado" /></div><p>Personalização substitui somente a cobrança nomeada. Obrigatórias não podem ser desligadas. Valores desconhecidos nunca são preenchidos com zero.</p>
      </details>
    </ConditionsContainer>
  </div>;
}
