import type { SavedKind } from '../app/model';
import type { SavedEntry } from '../app/storage';
export const savedLabels: Record<SavedKind, string> = { product: 'Produto', printer: 'Impressora', filament: 'Filamento', production: 'Custos de produção', marketplace: 'Marketplace', simulation: 'Simulação', 'cost-simulation': 'Cálculo de custos' };
export function ProfileSelect({ kind, entries, onApply }: { kind: SavedKind; entries: SavedEntry[]; onApply: (entry: SavedEntry) => void }) {
  const profiles = entries.filter(entry => entry.kind === kind);
  if (!profiles.length) return null;
  return <label>{savedLabels[kind]} salvo<select value="" onChange={event => { const selected = profiles.find(entry => entry.id === event.target.value); if (selected) onApply(selected); }}><option value="">Aplicar cadastro…</option>{profiles.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>;
}
