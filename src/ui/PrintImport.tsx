import { useEffect, useId, useRef, useState } from 'react';
import type { CalculatorDraft } from '../app/model';
import { applyImportedPlate, withExperience } from '../app/experience';
import { MAX_ARCHIVE_BYTES, MAX_GCODE_BYTES } from '../importers/limits';
import type { PrintImport as ImportData } from '../importers';
import { formattedNumeric } from './format';
import { D } from '../engine/decimal';

export function PrintImport({ draft, onApply, primary = false, disabled = false }: { draft: CalculatorDraft; onApply: (draft: CalculatorDraft) => void; primary?: boolean; disabled?: boolean }) {
  const id = useId(); const input = useRef<HTMLInputElement | null>(null); const [data, setData] = useState<ImportData | null>(null); const [plateId, setPlateId] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [dragging, setDragging] = useState(false); const worker = useRef<Worker | null>(null); const revision = useRef(0);
  useEffect(() => () => { revision.current++; worker.current?.terminate(); }, []);
  async function read(file: File | undefined) {
    if (disabled) return;
    revision.current++; const current = revision.current; worker.current?.terminate(); setData(null); setError(''); setBusy(false);
    if (!file) return;
    if (!/\.(3mf|gcode|gco|g)$/i.test(file.name)) { setError('Use uma placa fatiada .3mf/.gcode.3mf ou G-code textual. STL e G-code binário não trazem metadados compatíveis para este importador.'); return; }
    if (file.size > (/\.3mf$/i.test(file.name) ? MAX_ARCHIVE_BYTES : MAX_GCODE_BYTES)) { setError('Arquivo acima do limite: 100 MB para 3MF ou 20 MB para G-code.'); return; }
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer(); if (current !== revision.current) return;
      const task = new Worker(new URL('../importers/worker.ts', import.meta.url), { type: 'module' }); worker.current = task;
      task.onmessage = (event: MessageEvent<{ result?: ImportData; error?: string }>) => {
        if (current !== revision.current) return;
        setBusy(false); task.terminate(); worker.current = null;
        if (event.data.result) { setData(event.data.result); setPlateId(event.data.result.plates[0]?.id ?? ''); } else setError(event.data.error ?? 'Não foi possível ler os dados do arquivo.');
      };
      task.onerror = () => { if (current === revision.current) { setBusy(false); setError('Não foi possível ler este arquivo. Você pode preencher os dados manualmente.'); } task.terminate(); };
      task.postMessage({ fileName: file.name, bytes }, [bytes]);
    } catch { if (current === revision.current) { setBusy(false); setError('Leitura local indisponível. Tente selecionar o arquivo novamente ou preencha manualmente.'); } }
  }
  const plate = data?.plates.find(item => item.id === plateId);
  return <div className={`print-import ${primary ? 'primary-import' : ''}`} aria-busy={busy}>
    <div className={`drop-zone ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); event.stopPropagation(); setDragging(false); const files = event.dataTransfer.files; if (files.length !== 1) { setError('Selecione uma impressão por vez.'); return; } void read(files[0]); }}>
      <span className="import-symbol" aria-hidden="true">↥</span><h3>Importar impressão 3D</h3><p>Bambu Studio ou OrcaSlicer fatiado · .3mf, .gcode.3mf ou G-code textual compatível</p>
      <button type="button" onClick={() => input.current?.click()} disabled={busy || disabled}>{busy ? 'Lendo impressão…' : 'Selecionar arquivo'}</button><p className="muted">Ou arraste e solte o arquivo aqui, quando o sistema permitir. Nada é enviado.</p>
      <label htmlFor={id} className="sr-only">Selecionar arquivo de impressão 3D</label><input className="file-control" ref={input} id={id} tabIndex={-1} type="file" accept=".3mf,.gcode,.gco,.g" onChange={event => { void read(event.target.files?.[0]); event.target.value = ''; }} />
    </div>
    {busy && <p role="status">Lendo somente as estimativas declaradas pelo fatiador…</p>}{error && <p role="alert" className="notice">{error}</p>}
    {data && <div className="import-review"><h3>{data.fileName}</h3><p>Impressora identificada: <strong>{data.printer ?? 'não informada no arquivo'}</strong></p>
      {!!data.plates.length && <label>Placa que será calculada<select value={plateId} onChange={event => setPlateId(event.target.value)}>{data.plates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {plate && <><dl className="import-facts"><dt>Peças identificadas</dt><dd>{plate.pieces ?? 'Preencher manualmente'}</dd><dt>Material</dt><dd>{plate.materials.map(item => item.name).join(', ') || data.material || 'Não identificado'}</dd><dt>Filamento</dt><dd>{plate.grams === null ? 'Preencher manualmente' : `${formattedNumeric(plate.grams, 'weight')} g`}</dd><dt>Tempo estimado</dt><dd>{plate.seconds === null ? 'Preencher manualmente' : formattedNumeric(new D(plate.seconds).div(3600).toDecimalPlaces(12).toFixed(), 'duration')}</dd></dl>
        <p>Origem: metadados do fatiador, não medição real. Valores ausentes serão deixados em branco. Preços e custos continuam sendo informados por você.</p><button type="button" onClick={() => onApply(applyImportedPlate(withExperience(draft), data, plate))}>Usar esta placa</button></>}
      {!data.plates.length && <><p className="notice">O arquivo contém geometria ou metadados incompatíveis. Não foi possível obter peso, tempo e quantidade com segurança.</p><p>No Bambu Studio, fatie a placa e use a opção de exportar a placa fatiada em 3MF/G-code. Salvar apenas o projeto geométrico pode não incluir essas estimativas. Os nomes do comando variam conforme a versão do fatiador.</p><button type="button" className="secondary" onClick={() => onApply(applyImportedPlate(withExperience(draft), data, { id: 'manual', name: 'Preenchimento manual', grams: null, seconds: null, pieces: null, materials: [] }))}>Informar os dados manualmente</button></>}
      {data.plates.length > 1 && <p className="notice">Este arquivo tem {data.plates.length} placas. O cálculo usa somente a placa selecionada; não consolida as demais. Salve cada placa separadamente. Não some seus pesos e tempos como se pertencessem a uma única peça.</p>}
      {!!data.warnings.length && <details><summary>Dados ausentes e observações do arquivo</summary><ul>{data.warnings.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
    </div>}
  </div>;
}
