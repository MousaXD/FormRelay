import { describe, expect, it } from 'vitest';
import { parseImport } from '../../src/import/parseImport';
import { formDocument } from '../fixtures/formRelay';

describe('parseImport', () => {
  it('parses a valid FormRelay document', () => {
    const result = parseImport(JSON.stringify(formDocument()));
    expect(result.ok).toBe(true);
  });

  it('rejects malformed JSON', () => {
    expect(parseImport('{')).toEqual({ ok: false, error: 'Invalid JSON.' });
  });

  it('rejects payloads over the byte limit before schema processing', () => {
    const text = JSON.stringify({ ...formDocument([]), padding: 'x'.repeat(600_000) });
    expect(parseImport(text).ok).toBe(false);
  });

  it('rejects unexpected properties including __proto__ keys', () => {
    const text =
      '{"schema":"formrelay","schema_version":1,"page":{"title":"x","url":"https://x.test"},"form":{"id":null,"name":null},"fields":[],"__proto__":{"polluted":true}}';
    expect(parseImport(text).ok).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
  });

  it('rejects unsupported schema versions', () => {
    const raw = { ...formDocument(), schema_version: 99 };
    expect(parseImport(JSON.stringify(raw)).ok).toBe(false);
  });
});
