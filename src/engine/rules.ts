import { cash, D, date, decimal, money } from './decimal';
import type { Dec } from './decimal';
import type { FeeAssessment, FeeLine, FeeRule, Formula, Pending, SaleInput, SimpleFormula, TariffCatalog } from './types';

function validateFormula(formula: Formula): void {
  if (formula.kind === 'fixed') money(formula.amount, 'tarifa fixa');
  else if (formula.kind === 'percentage') {
    if (decimal(formula.rate).gt(100)) throw new Error('Percentual de taxa superior a 100%.');
    if (formula.cap !== undefined) money(formula.cap, 'teto');
  } else {
    if (!formula.bands.length) throw new Error('Faixas vazias.');
    let previous: string | null = '0';
    for (const band of formula.bands) {
      const from = money(band.from);
      if (previous === null || from.lt(previous) || (band.to !== null && money(band.to).lte(from))) {
        throw new Error('Faixas fora de ordem ou sobrepostas.');
      }
      previous = band.to;
      validateFormula(band.formula);
    }
  }
}

export function validateCatalog(catalog: TariffCatalog): void {
  date(catalog.simulationFrom);
  date(catalog.simulationUntil);
  if (catalog.simulationUntil < catalog.simulationFrom) throw new Error('Janela do catálogo invertida.');
  const versions = new Set<string>();
  for (const rule of catalog.rules) {
    const key = `${rule.id}@${rule.version}`;
    if (versions.has(key)) throw new Error(`Regra duplicada: ${key}.`);
    versions.add(key);
    if (!rule.id || !rule.version || !rule.evidence.reference) throw new Error('Regra sem identidade ou fonte.');
    if (rule.includes.includes(rule.id)) throw new Error('Regra não pode incluir a si mesma.');
    if (rule.effectiveFrom !== null) date(rule.effectiveFrom);
    if (rule.effectiveUntil !== null) date(rule.effectiveUntil);
    if (rule.effectiveFrom !== null && rule.effectiveUntil !== null && rule.effectiveUntil < rule.effectiveFrom) {
      throw new Error('Vigência invertida.');
    }
    if (rule.evidence.capturedAt !== null) date(rule.evidence.capturedAt);
    if (rule.formula !== null) validateFormula(rule.formula);
  }
}

function resolveFormula(formula: Formula, unitPrice: Dec): SimpleFormula | undefined {
  if (formula.kind !== 'tiered') return formula;
  return formula.bands.find(band => unitPrice.gte(band.from) && (band.to === null || unitPrice.lt(band.to)))?.formula;
}

function assess(rule: FeeRule, formula: SimpleFormula, gross: Dec, net: Dec, count: number): FeeLine {
  const base = rule.base === 'gross-sales' ? gross : net;
  let groups: { base: Dec; count: number }[];
  if (rule.scope === 'order') groups = [{ base, count: 1 }];
  else {
    // Distribute indivisible discount cents exactly across otherwise identical units.
    const cents = base.mul(100);
    const low = cents.div(count).floor();
    const highCount = cents.mod(count).toNumber(); // Bounded integer count, never money.
    groups = [{ base: low.div(100), count: count - highCount }, { base: low.plus(1).div(100), count: highCount }];
  }
  const assessments: FeeAssessment[] = groups.filter(group => group.count > 0).map(group => {
    let raw = formula.kind === 'fixed' ? new D(formula.amount) : group.base.mul(formula.rate).div(100);
    if (formula.kind === 'percentage' && formula.cap !== undefined) raw = D.min(raw, formula.cap);
    const rounded = cash(raw);
    return { base: cash(group.base), count: group.count, rawAmount: raw.toFixed(), roundedPerOccurrence: rounded, total: cash(new D(rounded).mul(group.count)) };
  });
  return { rule, resolvedFormula: formula, assessments, amount: cash(assessments.reduce((sum, entry) => sum.plus(entry.total), new D(0))) };
}

export function calculateFees(input: SaleInput, catalog: TariffCatalog, gross: Dec, net: Dec) {
  validateCatalog(catalog);
  const pending: Pending[] = [...catalog.pending];
  const excluded: { id: string; reason: string }[] = [];
  const fees: FeeLine[] = [];
  if (input.purpose !== catalog.purpose) {
    pending.push({ id: 'catalog-purpose', message: 'Catálogo histórico e simulação atual não podem ser intercambiados.' });
    return { fees, pending, excluded };
  }
  if (input.date < catalog.simulationFrom || input.date > catalog.simulationUntil) {
    pending.push({ id: 'catalog-date', message: 'A data está fora da janela documental deste catálogo. Atualize as evidências; nenhuma tarifa foi extrapolada.' });
    return { fees, pending, excluded };
  }
  const groups = Map.groupBy(catalog.rules, rule => rule.id);
  const candidates: FeeRule[] = [];
  for (const [id, versions] of groups) {
    if (input.selections[id] === false && versions.every(rule => rule.requirement === 'optional')) {
      excluded.push({ id, reason: 'Participação explicitamente desativada.' });
      continue;
    }
    const active = versions.filter(rule => (rule.effectiveFrom === null || input.date >= rule.effectiveFrom) &&
      (rule.effectiveUntil === null || input.date <= rule.effectiveUntil));
    if (active.length > 1) throw new Error(`Vigências sobrepostas para ${id}.`);
    const rule = active[0];
    if (!rule) {
      pending.push({ id, message: `Sem versão vigente para ${id} na data informada.` });
      continue;
    }
    if (rule.requirement !== 'optional' && input.selections[id] === false) throw new Error(`A cobrança ${id} não pode ser desativada manualmente.`);
    if (rule.requirement === 'optional') {
      if (input.selections[id] === false) { excluded.push({ id, reason: 'Participação explicitamente desativada.' }); continue; }
      if (input.selections[id] !== true) { pending.push({ id, message: `Confirme a participação em ${rule.name}.` }); continue; }
    }
    const conditions = rule.conditions.map(condition => input.facts[condition.key] === undefined ? undefined : input.facts[condition.key] === condition.equals);
    if (conditions.includes(false)) { excluded.push({ id, reason: 'Condição de incidência não atendida.' }); continue; }
    if (conditions.includes(undefined)) { pending.push({ id, message: `Condição não informada para ${rule.name}.` }); continue; }
    candidates.push(rule);
  }
  // Explicit containment, never guessed from fee names or percentages.
  const included = new Set(candidates.flatMap(rule => rule.includes));
  for (const rule of candidates) {
    if (included.has(rule.id)) {
      if (rule.includes.length) throw new Error('Hierarquia de inclusão ambígua ou cíclica.');
      excluded.push({ id: rule.id, reason: 'Componente já incluído em outra cobrança ativa.' });
      continue;
    }
    if (candidates.filter(parent => parent.includes.some(id => rule.includes.includes(id))).length > 1) {
      throw new Error('Duas cobranças incluem o mesmo componente.');
    }
    if (rule.formula === null || rule.evidence.verification === 'undetermined') {
      pending.push({ id: rule.id, message: `Fórmula não determinada: ${rule.name}.` }); continue;
    }
    const formula = resolveFormula(rule.formula, new D(input.unitPrice));
    if (!formula) { pending.push({ id: rule.id, message: `Faixa de preço não documentada: ${rule.name}.` }); continue; }
    if (rule.effectiveFrom === null) pending.push({ id: `${rule.id}:effective-date`, message: `${rule.name}: documento conhecido, início de vigência não comprovado.` });
    fees.push(assess(rule, formula, gross, net, input.quantity));
  }
  return { fees, pending, excluded };
}
