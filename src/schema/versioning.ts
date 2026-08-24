export const SCHEMA_NAME = 'formrelay' as const;
export const CURRENT_SCHEMA_VERSION = 1 as const;

export function assertSupportedVersion(schema: string, version: number): void {
  if (schema !== SCHEMA_NAME || version !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported FormRelay schema: ${schema}@${version}.`);
  }
}
