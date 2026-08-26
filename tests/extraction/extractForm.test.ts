import { beforeEach, describe, expect, it } from 'vitest';
import { extractForm } from '../../src/extraction/extractForm';
import { LIMITS } from '../../src/security/limits';

describe('extractForm', () => {
  beforeEach(() => {
    document.head.innerHTML = '<title>Example</title>';
    document.body.innerHTML = '';
  });

  it('extracts supported controls without leaking existing values', () => {
    document.body.innerHTML = `
      <form id="f">
        <label for="name">Name</label>
        <input id="name" name="name" value="SECRET" required maxlength="20">
        <input type="email" name="email" value="private@example.com">
        <input type="url" name="site">
        <input type="tel" name="phone">
        <input type="number" name="count" min="1" max="10" step="1">
        <input type="date" name="day" min="2026-01-01" max="2026-12-31">
        <input type="time" name="at" step="60">
        <input type="search" name="query">
        <textarea aria-label="Bio">PRIVATE</textarea>
        <select name="country">
          <option value="ae">United Arab Emirates</option>
          <option value="jo">Jordan</option>
        </select>
      </form>`;

    const result = extractForm(document);
    expect(result.document.page.identity).toMatch(/^frp_[0-9a-f]{16}$/);
    expect(result.document.fields.map((field) => field.type)).toEqual([
      'text',
      'email',
      'url',
      'tel',
      'number',
      'date',
      'time',
      'search',
      'textarea',
      'select',
    ]);
    expect(result.document.fields[0]).toMatchObject({
      label: 'Name',
      value: '',
      required: true,
      max_length: 20,
    });
    expect(result.document.fields[4]).toMatchObject({ min: '1', max: '10', step: '1' });
    expect(result.document.fields[8]?.value).toBe('');
    expect(result.document.fields[9]).toMatchObject({
      type: 'select',
      value: '',
      options: [
        { value: 'ae', label: 'United Arab Emirates' },
        { value: 'jo', label: 'Jordan' },
      ],
    });
  });

  it('resolves for, wrapped, aria-label, aria-labelledby, and fieldset context', () => {
    document.body.innerHTML = `
      <form>
        <fieldset>
          <legend>Contact</legend>
          <label for="full-name">Full name</label><input id="full-name">
          <label>Phone <input name="phone" type="tel"></label>
          <input name="nickname" aria-label="Nickname">
          <span id="mail-label">Email address</span>
          <input type="email" aria-labelledby="mail-label">
        </fieldset>
      </form>`;

    const fields = extractForm(document).document.fields;
    expect(fields.map((field) => field.label)).toEqual([
      'Full name',
      'Phone',
      'Nickname',
      'Email address',
    ]);
  });

  it('groups radios and same-name checkboxes into logical fields', () => {
    document.body.innerHTML = `
      <form>
        <label><input type="radio" name="plan" value="a">A</label>
        <label><input type="radio" name="plan" value="b">B</label>
        <label><input type="checkbox" name="tag" value="x">X</label>
        <label><input type="checkbox" name="tag" value="y">Y</label>
        <label><input type="checkbox" name="terms">Terms</label>
      </form>`;

    const fields = extractForm(document).document.fields;
    expect(fields.map((field) => field.type)).toEqual(['radio', 'checkbox_group', 'checkbox']);
    expect(fields[0]?.options).toHaveLength(2);
    expect(fields[1]?.value).toEqual([]);
    expect(fields[2]?.value).toBe(false);
  });

  it('exports only enabled select and choice options', () => {
    document.body.innerHTML = `
      <form>
        <select name="country"><option value="ae">UAE</option><option value="xx" disabled>Blocked</option></select>
        <label><input type="radio" name="plan" value="a">A</label>
        <label><input type="radio" name="plan" value="b" disabled>B</label>
      </form>`;
    const fields = extractForm(document).document.fields;
    expect(fields[0]?.options).toEqual([{ value: 'ae', label: 'UAE' }]);
    expect(fields[1]?.options).toEqual([{ value: 'a', label: 'A' }]);
  });

  it('excludes unsupported multi-select controls instead of misrepresenting them', () => {
    document.body.innerHTML = `
      <form>
        <select name="roles" multiple>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
        </select>
        <input name="supported">
      </form>`;
    const fields = extractForm(document).document.fields;
    expect(fields).toHaveLength(1);
    expect(fields[0]?.name).toBe('supported');
    expect(fields.some((field) => field.name === 'roles')).toBe(false);
  });

  it('fails closed when a form exceeds the exported field limit', () => {
    const inputs = Array.from(
      { length: LIMITS.fields + 1 },
      (_, index) => `<input name="field-${index}">`,
    ).join('');
    document.body.innerHTML = `<form>${inputs}</form>`;
    expect(() => extractForm(document)).toThrow(`${LIMITS.fields}-field safety limit`);
  });

  it('fails closed when a select exceeds the exported option limit', () => {
    const options = Array.from(
      { length: LIMITS.optionsPerField + 1 },
      (_, index) => `<option value="${index}">Option ${index}</option>`,
    ).join('');
    document.body.innerHTML = `<form><select name="huge">${options}</select></form>`;
    expect(() => extractForm(document)).toThrow(`${LIMITS.optionsPerField}-option safety limit`);
  });

  it('disambiguates duplicate semantic fingerprints only when necessary', () => {
    document.body.innerHTML = `
      <form>
        <label>Same <input name="x"></label>
        <label>Same <input name="x"></label>
        <input name="missing-id" aria-label="No DOM id">
      </form>`;
    const fields = extractForm(document).document.fields;
    expect(fields[0]?.field_id).not.toBe(fields[1]?.field_id);
    expect(fields[2]?.field_id).toMatch(/^fr_[0-9a-f]{8}$/);
  });

  it('selects the largest form deterministically', () => {
    document.body.innerHTML = `
      <form id="small"><input name="one"></form>
      <form id="large"><input name="one"><input name="two"></form>`;
    const result = extractForm(document).document;
    expect(result.form.id).toBe('large');
    expect(result.fields).toHaveLength(2);
  });
});
