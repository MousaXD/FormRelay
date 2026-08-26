import net from 'node:net';
import { readBridgeState } from './bridge-state.js';
import { createLineJsonParser, writeLine } from './line-json.js';
import { createNativeMessageParser, encodeNativeMessage } from './native-framing.js';

function writeBrowser(value) {
  process.stdout.write(encodeNativeMessage(value));
}

export async function runNativeHost() {
  const state = await readBridgeState();
  const socket = net.createConnection({ host: state.host, port: state.port });
  socket.setNoDelay(true);

  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });

  writeLine(socket, { type: 'hello', token: state.token });

  const parseBroker = createLineJsonParser(
    (message) => {
      if (message?.type === 'ready') {
        writeBrowser({ type: 'status', connected: true });
        return;
      }
      if (message?.type === 'request') writeBrowser(message);
      if (message?.type === 'error') writeBrowser({ type: 'status', connected: false, error: message.error });
    },
    (error) => {
      console.error(error.message);
      socket.destroy();
    },
  );
  socket.on('data', parseBroker);
  socket.on('error', (error) => console.error(error.message));
  socket.on('close', () => process.exit(0));

  const parseBrowser = createNativeMessageParser(
    (message) => {
      if (message?.type === 'response' && typeof message?.id === 'string') writeLine(socket, message);
    },
    (error) => {
      console.error(error.message);
      socket.destroy();
    },
  );
  process.stdin.on('data', parseBrowser);
  process.stdin.on('end', () => socket.destroy());
}
