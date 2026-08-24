import type { FormRelayDocument } from '../schema/formSchema';

export function exportJson(document: FormRelayDocument): string {
  return JSON.stringify(document, null, 2);
}
