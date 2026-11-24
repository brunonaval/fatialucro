import { withExperience } from './experience';
import type { CalculatorDraft } from './model';
import { text } from './model';
import { D } from '../engine/decimal';
import type { ExperienceOutput } from './experience';

export function beginQuick(draft:CalculatorDraft, source:'manual'|'printing',goal:'sale'|'profit'|'cost'='sale'):CalculatorDraft {
  const d=withExperience(draft);
  return {...d, fields:{...d.fields, calculation:goal==='profit'?'profit':'direct',quantity:goal==='cost'?text(d,'quantity'):text(d,'quantity')||'1'},ux:{...d.ux,entry:'manual',intent:goal==='cost'?'cost':'sale',stage:'print',manualProduction:{enabled:source==='manual',amount:d.ux.manualProduction?.amount??''}}};
}
export function quickSaleProjection(output:ExperienceOutput | undefined, orders:number) {
  if (!output || output.kind==='cost') return null;
  const validOrders=Number.isSafeInteger(orders)&&orders>=1&&orders<=1000000;
  const result = output.kind==='sale' && output.data.result.operatingProfit!==null ? output.data.result : output.referencePreview?.example;
  if (!result || result.operatingProfit===null) return null;
  const price=output.kind==='sale' && output.data.result.operatingProfit!==null ? output.data.input.unitPrice : output.referencePreview?.exampleUnitPrice;
  if(!price) return null;
  const qty=output.data.input.quantity;
  const profit=new D(result.operatingProfit);
  return {price, quantity:qty, result, provisional:result.confidence!=='documented'||output.kind==='blocked-search'||output.data.result.operatingProfit===null, perUnit:profit.div(qty).toFixed(2),projection:validOrders?profit.mul(orders).toFixed(2):null,profit100:profit.mul(100).toFixed(2),profit500:profit.mul(500).toFixed(2),range:output.referencePreview?.profitRange};
}
