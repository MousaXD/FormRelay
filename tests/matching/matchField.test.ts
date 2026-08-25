import { describe, expect, it } from 'vitest';
import { matchField } from '../../src/matching/matchField';
import { textField } from '../fixtures/formRelay';

describe('matchField', () => {
  it('matches an unchanged fingerprint after reordering', () => {
    const imported = textField({ field_id: 'fr_11111111' });
    const candidates = [
      textField({ field_id: 'fr_22222222', name: 'other', dom_id: 'other', label: 'Other' }),
      textField({ field_id: 'fr_11111111' }),
    ];
    expect(matchField(imported, candidates.map((field, index) => ({ field, index }))).candidate?.index).toBe(1);
  });

  it('falls back to DOM id and name after an unrelated insertion changes a fingerprint', () => {
    const imported = textField({ field_id: 'fr_aaaa0000', name: 'email', dom_id: 'mail' });
    const current = textField({ field_id: 'fr_bbbb0000', name: 'email', dom_id: 'mail' });
    expect(matchField(imported, [{ field: current, index: 2 }]).confidence).toBe(0.94);
  });

  it('refuses ambiguous duplicate names', () => {
    const imported = textField({ field_id: 'fr_aaaa0000', name: 'x', dom_id: null, label: 'Same' });
    const a = textField({ field_id: 'fr_00000001', name: 'x', dom_id: null, label: 'Same' });
    const b = textField({ field_id: 'fr_00000002', name: 'x', dom_id: null, label: 'Same' });
    expect(matchField(imported, [{ field: a, index: 0 }, { field: b, index: 1 }]).candidate).toBeNull();
  });

  it('refuses ambiguous duplicate labels when stronger identity is absent', () => {
    const imported = textField({
      field_id: 'fr_aaaa0000',
      name: null,
      dom_id: null,
      label: 'Shared label',
    });
    const a = textField({
      field_id: 'fr_00000001',
      name: null,
      dom_id: null,
      label: 'Shared label',
    });
    const b = textField({
      field_id: 'fr_00000002',
      name: null,
      dom_id: null,
      label: 'Shared label',
    });
    const result = matchField(imported, [
      { field: a, index: 0 },
      { field: b, index: 1 },
    ]);
    expect(result.candidate).toBeNull();
    expect(result.ambiguous).toBe(true);
  });

  it('leaves stale unrelated fields unresolved', () => {
    const imported = textField({ field_id: 'fr_aaaaaaaa', name: 'old', dom_id: 'old', label: 'Old field' });
    const current = textField({ field_id: 'fr_bbbbbbbb', name: 'new', dom_id: 'new', label: 'New field' });
    const result = matchField(imported, [{ field: current, index: 0 }]);
    expect(result.candidate).toBeNull();
    expect(result.confidence).toBeLessThan(0.72);
  });
});
