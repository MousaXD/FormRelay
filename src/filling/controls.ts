import type { FormRelayField } from '../schema/formSchema';
import { safeSupportedControls, selectFormRoot } from '../extraction/formRoot';

export type FillControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export type ControlResolution = { controls: FillControl[]; error: string | null };

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
  return field.type === 'select' && !control.multiple;
}

function missing(message = 'Field no longer exists on the page.'): ControlResolution {
  return { controls: [], error: message };
}

function ambiguous(message: string): ControlResolution {
  return { controls: [], error: message };
}

export function resolveControlsForField(
  field: FormRelayField,
  root: ParentNode,
): ControlResolution {
  const typed = safeSupportedControls(root).filter((control) => controlTypeMatches(field, control));

  if (field.type === 'radio' || field.type === 'checkbox_group') {
    if (field.dom_id) {
      const anchors = typed.filter((control) => control.id === field.dom_id);
      if (anchors.length === 0) return missing('Reviewed choice-group anchor no longer exists.');
      if (anchors.length > 1) return ambiguous('Duplicate DOM IDs make this choice group ambiguous.');
      const anchor = anchors[0];
      if (!(anchor instanceof HTMLInputElement)) return missing();
      if (field.name && anchor.getAttribute('name') !== field.name) {
        return missing('Reviewed choice-group identity changed.');
      }
      if (!field.name) return { controls: [anchor], error: null };
    }

    if (!field.name) {
      return missing('Choice group has no deterministic live identity.');
    }

    const members = typed.filter(
      (control): control is HTMLInputElement =>
        control instanceof HTMLInputElement && control.getAttribute('name') === field.name,
    );
    return members.length > 0 ? { controls: members, error: null } : missing();
  }

  if (field.dom_id) {
    const byId = typed.filter((control) => control.id === field.dom_id);
    if (byId.length === 0) {
      return missing('Reviewed field DOM ID no longer exists.');
    }
    if (byId.length > 1) {
      return ambiguous('Duplicate DOM IDs make the reviewed field ambiguous.');
    }
    return { controls: byId, error: null };
  }

  if (field.name) {
    const byName = typed.filter((control) => control.getAttribute('name') === field.name);
    if (byName.length === 0) return missing();
    if (byName.length > 1) {
      return ambiguous('Multiple live controls share this field name; refusing to guess.');
    }
    return { controls: byName, error: null };
  }

  return missing('Reviewed field has no deterministic DOM ID or name.');
}
