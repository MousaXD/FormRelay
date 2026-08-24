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

export default defineUnlistedScript({
  main() {
    if (globalThis.__formRelayBridgeInstalled) return;
    globalThis.__formRelayBridgeInstalled = true;

    browser.runtime.onMessage.addListener((message: unknown): Promise<BridgeResponse> | undefined => {
      if (message === null || typeof message !== 'object') return undefined;
      const type = Reflect.get(message, 'type');

      if (type === 'FORMRELAY_EXTRACT') {
        const result = extractForm(document);
        return Promise.resolve({ type: 'extract', ...result });
      }

      if (type === 'FORMRELAY_PREVIEW' || type === 'FORMRELAY_FILL') {
        const parsed = formRelaySchema.safeParse(Reflect.get(message, 'document'));
        if (!parsed.success) return undefined;

        if (type === 'FORMRELAY_PREVIEW') {
          const current = extractForm(document).document;
          return Promise.resolve({
            type: 'preview',
            current,
            changes: validateLiveChanges(validateImport(parsed.data, current), document),
          });
        }

        const allowPageMismatch = Reflect.get(message, 'allowPageMismatch') === true;
        return Promise.resolve({
          type: 'fill',
          result: fillForm(parsed.data, document, { allowPageMismatch }),
        });
      }

      return undefined;
    });
  },
});
