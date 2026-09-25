import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { freeLoopbackPort, qaOptions } from './codex_qa_options.mjs';

const { output } = qaOptions({ output: `release/codex_guard_checks_${Date.now()}` });
mkdirSync(output, { recursive: true });
// Mutations exist only in the isolated server's transform output. Product files never change.
const mutations = [
  { name: 'monthly-action', file: 'ListeningYearbookView.tsx', from: 'onClick={generate} disabled={loading || busy || automaticCount === 0}', to: 'onClick={() => {}} disabled={loading || busy || automaticCount === 0}', script: 'codex_check_reports.mjs', error: /monthly-artwork/ },
  { name: 'month-pagination', file: 'codex_YearbookPage.tsx', from: 'const defaultGroupLimit = entries.length <= 20 ? 12 : 3;', to: 'const defaultGroupLimit = entries.length <= 20 ? 12 : 1;', script: 'codex_check_simple_yearbook.mjs', error: /AssertionError/ },
  { name: 'export-size', file: 'codex_yearbookPages.ts', from: 'export const JOURNAL_WIDTH = 1080;', to: 'export const JOURNAL_WIDTH = 1081;', script: 'codex_check_simple_yearbook.mjs', error: /AssertionError/ },
];
const results = [];
try {
  for (const mutation of mutations) {
    const source = readFileSync(`mobile/src/${mutation.file}`, 'utf8');
    assert.equal(source.split(mutation.from).length, 2, `${mutation.name}: unique verified mutation site`);
    let hits = 0;
    const server = await createServer({
      configFile: path.resolve('mobile/vite.config.ts'),
      cacheDir: path.resolve(output, mutation.name, 'cache'), logLevel: 'silent',
      server: { host: '127.0.0.1', port: await freeLoopbackPort(), strictPort: true, forwardConsole: false },
      plugins: [{ name: `codex-guard-${mutation.name}`, enforce: 'pre', transform(code, id) {
        if (id.split('?')[0].replaceAll('\\', '/').endsWith(`/mobile/src/${mutation.file}`) && code.includes(mutation.from)) {
          hits++; return { code: code.replace(mutation.from, mutation.to), map: null };
        }
      } }],
    });
    let child;
    let log = '';
    let timeout;
    let timedOut = false;
    try {
      await server.listen();
      const port = server.httpServer.address().port;
      const exitCode = await new Promise((resolve, reject) => {
        child = spawn(process.execPath, [`scripts/${mutation.script}`, '--origin', `http://127.0.0.1:${port}`, '--output', path.resolve(output, mutation.name)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', data => { log += data; }); child.stderr.on('data', data => { log += data; });
        timeout = setTimeout(() => {
          timedOut = true;
          if (process.platform === 'win32') {
            try { execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' }); } catch { /* Already exited. */ }
          } else child.kill('SIGTERM');
        }, 100_000);
        child.once('error', reject); child.once('close', resolve);
      });
      assert.equal(timedOut, false, 'A process timeout is not evidence that the intended assertion worked');
      assert.ok(hits > 0, 'The broken behavior was actually served');
      assert.equal(exitCode, 1, 'The real regression script rejects broken behavior');
      assert.match(log, mutation.error);
      if (mutation.name === 'month-pagination') assert.match(log, /1 !== 3/);
      if (mutation.name === 'export-size') assert.match(log, /1081 !== 1080/);
      results.push({ name: mutation.name, mutated: hits, exitCode, passed: true });
      console.log(`PASS guard ${mutation.name}: expected regression rejected`);
    } finally {
      clearTimeout(timeout);
      await server.close();
      writeFileSync(path.join(output, `${mutation.name}.log`), log);
    }
  }
} finally {
  writeFileSync(path.join(output, 'codex_guard_results.json'), JSON.stringify({ passed: results.length === mutations.length, results }, null, 2));
}
