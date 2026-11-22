import { useState } from 'react';

export function Field({ name, label, initial = '0', decimal = false }: { name: string; label: string; initial?: string; decimal?: boolean }) {
  return <label>{label}<input name={name} defaultValue={initial} inputMode="decimal" required pattern={decimal ? '[0-9]+([,.][0-9]{1,12})?' : '[0-9]+([,.][0-9]{1,2})?'} /></label>;
}

export function ScopeField({ name, label }: { name: string; label: string }) {
  return <label>{label}<select name={name} defaultValue="" required><option value="">Selecione a incidência</option><option value="item">Por unidade vendida</option><option value="order">Uma vez por pedido</option></select></label>;
}

export function BaseField({ name }: { name: string }) {
  return <label>Base do percentual personalizado<select name={name} defaultValue="" required><option value="">Selecione a base</option><option value="gross-sales">Receita bruta, antes do desconto do vendedor</option><option value="after-seller-discount">Receita após desconto do vendedor</option></select></label>;
}

export function ManualFeeFields({ id, label }: { id: string; label: string }) {
  const [enabled, setEnabled] = useState(false);
  const [kind, setKind] = useState('fixed');
  return <details><summary>Parâmetro personalizado — {label}</summary>
    <label className="check"><input type="checkbox" name={`${id}:manual`} checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Substituir esta cobrança por parâmetro informado por mim</label>
    {enabled && <div className="fields">
      <label>Fórmula personalizada<select name={`${id}:kind`} value={kind} onChange={event => setKind(event.target.value)}><option value="fixed">Valor fixo em reais</option><option value="percentage">Percentual da base selecionada</option></select></label>
      <Field key={kind} name={`${id}:value`} label={kind === 'fixed' ? 'Valor fixo personalizado (R$)' : 'Percentual personalizado (%)'} initial="" decimal={kind === 'percentage'} />
      <ScopeField name={`${id}:scope`} label="Incidência personalizada" />
      {kind === 'percentage' ? <BaseField name={`${id}:base`} /> : <input type="hidden" name={`${id}:base`} value="gross-sales" />}
      <label>Origem ou motivo da premissa<input name={`${id}:reference`} required maxLength={500} placeholder="Sem dados pessoais, pedidos ou credenciais" /></label>
    </div>}
    <p>O valor será identificado como personalizado, sem validação oficial. Zero só é aceito se informado explicitamente. Para antecipação ou outras bases não modeladas, informe o custo apurado como valor fixo por pedido.</p>
  </details>;
}

export function ParticipationField({ name, label, ruleId }: { name: string; label: string; ruleId: string }) {
  const [value, setValue] = useState('unknown');
  return <div><label>{label}<select name={name} value={value} onChange={event => setValue(event.target.value)}><option value="unknown">Não confirmado</option><option value="inactive">Sem participação</option><option value="active">Participação ativa na data</option></select></label>
    {value === 'active' && <ManualFeeFields id={ruleId} label={label} />}
  </div>;
}
