import { useState } from 'react';
import type { FormEvent } from 'react';
import { calculatePricing, parseBrazilianMoney, solvePrice } from '../engine';
import type { PriceSolution, PricingResult, SaleInput } from '../engine';
import { directSaleCatalog } from '../marketplaces/custom';
import { createShopeeCatalog, SHOPEE_SNAPSHOT, shopeeFacts, shopeeSelections } from '../marketplaces/shopee/catalog';
import type { Participation, ShopeeContext } from '../marketplaces/shopee/catalog';
import './style.css';

const currency = (value: string | null) => value === null ? 'Pendente' : `R$ ${value.replace('.', ',')}`;
const numberText = (value: FormDataEntryValue | null, name: string) => {
  if (typeof value !== 'string' || !/^\d{1,18}([,.]\d{1,12})?$/.test(value)) throw new Error(`${name}: use um decimal não negativo sem separador de milhar.`);
  return value.replace(',', '.');
};

function Field({ name, label, initial = '0', decimal = false }: { name: string; label: string; initial?: string; decimal?: boolean }) {
  return <label>{label}<input name={name} defaultValue={initial} inputMode="decimal" required pattern={decimal ? '[0-9]+([,.][0-9]{1,12})?' : '[0-9]+([,.][0-9]{1,2})?'} /></label>;
}

function ParticipationField({ name, label }: { name: string; label: string }) {
  return <label>{label}<select name={name} defaultValue="unknown"><option value="unknown">Não confirmado</option><option value="inactive">Sem participação</option><option value="active">Participação ativa</option></select></label>;
}

