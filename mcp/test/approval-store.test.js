import assert from 'node:assert/strict';
import test from 'node:test';
import { ApprovalStore } from '../src/approval-store.js';

test('approval tokens are one-time and bound to exact document data', () => {
  const store = new ApprovalStore();
  const document = { schema_version: 1, page: {}, form: {}, fields: [] };
  const token = store.issue(document);
  assert.equal(store.consume(token, structuredClone(document)), true);
  assert.equal(store.consume(token, document), false);
});

test('approval tokens reject changed documents', () => {
  const store = new ApprovalStore();
  const document = { schema_version: 1, page: {}, form: {}, fields: [] };
  const token = store.issue(document);
  assert.equal(store.consume(token, { ...document, fields: [{ field_id: 'changed' }] }), false);
});
