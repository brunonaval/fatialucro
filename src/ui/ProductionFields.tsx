import { D, parseBrazilianMoney } from '../engine/decimal';
import { depreciationPerHour } from '../engine';
import { numeric, text } from '../app/model';
import type { CalculatorDraft } from '../app/model';
import type { SavedEntry } from '../app/storage';
import { Field, Input, NumericInput, Select, useForm } from './Fields';
import { ProfileSelect } from './ProfileSelect';

export function ProductionFields({ entries, change, reopen, onError }: { entries: SavedEntry[]; change: (draft: CalculatorDraft) => void; reopen: (entry: SavedEntry) => void; onError: (message: string) => void }) {
  const { draft, setField } = useForm(); const profiles = entries.filter(entry => entry.kind === 'filament');
  return <section id="production"><h2><b aria-hidden="true">2</b> Fabricação</h2>
    <p className="muted">Informe os totais da impressão. Peças produzidas e unidades vendidas são quantidades independentes.</p>
    <div className="fields"><Select name="basis" label="Os dados descrevem"><option value="batch">Um lote / placa</option><option value="unit">Uma unidade</option></Select>{draft.fields.basis === 'batch' && <Input name="pieces" label="Peças produzidas no lote" />}<Field name="hours" label="Tempo de impressão" decimal /></div>
    {!draft.materials.length ? <div className="fields"><Field name="grams" label="Filamento consumido" decimal /><Field name="filament" label="Preço do filamento (R$/kg)" /><ProfileSelect kind="filament" entries={entries} onApply={reopen} /></div> : <>
      {draft.materials.map((item, index) => <div className="material-row" key={item.id}><h3>{item.name}</h3><div className="fields">
        <NumericInput kind="weight" name={`${item.id}-grams`} label="Massa de filamento" value={item.grams} onValue={grams => change({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, grams } : value) })} />
        <NumericInput kind="money" name={`${item.id}-price`} label="Preço por kg" value={item.pricePerKg} onValue={pricePerKg => change({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, pricePerKg } : value) })} />
        <label>Filamento salvo<select value="" onChange={event => { const profile = profiles.find(value => value.id === event.target.value); if (profile) change({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, name: text(profile.draft, 'materialName'), pricePerKg: text(profile.draft, 'filament') } : value) }); }}><option value="">Aplicar perfil…</option>{profiles.map(profile => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label>
      </div></div>)}
      <button type="button" className="secondary" onClick={() => { const total = draft.materials.every(item => /^\d+([,.]\d+)?$/.test(item.grams)) ? draft.materials.reduce((sum, item) => sum.plus(item.grams.replace(',', '.')), new D(0)).toFixed() : ''; change({ fields: { ...draft.fields, grams: total, filament: '' }, materials: [] }); }}>Usar um único material</button>
    </>}
    <div className="fields"><Select name="machineMode" label="Custo da impressora"><option value="all-in">Valor completo por hora</option><option value="detailed">Detalhar energia e desgaste</option></Select><ProfileSelect kind="printer" entries={entries} onApply={reopen} />
      {draft.fields.machineMode === 'all-in' ? <Field name="machine" label="Máquina completa (R$/h)" decimal /> : <><Field name="watts" label="Potência média (W)" decimal /><Field name="kwh" label="Energia (R$/kWh)" decimal /><Field name="maintenance" label="Manutenção (R$/h)" decimal /><Field name="depreciation" label="Depreciação (R$/h)" decimal /></>}
    </div>
    <details><summary>Trabalho, embalagem e reservas</summary><div className="fields"><Field name="laborMinutes" label="Trabalho manual (minutos do lote/unidade)" decimal /><Field name="laborHour" label="Mão de obra (R$/h; aceita zero)" /><Field name="consumables" label="Consumíveis (R$/peça)" /><Field name="failure" label="Reserva de falhas (R$/peça)" /><Field name="packagingUnit" label="Embalagem (R$/unidade vendida)" /><Field name="packagingOrder" label="Embalagem compartilhada (R$/pedido)" /></div></details>
    <details><summary>Perfis de produção e depreciação</summary><div className="fields"><Input name="materialName" label="Identificação do filamento" required={false} /><Input name="printerName" label="Nome da impressora" required={false} /><Field name="printerPurchase" label="Valor depreciável (R$)" /><Field name="printerLife" label="Vida útil restante (horas)" decimal /></div>
      <button type="button" className="secondary" onClick={() => { try { setField('depreciation', depreciationPerHour(parseBrazilianMoney(text(draft, 'printerPurchase')), numeric(text(draft, 'printerLife'), 'Vida útil'))); } catch (problem) { onError(String(problem)); } }}>Calcular depreciação por hora</button><p>Depreciação separada é aplicada apenas no modo detalhado. O valor completo por hora já deve conter energia, manutenção e depreciação.</p>
      <ProfileSelect kind="production" entries={entries} onApply={reopen} />
    </details>
  </section>;
}
