import type { FormRelayField } from '../schema/formSchema';
import type { ValidatedChange } from '../import/validateImport';
import { controlsForField, primaryFormRoot } from './controls';
import { setNativeValue } from './events';

function probeTextControl(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): string | null {
  const probe = element.cloneNode(false);
  if (!(probe instanceof HTMLInputElement || probe instanceof HTMLTextAreaElement)) {
    return 'Could not validate the live field constraints.';
  }

  probe.removeAttribute('required');
  setNativeValue(probe, value);

  // Some typed inputs normalize invalid programmatic values to an empty string.
  if (value !== '' && probe.value !== value) {
    return 'Value is not valid for this input type.';
  }

  if (!probe.checkValidity()) {
    return 'Value violates the live HTML field constraints.';
  }

  return null;
}

export function validateLiveFieldValue(
  field: FormRelayField,
  root: ParentNode,
): string | null {
  if (typeof field.value !== 'string' || field.value === '') return null;
  if (field.type === 'select' || field.type === 'radio') return null;

  const controls = controlsForField(field, root);
  const element = controls.find(
    (control): control is HTMLInputElement | HTMLTextAreaElement =>
      control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement,
  );
  if (!element) return 'Field no longer exists on the page.';
  if (element.disabled) return 'Field is disabled and will not be filled.';
  if (element.readOnly) return 'Field is read-only and will not be filled.';

  return probeTextControl(element, field.value);
}

export function validateLiveChanges(
  changes: ValidatedChange[],
  doc: Document,
): ValidatedChange[] {
  const root = primaryFormRoot(doc);
  return changes.map((change) => {
    if (change.status !== 'ready') return change;
    const message = validateLiveFieldValue(change.imported, root);
    return message ? { ...change, status: 'invalid', message } : change;
  });
}
