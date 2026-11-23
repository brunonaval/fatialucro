import { useState } from 'react';
import { D } from '../engine/decimal';
import { parseBrazilianMoney } from '../engine/decimal';
import { depreciationPerHour } from '../engine';
import { numeric, text } from '../app/model';
import { spoolRates, validateReusableProfile, withExperience } from '../app/experience';
import type { SavedEntry } from '../app/storage';
import { Field, Input, NumericInput } from './Fields';
import { useExperience } from './ExperienceContext';
import { currency } from './ResultView';
import { profileSignature, profileSource } from '../app/ux-v3';
import type { PurchaseDraft } from '../app/experience-types';

function purchaseDescription(purchase: PurchaseDraft): string {
  try {
    const amount = parseBrazilianMoney(purchase.amount);
    const netGrams = numeric(purchase.netGrams, 'Peso líquido da bobina');
    if (new D(netGrams).lte(0)) throw new Error('Peso inválido.');
    return `Bobina: ${currency(amount)} / ${netGrams.replace('.', ',')} g. Origem: filamento salvo selecionado.`;
  } catch {
    return 'O cadastro desta bobina tem custo ou peso inválido. Escolha outro perfil ou informe o preço por kg.';
  }
}

function filamentLabel(entry: SavedEntry) {
  try { const profile = withExperience(entry.draft); validateReusableProfile(profile, 'filament'); return `${entry.name} — ${profile.ux.filament.mode === 'spool' ? `${currency(profile.ux.filament.amount.replace(',', '.'))} / ${profile.ux.filament.netGrams} g` : `${currency(text(profile, 'filament').replace(',', '.'))}/kg`}`; }
  catch { return `${entry.name} — custo incompleto, confira o perfil`; }
}
export function FilamentFields({ entries, onProfile, onSave }: { entries: SavedEntry[]; onProfile: (entry: SavedEntry) => void; onSave?: (draft: ReturnType<typeof withExperience>) => Promise<void> }) {
  const { draft, ux, patch, update, financial } = useExperience(); const [removing, setRemoving] = useState<string | null>(null);
  const profiles = entries.filter(item => item.kind === 'filament'); const [profileError, setProfileError] = useState('');
  const [saveFeedback, setSaveFeedback] = useState(''); const [saving, setSaving] = useState(false);
  const labelToSave = text(draft, 'materialName').trim();
  let validForSaving = false;
  try {
    validateReusableProfile(draft, 'filament');
    const paid = ux.filament.mode === 'spool' ? ux.filament.amount : text(draft, 'filament');
    validForSaving = new D(paid.replace(',', '.')).gt(0);
  } catch { /* Costs are still being entered; saving is optional. */ }
  const alreadySaved = profiles.some(entry => profileSignature(entry.draft, 'filament') === profileSignature(draft, 'filament'));
  let rates: ReturnType<typeof spoolRates> | null = null;
  try { if (ux.filament.mode === 'spool') rates = spoolRates(ux.filament.amount, ux.filament.netGrams); } catch { /* Incomplete values remain manual. */ }
  const chooseProfile = (entry: SavedEntry, row?: number) => {
    if (row === undefined) { onProfile(entry); return; }
    try { validateReusableProfile(entry.draft, 'filament'); } catch (error) { setProfileError(error instanceof Error ? error.message : 'Perfil incompleto; custo atual preservado.'); return; }
    setProfileError(''); const profile = withExperience(entry.draft);
    update({ ...draft, materials: draft.materials.map((item, index) => {
      if (index !== row) return item;
      const updated = { ...item, name: text(profile, 'materialName') || entry.name, pricePerKg: text(profile, 'filament') }; delete updated.purchase;
      if (profile.ux.filament.mode === 'spool') updated.purchase = { amount: profile.ux.filament.amount, netGrams: profile.ux.filament.netGrams };
      return updated;
    }) });
  };
  const material = financial?.preview?.lines.find(line => line.id === 'material');
  return <div className="cost-block"><h3>Quanto custou sua bobina?</h3><p>Usaremos o valor pago e o peso de filamento, sem contar o carretel.</p>
    <label className="check"><input type="checkbox" checked={ux.materialIncluded !== false} onChange={event => patch({ materialIncluded: event.target.checked })} />Incluir o material consumido</label>
    {ux.materialIncluded === false ? <p className="scope-note">Material não incluído por sua escolha; isso não comprova custo zero.</p> : <>
    {profileError && <p role="alert">{profileError}</p>}
    <p>Filamento usado: {draft.materials.length ? 'pesos individuais abaixo' : `${text(draft, 'grams') || 'falta informar'} g`}. {profileSource(draft, 'filament')}.</p>
    {!draft.materials.length ? <>
      {!!profiles.length && <label>Usar um filamento salvo<select value="" onChange={event => { const profile = profiles.find(item => item.id === event.target.value); if (profile) chooseProfile(profile); }}><option value="">Selecionar filamento…</option>{profiles.map(item => <option key={item.id} value={item.id}>{filamentLabel(item)}</option>)}</select></label>}
      <div className="choice-row" aria-label="Forma de informar filamento"><button type="button" aria-pressed={ux.filament.mode === 'spool'} className="secondary" onClick={() => patch({ filament: { ...ux.filament, mode: 'spool' } })}>Informar preço da bobina</button><button type="button" aria-pressed={ux.filament.mode === 'kg'} className="secondary" onClick={() => patch({ filament: { ...ux.filament, mode: 'kg' } })}>Já sei o preço por kg</button></div>
      {ux.filament.mode === 'spool' ? <><div className="fields"><NumericInput name="spool-price" label="Quanto você pagou pela bobina?" kind="money" value={ux.filament.amount} onValue={amount => patch({ filament: { ...ux.filament, amount } })} /><NumericInput name="spool-weight" label="Quanto filamento veio na bobina? (g, sem o carretel)" kind="weight" value={ux.filament.netGrams} onValue={netGrams => patch({ filament: { ...ux.filament, netGrams } })} /></div><p className="muted">Não precisa ser 1 kg. Use a quantidade de filamento realmente comprada.</p>{rates && <p className="rate-preview">Seu filamento custa cerca de <strong>{currency(rates.perKg)}/kg</strong>.</p>}</> : <Field name="filament" label="Preço direto por quilograma" />}
      {onSave ? <details className="profile-shortcut"><summary>Salvar esta bobina para usar novamente (opcional)</summary>
        <Input name="materialName" label="Material ou nome do filamento" required={false} />
        <h4>Guardar somente o custo desta bobina</h4>
        <p className="field-hint">Um nome como PLA permite reutilizar o custo na próxima impressão. Seu preço de venda não será salvo aqui.</p>
        <button type="button" className="secondary" disabled={saving || !validForSaving || !labelToSave || alreadySaved} onClick={async () => {
          setSaving(true); setSaveFeedback('');
          try { await onSave(withExperience(draft)); setSaveFeedback('Filamento salvo neste dispositivo. O próximo cálculo pode reutilizar este preço.'); }
          catch (error) { setSaveFeedback(error instanceof Error ? error.message : 'Não foi possível salvar o filamento.'); }
          finally { setSaving(false); }
        }}>{saving ? 'Salvando filamento…' : alreadySaved ? 'Este filamento já está salvo' : 'Salvar este filamento para próximas impressões'}</button>
        {!labelToSave && <p className="field-hint">Para salvar, informe um nome simples acima, por exemplo PLA. Não é necessário nome para calcular.</p>}
        {saveFeedback && <p role="status" className="message">{saveFeedback}</p>}
      </details> : <Input name="materialName" label="Nome do filamento (opcional)" required={false} />}
    </> : <>
      <p className="muted">Cada linha corresponde a um filamento efetivamente consumido. Até dois PLA podem pertencer a bobinas diferentes: escolha o preço correto para cada uma. Peso de suporte, purga e trocas deve estar no consumo informado, sem ser somado novamente.</p>
      {draft.materials.map((item, index) => <div className="material-row" key={item.id}><h4>Filamento {index + 1}: {item.name} · {item.grams || '?'} g</h4><label>Nome deste material<input name={`${item.id}-name`} value={item.name} onChange={event => update({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, name: event.target.value } : value) })} /></label><div className="fields">
        <NumericInput name={`${item.id}-g`} label="Peso total utilizado" kind="weight" value={item.grams} onValue={grams => update({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, grams } : value) })} />
        {!item.purchase ? <NumericInput name={`${item.id}-kg`} label="Preço por kg" kind="money" value={item.pricePerKg} onValue={pricePerKg => update({ ...draft, materials: draft.materials.map((value, i) => i === index ? { ...value, pricePerKg } : value) })} /> : <div className="rate-preview"><p>{purchaseDescription(item.purchase)}</p><button type="button" name={`${item.id}-purchase`} className="secondary" onClick={() => update({ ...draft, materials: draft.materials.map((value, i) => i === index ? { id: value.id, name: value.name, grams: value.grams, pricePerKg: value.pricePerKg } : value) })}>Corrigir custo desta bobina — informar outro preço por kg</button><p className="field-hint">A alteração vale somente para este cálculo, sem modificar o filamento salvo.</p></div>}
        {!!profiles.length && <label>Aplicar filamento salvo<select value="" onChange={event => { const profile = profiles.find(value => value.id === event.target.value); if (profile) chooseProfile(profile, index); }}><option value="">Selecionar perfil…</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{filamentLabel(profile)}</option>)}</select></label>}
      </div>{removing === item.id ? <div className="confirm-inline"><p>Remover este material também remove seu custo do cálculo.</p><button type="button" onClick={() => { update({ ...draft, materials: draft.materials.filter(value => value.id !== item.id) }); setRemoving(null); }}>Confirmar remoção</button><button type="button" className="secondary" onClick={() => setRemoving(null)}>Manter material</button></div> : <button type="button" className="text-button" onClick={() => setRemoving(item.id)}>Remover material…</button>}</div>)}
    </>}
    <details><summary>Mais de um material, suportes ou purga conhecidos</summary><p>Adicione somente consumo conhecido. Estimativas de geometria ou resistência não são usadas.</p><button type="button" className="secondary" disabled={draft.materials.length >= 32} onClick={() => {
      const first = draft.materials.length ? draft.materials : [{ id: crypto.randomUUID(), name: text(draft, 'materialName') || 'Material principal', grams: text(draft, 'grams'), pricePerKg: text(draft, 'filament'), ...(ux.filament.mode === 'spool' ? { purchase: { amount: ux.filament.amount, netGrams: ux.filament.netGrams } } : {}) }];
      update({ ...draft, materials: [...first, { id: crypto.randomUUID(), name: 'Material adicional', grams: '', pricePerKg: '' }] });
    }}>Adicionar material conhecido</button></details>
    {material?.amount !== null && material?.amount !== undefined && <p className="component-preview">Seu custo de material nesta impressão: <strong>{currency(material.amount)}</strong></p>}
    {material?.issue && <p className="input-pending">Falta completar o material: {material.issue}</p>}
    </>}
  </div>;
}

