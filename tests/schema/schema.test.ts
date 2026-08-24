import { describe, expect, it } from 'vitest';
import { formRelaySchema } from '../../src/schema/formSchema';
import { formDocument, textField } from '../fixtures/formRelay';

describe('FormRelay v1 schema', () => {
  it('accepts a valid document', () => {
    expect(formRelaySchema.safeParse(formDocument()).success).toBe(true);
  });

  it('rejects unexpected properties and prototype-pollution-shaped JSON', () => {
    expect(formRelaySchema.safeParse({ ...formDocument(), unexpected: 'x' }).success).toBe(false);
    const polluted = JSON.parse(
      '{"schema":"formrelay","schema_version":1,"page":{"title":"x","url":"https://x.test"},"form":{"id":null,"name":null},"fields":[],"__proto__":{"polluted":true}}',
    ) as unknown;
    expect(formRelaySchema.safeParse(polluted).success).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
  });

  it('rejects malformed select options', () => {
    const bad: unknown = {
      ...formDocument(),
      fields: [
        {
          ...textField(),
          type: 'select',
          options: [{ value: 'a' }],
        },
      ],
    };
    expect(formRelaySchema.safeParse(bad).success).toBe(false);
  });

  it('rejects oversized values and malformed Unicode', () => {
    expect(
      formRelaySchema.safeParse(formDocument([textField({ value: 'x'.repeat(20_001) })])).success,
    ).toBe(false);
    expect(
      formRelaySchema.safeParse(formDocument([textField({ value: '\ud800' })])).success,
    ).toBe(false);
  });
});
