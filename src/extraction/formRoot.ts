import { sensitiveFieldDecision } from '../security/blockedFields';
import { getLabel } from './labels';
import { supportedControls, type SupportedControl } from './selectors';

export function safeSupportedControls(root: ParentNode): SupportedControl[] {
  return supportedControls(root).filter(
    (control) => !sensitiveFieldDecision(control, getLabel(control)).blocked,
  );
}

export function selectFormRoot(doc: Document): HTMLFormElement | Document {
  const forms = Array.from(doc.forms);
  if (forms.length === 0) return doc;
  return (
    forms
      .map((form, index) => ({ form, index, count: safeSupportedControls(form).length }))
      .sort((a, b) => b.count - a.count || a.index - b.index)[0]?.form ?? doc
  );
}
