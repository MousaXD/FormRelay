import type { FormRelayDocument, FormRelayField } from '../../src/schema/formSchema';

type TextField = Extract<FormRelayField, { options: null; value: string }>;

export function textField(overrides: Partial<TextField> = {}): TextField {
  return {
    field_id: 'fr_1234abcd',
    type: 'text',
    name: 'name',
    dom_id: 'name',
    label: 'Name',
    description: null,
    placeholder: null,
    autocomplete: null,
    required: false,
    disabled: false,
    readonly: false,
    max_length: null,
    min: null,
    max: null,
    step: null,
    pattern: null,
    options: null,
    value: '',
    ...overrides,
  };
}

export function formDocument(
  fields: FormRelayField[] = [textField()],
  overrides: Partial<Omit<FormRelayDocument, 'fields'>> = {},
): FormRelayDocument {
  return {
    schema: 'formrelay',
    schema_version: 1,
    page: { title: 'Example', url: 'https://example.com/apply?x=1' },
    form: { id: 'application-form', name: null },
    fields,
    ...overrides,
  };
}
