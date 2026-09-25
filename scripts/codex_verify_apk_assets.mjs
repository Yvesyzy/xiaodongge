import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, lstat, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import yauzl from 'yauzl';

const { values } = parseArgs({ options: {
  apk: { type: 'string' }, web: { type: 'string' }, staged: { type: 'string' }, output: { type: 'string' },
} });
for (const key of ['apk', 'web', 'staged', 'output']) assert.ok(values[key], `Missing --${key}`);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(values.output);
const evidenceRoot = await realpath(path.join(root, 'release'));
assert.equal(evidenceRoot.toLowerCase(), path.join(root, 'release').toLowerCase(), 'Project release directory must not be linked');
const outputParent = await realpath(path.dirname(output));
assert.ok(outputParent.toLowerCase() === evidenceRoot.toLowerCase()
  || outputParent.toLowerCase().startsWith((evidenceRoot + path.sep).toLowerCase()), 'Evidence output must be under project release');
const sha256 = data => createHash('sha256').update(data).digest('hex');

async function filesIn(directory) {
  const root = path.resolve(directory);
  const files = new Map();
  async function walk(current) {
    for (const entry of await readdir(current)) {
      const full = path.join(current, entry);
      const info = await lstat(full);
      assert.ok(!info.isSymbolicLink(), `Symlink in web assets: ${full}`);
      if (info.isDirectory()) await walk(full);
      else {
        assert.ok(info.isFile(), `Unexpected web asset: ${full}`);
        files.set(path.relative(root, full).replaceAll('\\', '/'), sha256(await readFile(full)));
      }
    }
  }
  await walk(root);
  return files;
}

function filesInApk(apk) {
  return new Promise((resolve, reject) => {
    const files = new Map();
    yauzl.open(apk, { lazyEntries: true, autoClose: true }, (openError, zip) => {
      if (openError) return reject(openError);
      zip.on('error', reject);
      zip.on('end', () => resolve(files));
      zip.on('entry', entry => {
        const prefix = 'assets/';
        if (!entry.fileName.startsWith(prefix) || entry.fileName.endsWith('/')) return zip.readEntry();
        const relative = entry.fileName.slice(prefix.length);
        if (!relative || relative.includes('\\') || relative.split('/').includes('..') || files.has(relative)) {
          return reject(new Error(`Invalid or duplicate APK asset: ${entry.fileName}`));
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return reject(streamError);
          const hash = createHash('sha256');
          stream.on('error', reject);
          stream.on('data', chunk => hash.update(chunk));
          stream.on('end', () => { files.set(relative, hash.digest('hex')); zip.readEntry(); });
        });
      });
      zip.readEntry();
    });
  });
}

function compare(expected, actual, label) {
  const missing = [...expected.keys()].filter(name => !actual.has(name));
  const extra = [...actual.keys()].filter(name => !expected.has(name));
  const changed = [...expected.keys()].filter(name => actual.has(name) && expected.get(name) !== actual.get(name));
  assert.deepEqual({ missing, extra, changed }, { missing: [], extra: [], changed: [] }, label);
}

const web = await filesIn(values.web);
const staged = await filesIn(values.staged);
const expectedStaged = new Map(web);
for (const name of ['cordova.js', 'cordova_plugins.js']) {
  assert.ok(!expectedStaged.has(name), `Unexpected Cordova asset in web build: ${name}`);
  expectedStaged.set(name, sha256(Buffer.alloc(0)));
}
compare(expectedStaged, staged, 'Capacitor staging differs from the fresh web build');
const apk = await filesInApk(path.resolve(values.apk));
const publicAssets = new Map([...apk].filter(([name]) => name.startsWith('public/')).map(([name, hash]) => [name.slice(7), hash]));
compare(staged, publicAssets, 'APK public assets differ from Capacitor staging');
const androidAssets = path.resolve(values.staged, '..');
const platformAssets = new Map([
  ['capacitor.config.json', sha256(await readFile(path.join(androidAssets, 'capacitor.config.json')))],
  ['capacitor.plugins.json', sha256(await readFile(path.join(androidAssets, 'capacitor.plugins.json')))],
  ['native-bridge.js', sha256(await readFile(path.join(root, 'node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js')))],
]);
const packagedWebAssets = new Map([...apk].filter(([name]) => !name.startsWith('public/')
  && (platformAssets.has(name) || /\.(?:js|mjs|css|html|json|woff2?)$/i.test(name))));
compare(platformAssets, packagedWebAssets, 'APK contains an unexpected or changed web asset outside public');
const manifest = { apk: path.resolve(values.apk), web: path.resolve(values.web), staged: path.resolve(values.staged),
  publicFiles: publicAssets.size, platformFiles: platformAssets.size,
  files: [...apk].sort(([a], [b]) => a.localeCompare(b)).map(([name, hash]) => ({ name: `assets/${name}`, sha256: hash })), passed: true };
await writeFile(output, JSON.stringify(manifest, null, 2), { flag: 'wx' });
console.log(`PASS ${publicAssets.size} public assets and ${platformAssets.size} platform assets match the fresh build`);
