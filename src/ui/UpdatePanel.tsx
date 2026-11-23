import { useEffect, useRef, useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';
import appPackage from '../../package.json';
import { checkPublishedRelease, UPDATE_RELEASES_URL } from '../app/app-updates';
import type { VersionCheck } from '../app/app-updates';
import { checkSignedUpdate, installSignedUpdate, SIGNED_UPDATER_ENABLED } from '../app/signed-update';

type Phase = 'idle' | 'checking' | 'available' | 'installing' | 'finished' | 'error';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a atualização. Verifique a conexão e tente novamente.';
}

/**
 * Signed production releases check, download and install inside Tauri.
 * QA/development builds can inspect release availability but have no install
 * permission or signing key. Never run a downloaded executable via shell.
 */
export function UpdatePanel({ beforeInstall }: { beforeInstall?: () => Promise<void> }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [legacyResult, setLegacyResult] = useState<VersionCheck | null>(null);
  const available = useRef<Update | null>(null);

  useEffect(() => () => {
    const current = available.current;
    available.current = null;
    if (current) void current.close().catch(() => {});
  }, []);

  async function checkNow() {
    if (phase === 'checking' || phase === 'installing') return;
    setPhase('checking'); setError(''); setVersion(''); setNotes('');
    setLegacyResult(null); setProgress(null);
    if (available.current) {
      const previous = available.current;
      available.current = null;
      try { await previous.close(); } catch { /* Resource is already freed. */ }
    }
    try {
      if (SIGNED_UPDATER_ENABLED) {
        const release = await checkSignedUpdate();
        if (!release) { setPhase('idle'); setLegacyResult({ status: 'current', installed: appPackage.version }); return; }
        available.current = release.update;
        setVersion(release.version);
        setNotes(release.notes);
        setPhase('available');
      } else {
        // Unconfigured QA installers have no updater privileges.
        setLegacyResult(await checkPublishedRelease(appPackage.version));
        setPhase('idle');
      }
    } catch (cause) {
      setError(errorText(cause));
      setPhase('error');
    }
  }

  async function install() {
    if (!SIGNED_UPDATER_ENABLED || !available.current || phase !== 'available') return;
    try {
      // The current draft is explicitly flushed to IndexedDB before Windows
      // exits and launches its signed installer.
      if (beforeInstall) await beforeInstall();
    } catch (cause) {
      setError('O rascunho ainda não foi salvo. A atualização não começou. ' + errorText(cause));
      setPhase('error');
      return;
    }
    setError(''); setProgress(null); setPhase('installing');
    try {
      await installSignedUpdate(available.current, setProgress);
      // On Windows Tauri exits after successfully launching the installer.
      // If this callback resolves on another platform, never claim reboot.
      setPhase('finished');
    } catch (cause) {
      setError('A instalação não foi concluída. Seus dados continuam disponíveis. ' + errorText(cause));
      setPhase('error');
    }
  }

  const busy = phase === 'checking' || phase === 'installing';
  return <section className="update-panel" aria-label="Atualizações do FatiaLucro">
    <h2>Atualizações do FatiaLucro</h2>
    <p>Versão instalada: <strong>{appPackage.version}</strong></p>
    <button type="button" disabled={busy} onClick={() => { void checkNow(); }}>
      {phase === 'checking' ? 'Procurando atualizações…' : 'Buscar atualizações'}
    </button>
    <div aria-live="polite" role="status">
      {phase === 'error' && <p className="field-error">{error}</p>}
      {SIGNED_UPDATER_ENABLED && phase === 'available' && <div className="update-available">
        <h3>Nova versão {version} disponível</h3>
        {notes && <details><summary>O que mudou</summary><p className="update-notes">{notes}</p></details>}
        <p>O FatiaLucro vai baixar e verificar a assinatura da atualização, instalar e reiniciar. Seu cálculo será salvo antes de começar.</p>
        <button type="button" onClick={() => { void install(); }}>Atualizar e reiniciar</button>
        <button type="button" className="secondary" onClick={() => { void checkNow(); }}>Deixar para depois</button>
      </div>}
      {phase === 'installing' && <div className="update-progress">
        <strong>Baixando e verificando a atualização…</strong>
        <progress value={progress ?? undefined} max={100} aria-label="Progresso da atualização"/>
        <p>{progress === null ? 'Baixando os arquivos…' : progress < 100 ? `${progress}% transferido` : 'Download concluído. Preparando instalação segura…'}</p>
        <p>Não feche o FatiaLucro durante esta etapa.</p>
      </div>}
      {phase === 'finished' && <p>A instalação foi iniciada. O aplicativo pode ser fechado e reaberto pelo instalador.</p>}
      {legacyResult?.status === 'not-published' && <p>Ainda não existe uma versão estável publicada.</p>}
      {legacyResult?.status === 'current' && <p>Seu FatiaLucro está na versão mais recente disponível.</p>}
      {legacyResult?.status === 'available' && <div className="update-available">
        <p>Existe uma versão {legacyResult.release.version} publicada, mas esta instalação é de homologação e não tem atualizador assinado.</p>
        <a target="_blank" rel="noopener noreferrer" href={legacyResult.release.page}>Abrir versão oficial</a>
      </div>}
    </div>
    {!SIGNED_UPDATER_ENABLED && <p className="field-hint">Esta é uma compilação de teste, sem instalação automática. A versão oficial assinada terá o botão “Atualizar e reiniciar”.</p>}
    <p className="field-hint">A verificação é feita somente quando você clica. O programa não envia seus arquivos, custos ou dados da loja.</p>
    <a href={UPDATE_RELEASES_URL} target="_blank" rel="noopener noreferrer" className="text-button">Histórico de versões publicadas</a>
  </section>;
}
