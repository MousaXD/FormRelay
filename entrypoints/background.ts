import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { sendBridgeRequestToTab } from '../src/browser/bridge';
import type { McpControlRequest, McpStatus } from '../src/mcp/control';
import { mcpPermissionRequest } from '../src/mcp/permissions';
import { isBridgeRequest } from '../src/types/messages';

const NATIVE_HOST = 'io.formrelay.mcp';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default defineBackground(() => {
  let nativePort: ReturnType<typeof browser.runtime.connectNative> | null = null;
  let connected = false;
  let connecting = false;
  let lastError: string | null = null;

  const permissionGranted = () => browser.permissions.contains(mcpPermissionRequest());

  const status = async (): Promise<McpStatus> => ({
    permissionGranted: await permissionGranted(),
    connected,
    connecting,
    error: lastError,
  });

  const disconnect = () => {
    const port = nativePort;
    nativePort = null;
    connected = false;
    connecting = false;
    port?.disconnect();
  };

  const handleNativeRequest = async (port: NonNullable<typeof nativePort>, message: unknown) => {
    if (message === null || typeof message !== 'object') return;
    const payload = message as Record<string, unknown>;
    if (payload.type !== 'request' || typeof payload.id !== 'string') return;

    if (!isBridgeRequest(payload.request)) {
      port.postMessage({ type: 'response', id: payload.id, error: 'Invalid bridge request.' });
      return;
    }

    try {
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab?.id == null) throw new Error('No active browser tab is available.');
      const response = await sendBridgeRequestToTab(tab.id, payload.request);
      port.postMessage({ type: 'response', id: payload.id, response });
    } catch (error) {
      port.postMessage({ type: 'response', id: payload.id, error: errorMessage(error) });
    }
  };

  const connect = async (): Promise<McpStatus> => {
    if (!(await permissionGranted())) {
      lastError = 'MCP access has not been granted.';
      return status();
    }
    if (nativePort) return status();

    lastError = null;
    connecting = true;
    try {
      const port = browser.runtime.connectNative(NATIVE_HOST);
      nativePort = port;
      port.onMessage.addListener((message: unknown) => {
        if (port !== nativePort || message === null || typeof message !== 'object') return;
        const payload = message as Record<string, unknown>;
        if (payload.type === 'status') {
          connected = payload.connected === true;
          connecting = false;
          lastError = typeof payload.error === 'string' ? payload.error : null;
          return;
        }
        void handleNativeRequest(port, message);
      });
      port.onDisconnect.addListener(() => {
        if (port !== nativePort) return;
        nativePort = null;
        connected = false;
        connecting = false;
        if (!lastError) {
          lastError = 'Native bridge disconnected. Start the FormRelay MCP companion and reconnect.';
        }
      });
    } catch (error) {
      nativePort = null;
      connected = false;
      connecting = false;
      lastError = errorMessage(error);
    }
    return status();
  };

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (message === null || typeof message !== 'object') return undefined;
    const request = message as McpControlRequest;
    if (request.type === 'FORMRELAY_MCP_STATUS') return status();
    if (request.type === 'FORMRELAY_MCP_CONNECT') return connect();
    if (request.type === 'FORMRELAY_MCP_DISCONNECT') {
      disconnect();
      lastError = null;
      return status();
    }
    return undefined;
  });

  void permissionGranted().then((granted) => {
    if (granted) void connect();
  });
});