export function App() {
  const [marketplace, setMarketplace] = useState('shopee');
  const [machineMode, setMachineMode] = useState('all-in');
  const [result, setResult] = useState<PricingResult | null>(null);
  const [solution, setSolution] = useState<PriceSolution | null>(null);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setResult(null); setSolution(null); setStale(false);
    try {
      const form = new FormData(event.currentTarget);
      const text = (name: string) => String(form.get(name) ?? '');
      const money = (name: string) => parseBrazilianMoney(text(name));
      const value = (name: string) => numberText(form.get(name), name);
      const count = text('quantity');
      if (!/^\d+$/.test(count)) throw new Error('Quantidade precisa ser inteira.');
      const orders = text('orders');
      if (orders !== '' && !/^\d+$/.test(orders)) throw new Error('Pedidos em 90 dias precisa ser inteiro ou vazio.');
      const context: ShopeeContext = {
        seller: text('seller') === 'CPF' ? 'CPF' : 'CNPJ', ordersLast90Days: orders === '' ? null : Number(orders),
        returnsProtection: text('returns') as ShopeeContext['returnsProtection'],
        highlightCampaign: text('highlight') as Participation,
        adsEasy: text('ads') as Participation,
        affiliates: text('affiliates') as Participation,
        cashAdvance: text('advance') as Participation,
        shippingConfirmed: form.has('shippingConfirmed'),
      };
      const input: SaleInput = {
        date: text('date'), purpose: 'simulation', unitPrice: money('price'), quantity: Number(count),
        manufacturing: {
          grams: value('grams'), filamentPerKg: money('filament'), printHours: value('hours'),
          machine: machineMode === 'all-in' ? { mode: 'all-in', perHour: money('machine') } : {
            mode: 'detailed', watts: value('watts'), energyPerKwh: value('kwh'), maintenancePerHour: money('maintenance'), depreciationPerHour: money('depreciation'),
          },
          laborMinutes: value('laborMinutes'), laborPerHour: money('laborHour'), consumablesPerUnit: money('consumables'), failureReservePerUnit: money('failure'),
        },
        packagingPerUnit: money('packagingUnit'), packagingPerOrder: money('packagingOrder'),
        sellerDiscount: money('discount'), sellerShipping: money('shipping'), otherOperatingCosts: money('other'),
        selections: marketplace === 'shopee' ? shopeeSelections(context) : {}, facts: marketplace === 'shopee' ? shopeeFacts(context) : {},
      };
      const catalogAt = (price: string) => marketplace === 'shopee' ? createShopeeCatalog(context, price, input.sellerDiscount, input.date) : directSaleCatalog();
      setResult(calculatePricing(input, catalogAt(input.unitPrice)));
      if (text('calculation') !== 'direct') {
        setSolution(solvePrice(input, catalogAt, text('calculation') === 'margin' ? { kind: 'margin', ratio: value('targetMargin') } : { kind: 'profit', amount: money('targetProfit') }, { min: money('minPrice'), max: money('maxPrice') }));
      }
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Não foi possível calcular.'); }
  }

  return <main>
    <h1>FatiaLucro <small>0.1</small></h1>
    <p>Precificação local de impressão 3D. Valores iniciais são exemplos editáveis. Sem conta, conexão ou telemetria.</p>
    <form onSubmit={submit} onChange={() => { if (result) setStale(true); }}>
      <fieldset><legend>Venda</legend><div className="fields">
        <label>Canal<select name="marketplace" value={marketplace} onChange={event => setMarketplace(event.target.value)}><option value="shopee">Shopee Brasil — prévia documental</option><option value="direct">Venda direta — sem tarifas de marketplace</option></select></label>
        <label>Data de referência<input name="date" type="date" defaultValue={SHOPEE_SNAPSHOT} required /></label>
        <Field name="price" label="Preço unitário (R$)" initial="19,90" />
        <label>Quantidade<input name="quantity" type="number" min="1" max="10000" step="1" defaultValue="1" required /></label>
        <Field name="discount" label="Desconto total pago pelo vendedor (R$)" />
        <Field name="shipping" label="Frete líquido suportado pelo vendedor (R$/pedido)" />
        <Field name="other" label="Outras despesas operacionais (R$/pedido)" />
      </div><label className="check"><input type="checkbox" name="shippingConfirmed" /> Confirmei o frete líquido, após subsídios e valores pagos pelo comprador.</label></fieldset>
      <fieldset><legend>Fabricação por unidade</legend><div className="fields">
        <Field name="grams" label="Filamento consumido (g)" initial="22,31" decimal />
        <Field name="filament" label="Filamento (R$/kg)" initial="120" />
        <Field name="hours" label="Impressão (horas decimais)" initial="1,03" decimal />
        <label>Custo de máquina<select value={machineMode} onChange={event => setMachineMode(event.target.value)}><option value="all-in">Completo por hora</option><option value="detailed">Energia + manutenção + depreciação</option></select></label>
        {machineMode === 'all-in' ? <Field name="machine" label="Máquina completa (R$/h)" initial="2" /> : <>
          <Field name="watts" label="Potência média (W)" initial="150" decimal />
          <Field name="kwh" label="Energia (R$/kWh)" initial="0,80" decimal />
          <Field name="maintenance" label="Manutenção (R$/h)" />
          <Field name="depreciation" label="Depreciação (R$/h)" />
        </>}
        <Field name="laborMinutes" label="Trabalho manual (minutos)" decimal />
        <Field name="laborHour" label="Mão de obra (R$/h; aceita zero)" />
        <Field name="consumables" label="Consumíveis (R$/unidade)" />
        <Field name="failure" label="Reserva estimada de falhas (R$/unidade)" initial="0,27" />
        <Field name="packagingUnit" label="Embalagem individual (R$/unidade)" />
        <Field name="packagingOrder" label="Embalagem compartilhada (R$/pedido)" initial="0,36" />
      </div></fieldset>
      {marketplace === 'shopee' && <fieldset><legend>Shopee: condições reais da operação</legend>
        <p>A tabela disponível é uma captura de 22/11/2026. Vigência e arredondamento ainda têm pendências; não há previsão confirmada de lucro.</p>
        <div className="fields">
          <label>Cadastro<select name="seller" defaultValue="CNPJ"><option value="CNPJ">CNPJ</option><option value="CPF">CPF</option></select></label>
          <label>Pedidos em 90 dias (CPF; vazio = desconhecido)<input name="orders" type="number" min="0" step="1" /></label>
          <label>Devolução Fácil neste pedido pago<select name="returns" defaultValue="unknown"><option value="unknown">Não confirmado</option><option value="inactive">Sem participação</option><option value="trial">Durante teste gratuito</option><option value="billable">Participação cobrável, fora da gratuidade</option></select></label>
          <ParticipationField name="highlight" label="Campanha de Destaque — adesão na data" />
          <ParticipationField name="ads" label="Ads Fácil" />
          <ParticipationField name="affiliates" label="Afiliados" />
          <ParticipationField name="advance" label="Antecipação Shopee Acelera" />
        </div>
        <p>Campanha de Destaque ativa considera todas as vendas da loja durante a adesão. Alterar uma opção nesta simulação não cancela sua adesão na Shopee.</p>
      </fieldset>}
      <details><summary>Buscar preço para lucro ou margem</summary><div className="fields">
        <label>Operação<select name="calculation" defaultValue="direct"><option value="direct">Somente cálculo direto</option><option value="profit">Buscar lucro-alvo por pedido</option><option value="margin">Buscar margem-alvo</option></select></label>
        <Field name="targetProfit" label="Lucro desejado por pedido (R$)" initial="5" />
        <Field name="targetMargin" label="Margem desejada (0,25 = 25%)" initial="0,25" decimal />
        <Field name="minPrice" label="Preço unitário mínimo da busca (R$)" initial="0,01" />
        <Field name="maxPrice" label="Preço unitário máximo da busca (R$)" initial="100" />
      </div><p>Busca em centavos, até 100.000 preços. Uma região desconhecida interrompe a busca; não há preço mínimo garantido com tarifas pendentes.</p></details>
      <button type="submit">Calcular e detalhar</button>
    </form>
    {error && <p role="alert" className="notice">{error}</p>}
    {result && <section aria-live="polite"><h2>Demonstrativo {result.status === 'partial' ? 'parcial' : 'da simulação'}</h2>
      {stale && <p className="notice">Entradas alteradas. Recalcule para atualizar o demonstrativo abaixo.</p>}
      <p>Catálogo: {result.catalog.version}. Arredondamento: HALF_UP por ocorrência.</p>
      <dl>
        <dt>Receita bruta</dt><dd>{currency(result.grossSales)}</dd>
        <dt>Desconto do vendedor</dt><dd>{currency(result.sellerDiscount)}</dd>
        <dt>Receita após desconto (base da margem)</dt><dd>{currency(result.salesAfterDiscount)}</dd>
        <dt>Fabricação total</dt><dd>{currency(result.manufacturing.total)}</dd>
        <dt>Embalagem total</dt><dd>{currency(result.packaging)}</dd>
        <dt>Outras despesas operacionais</dt><dd>{currency(result.otherOperatingCosts)}</dd>
        <dt>Frete líquido informado</dt><dd>{currency(result.sellerShipping)}</dd>
        <dt>Subtotal de tarifas calculáveis</dt><dd>{currency(result.knownMarketplaceFees)}</dd>
        <dt>Recebimento líquido do marketplace</dt><dd>{currency(result.marketplaceNet)}</dd>
        <dt>Lucro operacional estimado (antes de tributos não informados)</dt><dd>{currency(result.operatingProfit)}</dd>
        <dt>Margem (lucro / receita após desconto)</dt><dd>{result.margin ?? 'Pendente ou sem denominador'}</dd>
        <dt>Markup (lucro / custos operacionais)</dt><dd>{result.markup ?? 'Pendente ou sem denominador'}</dd>
      </dl>
      {!!result.pending.length && <div className="notice"><h3>Pendências que impedem concluir o resultado</h3><ul>{result.pending.map((item, index) => <li key={`${item.id}-${index}`}>{item.message}</li>)}</ul></div>}
      <h3>Custos de fabricação</h3><div className="table-scroll"><table><thead><tr><th>Componente</th><th>Fórmula</th><th>Por unidade</th><th>Total</th></tr></thead><tbody>
        {result.manufacturing.lines.map(line => <tr key={line.id}><td>{line.name}</td><td>{line.formula}<br />Antes de arredondar: {line.rawPerUnit}</td><td>{currency(line.perUnit)}</td><td>{currency(line.total)}</td></tr>)}
      </tbody></table></div>
      <h3>Cada tarifa</h3>{result.fees.map(line => <details key={line.rule.id}><summary>{line.rule.name}: {currency(line.amount)} — por {line.rule.scope === 'item' ? 'item' : 'pedido'}</summary>
        <p>Identificador: {line.rule.id}; versão: {line.rule.version}; base: {line.rule.base}; obrigatoriedade: {line.rule.requirement}.</p>
        <p>Fórmula: {JSON.stringify(line.resolvedFormula)}. Vigência inicial: {line.rule.effectiveFrom ?? 'não comprovada'}; estado: {line.rule.evidence.verification}.</p>
        <p>{line.rule.evidence.reference}</p>
        <ul>{line.assessments.map((entry, index) => <li key={index}>Base {currency(entry.base)}; antes de arredondar {entry.rawAmount}; {entry.count} × {currency(entry.roundedPerOccurrence)} = {currency(entry.total)}</li>)}</ul>
        <ul>{line.rule.evidence.urls.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer">Fonte oficial</a></li>)}</ul>
      </details>)}
      {!!result.excluded.length && <><h3>Componentes não somados</h3><ul>{result.excluded.map(line => <li key={line.id}>{line.id}: {line.reason}</li>)}</ul></>}
      <ul>{result.warnings.map(message => <li key={message}>{message}</li>)}</ul>
      {solution && <aside><h3>Busca de preço</h3>{solution.status === 'found' ? <p>Preço unitário mínimo no intervalo: {currency(solution.unitPrice)}; lucro por pedido: {currency(solution.result.operatingProfit)}.</p> : solution.status === 'partial' ? <><p>Busca interrompida por evidência pendente.</p><ul>{solution.pending.map((item, index) => <li key={index}>{item.message}</li>)}</ul></> : <p>Meta não alcançada no intervalo informado.</p>}<p>Preços examinados: {solution.examined}.</p></aside>}
    </section>}
    <footer>FatiaLucro é gratuito e open source (MIT). Esta versão não salva dados ao fechar.</footer>
  </main>;
}
