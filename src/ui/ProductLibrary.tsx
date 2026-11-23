import { useState } from 'react';
import type { SavedEntry } from '../app/storage';
import { frozenResult, groupProducts } from '../app/records';
import { withExperience } from '../app/experience';
import { FormContext } from './Fields';
import { ExperienceContext } from './ExperienceContext';
import { ExperienceResult } from './ExperienceResult';

export function ProductLibrary({ entries, onEdit, onTrash, onRestore, onNew, busy }: { entries: SavedEntry[]; onEdit: (entry: SavedEntry, duplicate: boolean) => void; onTrash: (entry: SavedEntry) => Promise<boolean>; onRestore: (entry: SavedEntry) => Promise<boolean>; onNew: () => void; busy: boolean }) {
  const [selected, setSelected] = useState<string | null>(null); const [deleting, setDeleting] = useState<string | null>(null); const groups = groupProducts(entries);
  const trashed = entries.filter(entry => entry.deletedAt); const current = entries.find(entry => entry.id === selected && !entry.deletedAt);
  const output = current ? frozenResult(current) : null;
  function actions(entry: SavedEntry) {
    return <div className="record-actions"><button type="button" className="secondary" onClick={() => onEdit(entry, false)}>{entry.kind === 'product' ? 'Editar produto' : 'Editar como nova revisão'}</button><button type="button" className="text-button" onClick={() => onEdit(entry, true)}>Duplicar</button><button type="button" className="text-button" onClick={() => setDeleting(entry.id)} disabled={busy}>Mover para lixeira…</button>{deleting === entry.id && <div className="confirm-inline" role="alert"><p>Confirma mover “{entry.name}” para a lixeira? {entry.kind === 'product' && 'As simulações vinculadas a este produto também serão movidas.'} Você poderá restaurar depois.</p><button type="button" disabled={busy} onClick={async () => { if (await onTrash(entry)) { setDeleting(null); if (selected === entry.id) setSelected(null); } }}>Confirmar exclusão</button><button type="button" className="secondary" onClick={() => setDeleting(null)}>Cancelar</button></div>}</div>;
  }
  function simulation(entry: SavedEntry) {
    return <article className="simulation-row" key={entry.id}><div><strong>{entry.kind === 'cost-simulation' ? 'Custos da impressão' : 'Simulação de venda'} · revisão {entry.revision ?? 1}</strong><p>{entry.name} · {new Date(entry.updatedAt).toLocaleString('pt-BR')}</p><p className="muted">{entry.snapshot ? `Catálogo preservado: ${entry.snapshot.catalog.version}` : 'Sem venda ou repasse simulado'}</p></div><button type="button" onClick={() => setSelected(entry.id)}>Ver cálculo salvo</button>{actions(entry)}</article>;
  }
  return <div className="product-library"><section><div className="section-heading"><span className="step-label">Meus produtos</span><h2>Seus produtos e simulações</h2><p>Continue um produto, compare revisões ou consulte um resultado com as regras da época.</p></div><button type="button" onClick={onNew}>Novo produto</button>
    {!groups.products.length && !groups.ungrouped.length && <div className="empty-state"><h3>Seu primeiro produto começa com uma impressão</h3><p>Você não precisa cadastrar impressora ou loja antes de calcular. Quando quiser, dê um nome e salve seu resultado.</p></div>}
    {groups.products.map(({ product, simulations }) => <details className="product-card" key={product.id}><summary>{product.name}<span className="record-count">{simulations.length} cálculo(s)</span></summary>{actions(product)}{simulations.length ? simulations.map(simulation) : <p>Ainda não há simulação salva para este produto.</p>}</details>)}
    {!!groups.ungrouped.length && <details><summary>Simulações anteriores sem vínculo de produto</summary><p>Registros antigos foram preservados. Editar cria uma nova revisão vinculada a um produto, sem substituir seu histórico.</p>{groups.ungrouped.map(simulation)}</details>}
    <details><summary>Lixeira ({trashed.length})</summary><p>Registros permanecem no backup e podem ser recuperados. Não há remoção definitiva por um clique.</p>{trashed.map(entry => <div className="saved-row" key={entry.id}><div><strong>{entry.name}</strong><p>Movido em {new Date(entry.deletedAt!).toLocaleString('pt-BR')}</p></div><button type="button" className="secondary" disabled={busy} onClick={() => { void onRestore(entry); }}>Restaurar</button></div>)}</details>
  </section>
    {current && output && <div className="saved-result"><h2>{current.name} · cálculo salvo</h2><button type="button" className="secondary" onClick={() => setSelected(null)}>Fechar leitura do histórico</button><FormContext value={{ draft: withExperience(current.draft), setField: () => {} }}><ExperienceContext value={{ draft: withExperience(current.draft), update: () => {} }}><ExperienceResult frozen={output} /></ExperienceContext></FormContext></div>}
  </div>;
}
