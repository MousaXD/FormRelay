import { MAX_BRIDGE_MESSAGE_BYTES } from './constants.js';

export function encodeNativeMessage(value) {
  const payload = Buffer.from(JSON.stringify(value), 'utf8');
  if (payload.length > MAX_BRIDGE_MESSAGE_BYTES) throw new Error('Native message exceeded the size limit.');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

export function createNativeMessageParser(onMessage, onError) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (length > MAX_BRIDGE_MESSAGE_BYTES) {
        buffer = Buffer.alloc(0);
        onError(new Error('Native message exceeded the size limit.'));
        return;
      }
      if (buffer.length < 4 + length) return;
      const payload = buffer.subarray(4, 4 + length);
      buffer = buffer.subarray(4 + length);
      try {
        onMessage(JSON.parse(payload.toString('utf8')));
      } catch {
        onError(new Error('Browser sent invalid native-messaging JSON.'));
      }
    }
  };
}
