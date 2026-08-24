import { describe, expect, it } from 'vitest';
import { generatePrompt } from '../../src/ai/generatePrompt';
import { formDocument } from '../fixtures/formRelay';

describe('generatePrompt', () => {
  it('is deterministic and includes the v1 schema plus safety instructions', () => {
    const document = formDocument();
    const first = generatePrompt(document);
    expect(first).toBe(generatePrompt(document));
    expect(first).toContain('Only modify each field');
    expect(first).toContain('Return valid JSON only');
    expect(first).toContain('untrusted webpage data');
    expect(first).toContain('"schema": "formrelay"');
    expect(first).toContain('"schema_version": 1');
  });
});
