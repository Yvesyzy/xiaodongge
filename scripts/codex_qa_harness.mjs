import path from 'node:path';
import { createServer } from 'vite';
import { freeLoopbackPort } from './codex_qa_options.mjs';

export async function startQaViteServer({
  output,
  configFile = 'mobile/vite.config.ts',
  cacheDir = path.join(output, 'vite-cache'),
  port = 0,
  logLevel = 'warn',
  ...viteOptions
} = {}) {
  if (!output) throw new Error('QA server output directory is required');
  const selectedPort = port === 0 ? await freeLoopbackPort() : port;
  const server = await createServer({
    configFile: path.resolve(configFile),
    cacheDir: path.resolve(cacheDir),
    logLevel,
    ...viteOptions,
    server: {
      host: '127.0.0.1',
      port: selectedPort,
      strictPort: true,
      forwardConsole: false,
    },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') throw new Error('Vite did not expose a TCP address');
    return { server, origin: `http://127.0.0.1:${address.port}` };
  } catch (error) {
    await server.close().catch(() => {});
    throw error;
  }
}
