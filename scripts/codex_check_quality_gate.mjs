import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';

// Inject a compiler error in memory: never modify a source file to test the gate.
const configPath = path.resolve('mobile/tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
assert.deepEqual(parsed.errors, []);
const target = path.resolve('mobile/src/App.tsx');
assert.ok(parsed.fileNames.some(file => path.resolve(file) === target));
const host = ts.createCompilerHost(parsed.options);
const read = host.readFile.bind(host);
host.readFile = file => {
  const source = read(file);
  return source !== undefined && path.resolve(file) === target
    ? source + '\nconst codexQualityGateProbe: number = "must fail";\n' : source;
};
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, incremental: false }, host);
assert.ok(ts.getPreEmitDiagnostics(program).some(diagnostic => diagnostic.code === 2322 && diagnostic.file && path.resolve(diagnostic.file.fileName) === target), 'Default mobile configuration must reject an injected type error');
const invalid = spawnSync(process.execPath, ['scripts/codex_verify_project.mjs', '--checks', 'codex-invalid-check'], { encoding: 'utf8', windowsHide: true });
assert.equal(invalid.status, 1, 'Invalid check must propagate a nonzero exit code');
assert.match(invalid.stderr, /Unknown check/);
console.log('PASS quality gate: compiler catches an in-memory source error; invalid checks fail with exit 1');
