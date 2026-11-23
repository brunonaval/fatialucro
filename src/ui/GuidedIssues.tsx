import type { GuidedIssue } from './guided-validation';

export function GuidedIssues({ issues, onFix }: { issues: readonly GuidedIssue[]; onFix?: (issue: GuidedIssue) => void }) {
  if (!issues.length) return null;
  return <div className="guided-issues" role="group" aria-label="Informações faltantes para calcular">
    <h3>Faltam {issues.length} {issues.length === 1 ? 'informação' : 'informações'} para calcular</h3>
    <p>Os valores já conhecidos continuam disponíveis. Corrija apenas os campos abaixo:</p>
    <ul>{issues.slice(0, 6).map(issue => <li key={issue.id}><span>{issue.message}</span>{onFix && <button type="button" className="secondary" onClick={() => onFix(issue)}>Corrigir {issue.label.toLowerCase()}</button>}</li>)}</ul>
    {issues.length > 6 && <p>Há mais {issues.length - 6} campo(s) a conferir.</p>}
  </div>;
}
