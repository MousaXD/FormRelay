import http from 'node:http';
import { Readable } from 'node:stream';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { DEFAULT_HTTP_HOST, DEFAULT_HTTP_PORT } from './constants.js';
import { buildServer } from './server.js';

function isLoopback(host) {
  return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}

async function toWebRequest(req, host, port) {
  const base = `http://${req.headers.host || `${host}:${port}`}`;
  const url = new URL(req.url || '/', base);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  const init = { method: req.method || 'GET', headers };
  if (init.method !== 'GET' && init.method !== 'HEAD') {
    init.body = Readable.toWeb(req);
    init.duplex = 'half';
  }
  return new Request(url, init);
}

function sendWebResponse(response, res) {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  if (!response.body) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body).pipe(res);
}

export async function serveHttp({ bridge, approvals, host = DEFAULT_HTTP_HOST, port = DEFAULT_HTTP_PORT }) {
  const token = process.env.FORMRELAY_MCP_HTTP_TOKEN || '';
  if (!isLoopback(host) && !token) {
    throw new Error('FORMRELAY_MCP_HTTP_TOKEN is required when binding MCP HTTP outside loopback.');
  }
  const handler = createMcpHandler(() => buildServer({ bridge, approvals }));
  const server = http.createServer(async (req, res) => {
    try {
      const path = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`).pathname;
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
      const request = await toWebRequest(req, host, port);
      const response = await handler.fetch(request);
      sendWebResponse(response, res);
    } catch (error) {
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : 'Internal error');
    }
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
      await handler.close?.();
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
