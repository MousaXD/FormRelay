import { describe, expect, it } from 'vitest';
import { pageIdentity } from '../../src/extraction/pageIdentity';

function docAt(href: string): Document {
  return { location: { href } } as unknown as Document;
}

describe('pageIdentity', () => {
  it('changes when query or fragment route state changes', () => {
    const first = pageIdentity(docAt('https://example.com/customer?id=100#/edit'));
    const second = pageIdentity(docAt('https://example.com/customer?id=200#/edit'));
    const third = pageIdentity(docAt('https://example.com/customer?id=100#/history'));

    expect(first).toMatch(/^frp_[0-9a-f]{16}$/);
    expect(second).not.toBe(first);
    expect(third).not.toBe(first);
  });

  it('does not let embedded URL credentials affect exported routing identity', () => {
    const withCredentials = pageIdentity(docAt('https://user:secret@example.com/app?id=1'));
    const withoutCredentials = pageIdentity(docAt('https://example.com/app?id=1'));
    expect(withCredentials).toBe(withoutCredentials);
  });
});
