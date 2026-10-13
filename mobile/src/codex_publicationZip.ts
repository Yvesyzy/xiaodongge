export type PublicationZipFile = {
  name: string;
  data: Uint8Array;
};

const ZIP_LIMIT = 8 * 1024 * 1024;
const MAX_UINT32 = 0xffffffff;
const UTF8_FLAG = 0x0800;

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  CRC_TABLE[index] = value >>> 0;
}

function fail(message: string): never {
  throw new Error(message);
}

function crc32(bytes: Uint8Array): number {
  let result = 0xffffffff;
  for (const byte of bytes) result = CRC_TABLE[(result ^ byte) & 0xff] ^ (result >>> 8);
  return (result ^ 0xffffffff) >>> 0;
}

function writeUint16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function asciiName(name: unknown): Uint8Array {
  if (typeof name !== "string" || name.length === 0) fail("ZIP文件名不能为空。");
  if (name.length > 0xffff) fail("ZIP文件名过长，无法写入标准ZIP目录。");
  if (name === "." || name === ".." || name.includes("/") || name.includes("\\") || name.includes(":")) {
    fail("ZIP文件名不能包含路径穿越、目录分隔符或盘符。");
  }
  const bytes = new Uint8Array(name.length);
  for (let index = 0; index < name.length; index += 1) {
    const code = name.charCodeAt(index);
    if (code < 0x20 || code > 0x7e) fail("ZIP文件名只能使用ASCII可打印字符。");
    bytes[index] = code;
  }
  return bytes;
}

function checkedFiles(value: unknown): Array<{ name: string; nameBytes: Uint8Array; data: Uint8Array; crc: number }> {
  if (!Array.isArray(value)) fail("ZIP文件列表格式不正确。");
  if (value.length > 0xffff) fail("ZIP文件数量超过标准目录上限。");
  const names = new Set<string>();
  let archiveBytes = 22;
  return value.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) fail("ZIP文件条目格式不正确。");
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== Object.prototype && prototype !== null) fail("ZIP文件条目格式不正确，必须是普通对象。");
    const entry = item as Record<string, unknown>;
    const keys = Reflect.ownKeys(entry);
    if (keys.length !== 2 || keys.some((key) => typeof key !== "string" || (key !== "name" && key !== "data")) || !Object.prototype.hasOwnProperty.call(entry, "name") || !Object.prototype.hasOwnProperty.call(entry, "data")) {
      fail("ZIP文件条目只能包含name和data字段。");
    }
    const name = entry.name;
    if (typeof name !== "string") fail("ZIP文件名必须是文字。");
    if (names.has(name)) fail(`ZIP文件名重复：${name}`);
    names.add(name);
    const nameBytes = asciiName(name);
    if (!(entry.data instanceof Uint8Array)) fail(`ZIP文件“${name}”的数据必须是Uint8Array。`);
    const data = entry.data;
    if (data.length > MAX_UINT32) fail(`ZIP文件“${name}”超过标准ZIP单文件大小上限。`);
    archiveBytes += 30 + 46 + nameBytes.length * 2 + data.length;
    if (archiveBytes > ZIP_LIMIT) fail("ZIP导出包超过8 MiB大小限制，请减少文字或配图后重试。");
    return { name, nameBytes, data, crc: crc32(data) };
  });
}

export function buildPublicationZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const entries = checkedFiles(files);
  const localOffsets: number[] = [];
  let offset = 0;
  for (const entry of entries) {
    localOffsets.push(offset);
    offset += 30 + entry.nameBytes.length + entry.data.length;
  }
  const centralDirectoryOffset = offset;
  for (const entry of entries) offset += 46 + entry.nameBytes.length;
  const centralDirectorySize = offset - centralDirectoryOffset;
  const totalSize = offset + 22;
  if (totalSize > ZIP_LIMIT) fail("ZIP导出包超过8 MiB大小限制，请减少文字或配图后重试。");
  if (centralDirectoryOffset > MAX_UINT32 || centralDirectorySize > MAX_UINT32) fail("ZIP目录超过标准ZIP偏移上限。");

  const output = new Uint8Array(totalSize);
  let cursor = 0;
  entries.forEach((entry) => {
    writeUint32(output, cursor, 0x04034b50);
    writeUint16(output, cursor + 4, 20);
    writeUint16(output, cursor + 6, UTF8_FLAG);
    writeUint16(output, cursor + 8, 0);
    writeUint16(output, cursor + 10, 0);
    writeUint16(output, cursor + 12, 0);
    writeUint32(output, cursor + 14, entry.crc);
    writeUint32(output, cursor + 18, entry.data.length);
    writeUint32(output, cursor + 22, entry.data.length);
    writeUint16(output, cursor + 26, entry.nameBytes.length);
    writeUint16(output, cursor + 28, 0);
    output.set(entry.nameBytes, cursor + 30);
    output.set(entry.data, cursor + 30 + entry.nameBytes.length);
    cursor += 30 + entry.nameBytes.length + entry.data.length;
  });

  entries.forEach((entry, index) => {
    writeUint32(output, cursor, 0x02014b50);
    writeUint16(output, cursor + 4, 20);
    writeUint16(output, cursor + 6, 20);
    writeUint16(output, cursor + 8, UTF8_FLAG);
    writeUint16(output, cursor + 10, 0);
    writeUint16(output, cursor + 12, 0);
    writeUint16(output, cursor + 14, 0);
    writeUint32(output, cursor + 16, entry.crc);
    writeUint32(output, cursor + 20, entry.data.length);
    writeUint32(output, cursor + 24, entry.data.length);
    writeUint16(output, cursor + 28, entry.nameBytes.length);
    writeUint16(output, cursor + 30, 0);
    writeUint16(output, cursor + 32, 0);
    writeUint16(output, cursor + 34, 0);
    writeUint16(output, cursor + 36, 0);
    writeUint32(output, cursor + 38, 0);
    writeUint32(output, cursor + 42, localOffsets[index]);
    output.set(entry.nameBytes, cursor + 46);
    cursor += 46 + entry.nameBytes.length;
  });

  writeUint32(output, cursor, 0x06054b50);
  writeUint16(output, cursor + 4, 0);
  writeUint16(output, cursor + 6, 0);
  writeUint16(output, cursor + 8, entries.length);
  writeUint16(output, cursor + 10, entries.length);
  writeUint32(output, cursor + 12, centralDirectorySize);
  writeUint32(output, cursor + 16, centralDirectoryOffset);
  writeUint16(output, cursor + 20, 0);
  return output;
}
