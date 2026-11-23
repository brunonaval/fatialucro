import type { ShopeeCheckpoint, ShopeeCheckpointId } from '../app/shopee-checkpoints';

export function ShopSetupGuide({ checks, onNavigate }: { checks: readonly ShopeeCheckpoint[]; onNavigate: (target: ShopeeCheckpointId) => void }) {
  const pending = checks.filter(check => check.state === 'pending');
  const review = checks.filter(check => check.state === 'review');
  const answered = checks.filter(check => check.state === 'answered');
  return <section className="shop-checklist" aria-label="Conferência das condições da loja">
    <h3>Conferência rápida da Shopee</h3>
    <p>{pending.length
      ? `Faltam ${pending.length} ${pending.length === 1 ? 'resposta' : 'respostas'} sobre sua loja. Confira somente o que está pendente:`
      : 'As respostas básicas da loja foram informadas. Isso não comprova as tarifas nem conclui automaticamente o lucro.'}</p>
    {!!(pending.length || review.length) && <ul className="shop-checklist-items">
      {[...pending, ...review].map(check => <li key={check.id}>
        <div><strong>{check.label}</strong> <span className="field-necessity">{check.state === 'pending' ? 'Falta confirmar' : 'Conferir cobrança'}</span></div>
        <p>{check.detail}</p>
        <button type="button" className="secondary" onClick={() => onNavigate(check.id)}>{check.state === 'pending' ? 'Informar ou conferir' : 'Ver condição'}</button>
      </li>)}
    </ul>}
    {!!answered.length && <details><summary>{answered.length} {answered.length === 1 ? 'resposta já informada' : 'respostas já informadas'}</summary>
      <ul>{answered.map(check => <li key={check.id}><strong>{check.label}:</strong> {check.detail}</li>)}</ul>
    </details>}
    <p className="field-hint">Uma resposta registrada não garante lucro final: comissões, vigência documental e outras cobranças ainda podem exigir confirmação.</p>
  </section>;
}
