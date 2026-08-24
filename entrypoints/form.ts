import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { browser } from 'wxt/browser';
import { extractForm } from '../src/extraction/extractForm';
import { fillForm } from '../src/filling/fillForm';
import { validateLiveChanges } from '../src/filling/constraints';
import { validateImport } from '../src/import/validateImport';
import { formRelaySchema } from '../src/schema/formSchema';
import type { BridgeResponse } from '../src/types/messages';

declare global {
  var __formRelayBridgeInstalled: boolean | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export default defineUnlistedScript({
  main() {
    if (globalThis.__formRelayBridgeInstalled) return;
    globalThis.__formRelayBridgeInstalled = true;

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!isRecord(message)) return false;
      const type = message.type;

      if (type === 'FORMRELAY_EXTRACT') {
        const result = extractForm(document);
        const response: BridgeResponse = { type: 'extract', ...result };
        sendResponse(response);
        return false;
      }

      if (type === 'FORMRELAY_PREVIEW' || type === 'FORMRELAY_FILL') {
        const parsed = formRelaySchema.safeParse(message.document);
        if (!parsed.success) return false;

        if (type === 'FORMRELAY_PREVIEW') {
          const current = extractForm(document).document;
          const response: BridgeResponse = {
            type: 'preview',
            current,
            changes: validateLiveChanges(validateImport(parsed.data, current), document),
          };
          sendResponse(response);
          return false;
        }

        const response: BridgeResponse = {
          type: 'fill',
          result: fillForm(parsed.data, document, {
            allowPageMismatch: message.allowPageMismatch === true,
          }),
        };
        sendResponse(response);
        return false;
      }

      return false;
    });
  },
});
