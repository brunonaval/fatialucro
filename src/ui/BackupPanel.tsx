import { useState } from 'react';
import { decodeBackup } from '../app/storage';
export function BackupPanel({ onExport, onImport, busy }: { onExport: () => void; onImport: (text: string) => Promise<boolean>; busy: boolean }) {
  const [pending, setPending] = useState<{ text: string; count: number; name: string } | null>(null); const [error, setError] = useState('');
  async function choose(file: File | undefined) {
    setError(''); setPending(null); if (!file) return;
    try { if (file.size > 12 * 1024 * 1024) throw new Error('O backup excede 12 MB.'); const text = await file.text(); const entries = decodeBackup(text); setPending({ text, count: entries.length, name: file.name }); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Backup inválido. Seus dados não foram alterados.'); }
  }
  return <section><h2>Backup e recuperação</h2><p>Dados ficam neste dispositivo. Exporte uma cópia antes de limpar dados, trocar de instalação ou desinstalar. O backup contém produtos, simulações e lixeira; mantenha-o privado.</p><button type="button" className="secondary" disabled={busy} onClick={onExport}>Exportar backup local</button><label>Selecionar backup para restaurar<input type="file" accept=".json,application/json" disabled={busy} onChange={event => { void choose(event.target.files?.[0]); event.target.value = ''; }} /></label>
    {error && <p className="notice" role="alert">{error}</p>}{pending && <div className="confirm-inline"><p>“{pending.name}” contém {pending.count} registros válidos. Registros diferentes com o mesmo ID serão preservados como cópias; nada do histórico atual será sobrescrito.</p><button type="button" disabled={busy} onClick={async () => { if (await onImport(pending.text)) setPending(null); }}>Confirmar restauração</button><button type="button" className="secondary" onClick={() => setPending(null)}>Cancelar</button></div>}
  </section>;
}
