import { useState } from 'react';
import type { GuidedIssue } from './guided-validation';

/** Compact checklist: every missing field remains reachable without overwhelming the beginner. */
export function GuidedIssues({ issues, onFix }: { issues: readonly GuidedIssue[]; onFix?: (issue: GuidedIssue) => void }) {
  const [expanded, setExpanded] = useState(false);
  if (!issues.length) return null;
  const shown = expanded ? issues : issues.slice(0, 3);
  return <div className="guided-issues" role="group" aria-label="Informações faltantes para calcular">
    <h3>Faltam {issues.length} {issues.length === 1 ? 'informação' : 'informações'} para calcular</h3>
    <p>Seus valores já informados foram preservados. Corrija apenas o necessário:</p>
    {onFix && <button type="button" className="secondary" onClick={() => onFix(issues[0]!)}>Corrigir primeiro campo pendente</button>}
    <ul>{shown.map(issue => <li key={issue.id}><strong>{issue.label}:</strong> <span>{issue.message}</span>{onFix && <button type="button" className="secondary" onClick={() => onFix(issue)}>Corrigir {issue.label.toLowerCase()}</button>}</li>)}</ul>
    {issues.length > 3 && <button type="button" className="text-button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Mostrar somente os primeiros campos' : `Ver todas as ${issues.length} pendências`}</button>}
  </div>;
}
