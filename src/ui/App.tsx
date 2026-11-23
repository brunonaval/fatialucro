import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { newCalculationDraft, exampleDraft, withExperience, applyProfile, calculationSignature } from '../app/experience';
import { text, validateDraft } from '../app/model';
import type { CalculatorDraft } from '../app/model';
import { LocalRepository } from '../app/storage';
import type { SavedEntry } from '../app/storage';
import { recordsForResult } from '../app/records';
import type { EditingContext } from '../app/records';
import { applyRecurringCosts, validateProfile, workshopDefaults, workshopRecords } from '../app/workshop';
import { applySavedStore, isTheme } from '../app/preferences';
import type { Theme } from '../app/preferences';
import { bundledManifest, bundledPackage, bundledTables } from '../marketplaces/catalogs/bundled';
import { loadTrustedPackage } from '../marketplaces/catalogs/update';
import type { CatalogPackage, ValidatedPackage } from '../marketplaces/catalogs/types';
import { FormContext } from './Fields';
import { ExperienceContext } from './ExperienceContext';
import { PrintImport } from './PrintImport';
import { filamentProfileDraft } from '../app/filament-reuse';
import { PrintStep } from './PrintStep';
import { FilamentFields, OptionalCosts, PackagingFields, PrinterFields } from './CostFields';
import { SaleStep } from './SaleStep';
import { ExperienceResult } from './ExperienceResult';
import { ProductLibrary } from './ProductLibrary';
import { WorkshopWizard } from './WorkshopWizard';
import type { WorkshopProgress } from './WorkshopWizard';
import { CatalogManager } from './CatalogManager';
import { BackupPanel } from './BackupPanel';
import { useAutomaticCalculation } from './useAutomaticCalculation';
import { savedLabels } from './ProfileSelect';
import { FinancialSummary } from './FinancialSummary';
import { StoreSettings } from './StoreSettings';
import { CalculationNavigation, StageActions } from './CalculationNavigation';
import { applyFinalPrice, beginSale, changeScenarioDate } from '../app/ux-v3';
import { guidedIssues } from './guided-validation';
import type { GuidedIssue } from './guided-validation';
import './style.css';

type Page = 'calculate' | 'products' | 'settings';

