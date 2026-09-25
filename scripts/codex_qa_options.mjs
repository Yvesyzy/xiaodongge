import { parseArgs } from 'node:util';
import { createServer } from 'node:net';

export async function freeLoopbackPort() {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

// Shared by browser checks; positional origins remain valid for existing callers.
export function qaOptions(defaults = {}) {
  const { values, positionals } = parseArgs({
    options: {
      origin: { type: 'string' }, output: { type: 'string' },
      'prototype-origin': { type: 'string' }, backup: { type: 'string' },
    },
    allowPositionals: true,
  });
  const origin = values.origin ?? (defaults.positionalBackup ? undefined : positionals[0]) ?? defaults.origin ?? 'http://127.0.0.1:5173';
  const prototypeOrigin = values['prototype-origin'] ?? 'http://127.0.0.1:5174';
  for (const address of [origin, prototypeOrigin]) {
    const url = new URL(address);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== address) {
      throw new Error(`Browser checks require an exact http://127.0.0.1 origin: ${address}`);
    }
  }
  return {
    origin, prototypeOrigin,
    output: values.output ?? process.env.CODEX_QA_DIR ?? defaults.output ?? 'release/codex_qa',
    backup: values.backup ?? (defaults.positionalBackup ? positionals[0] : undefined),
  };
}
