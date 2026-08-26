import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeMessageParser, encodeNativeMessage } from '../src/native-framing.js';

test('native-messaging framing survives split chunks', () => {
  const seen = [];
  const errors = [];
  const parser = createNativeMessageParser((value) => seen.push(value), (error) => errors.push(error));
  const frame = encodeNativeMessage({ hello: 'world' });
  parser(frame.subarray(0, 3));
  parser(frame.subarray(3, 8));
  parser(frame.subarray(8));
  assert.deepEqual(seen, [{ hello: 'world' }]);
  assert.equal(errors.length, 0);
});
