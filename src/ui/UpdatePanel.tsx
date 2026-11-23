import { useState } from 'react';
import appPackage from '../../package.json';
import { checkPublishedRelease, UPDATE_RELEASES_URL } from '../app/app-updates';
import type { VersionCheck } from '../app/app-updates';

/** The first bridge build checks official releases; unsigned packages are never run. */
export function UpdatePanel() {
  const [phase, setPhase] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<VersionCheck | null>(null);
  const [error, setError] = useState('');
  async function checkNow() {
    setPhase('checking'); setError(''); setResult(null);
    try {
      setResult(await checkPublishedRelease(appPackage.version));
      setPhase('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'A consulta falhou. Verifique sua conexão.');
      setPhase('error');
    }
  }
  return <section className="update-panel" aria-label="Atualizações do FatiaLucro">
    <h2>Atualizações do FatiaLucro</h2>
    <p>Versão instalada: <strong>{appPackage.version}</strong></p>
    <button type="button" disabled={phase === 'checking'} onClick={() => { void checkNow(); }}>
      {phase === 'checking' ? 'Procurando atualizações…' : 'Buscar atualizações'}
    </button>
    <div aria-live="polite" role="status">
      {phase === 'error' && <p className="notice">{error}</p>}
      {result?.status === 'not-published' && <p>Ainda não há uma versão estável publicada. As compilações de teste do GitHub Actions não são atualizações automáticas.</p>}
      {result?.status === 'current' && <p>Você já utiliza a versão estável mais recente publicada.</p>}
      {result?.status === 'available' && <div className="update-available"><strong>Nova versão {result.release.version} disponível.</strong>
        <p>Esta instalação ainda não tem o canal de atualização automática assinada configurado. Por segurança, nenhuma instalação será iniciada sem verificar a assinatura.</p>
        <a target="_blank" rel="noopener noreferrer" href={result.release.page}>Abrir página oficial para instalar a versão</a>
      </div>}
    </div>
    <p className="field-hint">A verificação só ocorre ao clicar. Seus dados locais não são enviados; a consulta acessa apenas a página pública de versões do projeto.</p>
    <a href={UPDATE_RELEASES_URL} target="_blank" rel="noopener noreferrer" className="text-button">Histórico de versões publicadas</a>
  </section>;
}
