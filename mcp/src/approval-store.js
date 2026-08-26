import { createHash, randomUUID } from 'node:crypto';

function fingerprint(document) {
  return createHash('sha256').update(JSON.stringify(document)).digest('hex');
}

export class ApprovalStore {
  #items = new Map();
  #ttlMs;

  constructor(ttlMs = 5 * 60 * 1000) {
    this.#ttlMs = ttlMs;
  }

  issue(document) {
    this.#purge();
    const id = randomUUID();
    this.#items.set(id, {
      fingerprint: fingerprint(document),
      expiresAt: Date.now() + this.#ttlMs,
    });
    return id;
  }

  consume(id, document) {
    this.#purge();
    const item = this.#items.get(id);
    this.#items.delete(id);
    return Boolean(item && item.fingerprint === fingerprint(document) && item.expiresAt >= Date.now());
  }

  #purge() {
    const now = Date.now();
    for (const [id, item] of this.#items) {
      if (item.expiresAt < now) this.#items.delete(id);
    }
  }
}
