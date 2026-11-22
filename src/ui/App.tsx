import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { calculateManufacturing, calculatePricing, financialAlerts } from '../engine';
import { defaultDraft, expenseBreakdown, numeric, restoreProfile, text } from '../app/model';
import type { CalculatorDraft, SavedKind } from '../app/model';
import type { CalculationOutput } from '../app/calculate';
import { LocalRepository } from '../app/storage';
import type { SavedEntry } from '../app/storage';
import { Check, Field, FormContext, Input, Select } from './Fields';
import { currency, ResultView } from './ResultView';
import { ShopeeFields } from './ShopeeFields';
import { PrintImport } from './PrintImport';
import { bundledManifest, bundledPackage, bundledTables } from '../marketplaces/catalogs/bundled';
import { loadTrustedPackage } from '../marketplaces/catalogs/update';
import { catalogIndicator } from '../marketplaces/catalogs/select';
import type { CatalogPackage, ValidatedPackage } from '../marketplaces/catalogs/types';
import { applySavedStore, isTheme } from '../app/preferences';
import type { Theme } from '../app/preferences';
import { CatalogManager } from './CatalogManager';
import { FinancialSummary } from './FinancialSummary';
import { ProductionFields } from './ProductionFields';
import { PriceFields } from './PriceFields';
import { ProfileSelect, savedLabels as labels } from './ProfileSelect';
import './style.css';


