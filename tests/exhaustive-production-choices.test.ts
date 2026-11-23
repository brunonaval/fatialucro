import { describe, expect, it } from 'vitest';
import { calculateExperience, newCalculationDraft } from '../src/app/experience';
import { guidedIssues } from '../src/ui/guided-validation';
import type { CalculatorDraft } from '../src/app/model';

function base(): CalculatorDraft {
  const d = newCalculationDraft(new Date(2026, 10, 23));
  Object.assign(d.fields, { date: '2026-11-23', basis: 'unit', pieces: '4', grams: '60', filament: '100', hours: '2', machine: '0.5', watts: '150', kwh: '1', maintenance: '0.1', depreciation: '0.2', laborMinutes: '10', laborHour: '12', consumables: '0.50', failure: '0.20', packagingUnit: '0.40', packagingOrder: '0.30', quantity: '1', price: '60', minPrice: '60', maxPrice: '60', targetProfit: '1', targetMargin: '0.10', comparison: '30;40;60', seller: 'CPF', marketplace: 'direct', returns: 'inactive', highlight: 'inactive', ads: 'inactive', affiliates: 'inactive', advance: 'inactive', shipping: '0' });
  Object.assign(d.ux!, { entry: 'manual', intent: 'cost', stage: 'result', filament: { mode: 'spool', amount: '100', netGrams: '1000' }, packaging: { mode: 'unit', amount: '4', units: '10' }, packagingDecision: 'exclude', packagingIncluded: false, packagingExtraIncluded: false, shipping: 'no', volume: { answer: 'below', threshold: 450, date: '2026-11-23' } });
  return d;
}

