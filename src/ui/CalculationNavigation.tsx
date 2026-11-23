import { calculationStages } from '../app/ux-v3';
import type { ExperienceState } from '../app/experience-types';
const labels = { print: 'Impressão', costs: 'Custos', sale: 'Venda', result: 'Resultado' };
type Props = { ux: ExperienceState; onStage: (stage: ExperienceState['stage']) => void };
export function CalculationNavigation({ ux, onStage }: Props) {
  return <nav className="step-nav" aria-label="Etapas do cálculo">{calculationStages(ux).map((stage, index) => <button type="button" key={stage} className="secondary" aria-current={ux.stage === stage ? 'step' : undefined} onClick={() => onStage(stage)}><span aria-hidden="true">{index + 1}</span>{labels[stage]}</button>)}</nav>;
}
export function StageActions({ ux, onStage }: Props) {
  const stages = calculationStages(ux); const index = stages.indexOf(ux.stage);
  return <div className="step-actions">{index > 0 && <button type="button" className="secondary" onClick={() => onStage(stages[index - 1]!)}>← Voltar</button>}{index >= 0 && index < stages.length - 1 ? <button type="button" onClick={() => onStage(stages[index + 1]!)}>{ux.stage === 'print' ? 'Informar custos →' : ux.stage === 'costs' && ux.intent === 'cost' ? 'Ver custo da impressão' : ux.stage === 'costs' ? 'Continuar para venda →' : 'Ver resultado da venda'}</button> : null}</div>;
}
