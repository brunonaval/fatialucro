import { useEffect, useState } from 'react';
import type { CalculatorDraft } from '../app/model';
import { newCalculationDraft, withExperience } from '../app/experience';
import type { ShopeeTable } from '../marketplaces/catalogs/types';
import { FormContext, Select } from './Fields';
import { ExperienceContext } from './ExperienceContext';
import { FilamentFields, OptionalCosts, PackagingFields, PrinterFields } from './CostFields';
import { ShopQuestions } from './ShopQuestions';

export interface WorkshopProgress { step: number; draft: CalculatorDraft }
export function WorkshopWizard({ initial, tables, onSave, onApply, onProfile }: { initial: WorkshopProgress | null; tables: readonly ShopeeTable[]; onSave: (progress: WorkshopProgress) => Promise<void>; onApply: (progress: WorkshopProgress) => Promise<void>; onProfile: (draft: CalculatorDraft, kind: 'printer' | 'filament') => Promise<void> }) {
  const [progress, setProgress] = useState<WorkshopProgress>(() => initial ?? { step: 0, draft: newCalculationDraft() }); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (initial) setProgress(initial); }, [initial]);
  const draft = withExperience(progress.draft); const titles = ['Canal de venda', 'Impressora', 'Filamento', 'Custos opcionais'];
  async function persist(apply: boolean) {
    setBusy(true); setMessage(''); try { if (apply) await onApply(progress); else await onSave(progress); setMessage(apply ? 'Configurações salvas e aplicadas somente aos campos correspondentes.' : 'Etapa salva. Você pode continuar depois e calcular agora sem terminar a oficina.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a oficina.'); } finally { setBusy(false); }
  }
  const noProfile = () => {};
  return <section className="workshop-wizard"><div className="section-heading"><span className="step-label">Assistente opcional · etapa {progress.step + 1} de 4</span><h2>Configurar minha oficina</h2><p>Faça só o que for útil agora. Deixar uma etapa para depois não bloqueia seu cálculo.</p></div>
    <FormContext value={{ draft, setField: (name, value) => setProgress({ ...progress, draft: { ...draft, fields: { ...draft.fields, [name]: value } } }) }}><ExperienceContext value={{ draft, update: updated => setProgress({ ...progress, draft: updated }) }}>
      <div className="wizard-progress" aria-label="Etapas da oficina">{titles.map((title, index) => <button type="button" key={title} className="secondary" aria-current={progress.step === index ? 'step' : undefined} onClick={() => setProgress({ ...progress, step: index })}>{index + 1}. {title}</button>)}</div>
      {progress.step === 0 ? <><Select name="marketplace" label="Onde costuma vender?"><option value="direct">Venda direta ou só custos, sem loja de marketplace</option><option value="shopee">Shopee Brasil</option></Select>{draft.fields.marketplace === 'shopee' ? <ShopQuestions tables={tables} permanentOnly /> : <p className="help-box">Você não precisa configurar a Shopee.</p>}</> : progress.step === 1 ? <PrinterFields entries={[]} onProfile={noProfile} /> : progress.step === 2 ? <FilamentFields entries={[]} onProfile={noProfile} /> : <><PackagingFields /><OptionalCosts /></>}
    </ExperienceContext></FormContext>
    {(progress.step === 1 || progress.step === 2) && <button type="button" className="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await onProfile(draft, progress.step === 1 ? 'printer' : 'filament'); setMessage('Perfil salvo. Você pode usá-lo sem terminar o assistente.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Confira os dados deste perfil.'); } finally { setBusy(false); } }}>{progress.step === 1 ? 'Salvar esta impressora' : 'Salvar este filamento'}</button>}
    <div className="step-actions"><button type="button" className="secondary" disabled={busy} onClick={() => { void persist(false); }}>Salvar e retomar depois</button>{progress.step < 3 ? <button type="button" disabled={busy} onClick={() => setProgress({ ...progress, step: progress.step + 1 })}>Próxima etapa ou pular →</button> : <button type="button" disabled={busy} onClick={() => { void persist(true); }}>Salvar e usar no cálculo</button>}</div>
    <p className="muted">Valor de venda, peças produzidas, quantidade vendida e frete do pedido não pertencem aos perfis da oficina.</p>{message && <p className="message" role="status">{message}</p>}
  </section>;
}