export function App() {
  const [draft, setDraft] = useState(() => defaultDraft()); const [output, setOutput] = useState<CalculationOutput | null>(null);
  const [stale, setStale] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [theme, setTheme] = useState<Theme>('system'); const [ready, setReady] = useState(false);
  const [activeCatalog, setActiveCatalog] = useState<ValidatedPackage>({ manifest: bundledManifest, tables: bundledTables, package: bundledPackage });
  const [message, setMessage] = useState(''); const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [tab, setTab] = useState('calculator'); const [saveKind, setSaveKind] = useState<SavedKind>('product'); const [saveName, setSaveName] = useState('');
  const repository = useRef<LocalRepository | null>(null); const worker = useRef<Worker | null>(null); const revision = useRef(0);
  useEffect(() => {
    if (!globalThis.indexedDB) { setMessage('Armazenamento local indisponível. Cálculo disponível, sem salvar dados ou preferências.'); setReady(true); return; }
    const repo = new LocalRepository(globalThis.indexedDB); repository.current = repo;
    let active = true;
    async function initialize() {
      const results = await Promise.allSettled([repo.list(), repo.getSetting('theme'), repo.getSetting('catalog-active')]);
      if (!active) return;
      const [list, preference, cache] = results;
      if (list.status === 'fulfilled') {
        setEntries(list.value); const shop = list.value.find(entry => entry.id === 'store-shopee');
        if (shop) setDraft(current => applySavedStore(current, shop.draft, shop.updatedAt));
      } else setMessage('Não foi possível ler os cadastros locais. Nenhum dado foi substituído.');
      if (preference.status === 'fulfilled' && isTheme(preference.value)) setTheme(preference.value);
      else if (preference.status === 'rejected') setMessage('Não foi possível ler as preferências de aparência.');
      if (cache.status === 'fulfilled' && cache.value !== null) {
        try { const checked = await loadTrustedPackage(cache.value as CatalogPackage); if (active) setActiveCatalog(checked); }
        catch { if (active) setMessage('Cache de tarifas inválido ou regressivo. Usando o catálogo incluído no aplicativo, sem apagar históricos.'); }
      } else if (cache.status === 'rejected') setMessage('Cache indisponível. Usando o catálogo incluído no aplicativo.');
      if (active) setReady(true);
    }
    void initialize();
    return () => { active = false; repository.current = null; void repo.close(); };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => () => { revision.current++; worker.current?.terminate(); }, []);
  function change(next: CalculatorDraft) {
    revision.current++; worker.current?.terminate(); worker.current = null; setBusy(false);
    setDraft(next); setStale(output !== null); setError('');
  }
  function setField(name: string, value: string | boolean) { if (draft.fields[name] !== value) change({ ...draft, fields: { ...draft.fields, [name]: value } }); }
  function submit(event: FormEvent) {
    event.preventDefault(); if (!ready) { setError('Carregando seus dados locais. Aguarde um instante.'); return; } worker.current?.terminate(); const current = ++revision.current; setError(''); setBusy(true);
    try {
      const task = new Worker(new URL('../app/calculation-worker.ts', import.meta.url), { type: 'module' }); worker.current = task;
      task.onmessage = (event: MessageEvent<{ output?: CalculationOutput; error?: string }>) => {
        if (current !== revision.current) return;
        setBusy(false); task.terminate(); worker.current = null;
        if (event.data.output) { setOutput(event.data.output); setStale(false); }
        else { setError(event.data.error ?? 'Não foi possível calcular.'); setStale(output !== null); }
      };
      task.onerror = () => { if (current === revision.current) { setBusy(false); setError('Falha no processamento local.'); setStale(output !== null); } task.terminate(); };
      task.postMessage({ draft, tables: activeCatalog.tables });
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
  const shop = entries.find(entry => entry.id === 'store-shopee');
  let tariffStatus: ReturnType<typeof catalogIndicator>;
  try { tariffStatus = catalogIndicator(text(draft, 'date'), activeCatalog.tables); }
  catch { tariffStatus = { title: 'Confira a data do cenário', detail: 'Informe uma data válida para selecionar a tabela.', tone: 'warning' }; }
  async function saveStore() {
    if (!['CPF', 'CNPJ'].includes(text(draft, 'seller'))) { setMessage('Selecione CPF ou CNPJ antes de salvar a loja.'); return; }
    await storageAction(repo => repo.save({ id: 'store-shopee', kind: 'marketplace', name: 'Minha loja Shopee', updatedAt: new Date().toISOString(), draft: structuredClone(draft) }), 'Loja salva. Cadastro, adesões e convenções serão reutilizados; volume e frete continuam próprios de cada cenário.');
  }
  function newScenario() {
    const initial = defaultDraft(); change(shop ? applySavedStore(initial, shop.draft, shop.updatedAt) : initial); setOutput(null); setStale(false); setTab('calculator'); setMessage('Novo cenário com a data local de hoje.');
  }
  async function applyCatalog(next: ValidatedPackage) {
    if (!repository.current) throw new Error('Armazenamento local indisponível. O catálogo não foi aplicado.');
    await repository.current.activateCatalog(next.package); setActiveCatalog(next); revision.current++; worker.current?.terminate(); setBusy(false); setStale(true);
  }
  function chooseTheme(value: string) {
    if (!isTheme(value)) return; setTheme(value);
    if (!repository.current) { setMessage('Tema aplicado nesta sessão; armazenamento indisponível.'); return; }
    void repository.current.setTheme(value).catch(problem => setMessage(String(problem)));
  }
  let alerts: string[] = [];
  if (output) { try { alerts = financialAlerts(output.result, numeric(text(draft, 'lowMargin'), 'Limite de margem')); } catch { alerts = ['Limite do alerta inválido.']; } }
  return <FormContext value={{ draft, setField }}><main>
    <a className="skip-link" href="#workspace-content">Pular para o conteúdo</a>
    <header><div><span className="eyebrow">Da impressão ao preço, com clareza</span><h1>Fatia<span>Lucro</span></h1></div><div className="header-actions"><label className="theme-picker">Aparência<select value={theme} onChange={event => chooseTheme(event.target.value)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label><button type="button" className="secondary" onClick={newScenario}>Novo cenário</button></div></header>
    <nav aria-label="Navegação principal">{[['calculator', 'Calculadora'], ['library', 'Cadastros'], ['history', 'Histórico'], ['settings', 'Loja e tarifas']].map(([value, label]) => <button type="button" key={value} aria-current={tab === value ? 'page' : undefined} className={tab === value ? 'active' : 'secondary'} onClick={() => setTab(value!)}>{label}</button>)}</nav>
    <div id="workspace-content" tabIndex={-1}>
    {!ready && <p role="status" className="empty-state">Carregando seus dados locais…</p>}
    {message && <p className="message" role="status">{message}</p>}
    {tab === 'calculator' ? <div className="workspace"><form onSubmit={submit} noValidate>
      <section><h2><b aria-hidden="true">1</b> Produto e impressão</h2><Input name="productName" label="Nome do produto" required={false} />
        <p className="muted">Valores iniciais são exemplos editáveis. Confira os custos e as quantidades da sua impressão.</p>
        <PrintImport draft={draft} onApply={change} />
        <ProfileSelect kind="product" entries={entries} onApply={reopen} />
      </section>
      <ProductionFields entries={entries} change={change} reopen={reopen} onError={setError} />
      <section id="marketplace"><h2><b aria-hidden="true">3</b> Canal e despesas da venda</h2><div className="fields"><Select name="marketplace" label="Onde será vendido?"><option value="direct">Venda direta</option><option value="shopee">Shopee Brasil</option></Select><Input name="date" type="date" label="Data do cenário" /><ProfileSelect kind="marketplace" entries={entries} onApply={reopen} /></div>
        {draft.fields.marketplace === 'shopee' && <>
          <div className="store-strip"><div><strong>{text(draft, 'seller') ? `Loja ${text(draft, 'seller')}` : 'Configure sua loja uma vez'}</strong><p>{shop ? `Preferências salvas em ${new Date(shop.updatedAt).toLocaleDateString('pt-BR')}. Confira mudanças de adesão.` : 'CPF/CNPJ e adesões ainda não foram salvos.'}</p></div><button type="button" className="secondary" onClick={() => setTab('settings')}>Configurar loja</button></div>
          <div className={`tariff-status ${tariffStatus.tone}`} role="status"><strong>{tariffStatus.title}</strong><p>{tariffStatus.detail}</p></div>
          <div className="fields">{draft.fields.seller === 'CPF' && <Input name="orders" label="Pedidos nos últimos 90 dias (vazio = desconhecido)" required={false} />}<Field name="shipping" label="Frete líquido debitado do repasse (R$/pedido)" /></div>
          <Check name="shippingConfirmed">Conferi o frete líquido deste pedido, após subsídios e pagamentos do comprador.</Check>
          <details><summary>Exceções e personalizações deste cenário</summary><ShopeeFields /></details>
        </>}
        <details><summary>Desconto, frete e outras despesas</summary><div className="fields"><Field name="discount" label="Desconto total pago pelo vendedor (R$/pedido)" />{draft.fields.marketplace === 'direct' && <Field name="shipping" label="Frete descontado do recebimento (R$/pedido)" />}<Field name="other" label="Outras despesas / tributos informados (R$/pedido)" /></div><p>Cupons pagos integralmente pela plataforma não são desconto do vendedor. Frete pago fora do repasse entra uma vez em outras despesas.</p>
          <Check name="advertisingEnabled">Incluir publicidade convencional com custo apurado</Check>{draft.fields.advertisingEnabled === true && <Field name="advertising" label="Publicidade alocada a este pedido (R$)" />}<p>Publicidade informada integra outras despesas operacionais. Evite repetir valores de Ads Fácil ou créditos já incluídos.</p>
        </details>
      </section>
      <PriceFields error={error} busy={busy || !ready} />
    </form><aside className="result-column"><FinancialSummary output={output} stale={stale} busy={busy} />
      {!!alerts.length && <div className="notice">{alerts.map(value => <p key={value}>{value}</p>)}</div>}
      {output && <><details className="financial-details"><summary>Demonstrativo completo, tarifas e fontes</summary><ResultView result={output.result} solution={output.solution} stale={stale} catalog={output.catalog} expenses={output.expenses} /></details>{!!output.comparison.length && <section><h2>Comparação de preços</h2>{stale && <p className="notice">Comparação desatualizada. Recalcule.</p>}<div className="table-scroll"><table><thead><tr><th>Preço/un.</th><th>Tarifas calculáveis</th><th>Lucro/pedido</th><th>Situação</th></tr></thead><tbody>{output.comparison.map(row => <tr key={row.unitPrice}><td>{currency(row.unitPrice)}</td><td>{currency(row.result.knownMarketplaceFees)}</td><td>{currency(row.result.operatingProfit)}</td><td>{row.result.confidence === 'indeterminate' ? 'Indeterminado' : row.result.confidence === 'provisional' ? 'Provisório' : 'Calculado'}</td></tr>)}</tbody></table></div></section>}</>}
    </aside></div> : tab === 'settings' ? <>
      <section><h2>Sua loja Shopee</h2><p>Salve CPF/CNPJ, adesões e convenções uma vez. Essas escolhas representam sua loja; não alteram programas na plataforma. Dados de frete e volume precisam corresponder ao cenário.</p>
        <ShopeeFields /><button type="button" onClick={() => { void saveStore(); }}>Salvar configuração da loja</button>
        {shop && <p className="muted">Configuração salva em {new Date(shop.updatedAt).toLocaleString('pt-BR')}.</p>}
      </section><CatalogManager active={activeCatalog} onApply={applyCatalog} />
    </> : <section><h2>{tab === 'history' ? 'Histórico de simulações' : 'Seus cadastros locais'}</h2><p>Perfis são modelos reutilizáveis. Produtos e simulações reabrem o cenário inteiro. Simulações conservam o catálogo original; nenhum recebimento é confirmado.</p>
      {entries.filter(entry => tab === 'history' ? entry.kind === 'simulation' : entry.kind !== 'simulation').map(entry => <article className="saved-row" key={entry.id}><div><strong>{entry.name}</strong><p>{labels[entry.kind]} · {new Date(entry.updatedAt).toLocaleString('pt-BR')}</p></div><div><button type="button" onClick={() => reopen(entry)}>Abrir</button><button type="button" className="secondary" onClick={() => { void storageAction(repo => repo.remove(entry.id), 'Registro removido.'); }}>Excluir</button></div></article>)}
      {!entries.some(entry => tab === 'history' ? entry.kind === 'simulation' : entry.kind !== 'simulation') && <p>Nenhum registro salvo nesta categoria.</p>}
    </section>}
    <details className="save-panel" open={tab === 'library'}><summary>Salvar produto, perfil ou simulação</summary><div className="fields"><label>Salvar entradas atuais como<select value={saveKind} onChange={event => setSaveKind(event.target.value as SavedKind)}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Nome do cadastro<input maxLength={200} value={saveName} onChange={event => setSaveName(event.target.value)} placeholder={text(draft, 'productName') || 'Ex.: PLA branco ou A1 — padrão'} /></label></div>
      {saveKind === 'filament' && <div className="fields"><Input name="materialName" label="Material do perfil de filamento" /><Field name="filament" label="Preço deste perfil (R$/kg)" /></div>}
      <button type="button" onClick={() => { void save(); }}>Salvar localmente</button><p className="muted">Cada salvamento cria um registro. Perfis de filamento usam o material e o preço por kg acima. Falhas de armazenamento são informadas.</p>
      <details><summary>Backup dos dados locais</summary><p>Cadastros ficam neste dispositivo e nesta origem do aplicativo. Exporte antes de limpar dados, trocar de instalação ou desinstalar. O JSON pode conter seus nomes de produtos e custos; guarde-o em local privado.</p><button type="button" className="secondary" onClick={() => { void backup(); }}>Exportar backup JSON</button><label>Restaurar backup (mesmos IDs serão substituídos)<input type="file" accept=".json,application/json" onChange={event => { void importBackup(event.target.files?.[0]); event.target.value = ''; }} /></label></details>
    </details></div><footer>Dados e arquivos processados localmente. Estimativas antes de custos e tributos não informados. Tarifas desconhecidas permanecem pendentes. Homologação gráfica desta versão ainda não realizada.</footer>
  </main></FormContext>;
}
