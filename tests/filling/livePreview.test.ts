import { describe, expect, it } from 'vitest';
import { extractForm } from '../../src/extraction/extractForm';
import { validateLiveChanges } from '../../src/filling/constraints';
import { validateImport } from '../../src/import/validateImport';

describe('live preview values', () => {
  it('shows the current local value without putting it into exported JSON', () => {
    document.body.innerHTML = '<form><label for="name">Name</label><input id="name" name="name" value="Old value"></form>';

    const current = extractForm(document).document;
    const imported = structuredClone(current);
    const field = imported.fields[0];
    if (!field || field.type !== 'text') throw new Error('Fixture text field missing.');
    field.value = 'New value';

    expect(current.fields[0]?.value).toBe('');
    const changes = validateLiveChanges(validateImport(imported, current), document);
    expect(changes[0]?.status).toBe('ready');
    expect(changes[0]?.liveValue).toBe('Old value');
    expect(current.fields[0]?.value).toBe('');
  });
});
