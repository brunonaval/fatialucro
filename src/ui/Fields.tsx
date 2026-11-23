import { createContext, useContext, useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { CalculatorDraft } from '../app/model';
import type { GuidedIssue } from './guided-validation';
import { editableNumeric, formattedNumeric, kindForField, normalizeNumeric, numericIssue } from './format';
import type { FieldKind } from './format';
import { D } from '../engine/decimal';

export const FormContext = createContext<{ draft: CalculatorDraft; setField: (name: string, value: string | boolean) => void; issues?: readonly GuidedIssue[]; showErrors?: boolean } | null>(null);
export function useForm() { const context = useContext(FormContext); if (!context) throw new Error('Formulário indisponível.'); return context; }
export function Input({ name, label, type = 'text', required = true }: { name: string; label: string; type?: string; required?: boolean }) {
  const { draft, setField, issues, showErrors } = useForm(); const id = useId(); const [touched, setTouched] = useState(false);
  const value = String(draft.fields[name] ?? ''); const count = ['pieces', 'quantity', 'orders'].includes(name);
  const local = required && !value ? `Informe ${label.toLowerCase()}.` : count && value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < (name === 'orders' ? 0 : 1) || name !== 'orders' && Number(value) > 10000) ? 'Informe uma quantidade inteira válida.' : '';
  const guided = showErrors ? issues?.find(item => item.field === name)?.message ?? '' : '';
  const issue = guided || (touched ? local : '');
  return <label htmlFor={id} className={issue ? 'field-needs-attention' : undefined}>
    {label}<span className="field-necessity">{required ? 'Obrigatório' : 'Opcional'}</span>
    <input id={id} type={type} name={name} value={value} inputMode={count ? 'numeric' : undefined} onChange={event => { setTouched(true); setField(name, event.target.value); }} onBlur={() => setTouched(true)} required={required} maxLength={2000} aria-invalid={issue ? true : undefined} aria-describedby={issue ? `${id}-help` : undefined} />
    {issue && <small id={`${id}-help`} className="field-error" role="alert">{issue}</small>}
  </label>;
}
export function Select({ name, label, children, required = true }: { name: string; label: string; children: ReactNode; required?: boolean }) {
  const { draft, setField, issues, showErrors } = useForm();
  const issue = showErrors ? issues?.find(item => item.field === name)?.message : undefined;
  return <label className={issue ? 'field-needs-attention' : undefined}>{label}<span className="field-necessity">{required ? 'Obrigatório' : 'Opcional'}</span>
    <select name={name} value={String(draft.fields[name] ?? '')} onChange={event => setField(name, event.target.value)} aria-invalid={issue ? true : undefined}>{children}</select>
    {issue && <small className="field-error" role="alert">{issue}</small>}
  </label>;
}
export function Check({ name, children }: { name: string; children: ReactNode }) {
  const { draft, setField } = useForm();
  return <label className="check"><input type="checkbox" name={name} checked={draft.fields[name] === true} onChange={event => setField(name, event.target.checked)} />{children}</label>;
}
export function NumericInput({ value, onValue, kind, name, label, required = true }: { value: string; onValue: (value: string) => void; kind: FieldKind; name: string; label: string; required?: boolean }) {
  const id = useId(); const [editing, setEditing] = useState<string | null>(null); const [touched, setTouched] = useState(false);
  const { issues, showErrors } = useForm();
  const guided = showErrors ? issues?.find(item => item.field === name)?.message ?? '' : '';
  const local = !touched || editing !== null ? '' : !value && !required ? '' : !value ? ({ 'spool-price': 'Informe o preço pago pela bobina.', 'spool-weight': 'Informe o peso líquido de filamento comprado.', hours: 'Informe o tempo de impressão.', shipping: 'Confirme o custo líquido do frete.' } as Record<string, string>)[name] ?? `Informe ${label.toLowerCase()}.` : numericIssue(value, kind);
  const issue = guided || local;
  const update = (input: string) => {
    const next = normalizeNumeric(input, kind);
    if (!numericIssue(next, kind) && !numericIssue(value, kind) && new D(next.replace(',', '.')).eq(value.replace(',', '.'))) return;
    if (next !== value) onValue(next);
  };
  const unit = kind === 'money' ? 'R$' : kind === 'ratio' || kind === 'percent' ? '%' : kind === 'weight' ? 'g' : kind === 'duration' ? 'h:m:s' : '';
  return <label htmlFor={id} className={issue ? 'field-needs-attention' : undefined}>{label} <span className="field-necessity">{required ? 'Obrigatório' : 'Opcional'}</span><span className={`numeric-control ${issue ? 'has-error' : ''}`}><input id={id} name={name} value={editing ?? formattedNumeric(value, kind)} inputMode={kind === 'duration' ? 'text' : 'decimal'} required={required} aria-invalid={issue ? true : undefined} aria-describedby={`${id}-help`}
    onFocus={() => setEditing(editableNumeric(value, kind))}
    onChange={event => { setTouched(true); setEditing(event.target.value); update(event.target.value); }}
    onBlur={event => { update(event.target.value); setEditing(null); setTouched(true); }} />{unit && <span aria-hidden="true" className="unit">{unit}</span>}</span>
    <small id={`${id}-help`} className={issue ? 'field-error' : 'field-hint'}>{issue || (kind === 'duration' ? 'Horas:minutos:segundos ou horas decimais.' : kind === 'ratio' ? 'Porcentagem da receita após desconto.' : '\u00a0')}</small>
  </label>;
}
export function Field({ name, label, decimal = false, required = true }: { name: string; label: string; decimal?: boolean; required?: boolean }) {
  const { draft, setField } = useForm();
  return <NumericInput name={name} label={label} value={String(draft.fields[name] ?? '')} onValue={value => setField(name, value)} kind={kindForField(name, decimal)} required={required} />;
}
export function ScopeField({ name, label }: { name: string; label: string }) {
  return <Select name={name} label={label}><option value="">Selecione a incidência</option><option value="item">Por unidade vendida</option><option value="order">Uma vez por pedido</option></Select>;
}
export function BaseField({ name }: { name: string }) {
  return <Select name={name} label="Base do percentual personalizado"><option value="">Selecione a base</option><option value="gross-sales">Receita bruta, antes do desconto do vendedor</option><option value="after-seller-discount">Receita após desconto do vendedor</option></Select>;
}
export function ManualFeeFields({ id, label, inline = false }: { id: string; label: string; inline?: boolean }) {
  const { draft } = useForm(); const kind = draft.fields[`${id}:kind`];
  const body = <>
    <Check name={`${id}:manual`}>Substituir esta cobrança por parâmetro informado por mim</Check>
    {draft.fields[`${id}:manual`] === true && <div className="fields">
      <Select name={`${id}:kind`} label="Fórmula personalizada"><option value="fixed">Valor fixo em reais</option><option value="percentage">Percentual da base selecionada</option></Select>
      <Field name={`${id}:value`} label={kind === 'fixed' ? 'Valor fixo personalizado (R$)' : 'Percentual personalizado (%)'} decimal={kind === 'percentage'} />
      <ScopeField name={`${id}:scope`} label="Incidência personalizada" />
      <BaseField name={`${id}:base`} />
      <Input name={`${id}:reference`} label="Origem ou motivo da premissa (sem informações privadas)" />
    </div>}
    <p>Origem personalizada, sem validação oficial. Zero exige preenchimento explícito. Para uma base ainda não modelada, informe o custo apurado como valor fixo por pedido.</p>
  </>;
  return inline ? <fieldset><legend>Parâmetro personalizado — {label}</legend>{body}</fieldset> : <details><summary>Parâmetro personalizado — {label}</summary>{body}</details>;
}
export function ParticipationField({ name, label, ruleId }: { name: string; label: string; ruleId: string }) {
  const { draft } = useForm();
  return <div><Select name={name} label={label}><option value="unknown">Não confirmado</option><option value="inactive">Sem participação</option><option value="active">Participação ativa na data</option></Select>
    {draft.fields[name] === 'active' && <ManualFeeFields id={ruleId} label={label} />}
  </div>;
}
