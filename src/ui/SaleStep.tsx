import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { selectTable } from '../marketplaces/catalogs/select';
import { saleExtraSelected, text } from '../app/model';
import { Check, Field, Input, Select } from './Fields';
import { useExperience } from './ExperienceContext';
import { ShopQuestions } from './ShopQuestions';
import { PackagingFields } from './CostFields';

export function SaleStep({ tables, onSaveShop }: { tables: readonly ShopeeTable[]; onSaveShop: () => void }) {
  const { draft, ux, update, patch } = useExperience(); const calculation = text(draft, 'calculation');
  const searching = ['profit', 'margin', 'equilibrium'].includes(calculation);
  const discountSelected = saleExtraSelected(draft, 'discount');
  const otherSelected = saleExtraSelected(draft, 'other');
  const directShippingSelected = saleExtraSelected(draft, 'shipping');
  let regularFrom: string | null = null;
  try { regularFrom = selectTable(text(draft, 'date'), tables)?.table.cpf.regressiveBelow ?? null; } catch { /* Date can be incomplete. */ }
  return <section id="sale-step"><div className="section-heading"><span className="step-label">Venda</span><h2>Por quanto vender?</h2><p>Escolha seu objetivo. O custo de impressão já foi aproveitado automaticamente.</p></div>
    <div className="intent-cards" aria-label="Objetivo da venda"><button type="button" className="secondary" aria-pressed={!searching} onClick={() => update({ ...draft, fields: { ...draft.fields, calculation: 'direct' } })}><strong>Já tenho um preço</strong><span>Calcular meu lucro</span></button><button type="button" className="secondary" aria-pressed={searching} onClick={() => update({ ...draft, fields: { ...draft.fields, calculation: 'profit' } })}><strong>Descobrir quanto cobrar</strong><span>Escolher lucro ou margem</span></button></div>
    {searching && <label>O que você quer alcançar?<select value={calculation} onChange={event => update({ ...draft, fields: { ...draft.fields, calculation: event.target.value } })}><option value="profit">Quero lucrar um valor em reais por pedido</option><option value="margin">Quero uma margem sobre a venda</option><option value="equilibrium">Quero apenas cobrir os custos</option></select></label>}
    <div className="fields">{!searching ? <Field name="price" label={ux.saleUnit === 'kit' ? 'Preço de venda de um kit' : 'Preço de venda por unidade'} /> : calculation === 'profit' ? <Field name="targetProfit" label="Quanto quero lucrar neste pedido (R$)?" /> : calculation === 'margin' ? <Field name="targetMargin" label="Margem desejada sobre a venda (%)" decimal /> : null}<Input name="quantity" label={ux.saleUnit === 'kit' ? 'Quantos kits serão vendidos neste pedido?' : 'Quantas unidades serão vendidas neste pedido?'} /></div>
    {searching && <p className="field-hint">O resultado mostra o preço mínimo calculável para a meta e para as tarifas informadas, não uma garantia de vendas.</p>}
    {searching && draft.fields.marketplace === 'shopee' && draft.fields.seller === 'CPF' && regularFrom && ['0,01', '0.01'].includes(text(draft, 'minPrice')) && <p className="help-box">Para CPF, a busca começará em <strong>R$ {regularFrom.replace('.', ',')}</strong>: abaixo desse preço a tarifa regressiva não está suficientemente documentada. O resultado não será o mínimo de toda a Shopee.</p>}
    <div className="fields"><Select name="marketplace" label="Onde você vai vender?"><option value="direct">Venda direta (sem taxa de marketplace)</option><option value="shopee">Shopee Brasil</option></Select></div>
    <details className="optional-sale-settings" open={ux.mode === 'advanced' || ux.saleUnit === 'kit' ? true : undefined}><summary>{ux.saleUnit === 'kit' ? 'Venda em kit — conferir quantidade' : 'Alterar data ou vender em kit (opcional)'}</summary>
      <Input type="date" name="date" label="Data do cenário" />
      <label>Como você vende?<select value={ux.saleUnit} onChange={event => patch({ saleUnit: event.target.value as typeof ux.saleUnit })}><option value="piece">Peça avulsa</option><option value="kit">Kit com várias peças iguais</option></select></label>
      {ux.saleUnit === 'kit' && <label>Peças por kit <span className="field-necessity">Obrigatório para kit</span><input name="partsPerKit" inputMode="numeric" value={ux.partsPerKit} onChange={event => patch({ partsPerKit: event.target.value })} /></label>}
      <p className="field-hint">A data seleciona a referência de tarifas. O consumo da placa corresponde à produção; a quantidade da venda corresponde ao pedido.</p>
    </details>
    {draft.fields.marketplace === 'shopee' ? <><ShopQuestions tables={tables} /><details className="optional-sale-settings"><summary>Salvar ou revisar meu cadastro Shopee</summary><button type="button" className="secondary" onClick={onSaveShop}>Guardar minhas respostas para próximas vendas</button><p className="field-hint">Dados de campanhas, volume e frete precisam ser confirmados para cada cenário.</p></details></> : <p className="field-hint">Venda direta: não há taxas da Shopee neste cálculo.</p>}
    {ux.mode === 'advanced' || ux.packagingDecision === 'unknown' ? <PackagingFields /> : <details className="optional-sale-settings"><summary>{ux.packagingIncluded ? 'Embalagem incluída — editar custo (opcional)' : 'Adicionar embalagem ao cálculo (opcional)'}</summary><PackagingFields /></details>}
    <details className="optional-sale-costs"><summary>Descontos, frete e outras despesas (opcionais)</summary>
      <p className="field-hint">Inclua somente cobranças que realmente se aplicam ao seu pedido. Desativar uma opção conserva o valor digitado, mas o exclui do cálculo.</p>
      <label className="check"><input type="checkbox" checked={discountSelected} onChange={event => patch({ discountIncluded: event.target.checked })} />Tenho desconto ou cupom pago por mim neste pedido</label>
      {discountSelected && <Field name="discount" label="Desconto total pago por você no pedido" />}
      {draft.fields.marketplace === 'direct' && <><label className="check"><input type="checkbox" checked={directShippingSelected} onChange={event => patch({ directShippingIncluded: event.target.checked })} />Tenho frete descontado do recebimento direto</label>{directShippingSelected && <Field name="shipping" label="Frete líquido debitado neste pedido" />}</>}
      <label className="check"><input type="checkbox" checked={otherSelected} onChange={event => patch({ otherCostsIncluded: event.target.checked })} />Tenho outras despesas ou tributos informados por pedido</label>
      {otherSelected && <Field name="other" label="Outras despesas e tributos informados por pedido" />}
      <Check name="advertisingEnabled">Tenho publicidade paga atribuída a este pedido</Check>
      {draft.fields.advertisingEnabled === true && <Field name="advertising" label="Publicidade alocada ao pedido" />}
      <p className="muted">Excluir uma despesa não significa que ela seja zero na realidade. Cupons pagos pela plataforma não são desconto seu. O frete líquido da Shopee é confirmado na seção Shopee.</p>
    </details>
    <details className="price-tools"><summary>Mais opções de precificação (avançado)</summary>
      {searching && <><div className="fields"><Field name="minPrice" label="Início do intervalo de busca" /><Field name="maxPrice" label="Fim do intervalo de busca" /></div><p>Uma tarifa desconhecida pode interromper a busca. O mínimo só vale na faixa informada.</p>{draft.fields.marketplace === 'shopee' && draft.fields.seller === 'CPF' && regularFrom && <button type="button" className="secondary" onClick={() => update({ ...draft, fields: { ...draft.fields, minPrice: regularFrom! } })}>Definir manualmente início em R$ {regularFrom.replace('.', ',')}</button>}</>}
      <label>Comparação adicional<select value={calculation === 'compare' ? 'compare' : ''} onChange={event => { if (event.target.value) update({ ...draft, fields: { ...draft.fields, calculation: event.target.value } }); }}><option value="">Sem comparação adicional</option><option value="compare">Comparar preços que estou considerando</option></select></label>{calculation === 'compare' && <Input name="comparison" label="Preços separados por ponto e vírgula (ex.: 15; 19,90; 25)" />}
      <Field name="lowMargin" label="Avisar se margem ficar abaixo de (%)" decimal />
    </details>
    <button type="button" className="text-button" onClick={() => patch({ intent: 'cost', stage: 'result' })}>Voltar ao custo sem simular venda</button>
  </section>;
}