export function App() {
  const [draft, setDraft] = useState(() => newCalculationDraft()); const current = withExperience(draft); const ux = current.ux;
  const [startGoal, setStartGoal] = useState<'profit' | 'cost' | 'sale'>('profit');
  const [page, setPage] = useState<Page>('calculate'); const [ready, setReady] = useState(false); const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [theme, setTheme] = useState<Theme>('system'); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<CalculatorDraft | null>(null); const [draftStatus, setDraftStatus] = useState(''); const [editing, setEditing] = useState<EditingContext>({}); const [savedKey, setSavedKey] = useState('');
  const [workshop, setWorkshop] = useState<WorkshopProgress | null>(null); const [showWorkshop, setShowWorkshop] = useState(false); const [profileDelete, setProfileDelete] = useState<SavedEntry | null>(null);
  const [catalog, setCatalog] = useState<ValidatedPackage>({ manifest: bundledManifest, tables: bundledTables, package: bundledPackage });
  const repository = useRef<LocalRepository | null>(null); const workingDraft = useRef(draft); workingDraft.current = draft;
  const automatic = useAutomaticCalculation(current, catalog.tables, ready && page === 'calculate' && ux.entry !== 'none');
  const focusTarget = useRef<string | null>(null);
  const realEntries = entries.filter(entry => !entry.deletedAt); const example = ux.entry === 'example';
  const resultKey = `${calculationSignature(current)}|${text(current, 'productName')}`;
  const issues = guidedIssues(current);

  useEffect(() => {
    if (!globalThis.indexedDB) { setNotice('Armazenamento local indisponível. Você pode calcular, mas dados não serão salvos nesta sessão.'); setReady(true); return; }
    const repo = new LocalRepository(globalThis.indexedDB); repository.current = repo; let active = true;
    async function initialize() {
      const values = await Promise.allSettled([repo.list(true), repo.getSetting('theme'), repo.getSetting('catalog-active'), repo.getSetting('draft-v2'), repo.getSetting('workshop-v2'), repo.getSetting('experience-mode')]);
      if (!active) return;
      const [records, appearance, cache, savedDraft, savedWorkshop, mode] = values;
      if (records.status === 'fulfilled') { setEntries(records.value); setDraft(workshopDefaults(newCalculationDraft(), records.value)); }
      else setNotice('Não foi possível ler todos os cadastros. Nenhum registro foi apagado ou substituído.');
      if (appearance.status === 'fulfilled' && isTheme(appearance.value)) setTheme(appearance.value);
      else if (appearance.status === 'rejected') setNotice('A preferência de aparência não pôde ser lida.');
      if (savedDraft.status === 'fulfilled' && savedDraft.value !== null) {
        try { validateDraft(savedDraft.value); if (savedDraft.value.ux?.entry !== 'example') setRecovery(savedDraft.value); } catch { setNotice('O rascunho local não pôde ser validado. Os dados salvos não foram apagados.'); }
      } else if (savedDraft.status === 'rejected') setNotice('Não foi possível ler o rascunho local.');
      if (savedWorkshop.status === 'fulfilled' && savedWorkshop.value !== null) {
        try { const value = savedWorkshop.value as WorkshopProgress; validateDraft(value.draft); if (!Number.isSafeInteger(value.step) || value.step < 0 || value.step > 3) throw new Error(); setWorkshop(value); } catch { setNotice('A configuração da oficina precisa ser conferida; seus produtos continuam preservados.'); }
      } else if (savedWorkshop.status === 'rejected') setNotice('Não foi possível recuperar a etapa da oficina.');
      if (mode.status === 'fulfilled' && (mode.value === 'simple' || mode.value === 'advanced')) setDraft(value => ({ ...value, ux: { ...withExperience(value).ux, mode: mode.value as 'simple' | 'advanced' } }));
      else if (mode.status === 'rejected') setNotice('O modo de exibição não pôde ser recuperado.');
      if (cache.status === 'fulfilled' && cache.value !== null) {
        try { const valid = await loadTrustedPackage(cache.value as CatalogPackage); if (active) setCatalog(valid); } catch { if (active) setNotice('Cache de tarifas inválido. Usando o catálogo incluído no aplicativo, sem modificar históricos.'); }
      } else if (cache.status === 'rejected') setNotice('Cache de tarifas indisponível. O catálogo incluído continua disponível offline.');
      if (active) setReady(true);
    }
    void initialize(); return () => { active = false; repository.current = null; void repo.close().catch(() => {}); };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const id = focusTarget.current ?? (page === 'calculate' && ux.entry !== 'none' ? `${ux.stage}-step` : 'workspace-content'); focusTarget.current = null;
    if (id.startsWith('field:')) {
      const field = id.slice(6);
      const input = [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('[name]')].find(node => node.getAttribute('name') === field);
      if (input) {
        for (let ancestor = input.parentElement; ancestor; ancestor = ancestor.parentElement)
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        input.focus({ preventScroll: false }); input.scrollIntoView({ block: 'center' }); return;
      }
    }
    const node = document.getElementById(id); if (node) { node.setAttribute('tabindex', '-1'); node.focus({ preventScroll: true }); }
  }, [page, ux.stage, ux.entry]);
  useEffect(() => {
    if (!ready || !repository.current || ux.entry === 'none' || example) return;
    let active = true; const repo = repository.current; setDraftStatus('Alterações aguardando salvamento…');
    const timer = setTimeout(() => { void repo.saveSetting('draft-v2', draft).then(() => { if (active) setDraftStatus('Salvo neste dispositivo'); }).catch(() => { if (active) setDraftStatus('Não foi possível salvar o rascunho. Seus dados continuam no formulário.'); }); }, 700);
    return () => { active = false; clearTimeout(timer); };
  }, [draft, ready, ux.entry, example]);

  function update(next: CalculatorDraft) { setDraft(withExperience(next)); }
  function setField(name: string, value: string | boolean) { if (current.fields[name] !== value) update(name === 'date' ? changeScenarioDate(current, String(value)) : { ...current, fields: { ...current.fields, [name]: value } }); }
  function setStage(stage: typeof ux.stage) { update({ ...current, ux: { ...ux, stage } }); }
  function startWithGoal(next: CalculatorDraft) {
    const selected = withExperience(next);
    update({ ...selected, fields: { ...selected.fields, calculation: startGoal === 'profit' ? 'profit' : 'direct',
      ...(startGoal !== 'cost' ? { quantity: text(selected, 'quantity') || '1' } : {}) },
      ux: { ...selected.ux, intent: startGoal === 'cost' ? 'cost' : 'sale', stage: 'print' } });
  }
  function fixIssue(issue: GuidedIssue) {
    focusTarget.current = 'field:' + issue.field;
    if (issue.stage === ux.stage || ux.mode === 'advanced') {
      const input = [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('[name]')].find(node => node.getAttribute('name') === issue.field);
      if (input) {
        for (let ancestor = input.parentElement; ancestor; ancestor = ancestor.parentElement)
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        input.focus(); input.scrollIntoView({ block: 'center' }); focusTarget.current = null;
        return;
      }
    }
    setStage(issue.stage);
  }
  function repo() { if (!repository.current) throw new Error('Armazenamento local indisponível. Nada foi salvo.'); return repository.current; }
  async function refresh() { setEntries(await repo().list(true)); }
  async function mutate(action: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(true); setNotice(''); try { await action(); await refresh(); setNotice(success); return true; } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível salvar os dados.'); return false; } finally { setBusy(false); }
  }
  async function preserveDraft(): Promise<boolean> {
    const value = workingDraft.current;
    if (value.ux?.entry === 'none' || value.ux?.entry === 'example') return true;
    if (!repository.current) return true;
    try { await repository.current.saveSetting('draft-v2', value); setRecovery(value); return true; } catch { setNotice('Não foi possível preservar seu rascunho. O cálculo atual foi mantido.'); return false; }
  }
  async function startNew() {
    if (!await preserveDraft()) return; setStartGoal('profit');
    const fresh = workshopDefaults(newCalculationDraft(), realEntries); update({ ...fresh, ux: { ...withExperience(fresh).ux, mode: ux.mode } }); setEditing({}); setSavedKey(''); setPage('calculate'); setNotice('');
  }
  async function exploreExample() { if (!await preserveDraft()) return; update(exampleDraft()); setEditing({}); setSavedKey(''); setPage('calculate'); setNotice('Exemplo fictício isolado. Nenhum custo da sua oficina foi substituído.'); }
  function useProfile(entry: SavedEntry, stage?: typeof ux.stage) {
    if (!['printer', 'filament', 'production', 'marketplace'].includes(entry.kind)) return;
    try {
    const next = entry.id === 'workshop-production' ? applyRecurringCosts(current, entry.draft) : entry.kind === 'marketplace' ? applySavedStore(current, entry.draft, entry.updatedAt) : applyProfile(current, entry.draft, entry.kind as 'printer' | 'filament' | 'production', entry.name);
    update(stage ? { ...next, ux: { ...withExperience(next).ux, ...(entry.kind === 'marketplace' ? { intent: 'sale' as const } : {}), stage } } : next); setNotice(`${savedLabels[entry.kind]} aplicado somente aos campos correspondentes.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Perfil incompleto; valores atuais preservados.'); }
  }
  async function editRecord(entry: SavedEntry, duplicate: boolean) {
    if (!await preserveDraft()) return;
    const loaded = withExperience(structuredClone(entry.draft)); update({ ...loaded, fields: { ...loaded.fields, productName: duplicate ? `${entry.name} — cópia` : entry.name }, ux: { ...loaded.ux, stage: entry.kind === 'product' ? 'print' : loaded.ux.intent === 'sale' ? 'sale' : 'costs' } });
    const productId = entry.kind === 'product' ? entry.id : entry.productId;
    setEditing(duplicate ? {} : { ...(productId ? { productId } : {}), ...(entry.kind === 'product' ? {} : { parentId: entry.id }) });
    setSavedKey(''); setPage('calculate'); setNotice(`${duplicate ? 'Cópia independente em edição.' : 'Editando uma nova revisão.'} O registro salvo continua intacto; o recálculo usa as tarifas atualmente selecionadas. ${!entry.draft.ux ? 'Confira a origem e os custos deste registro anterior.' : ''}`);
  }
  async function saveProduct() {
    if (example) { setNotice('Demonstração fictícia: comece seu próprio cálculo para salvar.'); return; }
    const name = text(current, 'productName').trim(); if (!name) { setNotice('Informe um nome para guardar o produto.'); setStage('print'); return; }
    const id = editing.productId ?? crypto.randomUUID();
    if (entries.some(entry => entry.id === id && entry.deletedAt)) { setNotice('Este produto está na lixeira. Restaure ou duplique antes de salvar.'); return; }
    if (await mutate(() => repo().save({ id, kind: 'product', name, updatedAt: new Date().toISOString(), draft: structuredClone(current) }), 'Produto salvo. Você pode continuar completando os dados.')) setEditing({ ...editing, productId: id });
  }
  async function saveResult() {
    if (automatic.state.phase !== 'ready' || !automatic.state.output) { setNotice('Aguarde um resultado válido antes de salvar.'); return; }
    try {
      const records = recordsForResult(current, automatic.state.output, entries, editing);
      if (await mutate(() => repo().saveMany(records), 'Produto e simulação salvos. As versões anteriores foram preservadas.')) { setEditing({ productId: records[0]!.id, parentId: records[1]!.id }); setSavedKey(resultKey); }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Confira o nome do produto.'); }
  }
  async function saveShop() {
    if (!['CPF', 'CNPJ'].includes(text(current, 'seller'))) { setNotice('Responda se vende como CPF ou CNPJ antes de salvar a loja.'); return; }
    await mutate(() => repo().save({ id: 'store-shopee', kind: 'marketplace', name: 'Minha loja Shopee', updatedAt: new Date().toISOString(), draft: structuredClone(current) }), 'Respostas permanentes salvas. Frete e volume continuam próprios do cenário.');
  }
  async function saveWorkshop(progress: WorkshopProgress) { await repo().saveSetting('workshop-v2', progress); setWorkshop(progress); }
  async function applyWorkshop(progress: WorkshopProgress) {
    const records = workshopRecords(progress.draft); await repo().saveMany(records); await saveWorkshop(progress); const all = await repo().list(true); setEntries(all);
    update(workshopDefaults(current, all)); setNotice('Custos conhecidos da oficina aplicados. Etapas incompletas continuam no assistente para você retomar.');
  }
  async function saveProfile(value: CalculatorDraft, kind: 'printer' | 'filament') {
    validateProfile(value, kind);
    const name = text(value, kind === 'printer' ? 'printerName' : 'materialName').trim() || (kind === 'printer' ? 'Minha impressora' : 'Meu filamento');
    // A filament profile stores only reusable material data, never the product's
    // quantities, price, customer or marketplace conditions.
    const stored = kind === 'filament' ? filamentProfileDraft(value) : structuredClone(value);
    await repo().save({ id: crypto.randomUUID(), kind, name, updatedAt: new Date().toISOString(), draft: stored });
    await refresh();
  }
  async function applyCatalog(next: ValidatedPackage) { await repo().activateCatalog(next.package); setCatalog(next); setSavedKey(''); }
  function chooseTheme(value: string) { if (!isTheme(value)) return; setTheme(value); if (repository.current) void repository.current.setTheme(value).catch(() => setNotice('Tema aplicado nesta sessão, mas não foi possível salvar a preferência.')); }
  function chooseMode() { const mode = ux.mode === 'simple' ? 'advanced' : 'simple'; update({ ...current, ux: { ...ux, mode } }); if (repository.current) void repository.current.saveSetting('experience-mode', mode).catch(() => setNotice('Modo alterado nesta sessão; preferência não foi salva.')); }
  async function exportBackup() {
    await mutate(async () => { const data = await repo().export(); const url = URL.createObjectURL(new Blob([data], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `fatialucro-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, 'Backup local preparado. Guarde-o em um lugar privado.');
  }
  function resolvePending(target: string) {
    focusTarget.current = target;
    if (ux.stage === 'sale') { document.getElementById(target)?.focus(); focusTarget.current = null; }
    else update({ ...current, ux: { ...ux, intent: 'sale', stage: 'sale' } });
  }
  async function saveStoreDraft(value: CalculatorDraft) {
    if (!['CPF', 'CNPJ'].includes(text(value, 'seller'))) throw new Error('Informe CPF ou CNPJ antes de salvar a loja.');
    if (!await mutate(() => repo().save({ id: 'store-shopee', kind: 'marketplace', name: 'Minha loja Shopee', updatedAt: new Date().toISOString(), draft: structuredClone(value) }), 'Minha loja Shopee salva. Frete, volume e condições temporárias continuam próprios do cenário.')) throw new Error('Não foi possível salvar a loja.');
  }
  function submit(event: FormEvent) { event.preventDefault(); automatic.runNow(); setStage('result'); }
  const show = (stage: typeof ux.stage) => ux.mode === 'advanced' || ux.stage === stage;
  return <FormContext value={{ draft: current, setField }}><ExperienceContext value={{ draft: current, update, financial: automatic.state }}><main className="experience-app" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setNotice("Solte o arquivo na área de importação ou use Selecionar arquivo."); }}>
    <a className="skip-link" href="#workspace-content">Pular para o conteúdo</a>
    <header className="app-header"><div><h1>Fatia<span>Lucro</span></h1><p>Saiba quanto custa imprimir e quanto sobra na venda</p></div><button type="button" className="text-button" onClick={() => { void startNew(); }} disabled={!ready}>Nova impressão</button></header>
    <nav aria-label="Navegação principal">{([['calculate', 'Calcular'], ['products', 'Meus produtos'], ['settings', 'Configurações']] as const).map(([value, label]) => <button type="button" key={value} aria-current={page === value ? 'page' : undefined} className={page === value ? 'active' : 'secondary'} onClick={() => setPage(value)}>{label}</button>)}</nav>
    <div id="workspace-content" tabIndex={-1}>
      {notice && <p className="message" role="status">{notice}</p>}{!ready && <p className="empty-state" role="status">Carregando seus dados locais…</p>}
      {page === 'calculate' ? <>
        {ux.entry === 'none' ? <section className="welcome"><span className="step-label">Comece pela sua impressão</span><h2>Descubra o custo ou o preço sem formulários complicados.</h2><p>Escolha seu objetivo e importe o arquivo fatiado. Você pode calcular só o filamento sem configurar uma oficina.</p>
          <fieldset className="quick-goals"><legend>O que você deseja descobrir?</legend>
            <label><input type="radio" name="start-goal" checked={startGoal === 'profit'} onChange={() => setStartGoal('profit')} />Quanto devo cobrar?</label>
            <label><input type="radio" name="start-goal" checked={startGoal === 'cost'} onChange={() => setStartGoal('cost')} />Quanto custa imprimir?</label>
            <label><input type="radio" name="start-goal" checked={startGoal === 'sale'} onChange={() => setStartGoal('sale')} />Já tenho um preço: quanto vou lucrar?</label>
          </fieldset>
          <PrintImport primary disabled={!ready} filaments={realEntries} draft={current} onApply={startWithGoal} />
          <div className="start-alternatives"><button type="button" className="secondary" disabled={!ready} onClick={() => startWithGoal({ ...current, ux: { ...ux, entry: 'manual', stage: 'print' } })}>Preencher manualmente — peso e tempo</button><button type="button" className="text-button" disabled={!ready} onClick={() => { void exploreExample(); }}>Experimentar com um exemplo fictício</button></div>
          {recovery && <div className="recovery-card"><h3>Há um rascunho neste dispositivo</h3><p>{text(recovery, 'productName') || 'Impressão sem nome'} · a data e as entradas serão preservadas.</p><button type="button" className="secondary" onClick={() => { update(withExperience(recovery)); setRecovery(null); setEditing({}); setSavedKey(''); }}>Continuar de onde parei</button></div>}
          <button type="button" className="text-button" onClick={() => { setPage('settings'); setShowWorkshop(true); }}>Configurar minha oficina (opcional)</button>
        </section> : <>
          {example && <div className="example-banner"><strong>Exemplo fictício</strong><span>Não são os custos da sua oficina. Não será salvo como dado real.</span><button type="button" className="secondary" onClick={() => { void startNew(); }}>Começar com meus dados</button></div>}
          <div className="workspace-toolbar"><span className="draft-status" role="status">{example ? 'Demonstração isolada' : draftStatus || 'Seus dados ficam neste dispositivo'}</span><details className="workspace-options"><summary>Opções do cálculo</summary><button type="button" className="text-button" aria-pressed={ux.mode === 'advanced'} onClick={chooseMode}>{ux.mode === 'simple' ? 'Abrir modo avançado' : 'Voltar ao modo simples'}</button>{!example && <button type="button" className="text-button" disabled={busy} onClick={() => { void saveProduct(); }}>Guardar produto sem esperar o cálculo</button>}</details></div>
          <div className="calculation-layout"><div className="calculation-content">
          <CalculationNavigation ux={ux} onStage={setStage} />
          <form onSubmit={submit} noValidate>
            {show('print') && <PrintStep filaments={realEntries} />}
            {show('costs') && <section id="costs-step"><div className="section-heading"><span className="step-label">Custos</span><h2>Quanto custa fabricar esta peça?</h2><p>Para começar, informe somente o preço do filamento. Energia, máquina e trabalho são opcionais.</p></div><FilamentFields entries={realEntries} onProfile={useProfile} onSave={value => saveProfile(value, 'filament')} />{ux.machineIncluded ? <PrinterFields entries={realEntries} onProfile={useProfile} /> : <details className="optional-costs"><summary>Incluir energia e custo da impressora (opcional)</summary><PrinterFields entries={realEntries} onProfile={useProfile} /></details>}{ux.intent === 'cost' && <details><summary>Incluir embalagem (opcional)</summary><PackagingFields /></details>}<OptionalCosts /></section>}
            {ux.intent === 'sale' && show('sale') && <SaleStep tables={catalog.tables} onSaveShop={() => { void saveShop(); }} />}
            {show('result') && <ExperienceResult tables={catalog.tables} state={automatic.state} issues={issues} onFix={fixIssue} onConfirm={() => setStage('sale')} onResolve={resolvePending} onSell={() => update(beginSale(current))} onAdjustPrice={price => update(applyFinalPrice(current, price))} onSave={() => { void saveResult(); }} onRetry={automatic.runNow} saved={savedKey === resultKey} />}
            <StageActions ux={ux} onStage={setStage} />
          </form></div><FinancialSummary draft={current} state={automatic.state} issues={issues} onFix={fixIssue} onResolve={resolvePending} onRetry={automatic.runNow} /></div>
          <p className="automatic-note">Atualizamos os cálculos automaticamente. Custos opcionais ficam recolhidos; caso falte algo, use Corrigir no resumo.</p>
        </>}
      </> : page === 'products' ? <ProductLibrary entries={entries} busy={busy} onNew={() => { void startNew(); }} onEdit={(entry, duplicate) => { void editRecord(entry, duplicate); }} onTrash={entry => mutate(() => repo().trash(entry.id), 'Registro movido para a lixeira. Você pode restaurá-lo em Meus produtos.')} onRestore={entry => mutate(() => repo().restore(entry.id), 'Registro restaurado com seus dados e regras originais.')} /> : <div className="settings-area">
        <section><h2>Aparência e modo de uso</h2><label>Aparência<select value={theme} onChange={event => chooseTheme(event.target.value)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label><button type="button" className="secondary" aria-pressed={ux.mode === 'advanced'} onClick={chooseMode}>{ux.mode === 'simple' ? 'Abrir modo avançado' : 'Voltar ao modo simples'}</button><p>Os dois modos usam os mesmos dados e cálculos. O simples mostra uma decisão por vez.</p></section>
        <StoreSettings saved={realEntries.find(entry => entry.id === 'store-shopee')} tables={catalog.tables} onSave={saveStoreDraft} />
        <section><span className="step-label">Configurações</span><h2>Organize sua oficina no seu ritmo</h2><p>Esses cadastros são reutilizáveis. Nenhuma etapa é obrigatória para começar um cálculo.</p><button type="button" onClick={() => setShowWorkshop(!showWorkshop)}>{showWorkshop ? 'Recolher assistente' : workshop ? 'Retomar configuração da oficina' : 'Configurar minha oficina'}</button></section>
        {showWorkshop && <WorkshopWizard initial={workshop} tables={catalog.tables} onSave={saveWorkshop} onApply={applyWorkshop} onProfile={saveProfile} />}
        <section><h2>Impressoras, filamentos e custos salvos</h2>{!realEntries.some(entry => ['printer', 'filament', 'production', 'marketplace'].includes(entry.kind)) && <div className="empty-state"><p>Ainda não há perfis. Você pode criá-los no assistente e continuar calculando sem terminar todas as etapas.</p></div>}{realEntries.filter(entry => ['printer', 'filament', 'production', 'marketplace'].includes(entry.kind)).map(entry => <article className="saved-row" key={entry.id}><div><strong>{entry.name}</strong><p>{savedLabels[entry.kind]}</p></div><div><button type="button" className="secondary" onClick={() => { useProfile(entry, ux.entry === 'none' ? undefined : entry.kind === 'marketplace' ? 'sale' : 'costs'); setPage('calculate'); }}>Usar no cálculo</button><button type="button" className="text-button" onClick={() => setProfileDelete(entry)}>Mover para lixeira…</button></div></article>)}{profileDelete && <div className="confirm-inline" role="alert"><p>Mover “{profileDelete.name}” para a lixeira? As simulações salvas conservam seus próprios custos.</p><button type="button" disabled={busy} onClick={async () => { if (await mutate(() => repo().trash(profileDelete.id), 'Perfil movido para a lixeira; pode ser restaurado em Meus produtos.')) setProfileDelete(null); }}>Confirmar</button><button type="button" className="secondary" onClick={() => setProfileDelete(null)}>Cancelar</button></div>}</section>
        <section><h2>Ajuda rápida</h2><p>Importe uma placa fatiada ou preencha peso e tempo, informe o filamento e escolha os custos. Venda é opcional. Dados e arquivos permanecem locais; a consulta de tarifas só ocorre quando você solicita.</p><p>Exporte um backup antes de trocar instalação ou limpar dados. O backup inclui produtos, perfis e cálculos salvos, mas não o rascunho e as preferências.</p></section>
        <CatalogManager active={catalog} onApply={applyCatalog} /><BackupPanel busy={busy} onExport={() => { void exportBackup(); }} onImport={data => mutate(() => repo().import(data), 'Backup restaurado. Conflitos foram preservados como cópias, sem sobrescrever históricos.')} />
      </div>}
    </div><footer>FatiaLucro · gratuito e local. Estimativas baseadas nos custos e nas condições informadas. Sem conta ou telemetria obrigatória. Consulta de tarifas somente quando você solicitar.</footer>
  </main></ExperienceContext></FormContext>;
}
