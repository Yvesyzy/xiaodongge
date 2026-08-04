import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  plugin: "android/app/src/main/java/com/yves/musicarchive/NativeExportPlugin.java",
  activity: "android/app/src/main/java/com/yves/musicarchive/MainActivity.java",
  paths: "android/app/src/main/res/xml/file_paths.xml",
  bridge: "mobile/src/nativeExport.ts",
  app: "mobile/src/App.tsx",
};

for (const [name, relativePath] of Object.entries(files)) {
  assert.equal(existsSync(join(root, relativePath)), true, `${name} file is missing: ${relativePath}`);
}

const plugin = readFileSync(join(root, files.plugin), "utf8");
assert.match(plugin, /@CapacitorPlugin\(name = "NativeExport"\)/);
assert.match(plugin, /Intent\.ACTION_CREATE_DOCUMENT/);
assert.match(plugin, /@ActivityCallback/);
assert.match(plugin, /Intent\.ACTION_SEND/);
assert.match(plugin, /FileProvider\.getUriForFile/);
assert.match(plugin, /ClipboardManager/);

const activity = readFileSync(join(root, files.activity), "utf8");
assert.match(activity, /registerPlugin\(NativeExportPlugin\.class\)/);

const paths = readFileSync(join(root, files.paths), "utf8");
assert.match(paths, /<cache-path name="exports" path="exports\/" \/>/);

const bridge = readFileSync(join(root, files.bridge), "utf8");
assert.match(bridge, /registerPlugin<NativeExportPlugin>\("NativeExport"\)/);
assert.match(bridge, /saveFile\(options: ExportFileOptions\)/);
assert.match(bridge, /shareFile\(options: ExportFileOptions\)/);
assert.match(bridge, /copyText\(options: CopyTextOptions\)/);

const app = readFileSync(join(root, files.app), "utf8");
assert.match(app, /NativeExport\.saveFile/);
assert.match(app, /NativeExport\.shareFile/);
assert.match(app, /NativeExport\.copyText/);
assert.match(app, />保存到文件夹<\/button>/);
assert.match(app, />系统分享<\/button>/);
assert.match(app, />复制内容<\/button>/);
assert.match(app, /aria-live="polite"/);

console.log("Android native export integration check passed");
