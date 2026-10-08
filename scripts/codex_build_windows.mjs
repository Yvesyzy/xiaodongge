import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, cp, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('请在 Windows x64 上打包此版本');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const packageInfo = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '_');
const name = `codex_xiaodongge_windows_${packageInfo.version}_x64_${stamp}`;
const folder = path.join(root, 'release', name);
const zip = `${folder}.zip`;
const runtime = path.dirname(require('electron'));
const run = (file, args, env = {}) => execFileSync(file, args, { cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env, ...env } });

await access(path.join(root, 'desktop', 'native', 'codex_windows_native.ps1'));
await mkdir(folder, { recursive: false });
await cp(runtime, folder, { recursive: true });
await rename(path.join(folder, 'electron.exe'), path.join(folder, 'codex_xiaodongge.exe'));
const appFolder = path.join(folder, 'resources', 'app');
const desktopFolder = path.join(appFolder, 'desktop');
await mkdir(desktopFolder, { recursive: true });
// Build into this new package directory so prior development assets cannot enter the ZIP.
run(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build',
  '--config', 'desktop/codex_vite.config.ts', '--outDir', path.join(desktopFolder, 'dist'), '--emptyOutDir', 'false']);
await writeFile(path.join(appFolder, 'package.json'), JSON.stringify({ name: 'xiaodongge-windows',
  productName: '小懂哥', version: packageInfo.version, private: true, main: 'desktop/codex_main.cjs' }, null, 2));
for (const file of ['codex_main.cjs', 'codex_preload.cjs', 'codex_sqlite.cjs', 'codex_now_playing.cjs', 'native']) {
  await cp(path.join(root, 'desktop', file), path.join(desktopFolder, file), { recursive: true });
}
await cp(path.join(root, 'LICENSE'), path.join(appFolder, 'LICENSE'));
await cp(path.join(root, 'mobile', 'public', 'codex_font_licenses.txt'), path.join(appFolder, 'codex_font_licenses.txt'));
await cp(path.join(root, 'desktop', 'codex_README.md'), path.join(folder, 'codex_使用说明.md'));

async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

const files = [];
async function inventory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inventory(file);
    else files.push({ path: path.relative(folder, file).replaceAll('\\', '/'), bytes: (await stat(file)).size, sha256: await hashFile(file) });
  }
}
await inventory(folder);
const manifest = { version: packageInfo.version, electron: require('electron/package.json').version,
  createdAt: new Date().toISOString(), executable: 'codex_xiaodongge.exe', userDataIdentity: 'xiaodongge-windows',
  files, fileCount: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) };
const manifestPath = path.join(folder, 'codex_package_manifest.json');
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

// Paths travel as environment values, never interpolated PowerShell source.
const packEnvironment = { CODEX_PACKAGE_FOLDER: folder, CODEX_PACKAGE_ZIP: zip, CODEX_PACKAGE_MANIFEST: manifestPath };
run('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
  "$ErrorActionPreference = 'Stop'; Compress-Archive -LiteralPath $env:CODEX_PACKAGE_FOLDER -DestinationPath $env:CODEX_PACKAGE_ZIP -CompressionLevel Optimal"], packEnvironment);
run('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath $env:CODEX_PACKAGE_MANIFEST -Raw | ConvertFrom-Json
$archive = [System.IO.Compression.ZipFile]::OpenRead($env:CODEX_PACKAGE_ZIP)
$prefix = Split-Path -Path $env:CODEX_PACKAGE_FOLDER -Leaf
$verified = 0
try {
  foreach ($file in $manifest.files) {
    $entry = $archive.GetEntry($prefix + '/' + $file.path)
    if ($null -eq $entry -or $entry.Length -ne $file.bytes) { throw ('ZIP size mismatch: ' + $file.path) }
    $stream = $entry.Open()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = [System.Convert]::ToHexString($sha.ComputeHash($stream)).ToLowerInvariant() }
    finally { $sha.Dispose(); $stream.Dispose() }
    if ($hash -ne $file.sha256) { throw ('ZIP hash mismatch: ' + $file.path) }
    $verified++
  }
  if (($archive.Entries | Where-Object { -not $_.FullName.EndsWith('/') }).Count -ne $manifest.fileCount + 1) { throw 'ZIP inventory mismatch' }
} finally { $archive.Dispose() }
Write-Output ('ZIP_VERIFIED files=' + $verified)
`], packEnvironment);
const result = { folder, zip, executable: path.join(folder, 'codex_xiaodongge.exe'),
  version: packageInfo.version, sha256: await hashFile(zip), bytes: (await stat(zip)).size,
  manifest: manifestPath, verifiedFiles: files.length, signed: false };
await writeFile(`${zip}.sha256.txt`, `${result.sha256}  ${path.basename(zip)}\n`);
await writeFile(path.join(root, 'release', 'codex_windows_latest.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
