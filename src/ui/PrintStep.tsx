import { D } from '../engine/decimal';
import type { SavedEntry } from '../app/storage';
import { profileSource } from '../app/ux-v3';
import { text } from '../app/model';
import { Field, Input, Select } from './Fields';
import { useExperience } from './ExperienceContext';
import { PrintImport } from './PrintImport';
export function PrintStep({ filaments = [] }: { filaments?: readonly SavedEntry[] }) {
  const { draft, ux, update } = useExperience(); const origin = ux.origin;
  const source = (field: string, imported: string | null | undefined) => {
    if (imported === null || imported === undefined) return text(draft, field).trim() ? 'Informado por você' : 'Preenchimento manual necessário';
    try { return new D(text(draft, field).replace(',', '.')).eq(imported) ? 'Importado do fatiador' : 'Editado por você após importar'; } catch { return 'Confira o valor'; }
  };
  return <section id="print-step"><div className="section-heading"><span className="step-label">Impressão</span><h2>O que você vai imprimir?</h2><p>Informe os dados da placa fatiada ou os dados que você mediu.</p></div><Input name="productName" label="Nome da peça (opcional para calcular)" required={false} />
    {origin && <div className="origin-card"><strong>{origin.fileName}</strong><p>Placa: {origin.plateName} · impressora: {origin.printer ?? 'não identificada'} · material: {origin.material ?? ([...new Set(origin.materials.map(item => item.name))].join(', ') || 'não identificado')}</p><p>Quantidade original: {origin.pieces ?? 'ausente'} peças. Estimativa do fatiador; confirme se objetos correspondem às peças físicas/comerciais.</p>{origin.plateCount > 1 && <p className="notice">Somente esta placa é calculada. As outras {origin.plateCount - 1} placas não foram consolidadas.</p>}{ux.profileOrigins?.filament && <p className="help-box">{profileSource(draft, 'filament')}. O preço do filamento foi reutilizado; confira se corresponde à bobina desta impressão.</p>}</div>}
    {ux.manualProduction?.enabled ? <p className="help-box">Você está usando um custo de produção informado. Edite em Custos ou importe uma placa para voltar aos componentes detalhados.</p> : <><div className="fields"><Select name="basis" label="Esses dados correspondem a"><option value="batch">Placa ou lote com várias peças</option><option value="unit">Uma peça</option></Select>{draft.fields.basis === 'batch' && <Input name="pieces" label="Quantas peças físicas saem dessa impressão/placa?" />}{ux.machineIncluded && <Field name="hours" label={draft.fields.basis === 'batch' ? 'Tempo total de impressão do lote' : 'Tempo de impressão de uma peça'} decimal />}{ux.materialIncluded !== false && !draft.materials.length && <Field name="grams" label={draft.fields.basis === 'batch' ? 'Peso do filamento do lote (g)' : 'Peso do filamento (g)'} decimal />}</div>
    <p className="field-hint">O tempo só é obrigatório se você incluir energia ou outros custos por hora. Para calcular apenas o material, informe o peso e quanto custou o filamento.</p>
    {origin && <p className="muted">{!draft.materials.length && `Peso: ${source('grams', origin.grams)} · `}Quantidade: {source('pieces', origin.pieces === null ? null : String(origin.pieces))} · Tempo: {source('hours', origin.seconds === null ? null : new D(origin.seconds).div(3600).toDecimalPlaces(12).toFixed())}. A origem original está preservada.</p>}
    {!!draft.materials.length && <p className="help-box">Foram identificados {draft.materials.length} materiais. Os pesos e preços de cada um serão conferidos na etapa Custos.</p>}
    {origin && draft.fields.basis === 'unit' && <p className="notice">Os valores do arquivo são totais da placa. Você escolheu dados por peça: confira e informe peso/tempo de uma peça; não há divisão automática aqui.</p>}
    </>}
    <details><summary>Importar outra impressão ou escolher outra placa</summary><PrintImport draft={draft} filaments={filaments} onApply={update} /></details>
  </section>;
}
