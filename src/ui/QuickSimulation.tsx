import { useState } from 'react';
import { saleExtraSelected, text } from '../app/model';
import type { SavedEntry } from '../app/storage';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { selectTable } from '../marketplaces/catalogs/select';
import { declarePrograms, scenarioPrograms } from '../app/ux-v3';
import { quickSaleProjection } from '../app/quick-simulation';
import { D } from '../engine/decimal';
import { useExperience } from './ExperienceContext';
import { Field, Input, Select } from './Fields';
import { CostSource, AdvertisingFields } from './SharedQuickFields';
import { PrintStep } from './PrintStep';
import { PrintImport } from './PrintImport';
import { FilamentFields, PrinterFields, OptionalCosts, PackagingFields } from './CostFields';
import { ShopQuestions } from './ShopQuestions';
import { GuidedIssues } from './GuidedIssues';
import type { GuidedIssue } from './guided-validation';
import { currency } from './ResultView';
import { ExperienceResult } from './ExperienceResult';
import type { FinancialState } from './useAutomaticCalculation';

type Props={entries:SavedEntry[]; tables:readonly ShopeeTable[]; state:FinancialState; issues:readonly GuidedIssue[]; onFix:(issue:GuidedIssue)=>void; onProfile:(entry:SavedEntry)=>void; onSaveFilament:(draft:ReturnType<typeof import('../app/experience').withExperience>)=>Promise<void>; onSaveShop:()=>void; onSave:()=>void; onDetailed:()=>void; onResolve:(target:string)=>void; onRetry:()=>void; saved:boolean};
export function QuickSimulation({entries,tables,state,issues,onFix,onProfile,onSaveFilament,onSaveShop,onSave,onDetailed,onResolve,onRetry,saved}:Props) {
  const {draft,ux,update,patch}=useExperience();
  const [orders,setOrders]=useState('100');
  const operation=text(draft,'calculation');
  const sale=ux.intent==='sale';
  const output=state.phase==='ready' && !issues.length?state.output:undefined;
  const projection=quickSaleProjection(output,Number(orders));
  const financial=projection?.result;
  const price=Number(text(draft,'price').replace(',','.'));
  const sliderMax=Math.max(100, Number.isFinite(price)?Math.ceil(price/10)*10:100);
  const fields=scenarioPrograms(draft);
  const seller=text(draft,'seller');
  let threshold:number|null=null;
  try {threshold=selectTable(text(draft,'date'),tables)?.table.cpf.volumeThreshold??null;} catch { /* Invalid date remains visible in validation. */ }
  const changeProgram=(name:string,value:string)=>update(declarePrograms({...draft,fields:{...fields,[name]:value}},'some'));
  const setSale=(changes:Record<string,string|boolean>, extra:Partial<typeof ux>={})=>update({...draft,fields:{...draft.fields,...changes},ux:{...ux,...extra}});
  const volume=ux.volume.date===text(draft,'date')&&ux.volume.threshold===threshold?ux.volume.answer:'unknown';
  return <div className="quick-workspace">
    <div className="quick-main">
      <section className="quick-panel"><div className="quick-heading"><div><span className="step-label">Simulação rápida</span><h2>Seu preço, seu lucro.</h2><p>Altere os valores e acompanhe o resultado automaticamente.</p></div><button type="button" className="secondary" onClick={onDetailed}>Abrir detalhada</button></div>
      <CostSource />
      {ux.manualProduction?.enabled ? <details><summary>Importar uma impressão do fatiador</summary><PrintImport draft={draft} filaments={entries} onApply={update}/></details> : <><details open={issues.some(i=>i.stage==='print')?true:undefined}><summary>Impressão e importação de arquivo</summary><PrintStep filaments={entries}/></details><details open={issues.some(i=>i.stage==='costs')?true:undefined}><summary>Material, máquina e custos de fabricação</summary><FilamentFields entries={entries} onProfile={onProfile} onSave={onSaveFilament}/><details><summary>Energia e impressora (opcional)</summary><PrinterFields entries={entries} onProfile={onProfile}/></details><details><summary>Mão de obra e outros custos (opcional)</summary><OptionalCosts/></details></details></>}
      <details open={issues.some(i=>['packagingUnit','packagingOrder','package-price','package-units'].includes(i.field))?true:undefined}><summary>Embalagem (opcional)</summary><PackagingFields/></details>
      {state.preview?.perPiece!==null&&state.preview?.perPiece!==undefined&&<div className="quick-inline"><span>Custo por peça física (com itens selecionados)</span><strong>{currency(state.preview.perPiece)}</strong></div>}
      {!sale&&<button type="button" onClick={()=>setSale({calculation:'direct',quantity:text(draft,'quantity')||'1'},{intent:'sale'})}>Simular uma venda</button>}
      </section>
      {sale&&<section className="quick-panel"><h2>Venda</h2><div className="fields"><Select name="marketplace" label="Canal"><option value="direct">Venda direta</option><option value="shopee">Shopee Brasil</option></Select><Input name="quantity" label="Unidades comerciais por pedido"/></div>
      {ux.saleUnit==='kit'&&<p className="help-box">Kit: {ux.partsPerKit||'—'} peças por unidade comercial. <button type="button" className="text-button" onClick={onDetailed}>Editar kit</button></p>}
      <label>Objetivo<select value={operation} onChange={e=>setSale({calculation:e.target.value})}><option value="direct">Simular preço de venda</option><option value="profit">Encontrar preço para lucro desejado</option><option value="margin">Encontrar preço para margem desejada</option><option value="equilibrium">Encontrar ponto de equilíbrio</option><option value="compare">Comparar preços (detalhada)</option></select></label>
      {operation==='direct'||operation==='compare'?<><Field name="price" label="Preço de venda por unidade comercial"/><div className="quick-slider"><input type="range" aria-label="Ajustar preço de venda" min="0.01" max={sliderMax} step="0.01" value={Number.isFinite(price)&&price>0?price:0.01} onChange={e=>setSale({price:Number(e.target.value).toFixed(2)})}/><div><small>R$ 0,01</small><small>{currency(String(sliderMax))}</small></div></div>{operation==='compare'&&<Input name="comparison" label="Preços separados por ponto e vírgula"/>}</>:operation==='profit'?<Field name="targetProfit" label="Lucro desejado por pedido"/>:operation==='margin'?<Field name="targetMargin" label="Margem desejada (%)" decimal/>:<p className="muted">Busca um preço que cubra os custos selecionados.</p>}
      {['profit','margin','equilibrium'].includes(operation)&&<details><summary>Limites de busca (opcional)</summary><Field name="minPrice" label="Preço mínimo da busca" required={false}/><Field name="maxPrice" label="Preço máximo da busca" required={false}/></details>}
      {draft.fields.marketplace==='shopee'&&<><div className="quick-shopee"><Select name="seller" label="Tipo de vendedor"><option value="">Selecione CPF ou CNPJ</option><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></Select>
      {seller==='CPF'&&<label>Pedidos nos últimos 90 dias<select value={text(draft,'orders')?'exact':volume} onChange={e=>setSale({orders:''},{volume:{answer:e.target.value as typeof ux.volume.answer,threshold,date:text(draft,'date')}})}><option value="unknown">Não sei</option><option value="above" disabled={threshold===null}>Acima de {threshold??'—'}</option><option value="below" disabled={threshold===null}>Abaixo de {threshold??'—'}</option><option value="equal" disabled={threshold===null}>Exatamente {threshold??'—'}</option>{text(draft,'orders')&&<option value="exact">Contagem informada: {text(draft,'orders')}</option>}</select></label>}
      {(['highlight','returns','ads','affiliates','advance'] as const).map(name=><label key={name}>{({highlight:'Campanha de Destaque',returns:'Devolução Fácil',ads:'Ads Fácil',affiliates:'Afiliados',advance:'Shopee Acelera'})[name]}<span className="quick-choice" role="group" aria-label={name}>{(name==='returns'?[['billable','Sim'],['trial','Teste'],['inactive','Não'],['unknown','Não sei']]:[['active','Sim'],['inactive','Não'],['unknown','Não sei']]).map(([v,label])=><button type="button" className="secondary" key={v} aria-pressed={fields[name]===v} onClick={()=>changeProgram(name,v!)}>{label}</button>)}</span></label>)}
      </div><details><summary>Percentuais, frete e condições da Shopee (opcional)</summary><ShopQuestions tables={tables}/><button type="button" className="secondary" onClick={onSaveShop}>Salvar condições da loja</button></details></>}
      <AdvertisingFields slider/>
      <label className="check"><input type="checkbox" checked={saleExtraSelected(draft,'other')} onChange={e=>patch({otherCostsIncluded:e.target.checked})}/> Outras despesas ou tributos por pedido</label>{saleExtraSelected(draft,'other')&&<Field name="other" label="Outras despesas por pedido"/>}
      <details><summary>Desconto, data e demais opções</summary><Input name="date" type="date" label="Data do cenário"/><label className="check"><input type="checkbox" checked={saleExtraSelected(draft,'discount')} onChange={e=>patch({discountIncluded:e.target.checked})}/> Cupom pago pelo vendedor</label>{saleExtraSelected(draft,'discount')&&<Field name="discount" label="Desconto por pedido"/>}{draft.fields.marketplace==='direct'&&<><label className="check"><input type="checkbox" checked={saleExtraSelected(draft,'shipping')} onChange={e=>patch({directShippingIncluded:e.target.checked})}/> Frete pago por mim</label>{saleExtraSelected(draft,'shipping')&&<Field name="shipping" label="Frete por pedido"/>}</>}<button type="button" className="secondary" onClick={onDetailed}>Mais opções na detalhada</button></details>
      </section>}
    </div>
    <aside className="quick-panel quick-result" aria-label="Resultado da simulação rápida" aria-live="polite"><h2>Resultado ao vivo</h2>
      {issues.length>0?<GuidedIssues issues={issues} onFix={onFix}/>:state.phase==='processing'||state.phase==='waiting'?<p role="status">Atualizando cálculo…</p>:null}
      {projection&&financial?<><p className="quick-status">{projection.provisional?'Estimativa com hipóteses — não é repasse confirmado':'Simulação com dados informados'}</p><div className="quick-headline"><span>Preço {operation==='direct'?'por unidade comercial':'no cenário apresentado'}</span><strong>{currency(projection.price)}</strong></div>
      {projection.range&&<p className="field-hint">Lucro por pedido nos cenários: {currency(projection.range.lower)} a {currency(projection.range.upper)}. Não são limites garantidos.</p>}
      <dl className="quick-breakdown">{[['Taxas marketplace',financial.knownMarketplaceFees],['Produção',financial.manufacturing.total],['Embalagem',financial.packaging],['Frete',financial.sellerShipping],['Desconto',financial.sellerDiscount],['Publicidade e outras despesas',financial.otherOperatingCosts]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{currency(value!)}</dd></div>)}</dl>
      <div className="quick-stack" aria-label="Distribuição da receita do pedido">{[{value:new D(financial.manufacturing.total).plus(financial.packaging),cls:'production'},{value:new D(financial.knownMarketplaceFees),cls:'fees'},{value:new D(financial.sellerShipping).plus(financial.sellerDiscount).plus(financial.otherOperatingCosts),cls:'expenses'},{value:D.max(0,financial.operatingProfit??'0'),cls:'profit'}].map(item=><span key={item.cls} className={item.cls} style={{flexGrow:Math.max(0,item.value.toNumber())}}/>)}</div><div className="quick-legend"><span>Produção + embalagem</span><span>Taxas</span><span>Outras deduções</span><span>Lucro</span></div>
      <div className="quick-kpis"><div><small>Lucro estimado por unidade</small><strong className={Number(projection.perUnit)<0?'quick-loss':'quick-gain'}>{currency(projection.perUnit)}</strong></div><div><small>Margem sobre receita líquida</small><strong className={Number(financial.margin)<0?'quick-loss':'quick-gain'}>{financial.margin===null?'—':new D(financial.margin).mul(100).toFixed(2).replace('.',',')+'%'}</strong></div><div><small>Lucro em 100 pedidos iguais</small><b>{currency(projection.profit100)}</b></div><div><small>Lucro em 500 pedidos iguais</small><b>{currency(projection.profit500)}</b></div></div>
      <label>Projetar quantidade de pedidos<input type="number" min="1" max="1000000" step="1" value={orders} onChange={e=>setOrders(e.target.value)}/></label><div className="quick-inline"><span>Lucro projetado</span><strong>{currency(projection.projection)}</strong></div><p className="field-hint">Projeção de pedidos idênticos, com {projection.quantity} unidade(s) comercial(is) por pedido; não prevê demanda.</p>
      <details><summary>Composição das taxas e hipóteses</summary><ul>{financial.fees.map(f=><li key={f.rule.id}>{f.rule.name}: {currency(f.amount)}</li>)}</ul>{output&&output.kind!=='cost'&&output.referencePreview?.hypotheticalConditions.map(s=><p className="field-hint" key={s}>{s}</p>)}</details></>:null}
      {!projection&&state.preview?.perPiece&&<div className="quick-headline"><span>Custo conhecido por peça</span><strong>{currency(state.preview.perPiece)}</strong></div>}
      {!issues.length&&state.phase==='invalid'&&<><p>{state.error}</p><button type="button" className="secondary" onClick={onRetry}>Tentar novamente</button></>}
      {output?.kind==='blocked-search'&&output.referencePreview?.unreachableScenarios!==undefined&&output.referencePreview.unreachableScenarios>0&&<p className="notice">A meta não foi atingida em todos os cenários. Amplie a faixa de busca ou reduza a meta.</p>}
      <details open={!projection&&output?true:undefined}><summary>Ver resultado completo e ressalvas</summary><ExperienceResult state={state} tables={tables} issues={issues} onFix={onFix} onResolve={onResolve} onConfirm={onDetailed} onSave={onSave} saved={saved} onRetry={onRetry}/></details>
      <button type="button" className="secondary" onClick={onDetailed}>Abrir simulação completa detalhada</button>
    </aside>
  </div>;
}
