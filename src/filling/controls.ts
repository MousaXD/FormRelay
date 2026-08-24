import type { FormRelayField } from '../schema/formSchema';
import { safeSupportedControls, selectFormRoot } from '../extraction/formRoot';

export type FillControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function primaryFormRoot(doc: Document): ParentNode {
  return selectFormRoot(doc);
}

function inputTypeMatches(field: FormRelayField, input: HTMLInputElement): boolean {
  if (field.type === 'radio') return input.type === 'radio';
  if (field.type === 'checkbox' || field.type === 'checkbox_group') return input.type === 'checkbox';
  if (field.type === 'textarea' || field.type === 'select') return false;
  return (input.type || 'text').toLowerCase() === field.type;
}

function controlTypeMatches(field: FormRelayField, control: FillControl): boolean {
  if (control instanceof HTMLInputElement) return inputTypeMatches(field, control);
  if (control instanceof HTMLTextAreaElement) return field.type === 'textarea';
  return field.type === 'select';
}

export function controlsForField(field: FormRelayField, root: ParentNode): FillControl[] {
  return safeSupportedControls(root).filter((control) => {
    if (!controlTypeMatches(field, control)) return false;
    if (field.dom_id && control.id === field.dom_id) return true;
    return Boolean(field.name && control.getAttribute('name') === field.name);
  });
}
