import { text } from '../app/model';
import { Field, Input, Select, useForm } from './Fields';

export function PriceFields({ error, busy }: { error: string; busy: boolean }) {
  const { draft } = useForm(); const operation = text(draft, 'calculation');
  return <section id="price"><h2><b aria-hidden="true">4</b> Preço e objetivo</h2><div className="fields"><Field name="price" label="Preço por unidade" /><Input name="quantity" label="Unidades vendidas no pedido" /><Select name="calculation" label="Quero calcular"><option value="direct">Lucro do preço informado</option><option value="profit">Preço para um lucro desejado</option><option value="margin">Preço para uma margem desejada</option><option value="equilibrium">Preço de equilíbrio</option><option value="compare">Comparar preços</option></Select></div>
    {['profit', 'margin', 'equilibrium'].includes(operation) && <><div className="fields">{operation === 'profit' && <Field name="targetProfit" label="Lucro desejado por pedido" />}{operation === 'margin' && <Field name="targetMargin" label="Margem desejada (%)" decimal />}</div><details open><summary>Intervalo da busca</summary><div className="fields"><Field name="minPrice" label="Menor preço por unidade" /><Field name="maxPrice" label="Maior preço por unidade" /></div><p>O menor preço encontrado vale neste intervalo. Regiões com cobrança desconhecida interrompem a busca, sem pular preços. Limite de 100 mil candidatos.</p></details></>}
    {operation === 'compare' && <Input name="comparison" label="Preços separados por ponto e vírgula (até 20)" />}
    <details><summary>Alerta de margem baixa</summary><Field name="lowMargin" label="Avisar abaixo de (%)" decimal /></details>
    {error && <p id="calculation-error" className="notice" role="alert">{error}</p>}
    <button type="submit" className="calculate-button" disabled={busy} aria-describedby={error ? 'calculation-error' : undefined}>{busy ? 'Calculando localmente…' : 'Calcular cenário'}<span aria-hidden="true"> →</span></button>
  </section>;
}
