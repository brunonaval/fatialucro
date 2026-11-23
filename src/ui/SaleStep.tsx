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
  return <section id="sale-step"><div className="section-heading"><span className="step-label">Venda opcional</span><h2>Quer descobrir quanto sobra na venda?</h2><p>Use o custo da sua impressão para simular uma venda. Você pode voltar ao custo sem perder os dados.</p></div>
    <div className="intent-cards" aria-label="Objetivo da venda"><button type="button" className="secondary" aria-pressed={!searching} onClick={() => update({ ...draft, fields: { ...draft.fields, calculation: 'direct' } })}><strong>Já tenho um preço</strong><span>Mostre quanto sobra depois dos custos e das taxas conhecidas.</span></button><button type="button" className="secondary" aria-pressed={searching} onClick={() => update({ ...draft, fields: { ...draft.fields, calculation: 'profit' } })}><strong>Quero descobrir um preço</strong><span>Escolha um lucro ou uma margem desejada.</span></button></div>
    {searching && <label>O que você quer alcançar?<select value={calculation} onChange={event => update({ ...draft, fields: { ...draft.fields, calculation: event.target.value } })}><option value="profit">Quero lucrar um valor em reais por pedido</option><option value="margin">Quero uma margem sobre a venda</option><option value="equilibrium">Quero apenas cobrir os custos</option></select></label>}
    <div className="fields">{!searching ? <Field name="price" label={ux.saleUnit === 'kit' ? 'Preço de venda de um kit' : 'Preço de venda por unidade'} /> : calculation === 'profit' ? <Field name="targetProfit" label="Quanto quero lucrar neste pedido (R$)?" /> : calculation === 'margin' ? <Field name="targetMargin" label="Margem desejada sobre a venda (%)" decimal /> : null}<Input name="quantity" label={ux.saleUnit === 'kit' ? 'Quantos kits serão vendidos neste pedido?' : 'Quantas unidades serão vendidas neste pedido?'} /></div>
    {searching && <p className="help-box">Margem é a parte da receita após desconto que sobra como lucro. Não é o mesmo que acrescentar um percentual ao custo. A busca encontra um mínimo matemático para sua meta, não um preço competitivo ou garantia de vendas.</p>}
    <label>O que é uma unidade vendida?<select value={ux.saleUnit} onChange={event => patch({ saleUnit: event.target.value as typeof ux.saleUnit })}><option value="piece">Uma peça física</option><option value="kit">Kit com várias peças equivalentes</option></select></label>
    {ux.saleUnit === 'kit' && <label>Quantas peças físicas há dentro de cada kit? <span className="field-necessity">Obrigatório para kit</span><input name="partsPerKit" inputMode="numeric" value={ux.partsPerKit} onChange={event => patch({ partsPerKit: event.target.value })} /></label>}
    <p className="field-hint">Peças da placa são produção. Aqui a quantidade é de itens comerciais vendidos no mesmo pedido. Tarifas por item usam a unidade comercial. Kits com peças de custos diferentes exigem cálculo separado.</p>
    <div className="fields"><Select name="marketplace" label="Onde você vai vender?"><option value="direct">Venda direta (sem taxa de marketplace)</option><option value="shopee">Shopee Brasil</option></Select><Input type="date" name="date" label="Data do cenário" /></div>
    {draft.fields.marketplace === 'shopee' ? <><ShopQuestions tables={tables} /><button type="button" className="text-button" onClick={onSaveShop}>Guardar minhas respostas na loja Shopee</button><p className="field-hint">Cadastro é reutilizável. Campanhas, volume, frete e hipóteses não são confirmados para sempre. Adesões contínuas podem ser configuradas em Minha loja Shopee.</p></> : <p className="help-box">Venda direta não exige cadastro da Shopee e não herda taxas dela.</p>}
    <PackagingFields />
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
    <details className="price-tools"><summary>Mais opções de precificação</summary>
      {searching && <><div className="fields"><Field name="minPrice" label="Início do intervalo de busca" /><Field name="maxPrice" label="Fim do intervalo de busca" /></div><p>O mínimo vale somente neste intervalo. Uma tarifa desconhecida interrompe a busca.</p>{draft.fields.marketplace === 'shopee' && draft.fields.seller === 'CPF' && regularFrom && <button type="button" className="secondary" onClick={() => update({ ...draft, fields: { ...draft.fields, minPrice: regularFrom! } })}>Usar início da faixa regular CPF (R$ {regularFrom.replace('.', ',')})</button>}</>}
      <label>Comparação adicional<select value={calculation === 'compare' ? 'compare' : ''} onChange={event => { if (event.target.value) update({ ...draft, fields: { ...draft.fields, calculation: event.target.value } }); }}><option value="">Sem comparação adicional</option><option value="compare">Comparar preços que estou considerando</option></select></label>{calculation === 'compare' && <Input name="comparison" label="Preços separados por ponto e vírgula (ex.: 15; 19,90; 25)" />}
      <Field name="lowMargin" label="Avisar se margem ficar abaixo de (%)" decimal />
    </details>
    <button type="button" className="text-button" onClick={() => patch({ intent: 'cost', stage: 'result' })}>Voltar ao custo sem simular venda</button>
  </section>;
}
