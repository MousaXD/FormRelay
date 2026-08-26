import { randomBytes, randomUUID } from 'node:crypto';
import net from 'node:net';
import {
  BRIDGE_PROTOCOL_VERSION,
  DEFAULT_BRIDGE_TIMEOUT_MS,
  MAX_BRIDGE_MESSAGE_BYTES,
} from './constants.js';
import { removeBridgeStateIfOwned, writeBridgeState } from './bridge-state.js';
import { createLineJsonParser, writeLine } from './line-json.js';

export class BridgeBroker {
  #server;
  #socket = null;
  #token = randomBytes(32).toString('hex');
  #pending = new Map();
  #started = false;
  #statePath;

  constructor({ statePath } = {}) {
    this.#statePath = statePath;
  }

  get connected() {
    return this.#socket !== null && !this.#socket.destroyed;
  }

  async start() {
    if (this.#started) return;
    this.#server = net.createServer((socket) => this.#accept(socket));
    this.#server.maxConnections = 4;
    await new Promise((resolve, reject) => {
      this.#server.once('error', reject);
      this.#server.listen({ host: '127.0.0.1', port: 0 }, () => {
        this.#server.off('error', reject);
        resolve();
      });
    });
    const address = this.#server.address();
    if (!address || typeof address === 'string') throw new Error('Could not bind bridge broker.');
    await writeBridgeState(
      {
        version: BRIDGE_PROTOCOL_VERSION,
        host: '127.0.0.1',
        port: address.port,
        token: this.#token,
        pid: process.pid,
        started_at: new Date().toISOString(),
      },
      this.#statePath,
    );
    this.#started = true;
  }

  async close() {
    if (!this.#started) return;
    this.#socket?.destroy();
    this.#socket = null;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('FormRelay browser bridge stopped.'));
    }
    this.#pending.clear();
    await new Promise((resolve) => this.#server.close(() => resolve()));
    await removeBridgeStateIfOwned(this.#token, this.#statePath);
    this.#started = false;
  }

  async request(request, timeoutMs = DEFAULT_BRIDGE_TIMEOUT_MS) {
    if (!this.connected) {
      throw new Error('FormRelay browser bridge is not connected. Open the extension and enable MCP access.');
    }
    const id = randomUUID();
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error('FormRelay browser bridge timed out.'));
      }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      try {
        writeLine(this.#socket, { type: 'request', id, request });
      } catch (error) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(error);
      }
    });
  }

  #accept(socket) {
    socket.setNoDelay(true);
    let authenticated = false;
    let observedBytes = 0;

    const fail = (message) => {
      try {
        writeLine(socket, { type: 'error', error: message });
      } catch {
        // Ignore write errors while closing an unauthenticated socket.
      }
      socket.destroy();
    };

    const parse = createLineJsonParser(
      (message) => {
        if (!authenticated) {
          if (message?.type !== 'hello' || message?.token !== this.#token) {
            fail('Bridge authentication failed.');
            return;
          }
          authenticated = true;
          if (this.#socket && this.#socket !== socket) this.#socket.destroy();
          this.#socket = socket;
          writeLine(socket, { type: 'ready', version: BRIDGE_PROTOCOL_VERSION });
          return;
        }

        if (message?.type !== 'response' || typeof message?.id !== 'string') return;
        const pending = this.#pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.#pending.delete(message.id);
        if (typeof message.error === 'string') pending.reject(new Error(message.error));
        else pending.resolve(message.response);
      },
      () => fail('Bridge sent invalid JSON.'),
    );

    socket.on('data', (chunk) => {
      observedBytes += chunk.length;
      if (!authenticated && observedBytes > MAX_BRIDGE_MESSAGE_BYTES) {
        fail('Bridge handshake exceeded the size limit.');
        return;
      }
      parse(chunk);
    });
    socket.on('error', () => undefined);
    socket.on('close', () => {
      if (this.#socket === socket) {
        this.#socket = null;
        for (const pending of this.#pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(new Error('FormRelay browser bridge disconnected.'));
        }
        this.#pending.clear();
      }
    });
  }
}
