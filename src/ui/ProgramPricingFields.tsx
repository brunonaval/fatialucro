import { NumericInput } from './Fields';
import { useExperience } from './ExperienceContext';
import type { ProgramPricing } from '../marketplaces/shopee/programs';

export function ProgramPricingFields({ program, permanentOnly = false }: { program: string; permanentOnly?: boolean }) {
  const { ux, patch } = useExperience();
  const p = ux.programPricing ?? {};
  const set = <K extends keyof ProgramPricing>(key: K, value: NonNullable<ProgramPricing[K]>) => patch({ programPricing: { ...p, [key]: value } });
  if (program === 'ads') return <div id="program-ads" className="cost-block"><NumericInput name="adsRate" label="Percentual do Ads Fácil (até 5%)" kind="percent" required={false} value={p.adsRate ?? ''} onValue={v => set('adsRate',v)} /><p className="field-hint">Não sabe? Deixe vazio para simular até 5%. Confira em Ads Fácil na Central do Vendedor. Créditos recebidos não são dinheiro.</p></div>;
  if (program === 'affiliates') return <div id="program-affiliates" className="cost-block">
    <NumericInput name="affiliateRate" label="Comissão configurada para o produto (%)" kind="percent" required={false} value={p.affiliateRate ?? ''} onValue={v=>set('affiliateRate',v)} />
    <p className="field-hint">Consulte Afiliados do Vendedor → Campanha. Sem valor, a referência usa 4%, não um teto.</p>
    {!permanentOnly && <label>Origem prevista da venda (opcional)<select name="affiliateAttribution" value={p.affiliateAttribution ?? 'unknown'} onChange={e=>set('affiliateAttribution',e.target.value as NonNullable<ProgramPricing['affiliateAttribution']>)}><option value="unknown">Não sei</option><option value="none">Sem afiliado elegível</option><option value="direct">Venda direta por afiliado</option><option value="indirect">Venda indireta elegível (30%)</option></select></label>}
    <label>Campanha dinâmica (opcional)<select name="affiliateDynamic" value={p.affiliateDynamic ?? 'unknown'} onChange={e=>set('affiliateDynamic',e.target.value as NonNullable<ProgramPricing['affiliateDynamic']>)}><option value="unknown">Não sei</option><option value="off">Não / exclusiva</option><option value="low">Sim — redução de 50%</option><option value="base">Sim — comissão de referência</option><option value="high">Sim — aumento de 50%</option></select></label>
    <NumericInput name="affiliateExtraRate" label="Encargo adicional sobre a comissão (%; zero se confirmado)" kind="percent" required={false} value={p.affiliateExtraRate ?? ''} onValue={v=>set('affiliateExtraRate',v)} />
    <p className="field-hint">Informe somente se houver cobrança no seu relatório. Vazio não confirma ausência de encargo.</p>
  </div>;
  if (program === 'advance') return <div id="program-advance" className="cost-block"><label>Categoria no Shopee Acelera (opcional)<select name="advanceTier" value={p.advanceTier ?? 'unknown'} onChange={e=>set('advanceTier',e.target.value as NonNullable<ProgramPricing['advanceTier']>)}><option value="unknown">Não sei</option><option value="official">Loja Oficial — Grandes Marcas (1%)</option><option value="indicated">Vendedor Indicado (2,5%)</option><option value="other">Demais vendedores (3,5%)</option></select></label>
    {!permanentOnly && <NumericInput name="advanceShare" label="Parcela do recebível antecipada (%)" kind="percent" required={false} value={p.advanceShare ?? ''} onValue={v=>set('advanceShare',v)} />}
    <p className="field-hint">Deixe vazio se não souber; referência até 100% antecipado. Informe 0 se este pedido não foi antecipado. Consulte Shopee Acelera → detalhamento do resgate.</p>
  </div>;
  return null;
}
