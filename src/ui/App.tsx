import { useState } from 'react';
import type { FormEvent } from 'react';
import { calculatePricing, parseBrazilianMoney, solvePrice } from '../engine';
import type { ManualFee, PriceSolution, PricingResult, SaleInput } from '../engine';
import { directSaleCatalog } from '../marketplaces/custom';
import { createShopeeCatalog, SHOPEE_SNAPSHOT, shopeeFacts, shopeeSelections } from '../marketplaces/shopee/catalog';
import type { Participation, ShopeeContext } from '../marketplaces/shopee/catalog';
import { Field } from './Fields';
import { ResultView } from './ResultView';
import { ShopeeFields } from './ShopeeFields';
import './style.css';

const numberText = (value: FormDataEntryValue | null, name: string) => {
  if (typeof value !== 'string' || !/^\d{1,18}([,.]\d{1,12})?$/.test(value)) throw new Error(`${name}: use um decimal não negativo sem separador de milhar.`);
  return value.replace(',', '.');
};

export function App() {
  const [marketplace, setMarketplace] = useState('shopee');
  const [seller, setSeller] = useState('');
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
        seller: seller === 'CPF' || seller === 'CNPJ' ? seller : null,
        ordersLast90Days: orders === '' ? null : Number(orders),
        returnsProtection: text('returns') as ShopeeContext['returnsProtection'],
        highlightCampaign: text('highlight') as Participation, adsEasy: text('ads') as Participation,
        affiliates: text('affiliates') as Participation, cashAdvance: text('advance') as Participation,
        shippingConfirmed: form.has('shippingConfirmed'),
      };
      const overrides: Record<string, ManualFee> = {};
      const scope = (name: string) => {
        const selected = text(name);
        if (selected !== 'item' && selected !== 'order') throw new Error('Selecione explicitamente a incidência personalizada.');
        return selected;
      };
      const base = (name: string) => {
        const selected = text(name);
        if (selected !== 'gross-sales' && selected !== 'after-seller-discount') throw new Error('Selecione explicitamente a base personalizada.');
        return selected;
      };
      if (marketplace === 'shopee') {
        const period = { effectiveFrom: text('manualFrom'), effectiveUntil: text('manualUntil') };
        if (form.has('manualBasic')) {
          const reference = text('manualReference');
          overrides['shopee:commission'] = { ...period, reference, formula: { kind: 'percentage', rate: value('manualRate') }, scope: scope('manualRateScope'), base: base('manualBase') };
          overrides['shopee:fixed'] = { ...period, reference, formula: { kind: 'fixed', amount: money('manualFixed') }, scope: scope('manualFixedScope'), base: base('manualBase') };
        }
        for (const id of ['shopee:cpf-extra', 'shopee:returns-protection', 'shopee:highlight', 'shopee:adsEasy', 'shopee:affiliates', 'shopee:cashAdvance']) {
          if (form.has(`${id}:manual`)) overrides[id] = { ...period, reference: text(`${id}:reference`),
            formula: text(`${id}:kind`) === 'fixed' ? { kind: 'fixed', amount: money(`${id}:value`) } : { kind: 'percentage', rate: value(`${id}:value`) },
            scope: scope(`${id}:scope`), base: base(`${id}:base`) };
        }
      }
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
        acceptedAssumptions: { validity: form.has('acceptValidity'), rounding: form.has('acceptRounding'), precedence: form.has('acceptPrecedence') },
      };
      const catalogAt = (price: string) => marketplace === 'shopee' ? createShopeeCatalog(context, price, input.sellerDiscount, input.date, overrides) : directSaleCatalog();
      setResult(calculatePricing(input, catalogAt(input.unitPrice)));
      if (text('calculation') !== 'direct') setSolution(solvePrice(input, catalogAt,
        text('calculation') === 'margin' ? { kind: 'margin', ratio: value('targetMargin') } : { kind: 'profit', amount: money('targetProfit') },
        { min: money('minPrice'), max: money('maxPrice') }));
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Não foi possível calcular.'); }
  }

  return <main>
    <h1>FatiaLucro <small>0.1 — revisão</small></h1>
    <p>Precificação local de impressão 3D. Valores iniciais são exemplos editáveis. Sem conta online ou telemetria.</p>
    <form onSubmit={submit} onChange={() => { if (result) setStale(true); }}>
      <fieldset><legend>Venda</legend><div className="fields">
        <label>Canal<select name="marketplace" value={marketplace} onChange={event => setMarketplace(event.target.value)}><option value="shopee">Shopee Brasil — cálculo documentado ou personalizado</option><option value="direct">Venda direta — sem tarifas de marketplace</option></select></label>
        <label>Data de referência<input name="date" type="date" defaultValue={SHOPEE_SNAPSHOT} required /></label>
        <Field name="price" label="Preço unitário (R$)" initial="19,90" />
        <label>Quantidade<input name="quantity" type="number" min="1" max="10000" step="1" defaultValue="1" required /></label>
        <Field name="discount" label="Desconto total pago pelo vendedor (R$)" />
        <Field name="shipping" label="Frete líquido descontado no repasse (R$/pedido)" />
        <Field name="other" label="Outras despesas operacionais (R$/pedido)" />
      </div><p>Não inclua no desconto do vendedor os cupons ou subsídios integralmente pagos pela Shopee. Frete pago fora do repasse entra em outras despesas, uma única vez.</p>
      <label className="check"><input type="checkbox" name="shippingConfirmed" /> Confirmei o frete líquido, após subsídios e valores pagos pelo comprador.</label></fieldset>
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
      {marketplace === 'shopee' && <ShopeeFields seller={seller} onSellerChange={setSeller} />}
      <details><summary>Buscar preço para lucro ou margem</summary><div className="fields">
        <label>Operação<select name="calculation" defaultValue="direct"><option value="direct">Somente cálculo direto</option><option value="profit">Buscar lucro-alvo por pedido</option><option value="margin">Buscar margem-alvo</option></select></label>
        <Field name="targetProfit" label="Lucro desejado por pedido (R$)" initial="5" />
        <Field name="targetMargin" label="Margem desejada (0,25 = 25%)" initial="0,25" decimal />
        <Field key={`${marketplace}:${seller}`} name="minPrice" label="Preço unitário mínimo da busca (R$)" initial={marketplace === 'shopee' && seller === 'CPF' ? '12' : '0,01'} />
        <Field name="maxPrice" label="Preço unitário máximo da busca (R$)" initial="100" />
      </div><p>Busca em centavos, até 100.000 preços. Regiões indeterminadas interrompem a busca. CPF começa em R$12 para evitar extrapolar a regressão desconhecida; o intervalo pode ser alterado explicitamente.</p></details>
      <button type="submit">Calcular e detalhar</button>
    </form>
    {error && <p role="alert" className="notice">{error}</p>}
    {result && <ResultView result={result} solution={solution} stale={stale} />}
    <footer>FatiaLucro é gratuito e open source (MIT). Esta versão não salva dados ao fechar.</footer>
  </main>;
}
