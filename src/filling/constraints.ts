import type { FormRelayField } from '../schema/formSchema';
import { LIMITS } from '../security/limits';
import type { ValidatedChange } from '../import/validateImport';
import { primaryFormRoot, resolveControlsForField } from './controls';
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
  targetField: FormRelayField = field,
): string | null {
  if (typeof field.value !== 'string' || field.value === '') return null;
  if (field.type === 'select' || field.type === 'radio') return null;

  const resolution = resolveControlsForField(targetField, root);
  if (resolution.error) return resolution.error;

  const element = resolution.controls.find(
    (control): control is HTMLInputElement | HTMLTextAreaElement =>
      control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement,
  );
  if (!element) return 'Field no longer exists on the page.';
  if (element.disabled) return 'Field is disabled and will not be filled.';
  if (element.readOnly) return 'Field is read-only and will not be filled.';

  return probeTextControl(element, field.value);
}

function liveFieldValue(field: FormRelayField, root: ParentNode): FormRelayField['value'] | null {
  const resolution = resolveControlsForField(field, root);
  if (resolution.error) return null;
  const controls = resolution.controls;

  if (field.type === 'radio') {
    const selected = controls.find(
      (control): control is HTMLInputElement =>
        control instanceof HTMLInputElement && !control.disabled && control.checked,
    );
    return selected?.value ?? '';
  }

  if (field.type === 'checkbox_group') {
    return controls
      .filter(
        (control): control is HTMLInputElement =>
          control instanceof HTMLInputElement && !control.disabled && control.checked,
      )
      .map((control) => control.value.slice(0, LIMITS.optionChars));
  }

  if (field.type === 'checkbox') {
    const element = controls.find(
      (control): control is HTMLInputElement => control instanceof HTMLInputElement,
    );
    return element?.checked ?? null;
  }

  if (field.type === 'select') {
    const element = controls.find(
      (control): control is HTMLSelectElement => control instanceof HTMLSelectElement,
    );
    return element?.value.slice(0, LIMITS.optionChars) ?? null;
  }

  const element = controls.find(
    (control): control is HTMLInputElement | HTMLTextAreaElement =>
      control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement,
  );
  return element?.value.slice(0, LIMITS.fieldValueChars) ?? null;
}

export function validateLiveChanges(
  changes: ValidatedChange[],
  doc: Document,
): ValidatedChange[] {
  const root = primaryFormRoot(doc);
  return changes.map((change) => {
    if (change.status !== 'ready') return change;
    const message = validateLiveFieldValue(change.imported, root, change.current);
    if (message) return { ...change, status: 'invalid', message };

    const liveValue = liveFieldValue(change.current, root);
    return liveValue === null ? change : { ...change, liveValue };
  });
}
