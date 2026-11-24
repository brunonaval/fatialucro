import { describe, it, expect } from 'vitest';
import { automaticProgramRates } from '../src/marketplaces/shopee/programs';
import { calculatePricing } from '../src/engine';
import { createShopeeCatalog, shopeeFacts, shopeeSelections } from '../src/marketplaces/shopee/catalog';
import type { ShopeeContext } from '../src/marketplaces/shopee/catalog';
import { sale } from './helpers';
import { newCalculationDraft, calculateExperience } from '../src/app/experience';
import { guidedIssues } from '../src/ui/guided-validation';
const ctx: ShopeeContext = { seller:'CNPJ', ordersLast90Days:null, returnsProtection:'inactive', highlightCampaign:'inactive', adsEasy:'active', affiliates:'active', cashAdvance:'active', shippingConfirmed:true, programPricing:{adsRate:'1.5', affiliateRate:'5',affiliateAttribution:'direct',affiliateDynamic:'off',affiliateExtraRate:'0',advanceTier:'other',advanceShare:'90'} };
function result(context:ShopeeContext, price='50.00', quantity=1) {
 const date='2026-11-23';
 return calculatePricing(sale({unitPrice:price,quantity,date,sellerDiscount:'0',selections:shopeeSelections(context),facts:shopeeFacts(context),acceptedAssumptions:{validity:true,rounding:true,precedence:true}}),createShopeeCatalog(context,price,'0',date));
}
describe('Programas Shopee auditados',()=>{
 it('aplica o teto de Ads e separa taxas de comissão de afiliado',()=>{
   expect(automaticProgramRates({adsRate:'5.01'}).ads).toBeUndefined();
   expect(automaticProgramRates({adsRate:'5'}).ads).toBe('5');
   expect(automaticProgramRates({affiliateRate:'4',affiliateAttribution:'indirect',affiliateDynamic:'off',affiliateExtraRate:'0'}).affiliate).toBe('1.2');
   expect(automaticProgramRates({affiliateRate:'5',affiliateAttribution:'direct',affiliateDynamic:'off',affiliateExtraRate:'14'}).affiliate).toBe('5.7');
   expect(automaticProgramRates({affiliateAttribution:'none'}).affiliate).toBe('0');
   expect(automaticProgramRates({affiliateRate:'4',affiliateAttribution:'direct',affiliateDynamic:'high',affiliateExtraRate:'0'}).affiliate).toBe('6');
   expect(automaticProgramRates({affiliateRate:'4',affiliateAttribution:'direct',affiliateDynamic:'low',affiliateExtraRate:'0'}).affiliate).toBe('2');
 });
 it('ordena Acelera depois de todas as cobranças, sem duplicar créditos',()=>{
   const r=result(ctx);
   const amounts=Object.fromEntries(r.fees.map(f=>[f.rule.id,f.amount]));
   expect(amounts).toMatchObject({'shopee:commission':'10.00','shopee:fixed':'4.50','shopee:adsEasy':'0.75','shopee:affiliates':'2.50','shopee:cashAdvance':'1.02'});
   expect(r.fees.find(f=>f.rule.id==='shopee:cashAdvance')?.assessments[0]?.base).toBe('32.25');
   expect(r.status).toBe('complete');
 });
 it('calcula proporções e arredondamento em pedidos de várias unidades',()=>{
   const r=result(ctx,'50.00',2);
   expect(r.fees.find(f=>f.rule.id==='shopee:cashAdvance')?.amount).toBe('2.03');
   expect(r.fees.find(f=>f.rule.id==='shopee:adsEasy')?.amount).toBe('1.50');
 });
 it('não cobra programas explicitamente inativos nem inventa encargo fiscal',()=>{
   const r=result({...ctx,adsEasy:'inactive',affiliates:'inactive',cashAdvance:'inactive'});
   expect(r.knownMarketplaceFees).toBe('14.50');
   expect(automaticProgramRates({affiliateRate:'4',affiliateAttribution:'direct',affiliateDynamic:'off'}).affiliate).toBeUndefined();
 });
 it('combina percentuais, categorias, atribuição e dinâmica sem exceções',()=>{
   let n=0;
   for(const adsRate of ['', '0','1.5','5']) for(const affiliateRate of ['', '1','4','10'])
   for(const affiliateAttribution of ['unknown','none','direct','indirect'] as const)
   for(const affiliateDynamic of ['unknown','off','low','base','high'] as const)
   for(const affiliateExtraRate of ['', '0','14']) for(const advanceTier of ['unknown','official','indicated','other'] as const)
   for(const advanceShare of ['', '0','90','100']) {
     const rates=automaticProgramRates({adsRate,affiliateRate,affiliateAttribution,affiliateDynamic,affiliateExtraRate,advanceTier,advanceShare});
     for(const rate of Object.values(rates)) if(rate!==undefined) expect(Number(rate)).toBeGreaterThanOrEqual(0);
     n++;
   }
   expect(n).toBe(15360);
   console.info('MATRIZ PARAMETROS PROGRAMAS: '+n+' casos');
 });
 it('apresenta referência também em preço informado, mantendo declarações e campos vazios',()=>{
   const d=newCalculationDraft(new Date(2026,10,23));
   Object.assign(d.fields,{seller:'CNPJ',marketplace:'shopee',price:'50',quantity:'1',grams:'60',filament:'100',calculation:'direct',ads:'active',affiliates:'active',advance:'active',returns:'inactive',highlight:'inactive'});
   Object.assign(d.ux!,{entry:'manual',intent:'sale',filament:{mode:'kg',amount:'',netGrams:''},machineIncluded:false,packagingDecision:'exclude',shipping:'no'});
   const before=structuredClone(d);
   expect(guidedIssues(d)).toEqual([]);
   const out=calculateExperience(d);
   if(out.kind!=='sale') throw new Error('missing sale');
   expect(out.referencePreview?.profitRange).toBeDefined();
   expect(out.referencePreview?.example?.fees.map(f=>f.rule.id)).toEqual(expect.arrayContaining(['shopee:adsEasy','shopee:affiliates','shopee:cashAdvance']));
   expect(out.data.result.operatingProfit).toBeNull();
   expect(d).toEqual(before);
   d.ux!.programPricing={adsRate:'6'};
   expect(guidedIssues(d).some(i=>i.field==='adsRate')).toBe(true);
 });
});