describe('Matriz de fabricação e despesas opcionais', () => {
  it('864 combinações de fabricação, material, energia, trabalho e embalagem', () => {
    let tested = 0; const failures: string[] = [];
    for (const basis of ['unit','batch']) for (const material of ['off','kg','spool']) for (const machine of ['off','all-in','energy','wear'])
    for (const labor of ['excluded','zero','paid'] as const) for (const extras of [false,true])
    for (const pack of ['exclude','unknown','unit','unit-extra','pack','pack-extra']) {
      const d = base(); d.fields.basis = basis;
      Object.assign(d.ux!, { materialIncluded: material !== 'off', machineIncluded: machine !== 'off', wearIncluded: machine === 'wear', labor, extrasIncluded: extras, packagingDecision: ['exclude','unknown'].includes(pack) ? pack : 'include', packagingIncluded: !['exclude','unknown'].includes(pack), packagingExtraIncluded: pack.endsWith('-extra') });
      d.ux!.filament.mode = material === 'kg' ? 'kg' : 'spool';
      d.fields.machineMode = ['energy','wear'].includes(machine) ? 'detailed' : 'all-in';
      d.ux!.packaging.mode = pack.startsWith('pack') ? 'pack' : 'unit';
      if (material === 'off') { d.fields.grams = ''; d.fields.filament = ''; d.ux!.filament.amount = ''; d.ux!.filament.netGrams = ''; }
      if (machine === 'off') for (const f of ['hours','machine','watts','kwh','maintenance','depreciation']) d.fields[f] = '';
      if (machine === 'energy') { d.fields.maintenance = ''; d.fields.depreciation = ''; }
      if (labor !== 'paid') { d.fields.laborMinutes = ''; d.fields.laborHour = ''; }
      if (!extras) { d.fields.consumables = ''; d.fields.failure = ''; }
      if (!d.ux!.packagingIncluded) { d.fields.packagingUnit = ''; d.ux!.packaging.amount = ''; d.ux!.packaging.units = ''; }
      if (!d.ux!.packagingExtraIncluded) d.fields.packagingOrder = '';
      tested++;
      try {
        const issues = guidedIssues(d);
        if (issues.length) throw new Error(issues.map(i => i.field).join(','));
        const out = calculateExperience(d);
        if (out.kind !== 'cost' || !Number.isFinite(Number(out.cost.total))) throw new Error('custo ausente');
      } catch (e) { failures.push([basis,material,machine,labor,extras,pack].join('/') + ': ' + String(e)); }
    }
    console.info('MATRIZ PRODUCAO: ' + tested + ' casos, ' + failures.length + ' falhas');
    expect(tested).toBe(864);
    expect(failures, failures.slice(0,10).join('\n')).toEqual([]);
  });
  it('240 combinações de venda: objetivos, unidade/kit, descontos, outras despesas e publicidade', () => {
    let tested = 0; const failures: string[] = [];
    for (const channel of ['direct','shopee']) for (const unit of ['piece','kit'] as const) for (const mode of ['direct','compare','profit','margin','equilibrium'])
    for (const discount of [false,true]) for (const other of [false,true]) for (const ads of [false,true])
    for (const ship of channel === 'direct' ? [false,true] : [false]) {
      const d = base(); d.ux!.intent = 'sale'; d.ux!.saleUnit = unit; d.ux!.partsPerKit = unit === 'kit' ? '2' : '';
      Object.assign(d.fields, { marketplace: channel, calculation: mode, discount: discount ? '1.00' : '', other: other ? '0.50' : '', advertising: ads ? '0.25' : '', advertisingEnabled: ads, shipping: channel === 'shopee' ? '0' : ship ? '2.00' : '' });
      Object.assign(d.ux!, { discountIncluded: discount, otherCostsIncluded: other, directShippingIncluded: ship });
      tested++;
      try {
        const issues = guidedIssues(d);
        if (issues.length) throw new Error(issues.map(i => i.field).join(','));
        const out = calculateExperience(d);
        if (out.kind === 'cost') throw new Error('venda ausente');
        if (mode === 'compare' && out.data.comparison.length !== 3) throw new Error('comparação ausente');
        if (['profit','margin','equilibrium'].includes(mode) && out.data.solution?.status !== 'found' && !out.referencePreview) throw new Error('referência de preço ausente');
      } catch (e) { failures.push([channel,unit,mode,discount,other,ads,ship].join('/') + ': ' + String(e)); }
    }
    console.info('MATRIZ DESPESAS: ' + tested + ' casos, ' + failures.length + ' falhas');
    expect(tested).toBe(240);
    expect(failures, failures.slice(0,10).join('\n')).toEqual([]);
  });
  it('indica cada campo obrigatório selecionado, sem exigir os campos de opções desligadas', () => {
    const tests: {field:string; setup:(d:CalculatorDraft)=>void}[] = [
      { field:'pieces', setup:d=>{d.fields.basis='batch'; d.fields.pieces='';} },
      { field:'grams', setup:d=>{d.fields.grams='';} },
      { field:'spool-price', setup:d=>{d.ux!.filament.amount='';} },
      { field:'spool-weight', setup:d=>{d.ux!.filament.netGrams='';} },
      { field:'filament', setup:d=>{d.ux!.filament.mode='kg';d.fields.filament='';} },
      { field:'hours', setup:d=>{d.ux!.machineIncluded=true;d.fields.hours='';} },
      { field:'machine', setup:d=>{d.ux!.machineIncluded=true;d.fields.machine='';} },
      { field:'watts', setup:d=>{d.ux!.machineIncluded=true;d.fields.machineMode='detailed';d.fields.watts='';} },
      { field:'kwh', setup:d=>{d.ux!.machineIncluded=true;d.fields.machineMode='detailed';d.fields.kwh='';} },
      { field:'maintenance', setup:d=>{d.ux!.machineIncluded=true;d.ux!.wearIncluded=true;d.fields.machineMode='detailed';d.fields.maintenance='';} },
      { field:'depreciation', setup:d=>{d.ux!.machineIncluded=true;d.ux!.wearIncluded=true;d.fields.machineMode='detailed';d.fields.depreciation='';} },
      { field:'laborMinutes', setup:d=>{d.ux!.labor='paid';d.fields.laborMinutes='';} },
      { field:'laborHour', setup:d=>{d.ux!.labor='paid';d.fields.laborHour='';} },
      { field:'consumables', setup:d=>{d.ux!.extrasIncluded=true;d.fields.consumables='';} },
      { field:'failure', setup:d=>{d.ux!.extrasIncluded=true;d.fields.failure='';} },
      { field:'packagingUnit', setup:d=>{d.ux!.packagingIncluded=true;d.ux!.packagingDecision='include';d.fields.packagingUnit='';} },
      { field:'package-price', setup:d=>{d.ux!.packagingIncluded=true;d.ux!.packagingDecision='include';d.ux!.packaging.mode='pack';d.ux!.packaging.amount='';} },
      { field:'package-units', setup:d=>{d.ux!.packagingIncluded=true;d.ux!.packagingDecision='include';d.ux!.packaging.mode='pack';d.ux!.packaging.units='';} },
      { field:'packagingOrder', setup:d=>{d.ux!.packagingIncluded=true;d.ux!.packagingDecision='include';d.ux!.packagingExtraIncluded=true;d.fields.packagingOrder='';} },
      { field:'partsPerKit', setup:d=>{d.ux!.intent='sale';d.ux!.saleUnit='kit';d.ux!.partsPerKit='';} },
      { field:'price', setup:d=>{d.ux!.intent='sale';d.fields.calculation='direct';d.fields.price='';} },
      { field:'targetProfit', setup:d=>{d.ux!.intent='sale';d.fields.calculation='profit';d.fields.targetProfit='';} },
      { field:'discount', setup:d=>{d.ux!.intent='sale';d.ux!.discountIncluded=true;d.fields.discount='';} },
      { field:'other', setup:d=>{d.ux!.intent='sale';d.ux!.otherCostsIncluded=true;d.fields.other='';} },
      { field:'advertising', setup:d=>{d.ux!.intent='sale';d.fields.advertisingEnabled=true;d.fields.advertising='';} },
    ];
    for (const {field,setup} of tests) { const d=base();setup(d);expect(guidedIssues(d).map(i=>i.field),field).toContain(field); }
    console.info('MATRIZ CAMPOS OBRIGATORIOS: ' + tests.length + ' verificações');
  });
});
