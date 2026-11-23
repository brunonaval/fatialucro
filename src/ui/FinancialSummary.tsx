import { D } from '../engine/decimal';
import type { CalculatorDraft } from '../app/model';
import type { ExperienceOutput } from '../app/experience';
import type { FinancialState } from './useAutomaticCalculation';
import type { CostPreview } from '../app/cost-preview';
import type { Pending } from '../engine';
import { costExclusions, pendingAction } from '../app/ux-v3';
import { currency } from './ResultView';
import { GuidedIssues } from './GuidedIssues';
import type { GuidedIssue } from './guided-validation';

export function PendingQuestions({ pending, onResolve }: { pending: readonly Pending[]; onResolve?: (target: string) => void }) {
  const actions = [...new Map(pending.map(item => { const action = pendingAction(item); return [action.target, action]; })).values()];
  return <div className="pending-actions"><h3>Ainda não podemos determinar seu lucro</h3><p>Faltam informações. Nenhuma cobrança desconhecida foi considerada zero.</p><ul>{pending.slice(0, 3).map((item, index) => <li key={`${item.id}-${index}`}>{item.message}</li>)}</ul>{pending.length > 3 && <p>Mais {pending.length - 3} pendência(s) no cálculo completo.</p>}{onResolve && <div className="record-actions">{actions.map(action => <button type="button" className="secondary" key={action.target} onClick={() => onResolve(action.target)}>{action.label}</button>)}</div>}</div>;
}
export function CostMetrics({ preview }: { preview: CostPreview }) {
  return <><dl className="result-metrics">{preview.lines.filter(line => line.selected || ['machine', 'packaging'].includes(line.id)).map(line => <div className="metric-row" key={line.id}><dt>Custo {line.id === 'material' ? 'do material' : `de ${line.name.toLowerCase()}`}</dt><dd>{!line.selected ? 'Não incluído' : line.amount === null ? 'Falta informar' : currency(line.amount)}</dd></div>)}
    <div className="metric-row"><dt>{preview.total === null ? 'Subtotal dos custos já conhecidos' : 'Total dos custos selecionados'}</dt><dd className="result-total">{currency(preview.total ?? preview.known)}</dd></div>
    <div className="metric-row"><dt>Custo por peça física</dt><dd>{preview.perPiece === null ? 'Falta completar os custos' : currency(preview.perPiece)}</dd></div></dl>
    {preview.lines.some(line => line.issue) && <ul className="input-pending">{preview.lines.filter(line => line.issue).map(line => <li key={line.id}>{line.name}: {line.issue}</li>)}</ul>}
    <p className="muted">{preview.quantity ?? 'Quantidade ainda não informada'} peça(s) físicas nesta impressão. Embalagem, se selecionada aqui, usa uma por peça; a venda usa a quantidade comercial do pedido.</p></>;
}
export function FinancialMetrics({ output, advanced = false }: { output: ExperienceOutput; advanced?: boolean }) {
  if (output.kind !== 'sale') return null;
  const { input, result } = output.data; const complete = result.status === 'complete';
  const ratio = (value: string | null) => value === null ? 'Pendente' : `${new D(value).mul(100).toFixed(2).replace('.', ',')}%`;
  return <><div className="headline-price"><span>{output.data.solution?.status === 'found' ? 'Preço mínimo calculado por ' : 'Preço de venda por '}{input.manufacturing.partsPerUnit && input.manufacturing.partsPerUnit > 1 ? 'kit' : 'unidade'}</span><strong>{currency(input.unitPrice)}</strong><small>{input.quantity} unidade(s) comerciais no pedido</small></div>
    {output.data.searchRange?.automaticFloor && <p className="field-hint">Busca limitada a preços a partir de {currency(output.data.searchRange.automaticFloor)}. Valores menores não foram avaliados por falta da fórmula regressiva CPF.</p>}
    <dl className="result-metrics">
      <div className="metric-row"><dt>Total da venda</dt><dd>{currency(result.grossSales)}</dd></div>
      <div className="metric-row"><dt>{complete ? output.data.catalog.marketplace === 'direct' ? 'Taxas de marketplace' : 'Descontos da Shopee — tarifas' : 'Subtotal de tarifas conhecidas — incompleto'}</dt><dd>{currency(result.knownMarketplaceFees)}</dd></div>
      <div className="metric-row"><dt>Desconto pago por você</dt><dd>{currency(result.sellerDiscount)}</dd></div>
      <div className="metric-row"><dt>Frete líquido debitado</dt><dd>{currency(result.sellerShipping)}</dd></div>
      <div className="metric-row"><dt>{output.data.catalog.marketplace === 'direct' ? 'Recebimento estimado' : 'Repasse estimado do marketplace'}</dt><dd>{complete ? currency(result.marketplaceNet) : 'Pendente — não é valor a receber'}</dd></div>
      <div className="metric-row"><dt>Custo de fabricar e embalar as unidades vendidas</dt><dd>{currency(new D(result.manufacturing.total).plus(result.packaging).toFixed(2))}</dd></div>
      <div className="metric-row"><dt>Outras despesas informadas</dt><dd>{currency(result.otherOperatingCosts)}</dd></div>
      <div className="metric-row"><dt>Lucro operacional estimado do pedido</dt><dd className={`result-total ${result.operatingProfit?.startsWith('-') ? 'loss' : ''}`}>{complete ? `${result.operatingProfit?.startsWith('-') ? 'Prejuízo: ' : ''}${currency(result.operatingProfit)}` : 'Ainda não determinado'}</dd></div>
      <div className="metric-row"><dt>Lucro por unidade comercial</dt><dd>{result.operatingProfit === null ? 'Pendente' : currency(new D(result.operatingProfit).div(input.quantity).toFixed(2))}</dd></div>
      <div className="metric-row"><dt>Margem sobre a venda</dt><dd>{ratio(result.margin)}</dd></div>
      {advanced && <div className="metric-row"><dt>Markup sobre os custos</dt><dd>{ratio(result.markup)}</dd></div>}
    </dl></>;
}
export function FinancialSummary({ draft, state, onResolve, issues = [], onFix, onRetry }: { draft: CalculatorDraft; state: FinancialState; onResolve?: (target: string) => void; issues?: readonly GuidedIssue[]; onFix?: (issue: GuidedIssue) => void; onRetry?: () => void }) {
  const output = state.phase === 'ready' ? state.output : undefined;
  const sale = output?.kind === 'sale' ? output : null; const partial = sale?.data.result.status === 'partial';
  const status = sale ? partial ? 'Parcial' : sale.data.result.confidence === 'provisional' ? 'Simulação provisória' : 'Completo' : output?.kind === 'blocked-search' ? 'Busca não concluída' : 'Custos selecionados';
  const exclusions = costExclusions(draft);
  return <aside className="summary-column" aria-label="Meu resumo" tabIndex={0}><section className="financial-summary" aria-busy={state.phase === 'processing'}><h2>Meu resumo</h2>
    <p role="status" className="summary-status">{state.phase === 'waiting' || state.phase === 'processing' ? 'Atualizando os dados informados…' : state.phase === 'invalid' ? state.errorKind === 'technical' ? 'Falha ao processar. Seus dados foram preservados.' : issues.length ? 'Confira os campos indicados abaixo.' : state.error : status}</p>
    {sale ? <><span className={`status-badge ${partial ? 'warning' : ''}`}>{status}</span><FinancialMetrics output={sale} advanced={draft.ux?.mode === 'advanced'} />{partial && <PendingQuestions pending={sale.data.result.pending} {...(onResolve ? { onResolve } : {})} />}</> : state.preview ? <CostMetrics preview={state.preview} /> : <p>Informe sua impressão e os custos escolhidos. Valores antigos ficam ocultos durante a edição.</p>}
    {output?.kind === 'blocked-search' && output.referencePreview && <div className="reference-summary"><strong>Preço orientativo da Shopee</strong><p>{output.referencePreview.lower === output.referencePreview.upper ? currency(output.referencePreview.lower) : `${currency(output.referencePreview.lower)} a ${currency(output.referencePreview.upper)}`}</p><small>Estimativa com premissas ainda não verificadas; não é lucro confirmado.</small></div>}
    {state.phase === 'invalid' && state.errorKind === 'technical' && <div className="technical-recovery" role="alert"><strong>Não foi possível executar o cálculo no dispositivo.</strong><p>Os campos continuam salvos no formulário. Tente novamente; se persistir, confira a instalação.</p>{onRetry && <button type="button" className="secondary" onClick={onRetry}>Tentar calcular novamente</button>}<details><summary>Detalhes do processamento</summary><p>{state.error}</p></details></div>}
    {state.phase === 'invalid' && state.errorKind !== 'technical' && <GuidedIssues issues={issues} {...(onFix ? { onFix } : {})} />}
    <details><summary>O que não foi considerado?</summary>{exclusions.length ? <ul>{exclusions.map(item => <li key={item}>{item}</li>)}</ul> : <p>Os custos selecionados estão incluídos; despesas e tributos não informados não são estimados.</p>}{draft.ux?.labor === 'zero' && <p>Mão de obra definida conscientemente como R$ 0,00.</p>}</details>
    <p className="summary-footnote">Estimativa dos custos selecionados. Nenhum repasse está confirmado.</p>
  </section></aside>;
}
