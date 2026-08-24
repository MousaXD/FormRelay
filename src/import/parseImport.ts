import { formRelaySchema, type FormRelayDocument } from '../schema/formSchema';
import { assertSupportedVersion } from '../schema/versioning';
import { LIMITS } from '../security/limits';

export type ParseResult =
  | { ok: true; document: FormRelayDocument }
  | { ok: false; error: string };

export function parseImport(text: string): ParseResult {
  if (new TextEncoder().encode(text).byteLength > LIMITS.importBytes) {
    return { ok: false, error: 'Imported JSON exceeds the 512 KiB safety limit.' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }

  const parsed = formRelaySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: `JSON failed FormRelay schema validation: ${parsed.error.issues[0]?.message ?? 'unknown error'}`,
    };
  }

  try {
    assertSupportedVersion(parsed.data.schema, parsed.data.schema_version);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unsupported schema version.',
    };
  }

  return { ok: true, document: parsed.data };
}
