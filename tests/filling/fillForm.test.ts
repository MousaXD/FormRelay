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

  it('fills the exact reviewed DOM ID when sibling controls share a name', () => {
    document.body.innerHTML = `
      <form>
        <input id="first" name="address">
        <input id="second" name="address">
      </form>`;
    const relay = extractForm(document).document;
    const target = relay.fields.find((field) => field.dom_id === 'second');
    if (!target || target.type !== 'text') throw new Error('Second field missing.');
    target.value = 'second-only';

    const result = fillForm(relay, document);
    expect(result.filled).toBe(1);
    expect(requiredElement<HTMLInputElement>('#first').value).toBe('');
    expect(requiredElement<HTMLInputElement>('#second').value).toBe('second-only');
  });

  it('fails closed for duplicate same-name scalar controls without IDs', () => {
    document.body.innerHTML = `
      <form>
        <input name="answer">
        <input name="answer">
      </form>`;
    const relay = extractForm(document).document;
    const target = relay.fields[1];
    if (!target || target.type !== 'text') throw new Error('Second field missing.');
    target.value = 'do-not-guess';

    const result = fillForm(relay, document);
    expect(result.filled).toBe(0);
    expect(result.errors.join(' ')).toContain('refusing to guess');
    const values = Array.from(document.querySelectorAll<HTMLInputElement>('input')).map(
      (element) => element.value,
    );
    expect(values).toEqual(['', '']);
  });

  it('fails closed when malformed HTML contains duplicate DOM IDs', () => {
    document.body.innerHTML = `
      <form>
        <input id="duplicate" name="first">
        <input id="duplicate" name="second">
      </form>`;
    const relay = extractForm(document).document;
    const target = relay.fields[0];
    if (!target || target.type !== 'text') throw new Error('Target field missing.');
    target.value = 'blocked';

    const result = fillForm(relay, document);
    expect(result.filled).toBe(0);
    expect(result.errors.join(' ')).toContain('Duplicate DOM IDs');
    expect(Array.from(document.querySelectorAll<HTMLInputElement>('input')).every((input) => input.value === '')).toBe(true);
  });

  it('keeps exact-ID targeting correct when controls are reordered after review', () => {
    document.body.innerHTML = `
      <form>
        <input id="first" name="address">
        <input id="second" name="address">
      </form>`;
    const relay = extractForm(document).document;
    const target = relay.fields.find((field) => field.dom_id === 'second');
    if (!target || target.type !== 'text') throw new Error('Second field missing.');
    target.value = 'still-second';

    const form = requiredElement<HTMLFormElement>('form');
    form.prepend(requiredElement<HTMLInputElement>('#second'));
    const result = fillForm(relay, document);

    expect(result.filled).toBe(1);
    expect(requiredElement<HTMLInputElement>('#first').value).toBe('');
    expect(requiredElement<HTMLInputElement>('#second').value).toBe('still-second');
  });

  it('fails closed when a reviewed control is removed before fill', () => {
    document.body.innerHTML = '<form><input id="x" name="x"></form>';
    const relay = extractForm(document).document;
    const field = relay.fields[0];
    if (!field || field.type !== 'text') throw new Error('Fixture field missing.');
    field.value = 'stale';
    requiredElement<HTMLInputElement>('#x').remove();

    const result = fillForm(relay, document);
    expect(result.filled).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('revalidates a replaced control and refuses a changed input type', () => {
    document.body.innerHTML = '<form><input id="x" name="x"></form>';
    const relay = extractForm(document).document;
    const field = relay.fields[0];
    if (!field || field.type !== 'text') throw new Error('Fixture field missing.');
    field.value = 'not-a-number';
    requiredElement<HTMLInputElement>('#x').outerHTML = '<input id="x" name="x" type="number">';

    const result = fillForm(relay, document);
    expect(result.filled).toBe(0);
    expect(requiredElement<HTMLInputElement>('#x').value).toBe('');
  });

  it('revalidates disabled and readonly state immediately before mutation', () => {
    for (const attribute of ['disabled', 'readonly'] as const) {
      document.body.innerHTML = '<form><input id="x" name="x"></form>';
      const relay = extractForm(document).document;
      const field = relay.fields[0];
      if (!field || field.type !== 'text') throw new Error('Fixture field missing.');
      field.value = 'blocked';
      requiredElement<HTMLInputElement>('#x').setAttribute(attribute, '');

      const result = fillForm(relay, document);
      expect(result.filled).toBe(0);
      expect(requiredElement<HTMLInputElement>('#x').value).toBe('');
    }
  });

  it('revalidates select options before filling', () => {
    document.body.innerHTML = `
      <form>
        <select id="country" name="country">
          <option value="ae">UAE</option>
          <option value="jo">Jordan</option>
        </select>
      </form>`;
    const relay = extractForm(document).document;
    const field = relay.fields[0];
    if (!field || field.type !== 'select') throw new Error('Fixture select missing.');
    field.value = 'jo';
    requiredElement<HTMLOptionElement>('option[value="jo"]').remove();

    const result = fillForm(relay, document);
    expect(result.filled).toBe(0);
    expect(requiredElement<HTMLSelectElement>('#country').value).toBe('ae');
  });

  it('keeps same-name fields in separate forms isolated to the reviewed form root', () => {
    document.body.innerHTML = `
      <form id="primary">
        <input id="primary-answer" name="answer">
        <input name="extra">
      </form>
      <form id="other">
        <input id="other-answer" name="answer" value="untouched">
      </form>`;
    const relay = extractForm(document).document;
    const target = relay.fields.find((field) => field.dom_id === 'primary-answer');
    if (!target || target.type !== 'text') throw new Error('Primary field missing.');
    target.value = 'primary-only';

    const result = fillForm(relay, document);
    expect(result.filled).toBe(1);
    expect(requiredElement<HTMLInputElement>('#primary-answer').value).toBe('primary-only');
    expect(requiredElement<HTMLInputElement>('#other-answer').value).toBe('untouched');
  });

  it('fails closed when the selected primary form changes after review', () => {
    document.body.innerHTML = `
      <form id="first"><input id="a" name="a"><input id="b" name="b"></form>
      <form id="second"><input id="c" name="c"></form>`;
    const relay = extractForm(document).document;
    const target = relay.fields.find((field) => field.dom_id === 'a');
    if (!target || target.type !== 'text') throw new Error('Target field missing.');
    target.value = 'blocked';

    requiredElement<HTMLInputElement>('#b').remove();
    requiredElement<HTMLFormElement>('#second').insertAdjacentHTML(
      'beforeend',
      '<input id="d" name="d"><input id="e" name="e">',
    );

    const result = fillForm(relay, document);
    expect(result.filled).toBe(0);
    expect(result.errors.join(' ')).toContain('another form or webpage');
  });

  it('fails closed when checkbox-group membership changes after review', () => {
    document.body.innerHTML = `
      <form>
        <label><input type="checkbox" name="tag" value="a">A</label>
        <label><input type="checkbox" name="tag" value="b">B</label>
      </form>`;
    const relay = extractForm(document).document;
    const field = relay.fields[0];
    if (!field || field.type !== 'checkbox_group') throw new Error('Checkbox group missing.');
    field.value = ['a'];
    requiredElement<HTMLInputElement>('input[value="b"]').remove();

    const result = fillForm(relay, document);
    expect(result.filled).toBe(0);
    expect(requiredElement<HTMLInputElement>('input[value="a"]').checked).toBe(false);
  });

  it('fails closed when radio options change after review', () => {
    document.body.innerHTML = `
      <form>
        <label><input type="radio" name="plan" value="a">A</label>
        <label><input type="radio" name="plan" value="b">B</label>
      </form>`;
    const relay = extractForm(document).document;
    const field = relay.fields[0];
    if (!field || field.type !== 'radio') throw new Error('Radio group missing.');
    field.value = 'b';
    requiredElement<HTMLInputElement>('input[value="b"]').remove();

    const result = fillForm(relay, document);
    expect(result.filled).toBe(0);
    expect(requiredElement<HTMLInputElement>('input[value="a"]').checked).toBe(false);
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
