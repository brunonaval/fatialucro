import { D } from '../engine/decimal';
import { financialAlerts } from '../engine';
import type { ExperienceOutput } from '../app/experience';
import { text } from '../app/model';
import type { AutomaticState } from '../app/automatic';
import { currency, ResultView } from './ResultView';
import { Field, Input } from './Fields';
import { useExperience } from './ExperienceContext';
import { tariffHints } from '../app/tariff-hints';
import type { ShopeeTable } from '../marketplaces/catalogs/types';

export function ExperienceResult({ state, frozen, onConfirm, onSave, saved = false, tables = [] }: { state?: AutomaticState<ExperienceOutput>; frozen?: ExperienceOutput; onConfirm?: () => void; onSave?: () => void; saved?: boolean; tables?: readonly ShopeeTable[] }) {
  const context = useExperience(); const { draft, ux } = context;
  const output = frozen ?? (state?.phase === 'ready' ? state.output : undefined);
  if (!output) return <section id="result-step" className="result-empty" aria-live="polite"><span className="step-label">Resultado</span><h2>{state?.phase === 'processing' || state?.phase === 'waiting' ? 'Seu resultado está sendo atualizado' : 'Vamos completar seu cálculo'}</h2><p>{state?.phase === 'invalid' ? state.error : 'Informe os dados da impressão e os custos escolhidos. O cálculo aparece automaticamente.'}</p><p className="muted">Enquanto há edição ou erro, os valores anteriores ficam ocultos para não parecerem atuais.</p></section>;
  if (output.kind === 'blocked-search') {
    const solution = output.data.solution;
    return <section id="result-step" aria-live="polite"><span className="status-badge warning">Busca não concluída</span><h2>Ainda não há um preço mínimo calculável</h2><p>{solution?.status === 'partial' ? 'A busca encontrou uma condição desconhecida. Ela foi interrompida para não pular preços e apresentar um mínimo incorreto.' : 'A meta não foi atingida no intervalo informado. Confira a meta e os limites da busca.'}</p>{solution?.status === 'partial' && <ul>{solution.pending.map((item, index) => <li key={index}>{item.message}</li>)}</ul>}<p>Não mostramos lucro ou repasse de um preço arbitrário como se fosse o resultado da busca.</p><button type="button" onClick={onConfirm}>Conferir venda e condições</button></section>;
  }
  const demo = output.draft.ux?.entry === 'example';
  const sale = output.kind === 'sale' ? output.data : null; const result = sale?.result;
  const cost = output.kind === 'cost' ? output.cost : null;
  const complete = result?.status === 'complete'; const status = cost ? 'Custos selecionados' : !complete ? 'Parcial' : result?.confidence === 'provisional' ? 'Provisório' : 'Completo';
  const quantity = sale?.input.quantity ?? (output.kind === 'cost' ? output.input.quantity : 1);
  const physical = sale?.input.manufacturing.partsPerUnit ?? 1;
  const margin = result?.margin === null || result?.margin === undefined ? 'Pendente' : `${new D(result.margin).mul(100).toFixed(2).replace('.', ',')}%`;
  let alerts: string[] = [];
  if (result) { try { alerts = financialAlerts(result, text(draft, 'lowMargin').replace(',', '.')); } catch { alerts = ['Confira o limite do alerta de margem.']; } }
  if (sale && !frozen) { const table = tables.find(item => item.id === sale.catalog.provenance?.tableId); if (table) alerts.push(...tariffHints(table, sale.input.unitPrice)); }
  return <section id="result-step" className="experience-result" aria-live="polite">
    <div className="result-title"><span className="step-label">Resultado</span><span className={`status-badge ${!cost && !complete ? 'warning' : ''}`}>{demo ? 'Exemplo fictício · ' : ''}{status}</span></div>
    <h2>{cost ? 'Quanto custa esta impressão?' : sale?.solution?.status === 'found' ? 'Preço mínimo para a meta informada' : 'Quanto sobra neste pedido?'}</h2>
    {frozen && <p className="help-box">Cálculo salvo: usa os dados e as regras originais. Atualizar o catálogo não modifica este histórico.</p>}
    {demo && <p className="notice">Demonstração com dados fictícios. Estes valores não descrevem sua oficina e não serão salvos como dados reais.</p>}
    {sale && <div className="headline-price"><span>{physical > 1 ? 'Preço de um kit' : 'Preço por unidade'}</span><strong>{currency(sale.input.unitPrice)}</strong><small>{quantity} {physical > 1 ? 'kit(s)' : 'unidade(s)'} no pedido{physical > 1 ? ` · ${quantity * physical} peças físicas` : ''}</small></div>}
    <dl className="result-metrics">
      <dt>Custo de fabricação {cost ? 'desta impressão' : 'das unidades vendidas'}</dt><dd>{currency(cost?.manufacturing.total ?? result!.manufacturing.total)}</dd>
      <dt>Custo de fabricação por {physical > 1 ? 'kit' : 'peça'}</dt><dd>{currency(cost?.manufacturing.perUnit ?? result!.manufacturing.perUnit)}</dd>
      {cost ? <><dt>Embalagem incluída</dt><dd>{currency(cost.packaging)}</dd><dt>Total dos custos selecionados</dt><dd className="result-total">{currency(cost.total)}</dd></> : <>
        <dt>{complete ? 'Tarifas do marketplace' : 'Subtotal de tarifas conhecidas — incompleto'}</dt><dd>{currency(result!.knownMarketplaceFees)}</dd>
        <dt>{text(output.draft, 'marketplace') === 'direct' ? 'Recebimento estimado' : 'Repasse estimado da plataforma'}</dt><dd>{currency(result!.marketplaceNet)}</dd>
        <dt>Lucro operacional estimado do pedido</dt><dd className={`result-total ${result!.operatingProfit?.startsWith('-') ? 'loss' : ''}`}>{result!.operatingProfit?.startsWith('-') ? 'Prejuízo: ' : ''}{currency(result!.operatingProfit)}</dd>
        <dt>Lucro por unidade comercial</dt><dd>{result!.operatingProfit === null ? 'Pendente' : currency(new D(result!.operatingProfit).div(quantity).toFixed(2))}</dd>
        <dt>Margem operacional sobre a venda</dt><dd>{margin}</dd>
      </>}
    </dl>
    <p className="muted">{cost ? 'Sem venda simulada: não há preço, tarifa de marketplace, repasse ou lucro neste resultado.' : 'Lucro dividido pela receita após desconto do vendedor. Margem não é markup. Estimativa antes de despesas/tributos não informados; nenhum repasse está confirmado.'}</p>
    <p className="scope-note">{!output.draft.ux?.machineIncluded && output.draft.ux && 'Máquina/energia não incluídas. '}{output.draft.ux?.labor === 'excluded' && 'Mão de obra não incluída. '}{output.draft.ux?.labor === 'zero' && 'Mão de obra considerada em R$0 por sua escolha. '}{output.draft.ux && !output.draft.ux.packagingIncluded && 'Embalagem não incluída. '}{output.draft.ux && !output.draft.ux.extrasIncluded && 'Consumíveis e reserva de perdas não incluídos. '}</p>
    {sale?.solution?.status === 'found' && <p className="help-box">Mínimo matemático no intervalo informado, para esta quantidade e estas premissas. Não representa preço competitivo de mercado.</p>}
    {!!alerts.length && <div className="notice">{alerts.map(item => <p key={item}>{item}</p>)}</div>}
    {!!result?.pending.length && <div className="pending-actions"><h3>O que falta confirmar?</h3><ul>{result.pending.map((item, index) => <li key={`${item.id}-${index}`}>{item.message}</li>)}</ul>{onConfirm && <button type="button" onClick={onConfirm}>Conferir respostas da venda</button>}</div>}
    <details open className="money-flow"><summary>Para onde vai o dinheiro</summary><ul><li>Fabricação: {currency(cost?.manufacturing.total ?? result!.manufacturing.total)}.</li><li>Embalagem: {currency(cost?.packaging ?? result!.packaging)}.</li>{result && <><li>Outras despesas informadas: {currency(result.otherOperatingCosts)}.</li><li>Frete líquido debitado do repasse: {currency(result.sellerShipping)}.</li><li>{complete ? 'Tarifas' : 'Apenas tarifas calculáveis'}: {currency(result.knownMarketplaceFees)}.</li><li>{complete ? `Lucro operacional estimado: ${currency(result.operatingProfit)}.` : 'Lucro final indisponível enquanto houver cobranças desconhecidas.'}</li></>}</ul></details>
    <details><summary>Ver cálculo completo</summary>{sale ? <ResultView result={sale.result} solution={sale.solution} stale={false} catalog={sale.catalog} expenses={sale.expenses} /> : <div className="table-scroll"><table><caption>Fabricação — componentes incluídos</caption><thead><tr><th>Componente</th><th>Como foi calculado</th><th>Total</th></tr></thead><tbody>{cost!.manufacturing.lines.map(line => <tr key={line.id}><td>{line.name}</td><td>{line.formula}</td><td>{currency(line.total)}</td></tr>)}</tbody></table></div>}</details>
    {!!sale?.comparison.length && <details open><summary>Comparação de preços</summary><div className="table-scroll"><table><caption>Mesma quantidade e custos; cada preço mantém suas próprias pendências</caption><thead><tr><th>Preço/unidade</th><th>Tarifas conhecidas</th><th>Lucro/pedido</th><th>Situação</th></tr></thead><tbody>{sale.comparison.map(row => <tr key={row.unitPrice}><td>{currency(row.unitPrice)}</td><td>{currency(row.result.knownMarketplaceFees)}</td><td>{currency(row.result.operatingProfit)}</td><td>{row.result.status === 'partial' ? 'Parcial' : row.result.confidence === 'provisional' ? 'Provisório' : 'Completo'}</td></tr>)}</tbody></table></div></details>}
    {!frozen && !demo && <div className="save-result"><Input name="productName" label="Nome do produto para guardar este cálculo" required={false} /><button type="button" onClick={onSave} disabled={saved}>{saved ? 'Simulação salva' : 'Salvar produto e simulação'}</button></div>}
    {!frozen && ux.mode === 'advanced' && <details><summary>Ajustar alerta de margem</summary><Field name="lowMargin" label="Margem mínima para o aviso (%)" decimal /></details>}
  </section>;
}
