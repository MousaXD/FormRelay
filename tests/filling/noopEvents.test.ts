import { describe, expect, it, vi } from 'vitest';
import { fillCheckbox } from '../../src/filling/fillCheckbox';
import { fillInput } from '../../src/filling/fillInput';
import { fillSelect } from '../../src/filling/fillSelect';

describe('no-op filling', () => {
  it('does not dispatch input/change events when the requested value is already present', () => {
    document.body.innerHTML = `
      <input id="text" value="same">
      <input id="check" type="checkbox" checked>
      <select id="select"><option value="same" selected>Same</option></select>`;

    const text = document.querySelector<HTMLInputElement>('#text');
    const check = document.querySelector<HTMLInputElement>('#check');
    const select = document.querySelector<HTMLSelectElement>('#select');
    if (!text || !check || !select) throw new Error('Fixture controls missing.');

    const inputEvent = vi.fn();
    const changeEvent = vi.fn();
    for (const element of [text, check, select]) {
      element.addEventListener('input', inputEvent);
      element.addEventListener('change', changeEvent);
    }

    fillInput(text, 'same');
    fillCheckbox(check, true);
    fillSelect(select, 'same');

    expect(inputEvent).not.toHaveBeenCalled();
    expect(changeEvent).not.toHaveBeenCalled();
  });
});
