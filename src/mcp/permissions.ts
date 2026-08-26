import { browser } from 'wxt/browser';

export const FIREFOX_MCP_DATA_COLLECTION = [
  'personallyIdentifyingInfo',
  'websiteActivity',
  'websiteContent',
] as const;

export function mcpPermissionRequest(): Parameters<typeof browser.permissions.contains>[0] {
  return {
    permissions: ['nativeMessaging'],
    ...(import.meta.env.FIREFOX
      ? { data_collection: [...FIREFOX_MCP_DATA_COLLECTION] }
      : {}),
  } as Parameters<typeof browser.permissions.contains>[0];
}
