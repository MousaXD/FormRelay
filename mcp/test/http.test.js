import assert from 'node:assert/strict';
import test from 'node:test';
import { ApprovalStore } from '../src/approval-store.js';
import { serveHttp } from '../src/http.js';

test('HTTP companion binds and serves a guarded health endpoint', async () => {
  const bridge = {
    connected: false,
    request: async () => {
      throw new Error('not connected');
    },
  };
  const http = await serveHttp({
    bridge,
    approvals: new ApprovalStore(),
    host: '127.0.0.1',
    port: 0,
  });
  try {
    const address = http.server.address();
    assert(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, browser_bridge_connected: false });
  } finally {
    await http.close();
  }
});
