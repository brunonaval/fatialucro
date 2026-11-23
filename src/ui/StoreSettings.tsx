import { useEffect, useState } from 'react';
import type { CalculatorDraft } from '../app/model';
import { newCalculationDraft, withExperience } from '../app/experience';
import { applySavedStore } from '../app/preferences';
import type { SavedEntry } from '../app/storage';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { FormContext } from './Fields';
import { ExperienceContext } from './ExperienceContext';
import { ShopQuestions } from './ShopQuestions';

export function StoreSettings({ saved, tables, onSave }: { saved: SavedEntry | undefined; tables: readonly ShopeeTable[]; onSave: (draft: CalculatorDraft) => Promise<void> }) {
  const fresh = () => { const draft = newCalculationDraft(); draft.fields.marketplace = 'shopee'; return saved ? applySavedStore(draft, saved.draft, saved.updatedAt) : draft; };
  const [draft, setDraft] = useState(fresh); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(fresh()); }, [saved]);
  return <section><h2>Minha loja Shopee</h2><p>Cadastre sua loja sem alterar peso, tempo, preço ou pedido em edição. Condições temporárias serão conferidas em cada data.</p>
    <details><summary>{saved ? 'Conferir ou editar minha loja' : 'Configurar loja (opcional)'}</summary><FormContext value={{ draft, setField: (name, value) => setDraft({ ...draft, fields: { ...draft.fields, [name]: value } }) }}><ExperienceContext value={{ draft: withExperience(draft), update: setDraft }}><ShopQuestions tables={tables} permanentOnly /></ExperienceContext></FormContext>
      <button type="button" className="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await onSave(draft); setMessage('Minha loja salva neste dispositivo.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); } finally { setBusy(false); } }}>Salvar minha loja Shopee</button>
      {message && <p role="status">{message}</p>}
    </details>
  </section>;
}
