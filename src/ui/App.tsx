import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { calculateManufacturing, calculatePricing, depreciationPerHour, financialAlerts } from '../engine';
import { D, parseBrazilianMoney } from '../engine/decimal';
import { defaultDraft, expenseBreakdown, numeric, restoreProfile, text } from '../app/model';
import type { CalculatorDraft, SavedKind } from '../app/model';
import type { CalculationOutput } from '../app/calculate';
import { LocalRepository } from '../app/storage';
import type { SavedEntry } from '../app/storage';
import { Check, Field, FormContext, Input, Select } from './Fields';
import { currency, ResultView } from './ResultView';
import { ShopeeFields } from './ShopeeFields';
import { PrintImport } from './PrintImport';
import './style.css';

const labels: Record<SavedKind, string> = { product: 'Produto', printer: 'Impressora', filament: 'Filamento', production: 'Custos de produção', marketplace: 'Marketplace', simulation: 'Simulação' };

export function App() {
  const [draft, setDraft] = useState(defaultDraft); const [output, setOutput] = useState<CalculationOutput | null>(null);
  const [stale, setStale] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [message, setMessage] = useState(''); const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [tab, setTab] = useState('calculator'); const [saveKind, setSaveKind] = useState<SavedKind>('product'); const [saveName, setSaveName] = useState('');
  const repository = useRef<LocalRepository | null>(null); const worker = useRef<Worker | null>(null); const revision = useRef(0);
  useEffect(() => {
    if (!globalThis.indexedDB) { setMessage('Armazenamento local indisponível. O cálculo permanece utilizável, mas nenhum dado foi salvo.'); return; }
    const repo = new LocalRepository(globalThis.indexedDB); repository.current = repo;
    let active = true;
    repo.list().then(value => { if (active) setEntries(value); }).catch(problem => { if (active) setMessage(String(problem)); });
    return () => { active = false; repository.current = null; void repo.close(); };
  }, []);
  useEffect(() => () => { revision.current++; worker.current?.terminate(); }, []);
  function change(next: CalculatorDraft) {
    revision.current++; worker.current?.terminate(); worker.current = null; setBusy(false);
    setDraft(next); setStale(output !== null); setError('');
  }
  function setField(name: string, value: string | boolean) { change({ ...draft, fields: { ...draft.fields, [name]: value } }); }
  function submit(event: FormEvent) {
    event.preventDefault(); worker.current?.terminate(); const current = ++revision.current; setError(''); setBusy(true);
    try {
      const task = new Worker(new URL('../app/calculation-worker.ts', import.meta.url), { type: 'module' }); worker.current = task;
      task.onmessage = (event: MessageEvent<{ output?: CalculationOutput; error?: string }>) => {
        if (current !== revision.current) return;
        setBusy(false); task.terminate(); worker.current = null;
        if (event.data.output) { setOutput(event.data.output); setStale(false); }
        else { setError(event.data.error ?? 'Não foi possível calcular.'); setStale(output !== null); }
      };
      task.onerror = () => { if (current === revision.current) { setBusy(false); setError('Falha no processamento local.'); setStale(output !== null); } task.terminate(); };
      task.postMessage(draft);
    } catch (problem) { setBusy(false); setError(String(problem)); }
  }
  async function storageAction(action: (repo: LocalRepository) => Promise<void>, success: string) {
    setMessage('');
    try {
      const repo = repository.current; if (!repo) throw new Error('Armazenamento local indisponível. Nada foi salvo.');
      await action(repo); setEntries(await repo.list()); setMessage(success);
    } catch (problem) { setMessage(problem instanceof Error ? problem.message : 'Falha no armazenamento local.'); }
  }
  async function save() {
    const name = (saveName || text(draft, 'productName')).trim();
    if (!name) { setMessage('Informe um nome para salvar.'); return; }
    if (saveKind === 'simulation' && (!output || stale || busy)) { setMessage('Calcule com as entradas atuais antes de salvar a simulação.'); return; }
    const entry: SavedEntry = { id: crypto.randomUUID(), kind: saveKind, name, updatedAt: new Date().toISOString(), draft: structuredClone(draft),
      ...(saveKind === 'simulation' && output ? { snapshot: { input: output.input, catalog: output.catalog } } : {}) };
    await storageAction(repo => repo.save(entry), `${labels[saveKind]} salvo neste dispositivo.`);
  }
  function reopen(entry: SavedEntry) {
    try {
      change(restoreProfile(draft, entry.draft, entry.kind)); setTab('calculator');
      if (entry.snapshot) {
        const manufacturing = entry.snapshot.input.manufacturing;
        setOutput({ ...entry.snapshot, result: calculatePricing(entry.snapshot.input, entry.snapshot.catalog), production: calculateManufacturing(manufacturing, manufacturing.basis === 'batch' ? manufacturing.piecesPerBatch! : 1), expenses: expenseBreakdown(entry.draft), solution: null, comparison: [] }); setStale(false);
        setMessage('Simulação reaberta com o catálogo original salvo. Recalcular usa as regras atuais; buscas e comparações precisam ser executadas novamente.');
      } else setMessage(`${labels[entry.kind]} aplicado. Confira as entradas e calcule.`);
    } catch (problem) { setMessage(String(problem)); }
  }
  async function backup() {
    await storageAction(async repo => {
      const blob = new Blob([await repo.export()], { type: 'application/json' }); const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `fatialucro-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'Backup JSON preparado para salvar localmente.');
  }
  async function importBackup(file: File | undefined) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { setMessage('Backup excede 12 MB.'); return; }
    await storageAction(async repo => { await repo.import(await file.text()); }, 'Backup restaurado. Registros com o mesmo identificador foram atualizados.');
  }
  const materialProfiles = entries.filter(entry => entry.kind === 'filament');
  const profit = output?.result.operatingProfit ?? null;
  let alerts: string[] = [];
  if (output) { try { alerts = financialAlerts(output.result, numeric(text(draft, 'lowMargin'), 'Limite de margem')); } catch { alerts = ['Limite do alerta inválido.']; } }
  return <FormContext value={{ draft, setField }}><main>
    <header><div><span className="eyebrow">Impressão 3D · local e sem conta</span><h1>Fatia<span>Lucro</span></h1></div><span className="version">0.1 · integrada</span></header>
    <nav aria-label="Navegação principal">{[['calculator', 'Calculadora'], ['library', 'Cadastros'], ['history', 'Histórico']].map(([value, label]) => <button type="button" key={value} className={tab === value ? 'active' : 'secondary'} onClick={() => setTab(value!)}>{label}</button>)}</nav>
    {message && <p className="notice" role="status">{message}</p>}
    {tab === 'calculator' ? <div className="workspace"><form onSubmit={submit} noValidate>
      <section><h2><b>1</b> Produto e impressão</h2><Input name="productName" label="Nome do produto" required={false} />
        <p className="muted">Valores iniciais são exemplos editáveis. Confira os custos e as quantidades da sua impressão.</p>
        <PrintImport draft={draft} onApply={change} />
        <ProfileSelect kind="product" entries={entries} onApply={reopen} />
      </section>
      <section><h2><b>2</b> Custo de fabricação</h2>
        <div className="fields"><Select name="basis" label="Peso, tempo e trabalho informados"><option value="batch">Totais do lote / placa</option><option value="unit">Para uma unidade</option></Select>
          {draft.fields.basis === 'batch' && <Input name="pieces" label="Peças produzidas no lote" />}
          <Field name="hours" label={draft.fields.basis === 'batch' ? 'Tempo do lote (horas decimais)' : 'Tempo por unidade (horas decimais)'} decimal />
        </div><p className="muted">O custo do lote é rateado pelas peças produzidas. A quantidade vendida é informada na venda. Confirme se objetos do arquivo representam peças comerciais equivalentes.</p>
        {!draft.materials.length ? <div className="fields"><Field name="grams" label="Filamento consumido (g)" decimal /><Field name="filament" label="Filamento (R$/kg)" /><Input name="materialName" label="Material / filamento" required={false} /><ProfileSelect kind="filament" entries={entries} onApply={reopen} /></div> : <>
          {draft.materials.map((item, index) => <div className="material-row" key={item.id}><strong>{item.name}</strong><div className="fields">
            <label>Massa (g)<input inputMode="decimal" value={item.grams} onChange={event => change({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, grams: event.target.value } : value) })} /></label>
            <label>Preço (R$/kg)<input inputMode="decimal" value={item.pricePerKg} onChange={event => change({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, pricePerKg: event.target.value } : value) })} /></label>
            <label>Aplicar filamento salvo<select value="" onChange={event => { const profile = materialProfiles.find(value => value.id === event.target.value); if (profile) change({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, name: text(profile.draft, 'materialName'), pricePerKg: text(profile.draft, 'filament') } : value) }); }}><option value="">Escolha um perfil</option>{materialProfiles.map(profile => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label>
          </div></div>)}
          <button type="button" className="secondary" onClick={() => { const total = draft.materials.every(item => /^\d+([,.]\d+)?$/.test(item.grams)) ? draft.materials.reduce((sum, item) => sum.plus(item.grams.replace(',', '.')), new D(0)).toFixed() : ''; change({ fields: { ...draft.fields, grams: total, filament: '' }, materials: [] }); }}>Usar um único material com preço manual</button>
        </>}
        <div className="fields"><Select name="machineMode" label="Custo da máquina"><option value="all-in">Completo por hora</option><option value="detailed">Energia + manutenção + depreciação</option></Select><ProfileSelect kind="printer" entries={entries} onApply={reopen} />
          {draft.fields.machineMode === 'all-in' ? <Field name="machine" label="Máquina completa (R$/h)" decimal /> : <><Field name="watts" label="Potência média (W)" decimal /><Field name="kwh" label="Energia (R$/kWh)" decimal /><Field name="maintenance" label="Manutenção (R$/h)" decimal /><Field name="depreciation" label="Depreciação (R$/h)" decimal /></>}
        </div>
        <details><summary>Trabalho, embalagem e reservas</summary><div className="fields"><Field name="laborMinutes" label="Trabalho manual (minutos; mesma base do lote/unidade)" decimal /><Field name="laborHour" label="Mão de obra (R$/h; aceita zero)" /><Field name="consumables" label="Consumíveis (R$/peça)" /><Field name="failure" label="Reserva de falhas e desperdício (R$/peça)" /><Field name="packagingUnit" label="Embalagem (R$/unidade vendida)" /><Field name="packagingOrder" label="Embalagem compartilhada (R$/pedido)" /></div></details>
        <details><summary>Perfil da impressora e depreciação</summary><div className="fields"><Input name="printerName" label="Nome da impressora" required={false} /><Field name="printerPurchase" label="Valor depreciável da máquina (R$)" /><Field name="printerLife" label="Vida útil restante (horas)" decimal /></div><button type="button" className="secondary" onClick={() => { try { setField('depreciation', depreciationPerHour(parseBrazilianMoney(text(draft, 'printerPurchase')), numeric(text(draft, 'printerLife'), 'Vida útil'))); } catch (problem) { setError(String(problem)); } }}>Calcular depreciação por hora</button><p>Aplicada apenas no modo detalhado. O custo completo por hora já deve incluir energia, manutenção e depreciação.</p></details>
        <ProfileSelect kind="production" entries={entries} onApply={reopen} />
      </section>
      <section><h2><b>3</b> Canal e despesas da venda</h2><div className="fields"><Select name="marketplace" label="Onde será vendido?"><option value="direct">Venda direta</option><option value="shopee">Shopee Brasil</option></Select><Input name="date" type="date" label="Data do cenário" /><ProfileSelect kind="marketplace" entries={entries} onApply={reopen} /></div>
        {draft.fields.marketplace === 'shopee' && <ShopeeFields />}
        <details><summary>Desconto, frete e outras despesas</summary><div className="fields"><Field name="discount" label="Desconto total pago pelo vendedor (R$/pedido)" /><Field name="shipping" label="Frete líquido descontado do repasse (R$/pedido)" /><Field name="other" label="Outras despesas / tributos informados (R$/pedido)" /></div><p>Cupons pagos integralmente pela plataforma não são desconto do vendedor. Frete pago fora do repasse entra uma vez em outras despesas.</p>
          {draft.fields.marketplace === 'shopee' && <Check name="shippingConfirmed">Confirmei o frete líquido após subsídios e pagamentos do comprador.</Check>}
          <Check name="advertisingEnabled">Incluir publicidade convencional com custo apurado</Check>{draft.fields.advertisingEnabled === true && <Field name="advertising" label="Publicidade alocada a este pedido (R$)" />}<p>Publicidade informada integra outras despesas operacionais. Evite repetir valores de Ads Fácil ou créditos já incluídos.</p>
        </details>
      </section>
      <section><h2><b>4</b> Preço e objetivo</h2><div className="fields"><Field name="price" label="Preço por unidade (R$)" /><Input name="quantity" label="Unidades vendidas neste pedido" /><Select name="calculation" label="O que calcular?"><option value="direct">Lucro do preço informado</option><option value="profit">Preço para lucro desejado</option><option value="margin">Preço para margem desejada</option><option value="equilibrium">Ponto de equilíbrio</option><option value="compare">Comparar preços</option></Select></div>
        {['profit', 'margin', 'equilibrium'].includes(text(draft, 'calculation')) && <><div className="fields"><Field name="minPrice" label="Menor preço da busca (R$)" /><Field name="maxPrice" label="Maior preço da busca (R$)" />{draft.fields.calculation === 'profit' && <Field name="targetProfit" label="Lucro desejado por pedido (R$)" />}{draft.fields.calculation === 'margin' && <Field name="targetMargin" label="Margem desejada (0,20 = 20%)" decimal />}</div><p>Busca centavo a centavo, limitada a 100 mil preços. Cobranças desconhecidas interrompem a busca; o mínimo só vale no intervalo informado.</p></>}
        {draft.fields.calculation === 'compare' && <Input name="comparison" label="Preços separados por ponto e vírgula (até 20)" />}
        <details><summary>Alerta de margem</summary><Field name="lowMargin" label="Limite de margem baixa (0,10 = 10%)" decimal /></details>
        {error && <p className="notice" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Calculando localmente…' : 'Calcular cenário'}</button>
      </section>
    </form><aside className="result-column"><section className="profit-card"><span>Lucro operacional estimado · pedido</span><strong>{currency(profit)}</strong><p>{stale ? 'Entradas alteradas: recalcule.' : output ? output.result.confidence === 'provisional' ? 'Provisório, sob premissas identificadas' : output.result.status === 'partial' ? 'Complete as pendências para conhecer o lucro' : 'Calculado com as entradas informadas' : 'Preencha os custos e calcule o cenário'}</p>{output && <><p>Fabricação: {currency(output.result.manufacturing.perUnit)}/un. · {currency(output.result.manufacturing.total)} no pedido</p><p>Produção completa informada: {currency(output.production.total)} {output.input.manufacturing.basis === 'batch' ? `para ${output.input.manufacturing.piecesPerBatch} peças` : 'para uma peça'}</p></>}</section>
      {!!alerts.length && <div className="notice">{alerts.map(value => <p key={value}>{value}</p>)}</div>}
      {output && <><ResultView result={output.result} solution={output.solution} stale={stale} catalog={output.catalog} expenses={output.expenses} />{!!output.comparison.length && <section><h2>Comparação de preços</h2>{stale && <p className="notice">Comparação desatualizada. Recalcule.</p>}<div className="table-scroll"><table><thead><tr><th>Preço/un.</th><th>Tarifas calculáveis</th><th>Lucro/pedido</th><th>Situação</th></tr></thead><tbody>{output.comparison.map(row => <tr key={row.unitPrice}><td>{currency(row.unitPrice)}</td><td>{currency(row.result.knownMarketplaceFees)}</td><td>{currency(row.result.operatingProfit)}</td><td>{row.result.confidence === 'indeterminate' ? 'Indeterminado' : row.result.confidence === 'provisional' ? 'Provisório' : 'Calculado'}</td></tr>)}</tbody></table></div></section>}</>}
    </aside></div> : <section><h2>{tab === 'history' ? 'Histórico de simulações' : 'Seus cadastros locais'}</h2><p>Perfis são modelos reutilizáveis. Produtos e simulações reabrem o cenário inteiro. Simulações conservam o catálogo original; nenhum recebimento é confirmado.</p>
      {entries.filter(entry => tab === 'history' ? entry.kind === 'simulation' : entry.kind !== 'simulation').map(entry => <article className="saved-row" key={entry.id}><div><strong>{entry.name}</strong><p>{labels[entry.kind]} · {new Date(entry.updatedAt).toLocaleString('pt-BR')}</p></div><div><button type="button" onClick={() => reopen(entry)}>Abrir</button><button type="button" className="secondary" onClick={() => { void storageAction(repo => repo.remove(entry.id), 'Registro removido.'); }}>Excluir</button></div></article>)}
      {!entries.some(entry => tab === 'history' ? entry.kind === 'simulation' : entry.kind !== 'simulation') && <p>Nenhum registro salvo nesta categoria.</p>}
    </section>}
    <section><h2>Salvar e reutilizar</h2><div className="fields"><label>Salvar entradas atuais como<select value={saveKind} onChange={event => setSaveKind(event.target.value as SavedKind)}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Nome do cadastro<input maxLength={200} value={saveName} onChange={event => setSaveName(event.target.value)} placeholder={text(draft, 'productName') || 'Ex.: PLA branco ou A1 — padrão'} /></label></div>
      {saveKind === 'filament' && <div className="fields"><Input name="materialName" label="Material do perfil de filamento" /><Field name="filament" label="Preço deste perfil (R$/kg)" /></div>}
      <button type="button" onClick={() => { void save(); }}>Salvar localmente</button><p className="muted">Cada salvamento cria um registro. Perfis de filamento usam o material e o preço por kg acima. Falhas de armazenamento são informadas.</p>
      <details><summary>Backup dos dados locais</summary><p>Cadastros ficam neste dispositivo e nesta origem do aplicativo. Exporte antes de limpar dados, trocar de instalação ou desinstalar. O JSON pode conter seus nomes de produtos e custos; guarde-o em local privado.</p><button type="button" className="secondary" onClick={() => { void backup(); }}>Exportar backup JSON</button><label>Restaurar backup (mesmos IDs serão substituídos)<input type="file" accept=".json,application/json" onChange={event => { void importBackup(event.target.files?.[0]); event.target.value = ''; }} /></label></details>
    </section><footer>Dados e arquivos processados localmente. Estimativas antes de custos e tributos não informados. Tarifas desconhecidas permanecem pendentes. Homologação gráfica desta versão ainda não realizada.</footer>
  </main></FormContext>;
}

function ProfileSelect({ kind, entries, onApply }: { kind: SavedKind; entries: SavedEntry[]; onApply: (entry: SavedEntry) => void }) {
  const profiles = entries.filter(entry => entry.kind === kind);
  if (!profiles.length) return null;
  return <label>{labels[kind]} salvo<select value="" onChange={event => { const selected = profiles.find(entry => entry.id === event.target.value); if (selected) onApply(selected); }}><option value="">Aplicar cadastro…</option>{profiles.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>;
}
