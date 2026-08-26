import { browser } from 'wxt/browser';
import type { BridgeRequest, BridgeResponse } from '../types/messages';
import { isBridgeResponse } from '../types/messages';

export async function sendBridgeRequestToTab(
  tabId: number,
  request: BridgeRequest,
): Promise<BridgeResponse> {
  await browser.scripting.executeScript({
    target: { tabId },
    files: ['form.js'],
  });

  const results = await browser.scripting.executeScript({
    target: { tabId },
    func: (payload: BridgeRequest) => {
      const scope = globalThis as typeof globalThis & {
        __formRelayBridgeHandle?: (request: unknown) => unknown;
      };
      if (typeof scope.__formRelayBridgeHandle !== 'function') {
        throw new Error('FormRelay page bridge did not initialize.');
      }
      return scope.__formRelayBridgeHandle(payload);
    },
    args: [request],
  });

  if (results.length !== 1 || !isBridgeResponse(results[0]?.result)) {
    throw new Error('Unexpected FormRelay bridge response.');
  }
  return results[0].result;
}
