import { MAX_BRIDGE_MESSAGE_BYTES } from './constants.js';

export function createLineJsonParser(onMessage, onError, maxBytes = MAX_BRIDGE_MESSAGE_BYTES) {
  let buffer = '';
  let byteLength = 0;

  return (chunk) => {
    const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    byteLength += Buffer.byteLength(text);
    if (byteLength > maxBytes) {
      buffer = '';
      byteLength = 0;
      onError(new Error('Bridge message exceeded the size limit.'));
      return;
    }

    buffer += text;
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      byteLength = Buffer.byteLength(buffer);
      if (!line.trim()) continue;
      try {
        onMessage(JSON.parse(line));
      } catch {
        onError(new Error('Bridge sent invalid JSON.'));
      }
    }
  };
}

export function writeLine(socket, value) {
  const payload = `${JSON.stringify(value)}\n`;
  if (Buffer.byteLength(payload) > MAX_BRIDGE_MESSAGE_BYTES) {
    throw new Error('Bridge message exceeded the size limit.');
  }
  socket.write(payload);
}
