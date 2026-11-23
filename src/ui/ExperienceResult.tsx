import { financialAlerts } from '../engine';
import type { ExperienceOutput } from '../app/experience';
import { text } from '../app/model';
import type { FinancialState } from './useAutomaticCalculation';
import { calculateCostPreview } from '../app/cost-preview';
import { costExclusions } from '../app/ux-v3';
import { currency, ResultView } from './ResultView';
import { Input } from './Fields';
import { useExperience } from './ExperienceContext';
import { CostMetrics, FinancialMetrics, PendingQuestions } from './FinancialSummary';
import { tariffHints } from '../app/tariff-hints';
import { GuidedIssues } from './GuidedIssues';
import type { GuidedIssue } from './guided-validation';
import type { ShopeeTable } from '../marketplaces/catalogs/types';

export function ExperienceResult({ state, frozen, onConfirm, onResolve, onSell, onSave, onAdjustPrice, saved = false, tables = [], issues = [], onFix, onRetry }: { state?: FinancialState; frozen?: ExperienceOutput; onConfirm?: () => void; onResolve?: (target: string) => void; onSell?: () => void; onSave?: () => void; onAdjustPrice?: (price: string) => void; saved?: boolean; tables?: readonly ShopeeTable[]; issues?: readonly GuidedIssue[]; onFix?: (issue: GuidedIssue) => void; onRetry?: () => void }) {
  const { draft, ux } = useExperience(); const output = frozen ?? (state?.phase === 'ready' ? state.output : undefined);
  if (!output) return <section id="result-step" className="result-empty" aria-live="polite"><span className="step-label">Resultado</span><h2>{state?.phase === 'processing' || state?.phase === 'waiting' ? 'Seu resultado está sendo atualizado' : issues.length ? 'Vamos resolver os campos que faltam' : 'Ainda não foi possível calcular'}</h2>
    {state?.preview && <CostMetrics preview={state.preview} />}
    {state?.phase === 'invalid' && state.errorKind === 'technical' ? <div className="technical-recovery" role="alert"><h3>O processamento local falhou</h3><p>Seus dados não foram apagados. Tente novamente; se o problema persistir, confira a instalação.</p>{onRetry && <button type="button" onClick={onRetry}>Tentar calcular novamente</button>}<details><summary>Detalhes técnicos</summary><p>{state.error}</p></details></div> : <>
      <GuidedIssues issues={issues} {...(onFix ? { onFix } : {})} />
      {!issues.length && <p>{state?.phase === 'invalid' ? state.error : 'Importe ou informe os dados da impressão e o preço do material.'}</p>}
      {issues.length > 0 && state?.phase === 'invalid' && <details><summary>Detalhe técnico da validação</summary><p>{state.error}</p></details>}
    </>}
    <p>Valores antigos não são apresentados como atuais. O custo conhecido continua visível, quando disponível.</p></section>;
  if (output.kind === 'blocked-search') {
    const estimate = output.referencePreview;
    const conditional = estimate?.returnsUnconfirmed ?? false;
    const label = estimate && estimate.lower === estimate.upper
      ? currency(estimate.lower)
      : estimate ? `${currency(estimate.lower)} a ${currency(estimate.upper)}` : null;
    const pending = output.data.solution?.status === 'partial' ? output.data.solution.pending : [];
    return <section id="result-step" className="result-blocked">
      <span className="status-badge warning">{estimate ? 'Estimativa não confirmada' : 'Busca não concluída'}</span>
      {estimate ? <>
        <h2>Por quanto posso vender?</h2>
        <div className="reference-price-preview" aria-label="Preço estimado de referência">
          <span>{estimate.excludedActivePrograms.length ? 'Preço-base parcial, sem taxas de programas ativos' : 'Preço orientativo com tarifas documentadas'}</span>
          <strong>{label}</strong>
          <p>{conditional ? 'Cenários com e sem cobrança da Devolução Fácil.' : 'Simulação com as condições conhecidas.'} Não é preço garantido nem lucro confirmado. Se houver outras cobranças desconhecidas, o valor real pode superar esta referência.</p>
          {estimate.excludedActivePrograms.length > 0 && <div className="notice" role="status"><strong>Atenção: NÃO use esse preço-base como preço final de venda.</strong><p>Você informou participação ativa em {estimate.excludedActivePrograms.join(', ')}. Como os valores dessas cobranças não estão determinados, elas NÃO foram incluídas no preço-base ilustrativo. O preço necessário para sua margem pode ser maior.</p><p>Para obter um preço mais completo, informe as taxas reais dos programas ativos nas condições da Shopee. As respostas “Sim” foram mantidas.</p></div>}\n          {estimate.hypotheticalConditions.length > 0 && <details><summary>Hipóteses usadas porque você respondeu “Não sei”</summary><ul>{estimate.hypotheticalConditions.map(condition => <li key={condition}>{condition}</li>)}</ul><p>Você já respondeu. Não precisa preencher novamente para ver este cenário; confira as condições somente para obter um cálculo mais preciso.</p></details>}
        </div>
        <p className="field-hint">Busca desde {currency(estimate.searchStart)}. O valor de anúncio pode mudar após conferir cobranças reais da Shopee e despesas não informadas.</p>
      </> : <>
        <h2>Não foi possível estimar um preço confiável</h2>
        <p>Falta saber alguma cobrança que pode alterar o preço. Você pode conferir as condições sem preencher a tela inteira.</p>
      </>}
      {pending.length > 0 && <details className="pending-review"><summary>{estimate ? 'O que falta conferir para o lucro ficar determinado?' : 'Ver informações pendentes'} ({pending.length})</summary><PendingQuestions pending={pending} {...(onResolve ? { onResolve } : {})} /></details>}
      {onConfirm && <button type="button" className="secondary" onClick={onConfirm}>Conferir condições da Shopee</button>}
    </section>;
  }
  const demo = output.draft.ux?.entry === 'example'; const sale = output.kind === 'sale' ? output.data : null;
  const partial = sale?.result.status === 'partial'; const status = sale ? partial ? 'Parcial' : sale.result.confidence === 'provisional' ? 'Simulação provisória' : 'Completo' : 'Custos selecionados';
  const preview = output.kind === 'cost' ? calculateCostPreview(output.draft) : null;
  const exclusions = costExclusions(output.draft); const alerts: string[] = [];
  if (sale) { try { alerts.push(...financialAlerts(sale.result, text(draft, 'lowMargin').replace(',', '.'))); } catch { alerts.push('Confira o limite do alerta de margem.'); } }
  if (sale && !frozen) { const table = tables.find(item => item.id === sale.catalog.provenance?.tableId); if (table) alerts.push(...tariffHints(table, sale.input.unitPrice)); }
  return <section id="result-step" className="experience-result">
    <div className="result-title"><span className="step-label">Resultado</span><span className={`status-badge ${partial ? 'warning' : ''}`}>{demo ? 'Exemplo fictício · ' : ''}{status}</span></div>
    <h2>{sale ? sale.solution?.status === 'found' ? sale.searchRange?.automaticFloor ? 'Quanto cobrar na faixa documentada da Shopee' : 'Preço mínimo para a meta informada' : 'Quanto sobra neste pedido?' : 'Seu custo de impressão, explicado'}</h2>
    {frozen && <p className="help-box">Cálculo salvo: usa os dados e as regras originais. Atualizar o catálogo não modifica este histórico.</p>}
    {demo && <p className="notice">Demonstração com dados fictícios. Estes valores não descrevem sua oficina e não serão salvos como dados reais.</p>}
    {sale ? <FinancialMetrics output={output} advanced={ux.mode === 'advanced'} /> : preview && <CostMetrics preview={preview} />}
    {sale?.searchRange?.automaticFloor && <p className="help-box">Preço mínimo encontrado a partir de {currency(sale.searchRange.automaticFloor)}. Não afirmamos que seja o menor preço possível abaixo dessa faixa, onde a cobrança CPF é desconhecida.</p>}
    {partial && <PendingQuestions pending={sale!.result.pending} {...(onResolve ? { onResolve } : {})} />}
    {partial && <p>Lucro final indisponível enquanto houver cobranças desconhecidas.</p>}
    {sale?.result.confidence === 'provisional' && <p className="notice">Algumas regras usadas ainda precisam ser confirmadas com a Shopee. As hipóteses estão identificadas no cálculo completo.</p>}
    <details><summary>Estes custos não foram incluídos</summary><ul>{exclusions.map(item => <li key={item}>{item}</li>)}</ul>{output.draft.ux?.labor === 'zero' && <p>Mão de obra considerada em R$ 0,00 por sua escolha.</p>}</details>
    <p className="muted">{sale ? 'Estimativa antes de despesas/tributos não informados. Margem é lucro dividido pela receita após desconto, não markup. Nenhum repasse está confirmado.' : 'Sem venda simulada: este resultado não contém preço de venda, tarifas, repasse ou lucro.'}</p>
    {!!alerts.length && <div className="notice">{alerts.map(item => <p key={item}>{item}</p>)}</div>}
    {sale?.solution?.status === 'found' && <><p className="help-box">Mínimo matemático no intervalo informado, para esta quantidade e estas premissas. Não é pesquisa de mercado nem garantia de vendas.</p>{!frozen && onAdjustPrice && <details><summary>Quero usar outro preço final de anúncio</summary><p>Informe o valor efetivo, inclusive um preço como R$ 19,90 se desejar. Ao aplicar, mudamos para “Já tenho um preço” e recalculamos todas as tarifas. A meta anterior não é garantida.</p><FinalPrice onApply={onAdjustPrice} /></details>}</>}
    <details className="money-flow"><summary>Para onde vai o dinheiro</summary><ul><li>Fabricação: {currency(output.kind === 'cost' ? output.cost.manufacturing.total : sale!.result.manufacturing.total)}.</li><li>Embalagem: {currency(output.kind === 'cost' ? output.cost.packaging : sale!.result.packaging)}.</li>{sale && <><li>{partial ? 'Apenas tarifas calculáveis' : 'Tarifas'}: {currency(sale.result.knownMarketplaceFees)}.</li><li>Outras despesas: {currency(sale.result.otherOperatingCosts)}.</li><li>Lucro estimado: {sale.result.operatingProfit === null ? 'Ainda não determinado — existem cobranças desconhecidas' : currency(sale.result.operatingProfit)}.</li></>}</ul></details>
    <details className="complete-calculation"><summary>Ver cálculo completo · Ver como calculamos</summary>{sale ? <ResultView flat result={sale.result} solution={sale.solution} stale={false} catalog={sale.catalog} expenses={sale.expenses} /> : <ul>{output.kind === 'cost' && output.cost.manufacturing.lines.map(line => <li key={line.id}>{line.name}: {line.formula} = {currency(line.total)}</li>)}</ul>}</details>
    {!!sale?.comparison.length && <details><summary>Comparação de preços</summary><div className="table-scroll" tabIndex={0} role="region" aria-label="Comparação de preços"><table><caption>Mesmas condições; cada preço tem suas próprias pendências</caption><thead><tr><th>Preço</th><th>Tarifas conhecidas</th><th>Lucro/pedido</th><th>Situação</th></tr></thead><tbody>{sale.comparison.map(row => <tr key={row.unitPrice}><td>{currency(row.unitPrice)}</td><td>{currency(row.result.knownMarketplaceFees)}</td><td>{row.result.operatingProfit === null ? 'Pendente' : currency(row.result.operatingProfit)}</td><td>{row.result.status === 'partial' ? 'Parcial' : row.result.confidence === 'provisional' ? 'Provisório' : 'Completo'}</td></tr>)}</tbody></table></div></details>}
    {!frozen && !sale && onSell && <button type="button" onClick={onSell}>Simular uma venda com este custo</button>}
    {!frozen && !demo && <details className="save-result"><summary>Guardar produto e simulação</summary><Input name="productName" label="Nome da peça para salvar" required={false} /><button type="button" className="secondary" onClick={onSave} disabled={saved}>{saved ? 'Simulação salva' : 'Salvar produto e simulação'}</button></details>}
  </section>;
}
import { useState } from 'react';
import { NumericInput } from './Fields';
import { numericIssue } from './format';
function FinalPrice({ onApply }: { onApply: (price: string) => void }) {
  const [price, setPrice] = useState('');
  return <div className="final-price"><NumericInput name="final-announcement-price" label="Preço final desejado por unidade comercial" value={price} onValue={setPrice} kind="money" /><button type="button" className="secondary" disabled={!!numericIssue(price, 'money')} onClick={() => onApply(price)}>Aplicar preço e recalcular</button></div>;
}
