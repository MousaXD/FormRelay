import type { FormRelayDocument } from '../schema/formSchema';
import { extractForm } from '../extraction/extractForm';
import { comparePage, validateImport } from '../import/validateImport';
import { fillCheckbox } from './fillCheckbox';
import { controlsForField, primaryFormRoot } from './controls';
import { validateLiveFieldValue } from './constraints';
import { fillInput } from './fillInput';
import { fillRadio } from './fillRadio';
import { fillSelect } from './fillSelect';

export type FillResult = { filled: number; skipped: number; errors: string[] };
export type FillOptions = { allowPageMismatch?: boolean };

export function fillForm(
  imported: FormRelayDocument,
  doc: Document = document,
  options: FillOptions = {},
): FillResult {
  const current = extractForm(doc).document;
  const pageMatch = comparePage(imported, current);
  if (!pageMatch.matches && !options.allowPageMismatch) {
    return {
      filled: 0,
      skipped: imported.fields.length,
      errors: [pageMatch.warning ?? 'Page mismatch.'],
    };
  }
  const validated = validateImport(imported, current);
  const root = primaryFormRoot(doc);
  let filled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const change of validated) {
    if (change.status !== 'ready') {
      skipped += 1;
      continue;
    }

    const field = change.imported;
    const controls = controlsForField(change.current, root);

    try {
      const constraintError = validateLiveFieldValue(field, root);
      if (constraintError) throw new Error(constraintError);

      if (field.type === 'radio') {
        fillRadio(
          controls.filter((control): control is HTMLInputElement =>
            control instanceof HTMLInputElement,
          ),
          field.value,
        );
      } else if (field.type === 'checkbox_group') {
        const allowed = new Set(field.value);
        controls
          .filter(
            (control): control is HTMLInputElement =>
              control instanceof HTMLInputElement && !control.disabled,
          )
          .forEach((element) => fillCheckbox(element, allowed.has(element.value)));
      } else if (field.type === 'checkbox') {
        const element = controls.find(
          (control): control is HTMLInputElement => control instanceof HTMLInputElement,
        );
        if (!element) throw new Error('Checkbox no longer exists.');
        fillCheckbox(element, field.value);
      } else if (field.type === 'select') {
        const element = controls.find(
          (control): control is HTMLSelectElement => control instanceof HTMLSelectElement,
        );
        if (!element) throw new Error('Select no longer exists.');
        fillSelect(element, field.value);
      } else {
        const element = controls.find(
          (control): control is HTMLInputElement | HTMLTextAreaElement =>
            control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement,
        );
        if (!element) throw new Error('Text field no longer exists.');
        fillInput(element, field.value);
      }
      filled += 1;
    } catch (error) {
      skipped += 1;
      errors.push(
        `${field.label ?? field.name ?? field.field_id}: ${error instanceof Error ? error.message : 'fill failed'}`,
      );
    }
  }

  return { filled, skipped, errors };
}
