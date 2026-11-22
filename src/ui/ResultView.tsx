import { D } from '../engine/decimal';
import type { Formula, PricingResult, PriceSolution, TariffCatalog } from '../engine';

export const currency = (value: string | null) => {
  if (value === null) return 'Pendente';
  const [integer, fraction] = value.split('.');
  return `R$ ${integer!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${fraction ? `,${fraction}` : ''}`;
};
const percent = (value: string | null) => value === null ? 'Pendente ou sem denominador' : `${new D(value).mul(100).toFixed(2).replace('.', ',')}%`;
function formulaText(formula: Formula | null): string {
  if (formula === null) return 'Indeterminada na documentação';
  if (formula.kind === 'fixed') return currency(formula.amount);
  if (formula.kind === 'percentage') return `${formula.rate.replace('.', ',')}% da base${formula.cap === undefined ? '' : `, até ${currency(formula.cap)}`}`;
  return formula.bands.map(band => `${currency(band.from)} até ${band.to === null ? 'sem teto' : currency(band.to)} (exclusive): ${formulaText(band.formula)}`).join('; ');
}

export function ResultView({ result, solution, stale, catalog, expenses }: { result: PricingResult; solution: PriceSolution | null; stale: boolean; catalog: TariffCatalog; expenses: { other: string; advertising: string } }) {
  const unresolved = catalog.rules.filter(rule => !result.fees.some(line => line.rule.id === rule.id) && !result.excluded.some(line => line.id === rule.id));
  return <section aria-live="polite"><h2>{result.status === 'partial' ? 'Demonstrativo parcial' : result.confidence === 'provisional' ? 'Simulação provisória' : 'Resultado calculado'}</h2>
    {stale && <p className="notice">Entradas alteradas. Recalcule para atualizar o demonstrativo abaixo.</p>}
    <p>Simulação de custos e recebimentos, sem confirmação de repasse real. {result.confidence === 'provisional' && 'Os resultados dependem das premissas e dos parâmetros personalizados identificados abaixo.'}</p>
    <p>Catálogo: {result.catalog.version}. Arredondamento: HALF_UP por ocorrência.</p>
    {catalog.provenance && <p className="muted">Verificação documental: {catalog.provenance.lastVerified}. {catalog.provenance.selection === 'effective' ? 'Período declarado selecionado' : catalog.provenance.selection === 'reference' ? 'Referência sem vigência comprovada' : 'Sem tabela aplicável'}. Vigência: {catalog.provenance.effectiveFrom ?? 'início não comprovado'} a {catalog.provenance.effectiveUntil ?? 'fim não comprovado'}. Selecionar não confirma atualização ao vivo.</p>}
    <dl>
      <dt>Receita bruta</dt><dd>{currency(result.grossSales)}</dd>
      <dt>Desconto do vendedor</dt><dd>{currency(result.sellerDiscount)}</dd>
      <dt>Receita após desconto (base da margem)</dt><dd>{currency(result.salesAfterDiscount)}</dd>
      <dt>Fabricação total</dt><dd>{currency(result.manufacturing.total)}</dd>
      <dt>Embalagem total</dt><dd>{currency(result.packaging)}</dd>
      <dt>Outras despesas operacionais</dt><dd>{currency(result.otherOperatingCosts)}</dd>
      <dt>↳ Publicidade convencional informada (já incluída acima)</dt><dd>{currency(expenses.advertising)}</dd>
      <dt>↳ Demais despesas informadas (já incluídas acima)</dt><dd>{currency(expenses.other)}</dd>
      <dt>Frete líquido informado, debitado no repasse</dt><dd>{currency(result.sellerShipping)}</dd>
      <dt>Subtotal calculado por fórmulas documentadas</dt><dd>{currency(result.documentedMarketplaceFees)}</dd>
      <dt>Subtotal calculado com parâmetros personalizados</dt><dd>{currency(result.customMarketplaceFees)}</dd>
      <dt>Total das tarifas calculáveis</dt><dd>{currency(result.knownMarketplaceFees)}</dd>
      <dt>Repasse líquido simulado</dt><dd>{currency(result.marketplaceNet)}</dd>
      <dt>Lucro operacional estimado (antes de tributos não informados)</dt><dd>{currency(result.operatingProfit)}</dd>
      <dt>Margem (lucro / receita após desconto)</dt><dd>{percent(result.margin)}</dd>
      <dt>Markup (lucro / custos operacionais)</dt><dd>{percent(result.markup)}</dd>
    </dl>
    {!!result.pending.length && <div className="notice"><h3>Pendências que impedem concluir o resultado</h3><ul>{result.pending.map((item, index) => <li key={`${item.id}-${index}`}>{item.message}</li>)}</ul></div>}
    {!!result.assumptions.length && <details open><summary>Premissas e valores personalizados</summary><ul>{result.assumptions.map((item, index) => <li key={`${item.id}-${index}`}>{item.accepted ? 'Usada na simulação' : 'Ainda não aceita'}: {item.message}</li>)}</ul></details>}
    <details><summary>Custos de fabricação</summary><p>Em lotes, cada componente é arredondado no lote e rateado pelas peças produzidas. O total do pedido preserva as frações do rateio antes de arredondar. O valor unitário exibido pode não multiplicar exatamente para o total.</p><div className="table-scroll"><table><thead><tr><th>Componente</th><th>Fórmula</th><th>Por unidade</th><th>Total</th></tr></thead><tbody>
      {result.manufacturing.lines.map(line => <tr key={line.id}><td>{line.name}</td><td>{line.formula}<br />Antes de arredondar: {line.rawPerUnit}</td><td>{currency(line.perUnit)}</td><td>{currency(line.total)}</td></tr>)}
    </tbody></table></div></details>
    <h3>Taxas individualizadas</h3>{result.fees.map(line => <details key={line.rule.id}><summary>{line.rule.name}: total {currency(line.amount)} — incidência por {line.rule.scope === 'item' ? 'unidade' : 'pedido'} — {line.rule.evidence.verification === 'custom' ? 'personalizada' : 'documentada'}</summary>
      <p>Identificador: {line.rule.id}; versão: {line.rule.version}; base: {line.rule.base === 'gross-sales' ? 'receita bruta' : 'receita após desconto do vendedor'}; {line.rule.requirement === 'mandatory' ? 'obrigatória' : line.rule.requirement === 'conditional' ? 'condicional' : 'opcional'}.</p>
      <p>Fórmula: {formulaText(line.resolvedFormula)}. Período: {line.rule.effectiveFrom ?? 'início não comprovado'} a {line.rule.effectiveUntil ?? 'fim não comprovado'}; origem: {line.rule.evidence.verification === 'custom' ? 'personalizada' : 'documental'}.</p>
      <p>{line.rule.evidence.reference}</p>
      {line.rule.override && <p>Substitui somente esta cobrança. Fórmula documental anterior: {formulaText(line.rule.override.originalFormula)}. Fonte anterior: {line.rule.override.originalEvidence.id}. O parâmetro personalizado não se torna uma tarifa oficial.</p>}
      <ul>{line.assessments.map((entry, index) => <li key={index}>Base {currency(entry.base)}; antes de arredondar {entry.rawAmount}; {entry.count} × {currency(entry.roundedPerOccurrence)} = {currency(entry.total)}</li>)}</ul>
      <ul>{line.rule.evidence.urls.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer">Documento oficial arquivado</a></li>)}</ul>
    </details>)}
    {unresolved.map(rule => <details key={rule.id}><summary>{rule.name}: valor pendente — {rule.requirement === 'mandatory' ? 'obrigatória' : rule.requirement === 'conditional' ? 'condicional' : 'opcional'}</summary>
      <p>Fórmula: {formulaText(rule.formula)}; incidência por {rule.scope === 'item' ? 'unidade' : 'pedido'}; base {rule.base === 'gross-sales' ? 'receita bruta' : 'após desconto do vendedor'}. Não somada ao subtotal calculável enquanto houver indeterminação.</p>
      <p>{rule.evidence.reference}</p><ul>{rule.evidence.urls.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer">Documento de referência</a></li>)}</ul>
    </details>)}
    {!!result.excluded.length && <details><summary>Componentes não somados</summary><ul>{result.excluded.map(line => <li key={line.id}>{line.id}: {line.reason}</li>)}</ul></details>}
    <ul>{result.warnings.map(message => <li key={message}>{message}</li>)}</ul>
    {solution && <aside><h3>Busca de preço</h3>{solution.status === 'found' ? <>
      <p>{solution.confidence === 'provisional' ? 'Preço mínimo provisório, válido apenas sob as premissas da busca' : 'Preço mínimo calculado no intervalo'}: {currency(solution.unitPrice)}; lucro simulado por pedido: {currency(solution.result.operatingProfit)}.</p>
      <details><summary>Premissas consideradas em toda a busca</summary><ul>{solution.assumptions.map((item, index) => <li key={index}>{item.message}</li>)}</ul></details>
    </> : solution.status === 'partial' ? <><p>Busca interrompida por cobrança indeterminada ou premissa não aceita. Ajuste o intervalo ou informe o parâmetro correspondente, sem ignorar regiões desconhecidas.</p><ul>{solution.pending.map((item, index) => <li key={index}>{item.message}</li>)}</ul></> : <p>Meta não alcançada no intervalo {solution.confidence === 'provisional' ? 'sob as premissas informadas' : 'calculado'}.</p>}<p>Preços examinados: {solution.examined}.</p></aside>}
  </section>;
}
