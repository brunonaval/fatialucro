import { calculateManufacturing, calculatePackaging } from '../engine';
import { D } from '../engine/decimal';
import { buildCostSnapshot, withExperience } from './experience';
import { packagingInput, text } from './model';
import type { CalculatorDraft } from './model';

export interface PreviewLine { id: 'material' | 'machine' | 'labor' | 'extras' | 'packaging' | 'manual-production'; name: string; selected: boolean; amount: string | null; issue: string | null }
export interface CostPreview { lines: PreviewLine[]; known: string; total: string | null; perPiece: string | null; quantity: number | null }
/** Each independent component is calculated by the existing engine with other components explicitly excluded. Never a financial formula in React. */
export function calculateCostPreview(value: CalculatorDraft): CostPreview {
  const draft = withExperience(value); const ux = draft.ux;
  if (ux.manualProduction?.enabled) {
    const lines: PreviewLine[] = [];
    try { const snapshot = buildCostSnapshot({ ...draft, ux: { ...ux, packagingIncluded: false } }); lines.push({ id:'manual-production', name:'Produção informada', selected:true, amount:calculateManufacturing(snapshot.manufacturing,1).total, issue:null }); } catch { lines.push({ id:'manual-production', name:'Produção informada', selected:true, amount:null, issue:'Informe o custo por peça física.' }); }
    if (ux.packagingIncluded) { try { lines.push({ id:'packaging', name:'Embalagem', selected:true, amount:calculatePackaging({ ...packagingInput(draft), quantity:1 }), issue:null }); } catch { lines.push({ id:'packaging', name:'Embalagem', selected:true, amount:null, issue:'Confira o custo de embalagem.' }); } }
    const known = lines.reduce((sum,line)=>sum.plus(line.amount ?? '0'),new D(0)).toFixed(2);
    const total = lines.some(line=>line.issue) ? null : known;
    return { lines, known, total, perPiece:total, quantity:1 };
  }
  const definitions: { id: PreviewLine['id']; name: string; selected: boolean }[] = [
    { id: 'material', name: 'Material', selected: ux.materialIncluded !== false },
    { id: 'machine', name: 'Máquina/energia', selected: ux.machineIncluded },
    { id: 'labor', name: 'Mão de obra', selected: ux.labor !== 'excluded' },
    { id: 'extras', name: 'Consumíveis e reserva', selected: ux.extrasIncluded },
    { id: 'packaging', name: 'Embalagem', selected: ux.packagingIncluded },
  ];
  const rawQuantity = draft.fields.basis === 'batch' ? text(draft, 'pieces') : '1';
  const quantity = /^\d+$/.test(rawQuantity) && Number(rawQuantity) >= 1 && Number(rawQuantity) <= 10000 ? Number(rawQuantity) : null;
  const lines = definitions.map(({ id, name, selected }): PreviewLine => {
    if (!selected) return { id, name, selected, amount: null, issue: null };
    try {
      if (quantity === null) throw new Error('Informe quantas peças saem da impressão.');
      if (id === 'packaging') return { id, name, selected, amount: calculatePackaging({ ...packagingInput(draft), quantity }), issue: null };
      const isolated: CalculatorDraft = { ...draft, ux: { ...ux, intent: 'cost', materialIncluded: id === 'material', machineIncluded: id === 'machine', labor: id === 'labor' ? ux.labor : 'excluded', extrasIncluded: id === 'extras', packagingIncluded: false } };
      const input = buildCostSnapshot(isolated); const result = calculateManufacturing(input.manufacturing, quantity);
      return { id, name, selected, amount: result.total, issue: null };
    } catch (error) { return { id, name, selected, amount: null, issue: error instanceof Error ? error.message : `Falta informar ${name.toLowerCase()}.` }; }
  });
  const known = lines.reduce((sum, line) => sum.plus(line.amount ?? '0'), new D(0)).toFixed(2);
  const total = quantity === null || lines.some(line => line.issue) ? null : known;
  return { lines, known, total, quantity, perPiece: total === null ? null : new D(total).div(quantity!).toFixed(2) };
}
