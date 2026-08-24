import { describe, expect, it, vi } from 'vitest';
import { extractForm } from '../../src/extraction/extractForm';
import { validateLiveChanges } from '../../src/filling/constraints';
import { fillForm } from '../../src/filling/fillForm';
import { validateImport } from '../../src/import/validateImport';

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Fixture element missing: ${selector}`);
  return element;
}

describe('fillForm', () => {
  it('fills every v0.1 control family, dispatches events, and never submits', () => {
    document.body.innerHTML = `
      <form id="f">
        <label for="n">Name</label><input id="n" name="name">
        <textarea name="bio"></textarea>
        <select id="c" name="country"><option value="ae">UAE</option></select>
        <label><input type="radio" name="plan" value="a">A</label>
        <label><input type="radio" name="plan" value="b">B</label>
        <label><input type="checkbox" name="tag" value="x">X</label>
        <label><input type="checkbox" name="tag" value="y">Y</label>
        <label><input type="checkbox" name="terms">Terms</label>
        <button type="submit">Submit</button>
      </form>`;

    const input = requiredElement<HTMLInputElement>('#n');
    const inputEvent = vi.fn();
    const changeEvent = vi.fn();
    input.addEventListener('input', inputEvent);
    input.addEventListener('change', changeEvent);

    const relay = extractForm(document).document;
    for (const field of relay.fields) {
      if (field.name === 'name' && field.type === 'text') field.value = 'FormRelay';
      if (field.name === 'bio' && field.type === 'textarea') field.value = 'Local-first';
      if (field.name === 'country' && field.type === 'select') field.value = 'ae';
      if (field.name === 'plan' && field.type === 'radio') field.value = 'b';
      if (field.name === 'tag' && field.type === 'checkbox_group') field.value = ['x'];
      if (field.name === 'terms' && field.type === 'checkbox') field.value = true;
    }

    const submit = vi.fn((event: Event) => event.preventDefault());
    requiredElement<HTMLFormElement>('form').addEventListener('submit', submit);
    const result = fillForm(relay, document);

    expect(result).toMatchObject({ filled: 6, skipped: 0 });
    expect(input.value).toBe('FormRelay');
    expect(requiredElement<HTMLTextAreaElement>('textarea').value).toBe('Local-first');
    expect(requiredElement<HTMLSelectElement>('select').value).toBe('ae');
    expect(requiredElement<HTMLInputElement>('input[type="checkbox"][value="x"]').checked).toBe(true);
    expect(requiredElement<HTMLInputElement>('input[type="checkbox"][value="y"]').checked).toBe(false);
    expect(requiredElement<HTMLInputElement>('input[name="terms"]').checked).toBe(true);
    expect(inputEvent).toHaveBeenCalled();
    expect(changeEvent).toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('uses the native setter so controlled-input listeners observe the new value', () => {
    document.body.innerHTML = '<form><input id="x" name="x"></form>';
    const input = requiredElement<HTMLInputElement>('#x');
    let seen = '';
    input.addEventListener('input', () => {
      seen = input.value;
    });

    const relay = extractForm(document).document;
    const field = relay.fields[0];
    if (!field || field.type !== 'text') throw new Error('Fixture text field missing.');
    field.value = 'controlled';
    fillForm(relay, document);
    expect(seen).toBe('controlled');
  });

  it('does not toggle disabled members of choice groups', () => {
    document.body.innerHTML = `
      <form>
        <label><input type="checkbox" name="tag" value="a">A</label>
        <label><input type="checkbox" name="tag" value="b" disabled checked>B</label>
      </form>`;
    const relay = extractForm(document).document;
    for (const field of relay.fields) {
      if (field.type === 'checkbox_group') field.value = ['a'];
    }

    fillForm(relay, document);
    expect(requiredElement<HTMLInputElement>('input[type="checkbox"][value="b"]').checked).toBe(true);
  });


  it('refuses a wrong-page document unless explicit override is supplied', () => {
    document.body.innerHTML = '<form id="f"><input id="x" name="x"></form>';
    const relay = extractForm(document).document;
    const field = relay.fields[0];
    if (!field || field.type !== 'text') throw new Error('Fixture text field missing.');
    field.value = 'blocked';
    relay.page.url = 'https://another.example/form';

    const blocked = fillForm(relay, document);
    expect(blocked.filled).toBe(0);
    expect(requiredElement<HTMLInputElement>('#x').value).toBe('');

    const overridden = fillForm(relay, document, { allowPageMismatch: true });
    expect(overridden.filled).toBe(1);
    expect(requiredElement<HTMLInputElement>('#x').value).toBe('blocked');
  });

  it('marks live HTML constraint violations invalid before filling', () => {
    document.body.innerHTML = '<form><input type="number" name="count" min="1" max="5"></form>';
    const current = extractForm(document).document;
    const imported = structuredClone(current);
    const field = imported.fields[0];
    if (!field || field.type !== 'number') throw new Error('Fixture number field missing.');
    field.value = '99';

    const changes = validateLiveChanges(validateImport(imported, current), document);
    expect(changes[0]?.status).toBe('invalid');
  });
});
