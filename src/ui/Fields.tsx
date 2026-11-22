import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { CalculatorDraft } from '../app/model';

export const FormContext = createContext<{ draft: CalculatorDraft; setField: (name: string, value: string | boolean) => void } | null>(null);
export function useForm() { const context = useContext(FormContext); if (!context) throw new Error('Formulário indisponível.'); return context; }
export function Input({ name, label, type = 'text', required = true }: { name: string; label: string; type?: string; required?: boolean }) {
  const { draft, setField } = useForm();
  return <label>{label}<input type={type} name={name} value={String(draft.fields[name] ?? '')} onChange={event => setField(name, event.target.value)} required={required} maxLength={2000} /></label>;
}
export function Select({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  const { draft, setField } = useForm();
  return <label>{label}<select name={name} value={String(draft.fields[name] ?? '')} onChange={event => setField(name, event.target.value)}>{children}</select></label>;
}
export function Check({ name, children }: { name: string; children: ReactNode }) {
  const { draft, setField } = useForm();
  return <label className="check"><input type="checkbox" name={name} checked={draft.fields[name] === true} onChange={event => setField(name, event.target.checked)} />{children}</label>;
}
export function Field({ name, label, decimal = false }: { name: string; label: string; decimal?: boolean }) {
  const { draft, setField } = useForm();
  return <label>{label}<input name={name} value={String(draft.fields[name] ?? '')} onChange={event => setField(name, event.target.value)} inputMode="decimal" required pattern={decimal ? '[0-9]+([,.][0-9]{1,12})?' : '[0-9]+([,.][0-9]{1,2})?'} /></label>;
}
export function ScopeField({ name, label }: { name: string; label: string }) {
  return <Select name={name} label={label}><option value="">Selecione a incidência</option><option value="item">Por unidade vendida</option><option value="order">Uma vez por pedido</option></Select>;
}
export function BaseField({ name }: { name: string }) {
  return <Select name={name} label="Base do percentual personalizado"><option value="">Selecione a base</option><option value="gross-sales">Receita bruta, antes do desconto do vendedor</option><option value="after-seller-discount">Receita após desconto do vendedor</option></Select>;
}
export function ManualFeeFields({ id, label }: { id: string; label: string }) {
  const { draft } = useForm(); const kind = draft.fields[`${id}:kind`];
  return <details><summary>Parâmetro personalizado — {label}</summary>
    <Check name={`${id}:manual`}>Substituir esta cobrança por parâmetro informado por mim</Check>
    {draft.fields[`${id}:manual`] === true && <div className="fields">
      <Select name={`${id}:kind`} label="Fórmula personalizada"><option value="fixed">Valor fixo em reais</option><option value="percentage">Percentual da base selecionada</option></Select>
      <Field name={`${id}:value`} label={kind === 'fixed' ? 'Valor fixo personalizado (R$)' : 'Percentual personalizado (%)'} decimal={kind === 'percentage'} />
      <ScopeField name={`${id}:scope`} label="Incidência personalizada" />
      <BaseField name={`${id}:base`} />
      <Input name={`${id}:reference`} label="Origem ou motivo da premissa (sem informações privadas)" />
    </div>}
    <p>Origem personalizada, sem validação oficial. Zero exige preenchimento explícito. Para uma base ainda não modelada, informe o custo apurado como valor fixo por pedido.</p>
  </details>;
}
export function ParticipationField({ name, label, ruleId }: { name: string; label: string; ruleId: string }) {
  const { draft } = useForm();
  return <div><Select name={name} label={label}><option value="unknown">Não confirmado</option><option value="inactive">Sem participação</option><option value="active">Participação ativa na data</option></Select>
    {draft.fields[name] === 'active' && <ManualFeeFields id={ruleId} label={label} />}
  </div>;
}
