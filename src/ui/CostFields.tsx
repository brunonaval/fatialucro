import { useState } from 'react';
import { parseBrazilianMoney } from '../engine/decimal';
import { depreciationPerHour } from '../engine';
import { numeric, text } from '../app/model';
import { spoolRates, withExperience } from '../app/experience';
import type { SavedEntry } from '../app/storage';
import { Field, Input, NumericInput } from './Fields';
import { useExperience } from './ExperienceContext';
import { currency } from './ResultView';

export function FilamentFields({ entries, onProfile }: { entries: SavedEntry[]; onProfile: (entry: SavedEntry) => void }) {
  const { draft, ux, patch, update } = useExperience(); const [removing, setRemoving] = useState<string | null>(null);
  const profiles = entries.filter(item => item.kind === 'filament');
  let rates: ReturnType<typeof spoolRates> | null = null;
  try { if (ux.filament.mode === 'spool') rates = spoolRates(ux.filament.amount, ux.filament.netGrams); } catch { /* Incomplete values remain manual. */ }
  const chooseProfile = (entry: SavedEntry, row?: number) => {
    if (row === undefined) { onProfile(entry); return; }
    const profile = withExperience(entry.draft);
    update({ ...draft, materials: draft.materials.map((item, index) => {
      if (index !== row) return item;
      const updated = { ...item, name: text(profile, 'materialName') || entry.name, pricePerKg: text(profile, 'filament') }; delete updated.purchase;
      if (profile.ux.filament.mode === 'spool') updated.purchase = { amount: profile.ux.filament.amount, netGrams: profile.ux.filament.netGrams };
      return updated;
    }) });
  };
  return <div className="cost-block"><h3>Quanto custou o filamento?</h3>
    {!draft.materials.length ? <>
      {!!profiles.length && <label>Usar um filamento salvo<select value="" onChange={event => { const profile = profiles.find(item => item.id === event.target.value); if (profile) chooseProfile(profile); }}><option value="">Selecionar filamento…</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <div className="choice-row" aria-label="Forma de informar filamento"><button type="button" aria-pressed={ux.filament.mode === 'spool'} className="secondary" onClick={() => patch({ filament: { ...ux.filament, mode: 'spool' } })}>Valor e peso da bobina</button><button type="button" aria-pressed={ux.filament.mode === 'kg'} className="secondary" onClick={() => patch({ filament: { ...ux.filament, mode: 'kg' } })}>Já sei o preço por kg</button></div>
      {ux.filament.mode === 'spool' ? <><div className="fields"><NumericInput name="spool-price" label="Valor pago pela bobina" kind="money" value={ux.filament.amount} onValue={amount => patch({ filament: { ...ux.filament, amount } })} /><NumericInput name="spool-weight" label="Peso líquido comprado (sem a bobina vazia)" kind="weight" value={ux.filament.netGrams} onValue={netGrams => patch({ filament: { ...ux.filament, netGrams } })} /></div><p className="muted">Não precisa ser 1 kg. Use a quantidade de filamento realmente comprada.</p>{rates && <p className="rate-preview">Equivale a aproximadamente R$ {rates.perGram.replace('.', ',')}/g e R$ {rates.perKg.replace('.', ',')}/kg. O cálculo usa valor e peso originais, sem arredondar esse equivalente.</p>}</> : <Field name="filament" label="Preço direto por quilograma" />}
      <Input name="materialName" label="Material ou nome do filamento (opcional)" required={false} />
    </> : <>
      <p className="muted">Preencha o preço de cada material. Peso de suporte, purga e trocas deve estar no consumo informado, sem ser somado novamente.</p>
      {draft.materials.map((item, index) => <div className="material-row" key={item.id}><label>Material<input value={item.name} onChange={event => update({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, name: event.target.value } : value) })} /></label><div className="fields">
        <NumericInput name={`${item.id}-g`} label="Peso total utilizado" kind="weight" value={item.grams} onValue={grams => update({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, grams } : value) })} />
        {!item.purchase ? <NumericInput name={`${item.id}-kg`} label="Preço por kg" kind="money" value={item.pricePerKg} onValue={pricePerKg => update({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, pricePerKg } : value) })} /> : <p className="rate-preview">Bobina: {currency(item.purchase.amount.replace(',', '.'))} / {item.purchase.netGrams} g. Origem: perfil selecionado.</p>}
        {!!profiles.length && <label>Aplicar filamento salvo<select value="" onChange={event => { const profile = profiles.find(value => value.id === event.target.value); if (profile) chooseProfile(profile, index); }}><option value="">Selecionar perfil…</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>}
      </div>{removing === item.id ? <div className="confirm-inline"><p>Remover este material também remove seu custo do cálculo.</p><button type="button" onClick={() => { update({ ...draft, materials: draft.materials.filter(value => value.id !== item.id) }); setRemoving(null); }}>Confirmar remoção</button><button type="button" className="secondary" onClick={() => setRemoving(null)}>Manter material</button></div> : <button type="button" className="text-button" onClick={() => setRemoving(item.id)}>Remover material…</button>}</div>)}
    </>}
    <details><summary>Mais de um material, suportes ou purga conhecidos</summary><p>Adicione somente consumo conhecido. Estimativas de geometria ou resistência não são usadas.</p><button type="button" className="secondary" disabled={draft.materials.length >= 32} onClick={() => {
      const first = draft.materials.length ? draft.materials : [{ id: crypto.randomUUID(), name: text(draft, 'materialName') || 'Material principal', grams: text(draft, 'grams'), pricePerKg: text(draft, 'filament'), ...(ux.filament.mode === 'spool' ? { purchase: { amount: ux.filament.amount, netGrams: ux.filament.netGrams } } : {}) }];
      update({ ...draft, materials: [...first, { id: crypto.randomUUID(), name: 'Material adicional', grams: '', pricePerKg: '' }] });
    }}>Adicionar material conhecido</button></details>
  </div>;
}

