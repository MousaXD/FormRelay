import type { FillResult } from '../filling/fillForm';
import type { PageMatch, ValidatedChange } from '../import/validateImport';
import type { FormRelayDocument } from '../schema/formSchema';

export type BridgeRequest =
  | { type: 'FORMRELAY_EXTRACT' }
  | { type: 'FORMRELAY_PREVIEW'; document: FormRelayDocument }
  | {
      type: 'FORMRELAY_FILL';
      document: FormRelayDocument;
      allowPageMismatch: boolean;
    };

export type BridgeResponse =
  | { type: 'extract'; document: FormRelayDocument; excludedSensitiveCount: number }
  | {
      type: 'preview';
      current: FormRelayDocument;
      pageMatch: PageMatch;
      changes: ValidatedChange[];
    }
  | { type: 'fill'; result: FillResult };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function isBridgeRequest(value: unknown): value is BridgeRequest {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'FORMRELAY_EXTRACT') return true;
  if (value.type === 'FORMRELAY_PREVIEW') return isRecord(value.document);
  return (
    value.type === 'FORMRELAY_FILL' &&
    isRecord(value.document) &&
    typeof value.allowPageMismatch === 'boolean'
  );
}

export function isBridgeResponse(value: unknown): value is BridgeResponse {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  return value.type === 'extract' || value.type === 'preview' || value.type === 'fill';
}
