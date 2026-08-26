#!/usr/bin/env node
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NATIVE_HOST_NAME } from '../src/constants.js';

const browserName = process.argv[2];
const extensionId = process.argv[3];
if (process.platform !== 'linux') {
  throw new Error('The native-host installer currently supports Linux. Install the manifest manually on macOS/Windows for now.');
}
if (!['firefox', 'chrome', 'chromium'].includes(browserName)) {
  throw new Error('Usage: install-native-host.js <firefox|chrome|chromium> <extension-id>');
}
if (!extensionId) throw new Error('An extension ID is required.');

const thisFile = fileURLToPath(import.meta.url);
const nativeHostPath = resolve(dirname(thisFile), 'formrelay-native-host.js');
await chmod(nativeHostPath, 0o755);

const locations = {
  firefox: `${homedir()}/.mozilla/native-messaging-hosts/${NATIVE_HOST_NAME}.json`,
  chrome: `${homedir()}/.config/google-chrome/NativeMessagingHosts/${NATIVE_HOST_NAME}.json`,
  chromium: `${homedir()}/.config/chromium/NativeMessagingHosts/${NATIVE_HOST_NAME}.json`,
};
const target = locations[browserName];
const manifest = {
  name: NATIVE_HOST_NAME,
  description: 'FormRelay MCP local bridge',
  path: nativeHostPath,
  type: 'stdio',
  ...(browserName === 'firefox'
    ? { allowed_extensions: [extensionId] }
    : { allowed_origins: [`chrome-extension://${extensionId}/`] }),
};
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(target);
