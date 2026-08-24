import { matchField } from '../matching/matchField';
import type { FormRelayDocument, FormRelayField } from '../schema/formSchema';

export type PageMatch = { matches: boolean; warning: string | null };
export type ChangeStatus = 'ready' | 'empty' | 'unresolved' | 'invalid';
export type ValidatedChange = {
  imported: FormRelayField;
  current: FormRelayField;
  currentIndex: number;
  confidence: number;
  status: ChangeStatus;
  message?: string;
};

function comparable(field: FormRelayField): unknown {
  const { value: ignoredValue, ...rest } = field;
  void ignoredValue;
  return rest;
}

function isEmptyValue(value: FormRelayField['value']): boolean {
  return value === '' || value === false || (Array.isArray(value) && value.length === 0);
}

function normalizedPath(url: URL): string {
  const path = url.pathname.replace(/\/+$/, '');
  return path || '/';
}

export function comparePage(
  imported: FormRelayDocument,
  current: FormRelayDocument,
): PageMatch {
  try {
    const importedUrl = new URL(imported.page.url);
    const currentUrl = new URL(current.page.url);
    const samePath =
      importedUrl.origin === currentUrl.origin &&
      normalizedPath(importedUrl) === normalizedPath(currentUrl);
    const sameForm =
      (Boolean(imported.form.id) && imported.form.id === current.form.id) ||
      (Boolean(imported.form.name) && imported.form.name === current.form.name) ||
      (!imported.form.id && !imported.form.name && !current.form.id && !current.form.name);

    return samePath && sameForm
      ? { matches: true, warning: null }
      : {
          matches: false,
          warning: 'This JSON appears to belong to another form or webpage.',
        };
  } catch {
    return { matches: false, warning: 'This JSON contains an invalid page URL.' };
  }
}

export function validateImport(
  imported: FormRelayDocument,
  current: FormRelayDocument,
): ValidatedChange[] {
  const candidates = current.fields.map((field, index) => ({ field, index }));

  return imported.fields.map((field): ValidatedChange => {
    const match = matchField(field, candidates);
    if (!match.candidate) {
      return {
        imported: field,
        current: field,
        currentIndex: -1,
        confidence: match.confidence,
        status: 'unresolved',
        message: match.reason,
      };
    }

    const currentField = match.candidate.field;
    const base = {
      imported: field,
      current: currentField,
      currentIndex: match.candidate.index,
      confidence: match.confidence,
    };

    if (JSON.stringify(comparable(field)) !== JSON.stringify(comparable(currentField))) {
      return {
        ...base,
        status: 'invalid',
        message: 'Structural metadata differs from the live form.',
      };
    }
    if (currentField.disabled) {
      return {
        ...base,
        status: 'invalid',
        message: 'Field is disabled and will not be filled.',
      };
    }
    if (currentField.readonly) {
      return {
        ...base,
        status: 'invalid',
        message: 'Field is read-only and will not be filled.',
      };
    }
    if (isEmptyValue(field.value)) return { ...base, status: 'empty' };

    if (
      (field.type === 'select' || field.type === 'radio') &&
      !field.options.some((option) => option.value === field.value)
    ) {
      return { ...base, status: 'invalid', message: 'Value is not an allowed option.' };
    }

    if (
      field.type === 'checkbox_group' &&
      field.value.some((value) => !field.options.some((option) => option.value === value))
    ) {
      return {
        ...base,
        status: 'invalid',
        message: 'One or more values are not allowed options.',
      };
    }

    if (
      typeof field.value === 'string' &&
      field.max_length != null &&
      field.value.length > field.max_length
    ) {
      return { ...base, status: 'invalid', message: 'Value exceeds max_length.' };
    }

    return { ...base, status: 'ready' };
  });
}
