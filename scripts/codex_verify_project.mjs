import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import { freeLoopbackPort } from './codex_qa_options.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const { values } = parseArgs({ options: {
  scope: { type: 'string', default: 'affected' }, checks: { type: 'string' }, output: { type: 'string' },
} });
if (!['affected', 'full'].includes(values.scope)) throw new Error('scope must be affected or full');
const checks = {
  storage: 'codex_check_storage_integrity.mjs', capture: 'codex_check_capture_regressions.mjs',
  native: 'codex_check_native_export_ui.mjs', sqlite: 'codex_check_sqlite_backup.mjs',
  legacy: 'codex_check_legacy_backup.mjs', covers: 'codex_check_cover_sqlite.mjs',
  reports: 'codex_check_reports.mjs', yearbook: 'codex_check_simple_yearbook.mjs',
  rank: 'codex_check_rank_poster.mjs', share: 'codex_check_review_share.mjs', tabs: 'abu_check_yearbook_tabs.mjs',
  'legacy-web': 'codex_check_legacy_web.mjs',
  guards: 'codex_check_regression_guards.mjs',
  drafts: 'codex_check_draft_records.mjs', 'draft-backup': 'codex_check_draft_backup.mjs',
  identity: 'codex_check_music_identity.mjs', 'album-relisten': 'codex_check_album_relisten.mjs',
  'album-timeline': 'codex_check_album_timeline.mjs',
  reading: 'codex_check_reading.mjs',
  diagnostics: 'codex_check_diagnostics.mjs',
  'restore-preview': 'codex_check_restore_preview.mjs', accessibility: 'codex_check_interaction_accessibility.mjs',
};
const selected = values.checks?.split(',') ?? (values.scope === 'full' ? Object.keys(checks) : [...Object.keys(checks).slice(0, 8), 'rank', 'identity', 'album-relisten', 'album-timeline', 'restore-preview', 'diagnostics', 'accessibility']);
if (!selected.length || selected.some(name => !checks[name])) throw new Error(`Unknown check; choose ${Object.keys(checks).join(',')}`);
const output = path.resolve(values.output ?? `release/codex_validation_${new Date().toISOString().replace(/[:.]/g, '-')}`);
if (existsSync(output)) throw new Error(`Use a new evidence directory: ${output}`);
mkdirSync(output, { recursive: true });
const report = {
  startedAt: new Date().toISOString(), scope: values.scope, selected, node: process.version,
  platform: process.platform, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }), checks: [], passed: false,
  lockSha256: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),
  installed: Object.fromEntries(['next', 'react-router-dom', 'postcss', 'vite', 'typescript', 'playwright'].map(name => [name, JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')).version])),
};
const servers = [];
let runningChild;
function stopChild() {
  if (!runningChild || runningChild.exitCode !== null) return;
  if (process.platform === 'win32') {
    try { execFileSync('taskkill.exe', ['/pid', String(runningChild.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true }); } catch { /* Process may have already exited. */ }
  } else runningChild.kill('SIGTERM');
}
async function run(name, args) {
  const started = Date.now();
  const log = path.join(output, `${name}.log`);
  const stream = createWriteStream(log);
  console.log(`CHECK ${name}`);
  let code;
  try {
    code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      runningChild = child;
      child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
      const timer = setTimeout(() => { stopChild(); reject(new Error(`${name} timed out after 5 minutes`)); }, 300_000);
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('close', (exitCode, signal) => { clearTimeout(timer); resolve(exitCode ?? (signal ? 1 : 0)); });
    });
  } finally {
    await new Promise(resolve => stream.end(resolve));
    report.checks.push({ name, command: [process.execPath, ...args], exitCode: code ?? 1, elapsedMs: Date.now() - started, log });
    runningChild = undefined;
  }
  if (code !== 0) throw new Error(`${name} failed (${code}); see ${log}`);
  console.log(`PASS ${name}`);
}
async function serve(port, name) {
  // Vite maps 0 to 5173; select a free port explicitly before binding with strictPort.
  if (port === 0) port = await freeLoopbackPort();
  const server = await createServer({ configFile: path.join(root, 'mobile/vite.config.ts'),
    cacheDir: path.join(output, `vite-cache-${name}`), logLevel: 'warn',
    server: { host: '127.0.0.1', port, strictPort: true, forwardConsole: false },
  });
  servers.push(server);
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a TCP address');
  return `http://127.0.0.1:${address.port}`;
}
function interrupted() { stopChild(); process.exitCode = 1; void Promise.allSettled(servers.map(server => server.close())); }
process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
try {
  const lockedPackages = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages;
  report.dependencyMismatches = Object.entries(lockedPackages).flatMap(([directory, locked]) => {
    if (!directory || !existsSync(path.join(directory, 'package.json'))) return [];
    const installed = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')).version;
    return installed === locked.version ? [] : [{ directory, locked: locked.version, installed }];
  });
  if (report.dependencyMismatches.length) throw new Error(`Installed dependencies differ from package-lock.json: ${report.dependencyMismatches.map(item => item.directory).join(', ')}`);
  await run('unit', ['--test', 'shared/listeningAnalysis.test.ts', 'shared/listeningContext.test.ts', 'shared/backupAppData.test.ts']);
  await run('types-root', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']);
  await run('types-mobile', ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'mobile/tsconfig.json', '--incremental', 'false']);
  await run('quality-gate', ['scripts/codex_check_quality_gate.mjs']);
  await run('build-mobile', ['node_modules/vite/bin/vite.js', 'build', '--config', 'mobile/vite.config.ts', '--outDir', path.join(output, 'mobile-dist'), '--emptyOutDir', 'false']);
  const origin = await serve(0, 'app');
  // The prototype deliberately refuses all ports except its dedicated 5174 origin.
  const prototypeOrigin = selected.includes('yearbook') ? await serve(5174, 'prototype') : undefined;
  for (const name of selected) {
    const args = [`scripts/${checks[name]}`, '--origin', origin, '--output', path.join(output, name)];
    if (name === 'yearbook') args.push('--prototype-origin', prototypeOrigin);
    await run(name, args);
  }
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  stopChild();
  const closed = await Promise.allSettled(servers.map(server => server.close()));
  if (closed.some(result => result.status === 'rejected')) { report.passed = false; process.exitCode = 1; report.cleanupError = 'An owned Vite server did not close'; }
  report.finishedAt = new Date().toISOString();
  writeFileSync(path.join(output, 'codex_results.json'), JSON.stringify(report, null, 2));
  console.log(`Evidence: ${output}`);
}
