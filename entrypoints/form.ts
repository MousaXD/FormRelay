import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { extractForm } from '../src/extraction/extractForm';
import { validateLiveChanges } from '../src/filling/constraints';
import { fillForm } from '../src/filling/fillForm';
import { comparePage, validateImport } from '../src/import/validateImport';
import { formRelaySchema } from '../src/schema/formSchema';
import type { BridgeResponse } from '../src/types/messages';

declare global {
  var __formRelayBridgeHandle: ((request: unknown) => BridgeResponse) | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function handleBridgeRequest(request: unknown): BridgeResponse {
  if (!isRecord(request) || typeof request.type !== 'string') {
    throw new Error('Invalid FormRelay bridge request.');
  }

  if (request.type === 'FORMRELAY_EXTRACT') {
    const result = extractForm(document);
    return { type: 'extract', ...result };
  }

  if (request.type !== 'FORMRELAY_PREVIEW' && request.type !== 'FORMRELAY_FILL') {
    throw new Error('Unsupported FormRelay bridge request.');
  }

  const parsed = formRelaySchema.safeParse(request.document);
  if (!parsed.success) throw new Error('FormRelay document validation failed.');

  if (request.type === 'FORMRELAY_PREVIEW') {
    const current = extractForm(document).document;
    return {
      type: 'preview',
      current,
      pageMatch: comparePage(parsed.data, current),
      changes: validateLiveChanges(validateImport(parsed.data, current), document),
    };
  }

  return {
    type: 'fill',
    result: fillForm(parsed.data, document, {
      allowPageMismatch: request.allowPageMismatch === true,
    }),
  };
}

export default defineUnlistedScript(() => {
  // scripting.executeScript() runs this bundle in FormRelay's isolated world.
  // A second isolated-world executeScript call invokes this handler directly,
  // avoiding runtime message-listener lifecycle differences across browsers.
  globalThis.__formRelayBridgeHandle = handleBridgeRequest;
});
