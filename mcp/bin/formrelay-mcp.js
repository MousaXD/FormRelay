#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { ApprovalStore } from '../src/approval-store.js';
import { BridgeBroker } from '../src/bridge-broker.js';
import { DEFAULT_HTTP_HOST, DEFAULT_HTTP_PORT } from '../src/constants.js';
import { serveHttp } from '../src/http.js';
import { buildServer } from '../src/server.js';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const mode = process.argv[2] || 'stdio';
const bridge = new BridgeBroker();
const approvals = new ApprovalStore();
await bridge.start();

let transportClose = async () => undefined;
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  try {
    await transportClose();
  } finally {
    await bridge.close();
  }
}

process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));

if (mode === 'stdio') {
  const handle = serveStdio(() => buildServer({ bridge, approvals }));
  transportClose = () => handle.close();
  console.error('FormRelay MCP is serving over stdio.');
} else if (mode === 'http') {
  const host = option('--host', DEFAULT_HTTP_HOST);
  const port = Number.parseInt(option('--port', String(DEFAULT_HTTP_PORT)), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid --port value.');
  const http = await serveHttp({ bridge, approvals, host, port });
  transportClose = http.close;
  console.error(`FormRelay MCP HTTP listening on http://${host}:${port}/mcp`);
} else {
  await bridge.close();
  throw new Error('Usage: formrelay-mcp <stdio|http> [--host HOST] [--port PORT]');
}
