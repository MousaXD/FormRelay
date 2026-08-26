import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { BRIDGE_PROTOCOL_VERSION } from './constants.js';

export function bridgeStatePath() {
  return process.env.FORMRELAY_MCP_STATE_FILE || join(homedir(), '.formrelay', 'mcp-bridge.json');
}

export async function readBridgeState(path = bridgeStatePath()) {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  if (
    parsed?.version !== BRIDGE_PROTOCOL_VERSION ||
    parsed?.host !== '127.0.0.1' ||
    !Number.isInteger(parsed?.port) ||
    parsed.port < 1 ||
    parsed.port > 65535 ||
    typeof parsed?.token !== 'string' ||
    !/^[0-9a-f]{64}$/.test(parsed.token)
  ) {
    throw new Error('Invalid FormRelay MCP bridge state file.');
  }
  return parsed;
}

export async function writeBridgeState(state, path = bridgeStatePath()) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(state)}\n`, { encoding: 'utf8', mode: 0o600 });
  await chmod(temp, 0o600).catch(() => undefined);
  await rename(temp, path);
  await chmod(path, 0o600).catch(() => undefined);
}

export async function removeBridgeStateIfOwned(token, path = bridgeStatePath()) {
  try {
    const current = await readBridgeState(path);
    if (current.token === token) await rm(path, { force: true });
  } catch {
    // Missing or replaced state belongs to no cleanup work here.
  }
}
