import type { ReferencePricePreview } from '../app/reference-price-preview';
import { currency } from './ResultView';
export function ProgramEstimate({ estimate }: { estimate: ReferencePricePreview }) {
  if (!estimate.profitRange || !estimate.example) return null;
  const { lower, upper } = estimate.profitRange;
  return <div className="reference-price-preview"><strong>Lucro estimado com hipóteses: {lower === upper ? currency(lower) : currency(lower) + ' a ' + currency(upper)}</strong><p>Simulação, não repasse confirmado. Encargos não informados podem reduzir o lucro; a faixa não representa limite garantido.</p><details><summary>Composição no cenário de maior custo</summary><ul>{estimate.example.fees.map(fee=><li key={fee.rule.id}>{fee.rule.name}: {currency(fee.amount)}</li>)}</ul></details>{estimate.hypotheticalConditions.length > 0 && <details><summary>Hipóteses utilizadas</summary><ul>{estimate.hypotheticalConditions.map(condition=><li key={condition}>{condition}</li>)}</ul></details>}</div>;
}
