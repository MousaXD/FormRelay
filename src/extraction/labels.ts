import { sanitizeText } from '../security/sanitize';

function byAriaLabelledBy(element: HTMLElement): string | null {
  const ids = element.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
  if (ids.length === 0) return null;
  const text = ids
    .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
    .join(' ');
  return sanitizeText(text);
}

export function getLabel(element: HTMLElement): string | null {
  const aria = sanitizeText(element.getAttribute('aria-label'));
  if (aria) return aria;

  const labelled = byAriaLabelledBy(element);
  if (labelled) return labelled;

  if ('labels' in element) {
    const labels = (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).labels;
    const text = labels
      ? Array.from(labels)
          .map((label) => label.textContent ?? '')
          .join(' ')
      : '';
    const clean = sanitizeText(text);
    if (clean) return clean;
  }

  const wrapping = element.closest('label');
  const wrapped = sanitizeText(wrapping?.textContent);
  return wrapped || null;
}

export function getDescription(element: HTMLElement): string | null {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
  if (ids.length === 0) return null;
  return sanitizeText(
    ids.map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '').join(' '),
    1_000,
  );
}

export function getLegend(element: HTMLElement): string | null {
  const fieldset = element.closest('fieldset');
  if (!fieldset) return null;
  return sanitizeText(fieldset.querySelector(':scope > legend')?.textContent);
}
