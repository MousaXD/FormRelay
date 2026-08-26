import http from 'node:http';
import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  originValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { DEFAULT_HTTP_HOST, DEFAULT_HTTP_PORT } from './constants.js';
import { buildServer } from './server.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function csv(name) {
  return (process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function isLoopback(host) {
  return LOCAL_HOSTS.has(host);
}

export async function serveHttp({ bridge, approvals, host = DEFAULT_HTTP_HOST, port = DEFAULT_HTTP_PORT }) {
  const token = process.env.FORMRELAY_MCP_HTTP_TOKEN || '';
  const allowedHosts = csv('FORMRELAY_MCP_ALLOWED_HOSTS');
  const allowedOrigins = csv('FORMRELAY_MCP_ALLOWED_ORIGINS');
  const hasExternalHost = allowedHosts.some((value) => !LOCAL_HOSTS.has(value));

  if ((!isLoopback(host) || hasExternalHost) && !token) {
    throw new Error(
      'FORMRELAY_MCP_HTTP_TOKEN is required for non-loopback binds or externally routed hostnames.',
    );
  }

  const handler = createMcpHandler(() => buildServer({ bridge, approvals }));
  const nodeHandler = toNodeHandler(handler);
  const validateHost = allowedHosts.length > 0 ? hostHeaderValidation(allowedHosts) : localhostHostValidation();
  const validateOrigin =
    allowedOrigins.length > 0 ? originValidation(allowedOrigins) : localhostOriginValidation();

  const server = http.createServer((req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;

    const path = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
    if (path === '/healthz') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, browser_bridge_connected: bridge.connected }));
      return;
    }
    if (path !== '/mcp') {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    if (token && req.headers.authorization !== `Bearer ${token}`) {
      res.statusCode = 401;
      res.setHeader('www-authenticate', 'Bearer');
      res.end('Unauthorized');
      return;
    }
    void nodeHandler(req, res);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    server,
    close: async () => {
      await handler.close();
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
