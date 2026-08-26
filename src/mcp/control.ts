export type McpStatus = {
  permissionGranted: boolean;
  connected: boolean;
  connecting: boolean;
  error: string | null;
};

export type McpControlRequest =
  | { type: 'FORMRELAY_MCP_STATUS' }
  | { type: 'FORMRELAY_MCP_CONNECT' }
  | { type: 'FORMRELAY_MCP_DISCONNECT' };

export function isMcpStatus(value: unknown): value is McpStatus {
  if (value === null || typeof value !== 'object') return false;
  const status = value as Record<string, unknown>;
  return (
    typeof status.permissionGranted === 'boolean' &&
    typeof status.connected === 'boolean' &&
    typeof status.connecting === 'boolean' &&
    (status.error === null || typeof status.error === 'string')
  );
}
