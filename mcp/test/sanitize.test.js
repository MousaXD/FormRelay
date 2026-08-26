import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizePreview } from '../src/sanitize.js';

test('MCP preview never returns live before-values', () => {
  const result = sanitizePreview({
    type: 'preview',
    pageMatch: { matches: true, warning: null },
    changes: [
      {
        imported: { field_id: 'name', label: 'Name', type: 'text', value: 'New value' },
        current: { field_id: 'name', label: 'Name', type: 'text', value: '' },
        liveValue: 'Existing private value',
        confidence: 1,
        status: 'ready',
      },
    ],
  });
  assert.equal(JSON.stringify(result).includes('Existing private value'), false);
  assert.equal(result.changes[0].proposed_value, 'New value');
});
