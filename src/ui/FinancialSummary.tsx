import type { CalculationOutput } from '../app/calculate';
import { currency } from './ResultView';
export function FinancialSummary({ output, stale, busy }: { output: CalculationOutput | null; stale: boolean; busy: boolean }) {
  const result = output?.result;
  return <section className="financial-summary" aria-labelledby="summary-heading" aria-busy={busy}>
    <span className="eyebrow">Seu cenário</span><h2 id="summary-heading">Resumo financeiro</h2>
    <div className="summary-grid"><div><span>Preço por unidade</span><strong>{output ? currency(output.input.unitPrice) : '—'}</strong></div><div><span>Custos do pedido¹</span><strong>{result ? currency(result.operatingCosts) : '—'}</strong></div><div><span>{result?.status === 'partial' ? 'Tarifas calculáveis²' : 'Tarifas do pedido'}</span><strong>{result ? currency(result.knownMarketplaceFees) : '—'}</strong></div></div>
    <div className={`profit-value ${result?.operatingProfit?.startsWith('-') ? 'is-loss' : ''}`}><span>Lucro operacional estimado · pedido</span><strong>{result ? currency(result.operatingProfit) : '—'}</strong></div>
    <p className={`summary-status ${stale ? 'stale' : ''}`} role="status">{busy ? 'Processando as entradas…' : !result ? 'Complete a impressão e calcule seu primeiro cenário.' : stale ? 'Entradas alteradas. Recalcule para atualizar.' : result.status === 'partial' ? 'Há pendências. O subtotal de tarifas ainda não é o custo comercial completo.' : result.confidence === 'provisional' ? 'Provisório · depende das premissas e tarifas identificadas.' : 'Calculado com as entradas e regras do cenário.'}</p>
    {!!result?.pending.length && <details open className="pending-summary"><summary>O que falta confirmar ({result.pending.length})</summary><ul>{result.pending.slice(0, 3).map((item, index) => <li key={`${item.id}-${index}`}>{item.message}</li>)}</ul><a href="#marketplace">Conferir condições do cenário</a>{result.pending.length > 3 && <p>As demais pendências estão no demonstrativo completo.</p>}</details>}
    {output && <p className="muted">Fabricação: {currency(output.result.manufacturing.perUnit)}/un. · produção completa: {currency(output.production.total)}. ¹ Fabricação, embalagem e despesas informadas. Frete debitado do repasse: {currency(output.result.sellerShipping)}. {result?.status === 'partial' && '² Valores indeterminados ainda não somados.'}</p>}
    <p className="summary-footnote">Estimativa antes de custos/tributos não informados. Nenhum repasse é confirmado.</p>
  </section>;
}
