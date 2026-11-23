import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { IDBFactory } from 'fake-indexeddb';
import { strToU8, zipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { acceptHypotheses, applyFinalPrice, beginSale, calculationStages, changeScenarioDate, costExclusions, declarePrograms, profileSource } from '../src/app/ux-v3';
import { calculateExperience, applyImportedPlate, applyProfile, newCalculationDraft, withExperience } from '../src/app/experience';
import { calculateCostPreview } from '../src/app/cost-preview';
import { applySavedStore } from '../src/app/preferences';
import { LocalRepository, decodeBackup } from '../src/app/storage';
import type { SavedEntry } from '../src/app/storage';
import { recordsForResult, frozenResult } from '../src/app/records';
import { bundledTables } from '../src/marketplaces/catalogs/bundled';
import { importPrintFile } from '../src/importers';
import { FormContext, NumericInput } from '../src/ui/Fields';
import { ExperienceContext } from '../src/ui/ExperienceContext';
import { FinancialSummary } from '../src/ui/FinancialSummary';
import { ExperienceResult } from '../src/ui/ExperienceResult';
import { CalculationNavigation, StageActions } from '../src/ui/CalculationNavigation';
import { ShopQuestions } from '../src/ui/ShopQuestions';
import { SimulationReview } from '../src/ui/SimulationReview';
import { StoreSettings } from '../src/ui/StoreSettings';
import { SaleStep } from '../src/ui/SaleStep';
import { FilamentFields, PackagingFields, PrinterFields } from '../src/ui/CostFields';
import { currentFinancialState } from '../src/ui/useAutomaticCalculation';
import { App } from '../src/ui/App';
import { normalizeNumeric, numericIssue } from '../src/ui/format';
import { realDraft, cpfDraft } from './ux-helpers';

function html(draft: ReturnType<typeof newCalculationDraft>, content: ReactNode) {
  return renderToStaticMarkup(<FormContext value={{ draft, setField: () => {} }}><ExperienceContext value={{ draft, update: () => {} }}>{content}</ExperienceContext></FormContext>);
}
function ready(draft: ReturnType<typeof newCalculationDraft>) { return { signature: 'test', phase: 'ready' as const, output: calculateExperience(draft), preview: calculateCostPreview(draft) }; }
const repositories: LocalRepository[] = [];
afterEach(async () => { await Promise.all(repositories.splice(0).map(repository => repository.close())); });

describe('UX V3 — A a F: primeiro custo compreendido', () => {
  it('A: abertura traz importação, preenchimento manual e exemplo sem preços ou configurações obrigatórias', () => {
    const markup = renderToStaticMarkup(<App />);
    for (const label of ['Comece pela sua impressão', 'Importar impressão', 'Preencher manualmente', 'Experimentar com um exemplo', 'Configurar minha oficina (opcional)']) expect(markup).toContain(label);
    expect(markup).not.toContain('R$ 19,90'); expect(markup).not.toContain('name="machine"'); expect(markup).not.toContain('HALF_UP');
  });
  it('B: 22,31g, 1h02 e bobina bastam para material; não solicita loja, salário ou máquina', () => {
    const draft = newCalculationDraft(); draft.ux!.entry = 'manual'; draft.fields.grams = '22.31'; draft.fields.hours = normalizeNumeric('1:02', 'duration'); draft.ux!.filament = { mode: 'spool', amount: '120', netGrams: '1000' };
    const output = calculateExperience(draft); expect(output.kind).toBe('cost'); expect(output.kind === 'cost' && output.cost.total).toBe('2.68');
    const markup = html(draft, <ExperienceResult frozen={output} />); expect(markup).toContain('Máquina/energia não incluídas'); expect(markup).not.toContain('<dt>Lucro');
  });
  it('C: etapas e ação de custos pulam Venda; optar por venda preserva impressão e custos', () => {
    const draft = realDraft(); draft.ux!.stage = 'costs';
    expect(calculationStages(draft.ux!)).toEqual(['print', 'costs', 'result']);
    const nav = renderToStaticMarkup(<CalculationNavigation ux={draft.ux!} onStage={() => {}} />); expect(nav).not.toContain('Venda');
    const actions = renderToStaticMarkup(<StageActions ux={draft.ux!} onStage={() => {}} />); expect(actions).toContain('Ver custo da impressão'); expect(actions).not.toContain('Continuar para venda');
    const sell = beginSale(draft); expect(sell.fields).toEqual(draft.fields); expect(sell.ux).toMatchObject({ intent: 'sale', stage: 'sale' }); expect(calculationStages(sell.ux!)).toContain('sale');
  });
  it('D: excluir máquina ignora custos antigos e a interface explica a exclusão', () => {
    const draft = realDraft(); draft.ux!.machineIncluded = false; draft.fields.machine = '999'; draft.fields.kwh = '888';
    expect(calculateCostPreview(draft)).toMatchObject({ total: '10.00', perPiece: '2.00' });
    expect(costExclusions(draft)).toContain('Máquina/energia não incluídas');
    expect(html(draft, <PrinterFields entries={[]} onProfile={() => {}} />)).not.toContain('name="machine"');
  });
  it('E: perfil válido altera somente seu escopo e registra origem; perfil vazio não apaga custo válido', () => {
    const draft = cpfDraft(); const profile = realDraft(); profile.fields.machine = '3';
    const result = applyProfile(draft, profile, 'printer', 'Minha A1');
    for (const field of ['grams', 'hours', 'pieces', 'quantity', 'price', 'seller', 'date', 'shipping']) expect(result.fields[field]).toBe(draft.fields[field]);
    expect(profileSource(result, 'printer')).toBe('Perfil: Minha A1'); result.fields.machine = '4'; expect(profileSource(result, 'printer')).toContain('Editado por você');
    expect(() => applyProfile(draft, newCalculationDraft(), 'filament')).toThrow(); expect(() => applyProfile(draft, newCalculationDraft(), 'printer')).toThrow(); expect(draft.fields.machine).toBe('2');
  });
  it('F: pacote de envelopes usa quantidade comercial e adicional por pedido uma vez', () => {
    const draft = cpfDraft(); draft.ux!.saleUnit = 'kit'; draft.ux!.partsPerKit = '2'; draft.ux!.packagingIncluded = true; draft.ux!.packagingDecision = 'include'; draft.ux!.packaging = { mode: 'pack', amount: '35.90', units: '100' }; draft.fields.packagingOrder = '1.00';
    const output = calculateExperience(draft); if (output.kind !== 'sale') throw new Error();
    expect(output.data.result.packaging).toBe('1.72'); expect(output.data.result.manufacturing.total).toBe('16.00');
    const markup = html(draft, <PackagingFields />); expect(markup).toContain('Embalagem'); expect(markup).toContain('diferente do frete'); expect(markup).toContain('name="packagingOrder"');
  });
  it('resumo preserva material calculável quando a máquina selecionada ainda está sem custo', () => {
    const draft = realDraft(); draft.fields.machine = ''; const preview = calculateCostPreview(draft);
    expect(preview).toMatchObject({ known: '10.00', total: null, perPiece: null }); expect(preview.lines.find(line => line.id === 'machine')?.amount).toBeNull();
    const markup = renderToStaticMarkup(<FinancialSummary draft={draft} state={{ signature: 'incomplete', phase: 'invalid', error: 'Informe a máquina', preview }} />);
    expect(markup).toContain('Subtotal dos custos já conhecidos'); expect(markup).toContain('R$ 10,00'); expect(markup).toContain('Falta informar');
  });
  it('uma seleção opcional de material excluído não exige preencher sua bobina vazia', () => {
    const draft = newCalculationDraft(); draft.ux!.entry = 'manual'; draft.ux!.materialIncluded = false;
    const output = calculateExperience(draft); expect(output.kind === 'cost' && output.cost.total).toBe('0.00'); expect(costExclusions(draft)).toContain('Material não incluído');
  });
});

describe('UX V3 — G a L: Shopee e intenção de venda', () => {
  it('G: nenhum programa é uma declaração datada e enumerada; não confirma frete/volume/hipóteses', () => {
    const draft = newCalculationDraft(new Date(2026, 10, 22)); draft.ux!.entry = 'manual';
    const declared = declarePrograms(draft, 'none');
    expect(declared.ux?.programDeclaration).toEqual({ answer: 'none', date: '2026-11-22', programs: ['returns', 'highlight', 'ads', 'affiliates', 'advance'] });
    expect(declared.fields.returns).toBe('inactive'); expect(declared.fields.ads).toBe('inactive'); expect(declared.ux?.shipping).toBe('unknown'); expect(declared.ux?.volume.answer).toBe('unknown'); expect(declared.fields.acceptValidity).toBe(false);
    const markup = html(declared, <ShopQuestions tables={bundledTables} />); expect(markup).toContain('esses cinco programas inativos');
  });
  it('H: Não sei preserva pendências; a data seguinte não reutiliza declaração de ausência de programas', () => {
    let draft = declarePrograms(cpfDraft(), 'none'); draft = declarePrograms(draft, 'unknown');
    let result = calculateExperience(draft); expect(result.kind === 'sale' && result.data.result.operatingProfit).toBeNull();
    draft = declarePrograms(cpfDraft(), 'none'); draft.fields.date = '2026-11-23'; result = calculateExperience(draft);
    expect(result.kind === 'sale' && result.data.result.status).toBe('partial'); expect(result.kind === 'sale' && result.data.result.operatingProfit).toBeNull();
  });
  it('I: comissão obrigatória bloqueada, programas independentes e teste gratuito representável', () => {
    const draft = declarePrograms(cpfDraft(), 'some'); draft.fields.returns = 'trial'; draft.fields.ads = 'unknown';
    const output = calculateExperience(draft); if (output.kind !== 'sale') throw new Error();
    expect(output.data.result.knownMarketplaceFees).toBe('16.96'); expect(output.data.result.operatingProfit).toBeNull();
    const markup = html(draft, <ShopQuestions tables={bundledTables} />); expect(markup).toContain('teste gratuito'); expect(markup).toMatch(/disabled="" aria-label="Comissão básica obrigatória" checked=""/); expect(markup).toContain('Participa de Ads Fácil?');
  });
  it('aceite amigável registra hipóteses separadas e não resolve uma fórmula/adesão desconhecida', () => {
    let draft = cpfDraft(); draft.fields.acceptValidity = false; draft.fields.acceptRounding = false; draft.fields.acceptPrecedence = false; draft.fields.ads = 'unknown';
    draft = acceptHypotheses(draft, bundledTables[0]!.id, ['validity', 'rounding', 'precedence']);
    expect(draft.ux?.assumptionReview?.accepted).toEqual(['validity', 'rounding', 'precedence']);
    const output = calculateExperience(draft); if (output.kind !== 'sale') throw new Error();
    expect(output.data.result.status).toBe('partial'); expect(output.data.result.operatingProfit).toBeNull();
    expect(output.data.result.assumptions.every(item => item.accepted)).toBe(true);
  });
  it('aceite vinculado à data e à versão não confirma automaticamente um cenário diferente', () => {
    const draft = acceptHypotheses(cpfDraft(), bundledTables[0]!.id, ['validity', 'rounding', 'precedence']); draft.fields.date = '2026-11-23';
    const result = calculateExperience(draft); expect(result.kind === 'sale' && result.data.result.status).toBe('partial');
    const other = acceptHypotheses(cpfDraft(), 'outra-tabela', ['validity', 'rounding', 'precedence']); const result2 = calculateExperience(other); expect(result2.kind === 'sale' && result2.data.result.status).toBe('partial');
  });
  it('mudar a data por ação da interface pede nova confirmação de volume, frete e condições temporárias', () => {
    const draft = cpfDraft(); draft.fields.orders = '500';
    const changed = changeScenarioDate(draft, '2026-11-23');
    expect(changed.fields).toMatchObject({ orders: '', shippingConfirmed: false, acceptValidity: false, acceptRounding: false, acceptPrecedence: false }); expect(changed.ux?.shipping).toBe('unknown');
    const output = calculateExperience(changed); expect(output.kind === 'sale' && output.data.result.status).toBe('partial');
  });
  it('embalagem ainda não sei impede lucro completo, mas mantém fabricação e tarifas calculáveis', () => {
    const draft = cpfDraft(); draft.ux!.packagingDecision = 'unknown'; const output = calculateExperience(draft); if (output.kind !== 'sale') throw new Error();
    expect(output.data.result).toMatchObject({ manufacturing: { total: '8.00' }, knownMarketplaceFees: '16.96', marketplaceNet: null, operatingProfit: null });
    expect(output.data.result.pending.some(item => item.id === 'cost:packaging')).toBe(true);
    const markup = html(draft, <ExperienceResult state={ready(draft)} onResolve={() => {}} />); expect(markup).toContain('Conferir embalagem'); expect(markup).toContain('Ainda não podemos determinar seu lucro');
  });
  it('J: ajustar o preço final recalcula faixas; exatamente 80 suspende lucro e a viabilidade', () => {
    const draft = cpfDraft(); draft.fields.seller = 'CNPJ'; const lower = calculateExperience(applyFinalPrice(draft, '79.99')); const upper = calculateExperience(applyFinalPrice(draft, '80.01')); const boundary = calculateExperience(applyFinalPrice(draft, '80.00'));
    if (lower.kind !== 'sale' || upper.kind !== 'sale' || boundary.kind !== 'sale') throw new Error();
    expect(lower.data.result.knownMarketplaceFees).not.toBe(upper.data.result.knownMarketplaceFees); expect(lower.data.result.marketplaceNet).not.toBe(upper.data.result.marketplaceNet);
    expect(boundary.data.result.status).toBe('partial'); expect(boundary.data.result.operatingProfit).toBeNull(); expect(applyFinalPrice(draft, '19.90').fields.calculation).toBe('direct');
  });
  it('K/L: cinco peças produzidas, duas unidades ou dois kits mantêm incidência comercial independente', () => {
    const draft = cpfDraft(); const pieces = calculateExperience(draft); draft.ux!.saleUnit = 'kit'; draft.ux!.partsPerKit = '2'; const kits = calculateExperience(draft);
    if (pieces.kind !== 'sale' || kits.kind !== 'sale') throw new Error();
    expect(pieces.data.result.manufacturing.total).toBe('8.00'); expect(kits.data.result.manufacturing.total).toBe('16.00'); expect(kits.data.result.knownMarketplaceFees).toBe(pieces.data.result.knownMarketplaceFees);
  });
  it('duas intenções visíveis usam o mesmo modo de cálculo, com margem explicada', () => {
    const draft = cpfDraft(); draft.fields.calculation = 'margin'; const markup = html(draft, <SaleStep tables={bundledTables} onSaveShop={() => {}} />);
    expect(markup).toContain('Já tenho um preço'); expect(markup).toContain('Descobrir quanto cobrar'); expect(markup).toContain('O resultado mostra o preço mínimo calculável'); expect(markup).toContain('a busca começará em');
  });
});

describe('UX V3 — M a T: importação, edição e persistência', () => {
  it('M: geometria sem estimativas não inventa dados e preserva a venda em edição', () => {
    const data = importPrintFile('geometria.3mf', zipSync({ '3D/3dmodel.model': strToU8('<model/>') }));
    const draft = cpfDraft(); const applied = applyImportedPlate(draft, data, { id: 'manual', name: 'Manual', grams: null, seconds: null, pieces: null, materials: [] });
    expect(applied.fields).toMatchObject({ grams: '', hours: '', pieces: '', price: '19.90', quantity: '2', seller: 'CPF', machine: '2' });
  });
  it('N: seleção de uma placa mantém tempo/massa independentes, sem total fictício de placas', () => {
    const file = zipSync({ 'Metadata/slice_info.config': strToU8('<config><plate><metadata key="index" value="1"/><metadata key="prediction" value="3600"/><metadata key="object_count" value="2"/><filament type="PLA" used_g="20"/></plate><plate><metadata key="index" value="2"/><metadata key="prediction" value="7200"/><metadata key="object_count" value="3"/><filament type="PETG" used_g="40"/></plate></config>') });
    const data = importPrintFile('placas.gcode.3mf', file); const applied = applyImportedPlate(realDraft(), data, data.plates[1]!);
    expect(applied.fields).toMatchObject({ hours: '2', grams: '40', pieces: '3', quantity: '2' }); expect(applied.ux?.origin?.plateCount).toBe(2);
  });
  it('O: custo parcial atual pode aparecer; envelope de geração antiga ou em espera nunca reaparece', () => {
    const draft = realDraft(); const envelope = { finished: true, preview: calculateCostPreview(draft), output: calculateExperience(draft) };
    expect(currentFinancialState({ signature: 'old', phase: 'ready', output: envelope }, 'new')).toEqual({ signature: 'new', phase: 'waiting' });
    expect(currentFinancialState({ signature: 'new', phase: 'waiting', output: envelope }, 'new').output).toBeUndefined();
    const interim = currentFinancialState({ signature: 'new', phase: 'ready', output: { preview: envelope.preview, finished: false } }, 'new'); expect(interim.phase).toBe('processing');
  });
  it('P: banco v3 migra sem reescrita; backup reabre cálculo antigo e conserva hipóteses e lixeira', async () => {
    const factory = new IDBFactory(); const draft = cpfDraft(); const records = recordsForResult(draft, calculateExperience(draft), [], {}, '2026-11-22T12:00:00Z');
    await new Promise<void>((resolve, reject) => { const request = factory.open('fatialucro-local-v1', 3); request.onupgradeneeded = () => { request.result.createObjectStore('entries', { keyPath: 'id' }); request.result.createObjectStore('settings', { keyPath: 'id' }); }; request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result; const tx = db.transaction('entries', 'readwrite'); for (const record of records) tx.objectStore('entries').put(record); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); }; });
    const repository = new LocalRepository(factory); repositories.push(repository); expect((await repository.list()).sort((a, b) => a.id.localeCompare(b.id))).toEqual([...records].sort((a, b) => a.id.localeCompare(b.id)));
    await repository.trash(records[0]!.id); const backup = decodeBackup(await repository.export()); expect(backup.every(entry => entry.deletedAt)).toBe(true);
    const restored = frozenResult(backup.find(entry => entry.kind === 'simulation')!); expect(restored?.kind === 'sale' && restored.data.result.knownMarketplaceFees).toBe('16.96');
    await repository.restore(records[0]!.id); expect(await repository.list()).toHaveLength(2);
  });
  it('preferências da loja não sobrescrevem pedido atual nem perpetuam campanha, trial ou hipóteses', () => {
    const store = declarePrograms(cpfDraft(), 'some'); Object.assign(store.fields, { highlight: 'active', returns: 'trial', ads: 'active' }); store.ux!.persistentPrograms = ['returns', 'ads'];
    const current = cpfDraft(); Object.assign(current.fields, { date: '2026-11-23', orders: '17', price: '88', shipping: '4.00', acceptValidity: false }); current.ux!.shipping = 'yes';
    const applied = applySavedStore(current, store, '2026-11-22T12:00:00Z');
    expect(applied.fields).toMatchObject({ highlight: 'unknown', returns: 'unknown', ads: 'active', orders: '17', price: '88', shipping: '4.00', date: '2026-11-23', acceptValidity: false }); expect(applied.ux?.shipping).toBe('yes');
  });
  it('Q: rótulos/dicas são associados e formatos parciais inválidos não são convertidos em número final', () => {
    const markup = renderToStaticMarkup(<NumericInput name="spool-price" label="Preço pago" value="35.90" onValue={() => {}} kind="money" />);
    const id = markup.match(/id="([^"]+)"/)?.[1]; expect(markup).toContain(`for="${id}"`); expect(markup).toContain('aria-describedby'); expect(markup).toContain('35,90');
    expect(numericIssue(normalizeNumeric('1,', 'money'), 'money')).not.toBe(''); expect(normalizeNumeric('R$ 1.234,56', 'money')).toBe('1234.56');
    const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8'); expect(css).toContain('grid-template-columns: minmax(0, 1fr)'); expect(css).toContain(':focus-visible'); expect(css).not.toMatch(/font-size:\s*\.7\d*rem/);
  });
  it('R: modo e etapa não alteram custos, tarifas ou resultado para entradas idênticas', () => {
    const draft = cpfDraft(); const simple = calculateExperience(draft); draft.ux!.mode = 'advanced'; draft.ux!.stage = 'result'; const advanced = calculateExperience(draft);
    expect(simple.kind === 'sale' && simple.data.result).toEqual(advanced.kind === 'sale' && advanced.data.result);
  });
  it('S: data histórica mantém ausência de regras aplicáveis e não promove referência antiga a vigente', () => {
    const draft = cpfDraft(); draft.fields.date = '2026-06-15'; const result = calculateExperience(draft);
    expect(result.kind === 'sale' && result.data.result.status).toBe('partial'); expect(result.kind === 'sale' && result.data.result.operatingProfit).toBeNull(); expect(bundledTables[0]!.lastVerified).toBe('2026-11-22');
  });
  it('T: trocar Shopee por venda direta elimina todas as tarifas e pendências Shopee residuais', () => {
    const draft = cpfDraft(); draft.fields.ads = 'unknown'; draft.fields.marketplace = 'direct'; const result = calculateExperience(draft); if (result.kind !== 'sale') throw new Error();
    expect(result.data.result).toMatchObject({ status: 'complete', knownMarketplaceFees: '0.00', operatingProfit: '31.80' }); expect(result.data.result.pending).toEqual([]); expect(result.data.result.fees).toEqual([]);
  });
  it('resultado e resumo compartilham apresentação; auditoria completa não impõe cadeia de três accordions', () => {
    const draft = cpfDraft(); const markup = html(draft, <ExperienceResult frozen={calculateExperience(draft)} />);
    expect(markup).toContain('class="audit-block"');
    let depth = 0; let maximum = 0;
    for (const tag of markup.matchAll(/<\/?details\b[^>]*>/g)) { depth += tag[0].startsWith('</') ? -1 : 1; maximum = Math.max(maximum, depth); }
    expect(maximum).toBeLessThanOrEqual(2);
    const summary = renderToStaticMarkup(<FinancialSummary draft={draft} state={ready(draft)} />); expect(summary).toContain('Meu resumo'); expect(summary).toContain('Simulação provisória'); expect(summary).toContain('R$ 16,96');
  });
  it('explicação de hipóteses inicial é amigável e não mostra controles técnicos de aceite', () => {
    const draft = cpfDraft(); const markup = html(draft, <SimulationReview tables={bundledTables} />);
    expect(markup).toContain('Ver hipóteses'); expect(markup).toContain('documentação arquivada'); expect(markup).not.toContain('HALF_UP'); expect(markup).not.toContain('type="checkbox"');
  });
  it('material já calculável aparece no bloco correto da etapa Custos', () => {
    const draft = realDraft(); const markup = renderToStaticMarkup(<FormContext value={{ draft, setField: () => {} }}><ExperienceContext value={{ draft, update: () => {}, financial: ready(draft) }}><FilamentFields entries={[]} onProfile={() => {}} /></ExperienceContext></FormContext>);
    expect(markup).toContain('Seu custo de material nesta impressão'); expect(markup).toContain('R$ 10,00');
  });
  it('nova metadata de declaração/aceites é validada antes do backup', () => {
    const draft = declarePrograms(cpfDraft(), 'none'); const record: SavedEntry = { id: 'valid', kind: 'product', name: 'Produto', updatedAt: '2026-11-22T12:00:00Z', draft };
    expect(decodeBackup(JSON.stringify({ version: 2, entries: [record] }))).toHaveLength(1);
    draft.ux!.programDeclaration!.programs.push('inventado'); expect(() => decodeBackup(JSON.stringify({ version: 2, entries: [record] }))).toThrow('Declaração');
  });
  it('rascunho V2 salvo na antiga etapa Venda sem intenção de venda continua navegável', () => {
    const draft = realDraft(); draft.ux!.stage = 'sale'; const migrated = withExperience(draft); expect(calculationStages(migrated.ux)).toContain(migrated.ux.stage);
  });
  it('editores simultâneos em Configurações têm IDs únicos e auditoria com no máximo duas expansões', () => {
    const draft = cpfDraft(); const saved: SavedEntry = { id: 'store-shopee', kind: 'marketplace', name: 'Minha loja', updatedAt: '2026-11-22T12:00:00Z', draft };
    const markup = html(draft, <><StoreSettings saved={saved} tables={bundledTables} onSave={async () => {}} /><ShopQuestions tables={bundledTables} permanentOnly /></>);
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]); expect(new Set(ids).size).toBe(ids.length);
    let depth = 0; let maximum = 0;
    for (const tag of markup.matchAll(/<\/?details\b[^>]*>/g)) { depth += tag[0].startsWith('</') ? -1 : 1; maximum = Math.max(maximum, depth); }
    expect(maximum).toBeLessThanOrEqual(2);
  });
});
