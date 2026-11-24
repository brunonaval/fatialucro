import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { beginQuick, quickSaleProjection } from '../src/app/quick-simulation';
import { calculateExperience, calculationSignature, newCalculationDraft, withExperience } from '../src/app/experience';
import { validateDraft } from '../src/app/model';
import { calculateCostPreview } from '../src/app/cost-preview';
import { guidedIssues } from '../src/ui/guided-validation';
import { FormContext } from '../src/ui/Fields';
import { ExperienceContext } from '../src/ui/ExperienceContext';
import { QuickSimulation } from '../src/ui/QuickSimulation';
import { App } from '../src/ui/App';
import { bundledTables } from '../src/marketplaces/catalogs/bundled';
import { recordsForResult, frozenResult } from '../src/app/records';
import { LocalRepository } from '../src/app/storage';
import { IDBFactory } from 'fake-indexeddb';

function ready() {
 const d=withExperience(beginQuick(newCalculationDraft(new Date(2026,10,23)),'manual'));
 Object.assign(d.fields,{productName:'Peça de teste',price:'21.00',quantity:'1',marketplace:'direct'});
 d.ux.manualProduction={enabled:true,amount:'3.00'};
 d.ux.packagingDecision='exclude';d.ux.packagingIncluded=false;
 return d;
}
describe('Simulação rápida e detalhada: um único rascunho e motor',()=>{
 it('inicia com custo informado, sem exigir peso, máquina ou bobina',()=>{
   const d=ready(); validateDraft(d);expect(guidedIssues(d)).toEqual([]);
   expect(calculateCostPreview(d)).toMatchObject({total:'3.00',perPiece:'3.00'});
   const r=calculateExperience(d); if(r.kind!=='sale')throw Error('missing sale');
   expect(r.data.result.operatingProfit).toBe('18.00');
   expect(r.data.result.manufacturing.lines[0]?.id).toBe('manual-production');
   expect(quickSaleProjection(r,100)?.projection).toBe('1800.00');
   expect(quickSaleProjection(r,0)?.projection).toBeNull();
   expect(quickSaleProjection(r,0)?.perUnit).toBe('18.00');
 });
 it('troca apresentação sem modificar rascunho nem cálculo',()=>{
   const d=ready(),sig=calculationSignature(d);
   const other={...d,ux:{...d.ux,mode:'advanced' as const,stage:'result' as const}};
   expect(calculationSignature(other)).toBe(sig);
   const a=calculateExperience(d),b=calculateExperience(other);
   if(a.kind!=='sale'||b.kind!=='sale')throw Error('missing sale');
   expect(a.data.result).toEqual(b.data.result);
   expect(a.data.input).toEqual(b.data.input);
 });
 it('custo por peça respeita kits, unidades do pedido e embalagem',()=>{
   const d=ready();d.fields.quantity='2';d.ux.saleUnit='kit';d.ux.partsPerKit='3';
   d.ux.packagingDecision='include';d.ux.packagingIncluded=true;d.ux.packagingExtraIncluded=false;d.fields.packagingUnit='0.50';
   const r=calculateExperience(d);if(r.kind!=='sale')throw Error('missing sale');
   expect(r.data.result.manufacturing.total).toBe('18.00');
   expect(r.data.result.packaging).toBe('1.00');
   expect(r.data.result.operatingProfit).toBe('23.00');
   expect(quickSaleProjection(r,100)?.perUnit).toBe('11.50');
   expect(quickSaleProjection(r,100)?.projection).toBe('2300.00');
 });
 it('publicidade em percentual acompanha qualquer preço e a busca de meta',()=>{
   const d=ready();d.fields.advertisingEnabled=true;d.ux.advertisingPercent='10';
   let r=calculateExperience(d);if(r.kind!=='sale')throw Error('missing sale');
   expect(r.data.result.otherOperatingCosts).toBe('2.10');
   expect(r.data.result.operatingProfit).toBe('15.90');
   d.fields.price='30';r=calculateExperience(d);if(r.kind!=='sale')throw Error('missing sale');
   expect(r.data.result.otherOperatingCosts).toBe('3.00');
   d.fields.calculation='profit';d.fields.targetProfit='6';d.fields.minPrice='9';d.fields.maxPrice='20';
   r=calculateExperience(d);if(r.kind!=='sale')throw Error('missing search result');
   expect(r.data.input.unitPrice).toBe('10.00');expect(r.data.expenses.advertising).toBe('1.00');expect(r.data.result.operatingProfit).toBe('6.00');
 });
 it('custo manual desligado preserva dados anteriores e volta a exigir dados necessários',()=>{
   const d=ready();d.fields.grams='50';d.ux.filament={mode:'kg',amount:'',netGrams:''};d.fields.filament='100';
   d.ux.manualProduction!.enabled=false;expect(guidedIssues(d)).toEqual([]);
   expect(calculateCostPreview(d).perPiece).toBe('5.00');
   d.ux.manualProduction!.enabled=true;expect(calculateCostPreview(d).perPiece).toBe('3.00');
   d.ux.manualProduction!.amount='';expect(guidedIssues(d).map(i=>i.field)).toContain('manualProductionCost');
 });
 it('Shopee com respostas desconhecidas usa a mesma referência, sem declarar lucro confirmado',()=>{
   const d=ready();d.fields.marketplace='shopee';d.fields.seller='CPF';d.fields.price='35';
   const r=calculateExperience(d);if(r.kind!=='sale')throw Error('missing sale');
   expect(r.data.result.operatingProfit).toBeNull();
   expect(quickSaleProjection(r,100)?.provisional).toBe(true);
   expect(r.referencePreview?.profitRange).toBeDefined();
 });
 it('renderiza abas e resultado rápido com preço, projeções e dados reais do motor',()=>{
   const html=renderToStaticMarkup(<App/>);expect(html).toContain('Simulação rápida');expect(html).toContain('Simulação completa detalhada');
   const d=ready();const result=calculateExperience(d);
   const quick=renderToStaticMarkup(<FormContext value={{draft:d,setField:()=>{}}}><ExperienceContext value={{draft:d,update:()=>{}}}><QuickSimulation entries={[]} tables={bundledTables} state={{signature:'test',phase:'ready',output:result,preview:calculateCostPreview(d)}} issues={[]} onFix={()=>{}} onProfile={()=>{}} onSaveFilament={async()=>{}} onSaveShop={()=>{}} onSave={()=>{}} onDetailed={()=>{}} onResolve={()=>{}} onRetry={()=>{}} saved={false}/></ExperienceContext></FormContext>);
   expect(quick).toContain('Resultado ao vivo');expect(quick).toContain('Ajustar preço de venda');expect(quick).toContain('R$ 18,00');expect(quick).toContain('Lucro em 100 pedidos iguais');
 });
 it('salva e recupera o mesmo resultado com custo manual e publicidade percentual',async()=>{
   const d=ready();d.fields.advertisingEnabled=true;d.ux.advertisingPercent='10';
   const result=calculateExperience(d);
   const repo=new LocalRepository(new IDBFactory());let i=0;
   try{const records=recordsForResult(d,result,[],{},'2026-11-23T12:00:00Z',()=>String(++i));await repo.saveMany(records);
   const saved=(await repo.list()).find(e=>e.kind==='simulation')!;const output=frozenResult(saved);if(output?.kind!=='sale'||result.kind!=='sale')throw Error('missing snapshot');expect(output.data.result).toEqual(result.data.result);}
   finally{await repo.close();}
 });
});
