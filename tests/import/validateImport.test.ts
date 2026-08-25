import { describe, expect, it } from 'vitest';
import { comparePage, validateImport } from '../../src/import/validateImport';
import type { FormRelayDocument, FormRelayField } from '../../src/schema/formSchema';
import { formDocument, textField } from '../fixtures/formRelay';

function selectDocument(url = 'https://example.com/apply?x=1'): FormRelayDocument {
  const field: Extract<FormRelayField, { type: 'select' }> = {
    ...textField(),
    type: 'select',
    name: 'country',
    dom_id: 'country',
    label: 'Country',
    options: [{ value: 'ae', label: 'United Arab Emirates' }],
    value: '',
  };
  return formDocument([field], { page: { title: 'Apply', url }, form: { id: 'f', name: null } });
}

function firstField(document: FormRelayDocument): FormRelayField {
  const field = document.fields[0];
  if (!field) throw new Error('Fixture must contain one field.');
  return field;
}

describe('validateImport', () => {
  it('allows query/hash changes but warns on another path or form', () => {
    expect(comparePage(selectDocument(), selectDocument('https://example.com/apply?x=2#part')).matches).toBe(true);
    expect(comparePage(selectDocument(), selectDocument('https://example.com/other')).matches).toBe(false);
    const otherForm = selectDocument();
    otherForm.form.id = 'another-form';
    expect(comparePage(selectDocument(), otherForm).matches).toBe(false);
  });

  it('rejects structural mutation outside value, including constraint mutation', () => {
    const imported = formDocument([textField({ max_length: 20 })]);
    const current = formDocument([textField({ max_length: 10 })]);
    expect(validateImport(imported, current)[0]?.status).toBe('invalid');
  });

  it('enforces one imported field to one live field allocation', () => {
    const currentField = textField({
      field_id: 'fr_11111111',
      name: 'answer',
      dom_id: 'answer',
    });
    const first = { ...currentField, value: 'first' };
    const second = {
      ...currentField,
      field_id: 'fr_22222222',
      value: 'second',
    };

    const changes = validateImport(formDocument([first, second]), formDocument([currentField]));
    expect(changes[0]?.currentIndex).toBe(0);
    expect(changes[1]?.status).toBe('unresolved');
    expect(changes.filter((change) => change.currentIndex === 0)).toHaveLength(1);
  });

  it('keeps valid distinct imported fields mapped to distinct live fields', () => {
    const first = textField({ field_id: 'fr_11111111', name: 'first', dom_id: 'first' });
    const second = textField({ field_id: 'fr_22222222', name: 'second', dom_id: 'second' });
    const imported = formDocument([
      { ...first, value: 'A' },
      { ...second, value: 'B' },
    ]);
    const changes = validateImport(imported, formDocument([first, second]));
    expect(changes.map((change) => change.status)).toEqual(['ready', 'ready']);
    expect(changes.map((change) => change.currentIndex)).toEqual([0, 1]);
  });

  it('rejects invented select and checkbox-group options', () => {
    const imported = selectDocument();
    const select = firstField(imported);
    if (select.type !== 'select') throw new Error('Fixture must be select.');
    select.value = 'xx';
    expect(validateImport(imported, selectDocument())[0]?.status).toBe('invalid');

    const group: Extract<FormRelayField, { type: 'checkbox_group' }> = {
      ...textField(),
      type: 'checkbox_group',
      name: 'tags',
      options: [{ value: 'a', label: 'A' }],
      value: ['x'],
    };
    const currentGroup = { ...group, value: [] as string[] };
    expect(validateImport(formDocument([group]), formDocument([currentGroup]))[0]?.status).toBe('invalid');
  });

  it('refuses disabled and read-only live fields', () => {
    const disabled = textField({ disabled: true, value: 'x' });
    expect(validateImport(formDocument([disabled]), formDocument([{ ...disabled, value: '' }]))[0]?.message).toContain('disabled');

    const readonly = textField({ readonly: true, value: 'x' });
    expect(validateImport(formDocument([readonly]), formDocument([{ ...readonly, value: '' }]))[0]?.message).toContain('read-only');
  });

  it('marks empty answers without filling them', () => {
    expect(validateImport(formDocument(), formDocument())[0]?.status).toBe('empty');
  });

  it('rejects max_length violations before preview approval', () => {
    const imported = textField({ max_length: 3, value: 'four' });
    const current = textField({ max_length: 3, value: '' });
    expect(validateImport(formDocument([imported]), formDocument([current]))[0]?.message).toContain('max_length');
  });

  it('leaves stale unmatched fields unresolved', () => {
    const imported = textField({
      field_id: 'fr_aaaaaaaa',
      name: 'old',
      dom_id: 'old',
      label: 'Old',
      value: 'answer',
    });
    const current = textField({
      field_id: 'fr_bbbbbbbb',
      name: 'new',
      dom_id: 'new',
      label: 'New',
    });
    expect(validateImport(formDocument([imported]), formDocument([current]))[0]?.status).toBe('unresolved');
  });
});
