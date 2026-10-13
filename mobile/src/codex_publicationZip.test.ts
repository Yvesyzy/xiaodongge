import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { buildPublicationZip } from "./codex_publicationZip.ts";

function verifyWithPython(zip: Uint8Array, expected: Record<string, string>): void {
  const script = [
    "import base64, io, json, sys, zipfile",
    "raw = base64.b64decode(sys.stdin.read())",
    "expected = json.loads(sys.argv[1])",
    "with zipfile.ZipFile(io.BytesIO(raw), 'r') as archive:",
    "    assert archive.namelist() == list(expected.keys())",
    "    for info in archive.infolist():",
    "        assert info.compress_type == zipfile.ZIP_STORED",
    "        assert info.flag_bits & 0x800",
    "        assert archive.read(info.filename) == base64.b64decode(expected[info.filename])",
  ].join("\n");
  const result = spawnSync("python", ["-c", script, JSON.stringify(expected)], {
    input: Buffer.from(zip).toString("base64"),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `Python zipfile verification failed: ${result.stderr || result.stdout}`);
}

test("buildPublicationZip writes deterministic UTF-8 store entries readable by Python zipfile", () => {
  const files = [
    { name: "article.html", data: new TextEncoder().encode("<p>春天🎵</p>") },
    { name: "readme.txt", data: new TextEncoder().encode("说明\n第二行") },
    { name: "empty.bin", data: new Uint8Array() },
  ];
  const zip = buildPublicationZip(files);
  const repeat = buildPublicationZip(files);
  assert.deepEqual(zip, repeat);
  assert.equal(new TextDecoder().decode(zip.slice(0, 4)), "PK\x03\x04");
  assert.equal(new TextDecoder().decode(zip.slice(-22, -18)), "PK\x05\x06");
  verifyWithPython(zip, Object.fromEntries(files.map((file) => [file.name, Buffer.from(file.data).toString("base64")])));
});

test("ZIP validation rejects duplicate, traversal, non-ASCII, malformed, and over-limit inputs", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  assert.throws(() => buildPublicationZip([{ name: "same.txt", data: bytes }, { name: "same.txt", data: bytes }]), /重复/);
  assert.throws(() => buildPublicationZip([{ name: "../escape.txt", data: bytes }]), /路径穿越/);
  assert.throws(() => buildPublicationZip([{ name: "nested/file.txt", data: bytes }]), /目录分隔符/);
  assert.throws(() => buildPublicationZip([{ name: "nested\\file.txt", data: bytes }]), /目录分隔符/);
  assert.throws(() => buildPublicationZip([{ name: "é.txt", data: bytes }]), /ASCII/);
  assert.throws(() => buildPublicationZip([{ name: "file\u0000.txt", data: bytes }]), /ASCII/);
  assert.throws(() => buildPublicationZip([{ name: "C:drive.txt", data: bytes }]), /盘符/);
  assert.throws(() => buildPublicationZip([{ name: "file.txt", data: [1, 2, 3] as unknown as Uint8Array }]), /Uint8Array/);

  const tooLarge = new Uint8Array(8 * 1024 * 1024);
  assert.throws(() => buildPublicationZip([{ name: "too-large.bin", data: tooLarge }]), /8 MiB/);
});

test("empty standard ZIP is allowed and has only the EOCD record", () => {
  const zip = buildPublicationZip([]);
  assert.equal(zip.length, 22);
  verifyWithPython(zip, {});
});