export function PrinterFields({ entries, onProfile }: { entries: SavedEntry[]; onProfile: (entry: SavedEntry) => void }) {
  const { draft, ux, update, patch } = useExperience(); const [error, setError] = useState('');
  const profiles = entries.filter(item => item.kind === 'printer');
  return <div className="cost-block"><h3>Impressora e energia</h3><div className="fields">
    {!!profiles.length && <label>Impressora salva<select value="" onChange={event => { const entry = profiles.find(item => item.id === event.target.value); if (entry) onProfile(entry); }}><option value="">Selecionar impressora…</option>{profiles.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
    <label>Como quer informar o custo?<select value={!ux.machineIncluded ? 'none' : text(draft, 'machineMode')} onChange={event => update({ ...draft, fields: { ...draft.fields, ...(event.target.value === 'none' ? {} : { machineMode: event.target.value }) }, ux: { ...ux, machineIncluded: event.target.value !== 'none' } })}><option value="all-in">Custo completo por hora</option><option value="detailed">Energia e desgaste separados</option><option value="none">Calcular material sem máquina/energia</option></select></label>
    {ux.machineIncluded && (draft.fields.machineMode === 'all-in' ? <Field name="machine" label="Quanto custa uma hora de impressão? (R$/h)" decimal /> : <><Field name="watts" label="Potência média utilizada (W)" decimal /><Field name="kwh" label="Preço da energia (R$/kWh)" decimal /></>)}
  </div>
    {!ux.machineIncluded ? <p className="notice">Máquina e energia não serão incluídas. Este resultado é somente dos custos escolhidos.</p> : draft.fields.machineMode === 'all-in' ? <p className="muted">Esse valor deve incluir energia, manutenção e desgaste. Esses componentes não serão cobrados novamente.</p> : <details><summary>Incluir manutenção e desgaste da impressora</summary><label className="check"><input type="checkbox" checked={ux.wearIncluded} onChange={event => patch({ wearIncluded: event.target.checked })} /> Incluir manutenção e depreciação conhecidas</label>{ux.wearIncluded && <div className="fields"><Field name="maintenance" label="Manutenção por hora" decimal /><Field name="depreciation" label="Desgaste/depreciação por hora" decimal /></div>}<p className="muted">Sem essa seleção, o custo detalhado inclui somente a energia informada.</p></details>}
    <details><summary>Nome da impressora e ajuda para depreciação</summary><Input name="printerName" label="Nome da impressora (opcional)" required={false} /><div className="fields"><Field name="printerPurchase" label="Valor que ainda será depreciado" /><Field name="printerLife" label="Vida útil restante (horas)" decimal /></div><button type="button" className="secondary" onClick={() => { try { const value = depreciationPerHour(parseBrazilianMoney(text(draft, 'printerPurchase')), numeric(text(draft, 'printerLife'), 'Vida útil')); update({ ...draft, fields: { ...draft.fields, depreciation: value }, ux: { ...ux, wearIncluded: true } }); setError(''); } catch { setError('Informe o valor da máquina e uma vida útil maior que zero.'); } }}>Calcular desgaste por hora</button>{error && <p role="alert">{error}</p>}<p>Aplicado apenas no modo de custos separados.</p></details>
  </div>;
}

export function OptionalCosts() {
  const { ux, patch } = useExperience();
  return <details className="optional-costs"><summary>Embalagem, mão de obra e outros custos opcionais</summary><p className="muted">Não incluídos até você selecionar. Excluir um custo desta estimativa não comprova que ele seja zero na sua operação.</p>
    <label>Mão de obra<select value={ux.labor} onChange={event => patch({ labor: event.target.value as typeof ux.labor })}><option value="excluded">Não incluir neste cálculo</option><option value="zero">Considerar R$ 0,00, por escolha minha</option><option value="paid">Informar tempo e valor</option></select></label>
    {ux.labor === 'paid' && <div className="fields"><Field name="laborMinutes" label="Trabalho manual no lote (minutos)" decimal /><Field name="laborHour" label="Valor da hora de trabalho (aceita zero)" /></div>}
    <label className="check"><input type="checkbox" checked={ux.packagingIncluded} onChange={event => patch({ packagingIncluded: event.target.checked })} /> Incluir embalagem conhecida</label>
    {ux.packagingIncluded && <><label>Como pagou pela embalagem?<select value={ux.packaging.mode} onChange={event => patch({ packaging: { ...ux.packaging, mode: event.target.value as 'unit' | 'pack' } })}><option value="unit">Tenho o custo de uma unidade</option><option value="pack">Comprei um pacote com várias unidades</option></select></label>{ux.packaging.mode === 'unit' ? <Field name="packagingUnit" label="Embalagem por unidade vendida (peça ou kit)" /> : <div className="fields"><NumericInput name="package-price" label="Valor pago no pacote" kind="money" value={ux.packaging.amount} onValue={amount => patch({ packaging: { ...ux.packaging, amount } })} /><label>Quantidade de embalagens no pacote<input inputMode="numeric" value={ux.packaging.units} onChange={event => patch({ packaging: { ...ux.packaging, units: event.target.value } })} /></label></div>}<Field name="packagingOrder" label="Embalagem compartilhada adicional por pedido" /></>}
    <label className="check"><input type="checkbox" checked={ux.extrasIncluded} onChange={event => patch({ extrasIncluded: event.target.checked })} /> Incluir consumíveis e reserva de perdas por peça física</label>{ux.extrasIncluded && <div className="fields"><Field name="consumables" label="Consumíveis por peça" /><Field name="failure" label="Reserva informada de perdas por peça" /></div>}
  </details>;
}
