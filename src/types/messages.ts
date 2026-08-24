import type { FillResult } from '../filling/fillForm';
import type { ValidatedChange } from '../import/validateImport';
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
  | { type: 'preview'; current: FormRelayDocument; changes: ValidatedChange[] }
  | { type: 'fill'; result: FillResult };
