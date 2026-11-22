import { useEffect, useRef, useState } from 'react';
import { checkCatalogUpdate } from '../marketplaces/catalogs/update';
import type { ValidatedPackage } from '../marketplaces/catalogs/types';

export function CatalogManager({ active, onApply }: { active: ValidatedPackage; onApply: (catalog: ValidatedPackage) => Promise<void> }) {
  const [candidate, setCandidate] = useState<ValidatedPackage | null>(null); const [busy, setBusy] = useState(false); const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState(''); const [error, setError] = useState(''); const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function check() {
    controller.current?.abort(); const task = new AbortController(); controller.current = task; setBusy(true); setError(''); setStatus(''); setCandidate(null);
    try {
      const next = await checkCatalogUpdate(active, fetch, task.signal); if (task.signal.aborted) return;
      if (next.manifest.releaseSequence === active.manifest.releaseSequence) setStatus('Nenhuma publicação nova. A data de verificação documental das tarifas permanece a mesma.');
      else { setCandidate(next); setStatus('Publicação íntegra e revisada disponível. Confira as informações antes de aplicar.'); }
    } catch (problem) { if (!task.signal.aborted) setError(problem instanceof Error ? problem.message : 'Consulta indisponível. O catálogo local foi preservado.'); }
    finally { if (!task.signal.aborted) setBusy(false); }
  }
  return <section aria-labelledby="catalog-heading"><h2 id="catalog-heading">Catálogo de tarifas</h2><p>Canal público de revisão do PR #1 · publicação local {active.manifest.releaseSequence}.</p>
    <p className="muted">Consulta opcional ao GitHub. O aplicativo continua funcionando offline. Uma consulta não verifica novamente os documentos oficiais nem altera valores por conta própria.</p>
    <button type="button" className="secondary" disabled={busy || applying} onClick={() => { void check(); }}>{busy ? 'Consultando publicação…' : 'Consultar atualizações no GitHub'}</button>
    {status && <p role="status" className="success">{status}</p>}{error && <p role="alert" className="notice">{error}</p>}
    {candidate && <div className="update-preview"><h3>Revisar publicação {candidate.manifest.releaseSequence}</h3><p>Revisão: {candidate.manifest.review.reference}</p><ul>{candidate.tables.filter(table => !active.tables.some(old => old.id === table.id)).map(table => <li key={table.id}><strong>Versão {table.version}</strong> · {table.confirmation === 'confirmed' ? 'período comprovado' : table.confirmation === 'withdrawn' ? 'retirada documental' : 'referência documental'} · última verificação {table.lastVerified} · vigência {table.effectiveFrom ?? 'início não comprovado'} a {table.effectiveUntil ?? 'fim não comprovado'}<p>{table.review.reference}</p><ul>{table.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">Fonte oficial: {source.id}</a></li>)}</ul></li>)}</ul>
      <button type="button" disabled={applying} onClick={async () => { setApplying(true); setError(''); try { await onApply(candidate); setCandidate(null); setStatus('Catálogo revisado aplicado e salvo localmente. Simulações antigas foram preservadas.'); } catch (problem) { setError(String(problem)); } finally { setApplying(false); } }}>{applying ? 'Salvando catálogo…' : 'Aplicar publicação revisada'}</button>
    </div>}
    <details><summary>Versões disponíveis e origem</summary>{active.tables.map(table => <article key={table.id} className="catalog-entry"><h3>{table.version}</h3><p>Verificação documental: {table.lastVerified}. Estado: {table.confirmation === 'confirmed' ? 'vigência documentada' : table.confirmation === 'withdrawn' ? 'retirada' : 'documental, sem vigência comprovada'}. Período: {table.effectiveFrom ?? 'início não comprovado'} a {table.effectiveUntil ?? 'fim não comprovado'}.</p><p>{table.review.reference}</p><ul>{table.boundaryReview.map(item => <li key={item.price}>R$ {item.price.replace('.', ',')}: {item.note}</li>)}</ul></article>)}</details>
  </section>;
}
