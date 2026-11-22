import { useEffect, useRef, useState } from 'react';
import type { CalculatorDraft } from '../app/model';
import { applyPlate } from '../app/model';
import { MAX_ARCHIVE_BYTES, MAX_GCODE_BYTES } from '../importers/limits';
import type { PrintImport as ImportData } from '../importers';

export function PrintImport({ draft, onApply }: { draft: CalculatorDraft; onApply: (draft: CalculatorDraft) => void }) {
  const [data, setData] = useState<ImportData | null>(null); const [plateId, setPlateId] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const worker = useRef<Worker | null>(null);
  const revision = useRef(0);
  useEffect(() => () => { revision.current++; worker.current?.terminate(); }, []);
  async function read(file: File | undefined) {
    revision.current++; const current = revision.current; worker.current?.terminate(); setData(null); setError(''); setBusy(false);
    if (!file) return;
    const is3mf = /\.3mf$/i.test(file.name);
    if (!/\.(3mf|gcode|gco|g)$/i.test(file.name)) { setError('Selecione 3MF fatiado ou G-code textual compatível.'); return; }
    if (file.size > (is3mf ? MAX_ARCHIVE_BYTES : MAX_GCODE_BYTES)) { setError(`Limite de ${is3mf ? '100' : '20'} MB excedido.`); return; }
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer(); if (current !== revision.current) return;
      const task = new Worker(new URL('../importers/worker.ts', import.meta.url), { type: 'module' }); worker.current = task;
      task.onmessage = (event: MessageEvent<{ result?: ImportData; error?: string }>) => {
        if (current !== revision.current) return;
        setBusy(false); task.terminate(); worker.current = null;
        if (event.data.result) { setData(event.data.result); setPlateId(event.data.result.plates[0]?.id ?? ''); }
        else setError(event.data.error ?? 'Falha na importação.');
      };
      task.onerror = () => { if (current === revision.current) { setBusy(false); setError('Não foi possível ler o arquivo local.'); } task.terminate(); };
      task.postMessage({ fileName: file.name, bytes }, [bytes]);
    } catch (problem) { if (current === revision.current) { setBusy(false); setError(problem instanceof Error ? problem.message : 'Falha ao ler arquivo.'); } }
  }
  return <details><summary>Importar impressão Bambu 3MF ou G-code</summary>
    <p>Leitura local de metadados, sem enviar arquivos. Valores extraídos são estimativas do fatiador e precisam corresponder às peças que serão vendidas.</p>
    <label>Arquivo fatiado<input type="file" accept=".3mf,.gcode,.gco,.g" onChange={event => { void read(event.target.files?.[0]); }} /></label>
    {busy && <p role="status">Lendo metadados…</p>}{error && <p role="alert" className="notice">{error}</p>}
    {data && <><p>{data.fileName} · Impressora: {data.printer ?? 'não identificada'} · Material: {data.material ?? 'consultar placa'}</p>
      {!!data.plates.length && <><label>Placa<select value={plateId} onChange={event => setPlateId(event.target.value)}>{data.plates.map(plate => <option key={plate.id} value={plate.id}>{plate.name} · {plate.grams ?? '?'} g · {plate.seconds ?? '?'} s · {plate.pieces ?? '?'} peças</option>)}</select></label>
        <button type="button" className="secondary" onClick={() => { const plate = data.plates.find(item => item.id === plateId); if (plate) onApply(applyPlate(draft, plate)); }}>Aplicar placa à produção</button></>}
      {!data.plates.length && <button type="button" className="secondary" onClick={() => onApply(applyPlate(draft, { id: 'manual', name: 'Manual', grams: null, seconds: null, pieces: null, materials: [] }))}>Preparar preenchimento manual</button>}
      <ul>{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      <p>Aplicar substitui peso, tempo e quantidade produzida. Preços por kg exigem preenchimento ou perfil. Quantidade vendida permanece independente.</p>
    </>}
  </details>;
}
