import type { Browser } from 'wxt/browser';

export const FIREFOX_MCP_DATA_COLLECTION = [
  'personallyIdentifyingInfo',
  'websiteActivity',
  'websiteContent',
] as const;

function runningInFirefox(): boolean {
  return typeof navigator !== 'undefined' && /Firefox\//.test(navigator.userAgent);
}

export function mcpPermissionRequest(isFirefox = runningInFirefox()): Browser.permissions.Permissions {
  return {
    permissions: ['nativeMessaging'],
    ...(isFirefox ? { data_collection: [...FIREFOX_MCP_DATA_COLLECTION] } : {}),
  };
}
