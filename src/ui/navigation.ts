/**
 * Navigation must never mistake a primary tab switch for an error correction.
 * A page switch starts at the top; a correction opens hidden sections and
 * focuses the exact input (or the nearest actionable control).
 */
export function focusPageStart(doc: Document = document, win: Window = window): void {
  doc.getElementById('workspace-content')?.focus({ preventScroll: true });
  win.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

export function focusCorrectionTarget(target: string, doc: Document = document): boolean {
  const previous = doc.querySelectorAll('[data-correction-target="true"]');
  previous.forEach(node => node.removeAttribute('data-correction-target'));
  const item = target.startsWith('field:')
    ? [...doc.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('[name]')]
      .find(node => node.getAttribute('name') === target.slice(6))
    : doc.getElementById(target);
  if (!item) return false;

  for (let ancestor = item.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
  }

  const stage = target.endsWith('-step');
  const control = stage ? item : item.matches('input, select, button, textarea')
    ? item
    : item.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled])') ?? item;
  if (!(control instanceof HTMLElement)) return false;
  if (!stage) {
    const visual = control.closest('label') ?? control.closest('.material-row') ?? control;
    visual.setAttribute('data-correction-target', 'true');
  }
  if (!control.hasAttribute('tabindex') && !control.matches('input, select, button, textarea')) control.setAttribute('tabindex', '-1');
  control.focus({ preventScroll: true });
  control.scrollIntoView({ block: stage ? 'start' : 'center', behavior: 'instant' });
  return true;
}