export function PrinterFields({ entries, onProfile }: { entries: SavedEntry[]; onProfile: (entry: SavedEntry) => void }) {
  const { draft, ux, update, patch } = useExperience(); const [error, setError] = useState('');
  const profiles = entries.filter(item => item.kind === 'printer');
  return <div className="cost-block"><h3>Deseja incluir o custo da impressora e da energia?</h3><p>Você pode calcular só o material agora e acrescentar outros custos quando souber.</p><div className="fields">
    {!!profiles.length && <label>Impressora salva<select value="" onChange={event => { const entry = profiles.find(item => item.id === event.target.value); if (entry) onProfile(entry); }}><option value="">Selecionar impressora…</option>{profiles.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
    <label>Deseja incluir energia e desgaste?<select value={!ux.machineIncluded ? 'none' : text(draft, 'machineMode')} onChange={event => update({ ...draft, fields: { ...draft.fields, ...(event.target.value === 'none' ? {} : { machineMode: event.target.value }) }, ux: { ...ux, machineIncluded: event.target.value !== 'none' } })}><option value="none">Ainda não — calcular somente os custos selecionados</option><option value="all-in">Sim — sei quanto custa cada hora</option><option value="detailed">Sim — quero calcular energia e desgaste separados</option></select></label>
    {ux.machineIncluded && (draft.fields.machineMode === 'all-in' ? <Field name="machine" label="Quanto custa uma hora de impressão? (R$/h)" decimal /> : <><Field name="watts" label="Potência média utilizada (W)" decimal /><Field name="kwh" label="Preço da energia (R$/kWh)" decimal /></>)}
  </div><p className="source-note">{profileSource(draft, 'printer')}.</p>
    {!ux.machineIncluded ? <p className="notice">Máquina e energia não serão incluídas. Este resultado é somente dos custos escolhidos.</p> : draft.fields.machineMode === 'all-in' ? <p className="muted">Esse valor deve incluir energia, manutenção e desgaste. Esses componentes não serão cobrados novamente.</p> : <details><summary>Incluir manutenção e desgaste da impressora</summary><label className="check"><input type="checkbox" checked={ux.wearIncluded} onChange={event => patch({ wearIncluded: event.target.checked })} /> Incluir manutenção e depreciação conhecidas</label>{ux.wearIncluded && <div className="fields"><Field name="maintenance" label="Manutenção por hora" decimal /><Field name="depreciation" label="Desgaste/depreciação por hora" decimal /></div>}<p className="muted">Sem essa seleção, o custo detalhado inclui somente a energia informada.</p></details>}
    <details><summary>Nome da impressora e ajuda para depreciação</summary><Input name="printerName" label="Nome da impressora (opcional)" required={false} /><div className="fields"><Field name="printerPurchase" label="Valor que ainda será depreciado" /><Field name="printerLife" label="Vida útil restante (horas)" decimal /></div><button type="button" className="secondary" onClick={() => { try { const value = depreciationPerHour(parseBrazilianMoney(text(draft, 'printerPurchase')), numeric(text(draft, 'printerLife'), 'Vida útil')); update({ ...draft, fields: { ...draft.fields, depreciation: value }, ux: { ...ux, wearIncluded: true } }); setError(''); } catch { setError('Informe o valor da máquina e uma vida útil maior que zero.'); } }}>Calcular desgaste por hora</button>{error && <p role="alert">{error}</p>}<p>Aplicado apenas no modo de custos separados.</p></details>
  </div>;
}

export function OptionalCosts() {
  const { ux, patch, draft } = useExperience();
  return <details className="optional-costs"><summary>Mão de obra, acabamento e outros custos</summary><p className="muted">Não incluídos até você selecionar. Trabalho e acabamento seguem a base da impressão (lote ou peça); consumíveis e reserva são por peça física. Embalagem é por unidade comercial e/ou pedido. Excluir não comprova custo real zero.</p>
    <label>Mão de obra<select value={ux.labor} onChange={event => patch({ labor: event.target.value as typeof ux.labor })}><option value="excluded">Não incluir neste cálculo</option><option value="zero">Considerar R$ 0,00, por escolha minha</option><option value="paid">Informar tempo e valor</option></select></label>
    {ux.labor === 'paid' && <div className="fields"><Field name="laborMinutes" label={draft.fields.basis === 'batch' ? 'Trabalho manual e acabamento no lote (minutos)' : 'Trabalho manual e acabamento por peça (minutos)'} decimal /><Field name="laborHour" label="Valor da hora de trabalho (aceita zero)" /></div>}
    <label className="check"><input type="checkbox" checked={ux.extrasIncluded} onChange={event => patch({ extrasIncluded: event.target.checked })} /> Incluir consumíveis e reserva de perdas por peça física</label>{ux.extrasIncluded && <div className="fields"><Field name="consumables" label="Consumíveis por peça" /><Field name="failure" label="Reserva informada de perdas por peça" /></div>}
  </details>;
}

export function PackagingFields() {
  const { ux, patch, draft } = useExperience();
  const choice = ux.packagingDecision ?? (ux.packagingIncluded ? 'include' : 'exclude');
  return <div id="packaging-cost" className="cost-block" tabIndex={-1}><h3>Embalagem</h3><p>O envelope ou caixa é uma despesa de envio, diferente do frete.</p>
    <label>Você usa embalagem para enviar o produto?<select value={choice} onChange={event => { const value = event.target.value as 'include' | 'exclude' | 'unknown'; patch({ packagingDecision: value, packagingIncluded: value === 'include' }); }}><option value="unknown">Ainda não sei</option><option value="exclude">Não incluir neste cálculo</option><option value="include">Sim — informar embalagem</option></select></label>
    {choice === 'unknown' && <p className="help-box">{ux.intent === 'sale' ? 'Confirme a embalagem antes de concluir o lucro da venda. Um custo desconhecido não será tratado como zero.' : 'Embalagem ainda não selecionada. O custo de impressão pode ser calculado sem ela.'}</p>}
    {choice === 'exclude' && <p className="scope-note">Embalagem excluída desta estimativa por sua escolha. Isso não comprova que seu custo real seja zero.</p>}
    {choice === 'include' && <><label>Como quer informar o custo?<select value={ux.packaging.mode} onChange={event => patch({ packaging: { ...ux.packaging, mode: event.target.value as 'unit' | 'pack' } })}><option value="pack">Comprei um pacote de embalagens</option><option value="unit">Sei o custo por embalagem</option></select></label>
      {ux.packaging.mode === 'unit' ? <Field name="packagingUnit" label="Custo por unidade comercial (peça ou kit)" /> : <div className="fields"><NumericInput name="package-price" label="Quanto custou o pacote?" kind="money" value={ux.packaging.amount} onValue={amount => patch({ packaging: { ...ux.packaging, amount } })} /><label>Quantas embalagens vieram no pacote?<input name="package-units" inputMode="numeric" value={ux.packaging.units} onChange={event => patch({ packaging: { ...ux.packaging, units: event.target.value } })} /></label></div>}
      <label className="check"><input type="checkbox" checked={ux.packagingExtraIncluded ?? text(draft, 'packagingOrder').trim() !== ''} onChange={event => patch({ packagingExtraIncluded: event.target.checked })} />Tenho uma segunda embalagem ou custo adicional por pedido</label>
      {(ux.packagingExtraIncluded ?? text(draft, 'packagingOrder').trim() !== '') && <Field name="packagingOrder" label="Custo adicional por pedido (uma vez só)" />}
      <p className="field-hint">O custo do pacote é dividido pela quantidade comprada. Se você não selecionar um adicional, ele ficará excluído do cálculo. Exclusão não comprova custo real zero.</p>
      <details><summary>Entender este valor</summary><p>Exemplo fictício: 100 envelopes por R$ 35,90 equivalem a R$ 0,359 por envelope antes de arredondar a apresentação. Este exemplo não preenche seus custos.</p><p>{draft.ux?.intent === 'sale' ? 'Usamos a quantidade de unidades comerciais deste pedido.' : 'Sem venda, consideramos uma embalagem por peça física produzida.'}</p></details>
    </>}
  </div>;
}
