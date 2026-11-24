import { useExperience } from './ExperienceContext';
import { Field, NumericInput } from './Fields';
import { text } from '../app/model';

export function CostSource() {
  const { ux, patch } = useExperience();
  const manual = ux.manualProduction?.enabled ?? false;
  return <div className="quick-cost-source"><div className="quick-choice" aria-label="Origem do custo"><button type="button" className="secondary" aria-pressed={manual} onClick={()=>patch({manualProduction:{enabled:true,amount:ux.manualProduction?.amount ?? ''}})}>Já sei o custo</button><button type="button" className="secondary" aria-pressed={!manual} onClick={()=>patch({manualProduction:{enabled:false,amount:ux.manualProduction?.amount ?? ''}})}>Calcular pela impressão</button></div>
    {manual && <><NumericInput name="manualProductionCost" label="Custo de produção por peça física (sem embalagem)" kind="money" value={ux.manualProduction?.amount ?? ''} onValue={amount=>patch({manualProduction:{enabled:true,amount}})} /><p className="field-hint">Substitui apenas o custo de fabricação; os dados do fatiamento ficam guardados. Embalagem e outras despesas são separadas.</p></>}
  </div>;
}

export function AdvertisingFields({ slider=false }: {slider?:boolean}) {
  const {draft,ux,update}=useExperience();
  const active=draft.fields.advertisingEnabled===true;
  const percent=ux.advertisingPercent!==undefined;
  const rate=Number((ux.advertisingPercent??'0').replace(',','.'));
  function change(mode:'off'|'percent'|'fixed') {
    const next={...ux};
    if(mode==='percent') next.advertisingPercent=ux.advertisingPercent??'0';
    if(mode==='fixed') delete next.advertisingPercent;
    update({...draft,fields:{...draft.fields,advertisingEnabled:mode!=='off',...(mode==='fixed'&&!text(draft,'advertising')?{advertising:'0'}:{})},ux:next});
  }
  return <div className="quick-advertising"><label>Publicidade adicional (não repetir créditos Ads Fácil)<select value={!active?'off':percent?'percent':'fixed'} onChange={e=>change(e.target.value as 'off'|'percent'|'fixed')}><option value="off">Não incluir</option><option value="percent">% da venda</option><option value="fixed">Valor em reais por pedido</option></select></label>
    {active && percent && <><NumericInput name="advertisingPercent" label="Investimento sobre a venda" kind="percent" value={ux.advertisingPercent??''} onValue={value=>update({...draft,ux:{...ux,advertisingPercent:value}})} />{slider && <input type="range" aria-label="Ajustar publicidade em percentual" min="0" max="100" step="0.5" value={Number.isFinite(rate)?Math.max(0,Math.min(100,rate)):0} onChange={e=>update({...draft,ux:{...ux,advertisingPercent:e.target.value}})} />}</>}
    {active && !percent && <Field name="advertising" label="Publicidade alocada ao pedido" />}
  </div>;
}
