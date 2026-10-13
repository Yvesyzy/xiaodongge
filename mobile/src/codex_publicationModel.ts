export type PublicationPrivacy = {
  hideRating: boolean;
  hideDate: boolean;
  hideBrand: boolean;
  hideContent: boolean;
};

export type PublicationSection = {
  id: string;
  title: string;
  content: string;
  musicLabel: string;
  ratingText: string;
  dateText: string;
  coverDataUrl: string | null;
  includeImage: boolean;
};

export type PublicationDraft = {
  version: 1;
  title: string;
  author: string;
  intro: string;
  sections: PublicationSection[];
  privacy: PublicationPrivacy;
};

export type PublicationImage = {
  fileName: string;
  dataUrl: string;
  caption: string;
};

export type Publication = {
  title: string;
  plainText: string;
  htmlFragment: string;
  htmlDocument: string;
  images: PublicationImage[];
};

const MAX_TITLE_CHARACTERS = 200;
const MAX_AUTHOR_CHARACTERS = 100;
const MAX_INTRO_CHARACTERS = 20_000;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_SECTIONS = 256;
const MAX_ID_CHARACTERS = 1_024;
const MAX_SECTION_TITLE_CHARACTERS = MAX_TEXT_BYTES;
const MAX_SECTION_METADATA_CHARACTERS = MAX_TEXT_BYTES;
const MAX_CONTENT_CHARACTERS = MAX_TEXT_BYTES;
const PNG_DATA_PREFIX = "data:image/png;base64,";
const PNG_HEADER_BYTES = 33;
const MAX_PNG_BASE64_CHARACTERS = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
const MAX_PNG_DATA_URL_CHARACTERS = PNG_DATA_PREFIX.length + MAX_PNG_BASE64_CHARACTERS;

const BASE64_VALUES = new Int16Array(128);
BASE64_VALUES.fill(-1);
for (let index = 0; index < 26; index += 1) {
  BASE64_VALUES[65 + index] = index;
  BASE64_VALUES[97 + index] = 26 + index;
}
for (let index = 0; index < 10; index += 1) BASE64_VALUES[48 + index] = 52 + index;
BASE64_VALUES[43] = 62;
BASE64_VALUES[47] = 63;

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  CRC_TABLE[index] = value >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let result = 0xffffffff;
  for (const byte of bytes) result = CRC_TABLE[(result ^ byte) & 0xff] ^ (result >>> 8);
  return (result ^ 0xffffffff) >>> 0;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function characterLength(value: string): number {
  return Array.from(value).length;
}

function fail(message: string): never {
  throw new Error(message);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainRecord(value)) fail(`${label}格式不正确，必须是对象。`);
  return value;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  const actual = Reflect.ownKeys(value);
  if (actual.length !== allowed.length || actual.some((key) => typeof key !== "string" || !allowedSet.has(key))) {
    fail(`${label}包含无法恢复的字段。`);
  }
}

function text(value: unknown, label: string, maxCharacters: number, required = false): string {
  if (typeof value !== "string") fail(`${label}必须是文字。`);
  if (required && value.length === 0) fail(`${label}不能为空。`);
  if (characterLength(value) > maxCharacters) fail(`${label}过长，最多允许${maxCharacters}个字符。`);
  return value;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") fail(`${label}必须是布尔值。`);
  return value;
}

function base64Value(code: number): number {
  return code < 128 ? BASE64_VALUES[code] : -1;
}

function validateBase64(value: string, start: number): number {
  const length = value.length - start;
  if (length === 0 || length % 4 !== 0) fail("配图必须使用完整的本地PNG Base64数据。");
  if (length > MAX_PNG_BASE64_CHARACTERS) fail("配图超过8 MiB大小限制。");

  let padding = 0;
  if (value.charCodeAt(value.length - 1) === 61) padding += 1;
  if (value.charCodeAt(value.length - 2) === 61) padding += 1;
  for (let index = start; index < value.length - padding; index += 1) {
    if (value.charCodeAt(index) === 61) fail("配图的Base64填充位置不正确。");
  }

  for (let index = start; index < value.length; index += 4) {
    const firstCode = value.charCodeAt(index);
    const secondCode = value.charCodeAt(index + 1);
    const thirdCode = value.charCodeAt(index + 2);
    const fourthCode = value.charCodeAt(index + 3);
    const a = base64Value(firstCode);
    const b = base64Value(secondCode);
    const thirdPadding = thirdCode === 61;
    const fourthPadding = fourthCode === 61;
    const c = thirdPadding ? 0 : base64Value(thirdCode);
    const d = fourthPadding ? 0 : base64Value(fourthCode);
    const isLast = index + 4 === value.length;
    if (a < 0 || b < 0 || c < 0 || d < 0) fail("配图的Base64数据格式不正确。");
    if (thirdPadding && !fourthPadding) fail("配图的Base64填充格式不正确。");
    if (!isLast && (thirdPadding || fourthPadding)) fail("配图的Base64填充位置不正确。");
    if (thirdPadding && (b & 0x0f) !== 0) fail("配图的Base64数据不是规范编码。");
    if (fourthPadding && !thirdPadding && (c & 0x03) !== 0) fail("配图的Base64数据不是规范编码。");
  }

  const decodedLength = (length / 4) * 3 - padding;
  if (decodedLength > MAX_IMAGE_BYTES) fail("配图超过8 MiB大小限制。");
  return decodedLength;
}

function decodeBase64Prefix(value: string, start: number, decodedLength: number, prefixLength: number): Uint8Array {
  const output = new Uint8Array(Math.min(decodedLength, prefixLength));
  let outputIndex = 0;
  for (let index = start; index < value.length && outputIndex < output.length; index += 4) {
    const a = base64Value(value.charCodeAt(index));
    const b = base64Value(value.charCodeAt(index + 1));
    const thirdPadding = value.charCodeAt(index + 2) === 61;
    const fourthPadding = value.charCodeAt(index + 3) === 61;
    const c = thirdPadding ? 0 : base64Value(value.charCodeAt(index + 2));
    const d = fourthPadding ? 0 : base64Value(value.charCodeAt(index + 3));
    const combined = (a << 18) | (b << 12) | (c << 6) | d;
    if (outputIndex < output.length) output[outputIndex++] = (combined >>> 16) & 0xff;
    if (outputIndex < output.length && !thirdPadding) output[outputIndex++] = (combined >>> 8) & 0xff;
    if (outputIndex < output.length && !fourthPadding) output[outputIndex++] = combined & 0xff;
  }
  return output;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset] << 24) >>> 0) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function validatePngDataUrl(value: string): void {
  if (!value.startsWith(PNG_DATA_PREFIX)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(value)) fail("配图只允许本地PNG，不能使用远程URL或其他URL协议。");
    fail("配图必须是有效的本地PNG data URL。");
  }
  if (value.length > MAX_PNG_DATA_URL_CHARACTERS) fail("配图超过8 MiB大小限制。");
  const decodedLength = validateBase64(value, PNG_DATA_PREFIX.length);
  if (decodedLength < PNG_HEADER_BYTES) fail("配图不是有效的PNG文件。");
  const bytes = decodeBase64Prefix(value, PNG_DATA_PREFIX.length, decodedLength, PNG_HEADER_BYTES);
  if (bytes.length < 33) fail("配图不是有效的PNG文件。");
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (signature.some((byte, index) => bytes[index] !== byte)) fail("配图不是有效的PNG文件。");
  if (readUint32(bytes, 8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR") fail("配图缺少有效的PNG尺寸信息。");
  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  if (width < 1 || height < 1 || width > 4096 || height > 4096) fail("配图尺寸必须在1至4096像素范围内。");
  if (crc32(bytes.subarray(12, 29)) !== readUint32(bytes, 29)) fail("配图的PNG尺寸块校验失败。");
}

function validatePrivacy(value: unknown): PublicationPrivacy {
  const privacy = record(value, "隐私选项");
  exactKeys(privacy, ["hideRating", "hideDate", "hideBrand", "hideContent"], "隐私选项");
  return {
    hideRating: bool(privacy.hideRating, "hideRating"),
    hideDate: bool(privacy.hideDate, "hideDate"),
    hideBrand: bool(privacy.hideBrand, "hideBrand"),
    hideContent: bool(privacy.hideContent, "hideContent"),
  };
}

function validateSection(value: unknown, sectionIndex: number): PublicationSection {
  const section = record(value, `第${sectionIndex + 1}篇文章`);
  exactKeys(section, ["id", "title", "content", "musicLabel", "ratingText", "dateText", "coverDataUrl", "includeImage"], `第${sectionIndex + 1}篇文章`);
  const id = text(section.id, `第${sectionIndex + 1}篇文章的id`, MAX_ID_CHARACTERS, true);
  const title = text(section.title, `第${sectionIndex + 1}篇文章的标题`, MAX_SECTION_TITLE_CHARACTERS, true);
  const content = text(section.content, `第${sectionIndex + 1}篇文章的正文`, MAX_CONTENT_CHARACTERS);
  const musicLabel = text(section.musicLabel, `第${sectionIndex + 1}篇文章的音乐信息`, MAX_SECTION_METADATA_CHARACTERS);
  const ratingText = text(section.ratingText, `第${sectionIndex + 1}篇文章的评分`, MAX_SECTION_METADATA_CHARACTERS);
  const dateText = text(section.dateText, `第${sectionIndex + 1}篇文章的日期`, MAX_SECTION_METADATA_CHARACTERS);
  const includeImage = bool(section.includeImage, `第${sectionIndex + 1}篇文章的配图选项`);
  let coverDataUrl: string | null;
  if (section.coverDataUrl === null) coverDataUrl = null;
  else {
    if (typeof section.coverDataUrl !== "string") fail(`第${sectionIndex + 1}篇文章的配图必须是文字。`);
    if (section.coverDataUrl.length === 0) fail(`第${sectionIndex + 1}篇文章的配图不能为空。`);
    if (section.coverDataUrl.length > MAX_PNG_DATA_URL_CHARACTERS) fail("配图超过8 MiB大小限制。");
    coverDataUrl = section.coverDataUrl;
    validatePngDataUrl(coverDataUrl);
  }
  return { id, title, content, musicLabel, ratingText, dateText, coverDataUrl, includeImage };
}

function validateDraft(value: unknown): PublicationDraft {
  const draft = record(value, "公众号稿");
  exactKeys(draft, ["version", "title", "author", "intro", "sections", "privacy"], "公众号稿");
  if (draft.version !== 1) fail("公众号稿版本不受支持，只能恢复版本1。");
  const title = text(draft.title, "公众号标题", MAX_TITLE_CHARACTERS, true);
  const author = text(draft.author, "公众号作者", MAX_AUTHOR_CHARACTERS);
  const intro = text(draft.intro, "公众号导语", MAX_INTRO_CHARACTERS);
  if (!Array.isArray(draft.sections)) fail("公众号文章列表格式不正确。");
  if (draft.sections.length === 0) fail("公众号文章列表不能为空，至少需要一篇文章。");
  if (draft.sections.length > MAX_SECTIONS) fail(`公众号文章数量不能超过${MAX_SECTIONS}篇。`);
  const sections = draft.sections.map((section, index) => validateSection(section, index));
  const ids = new Set<string>();
  for (const section of sections) {
    if (ids.has(section.id)) fail("公众号文章标识不能重复。");
    ids.add(section.id);
  }
  const privacy = validatePrivacy(draft.privacy);
  const textBytes = [title, author, intro, ...sections.flatMap((section) => [section.id, section.title, section.content, section.musicLabel, section.ratingText, section.dateText])]
    .reduce((total, item) => total + utf8ByteLength(item), 0);
  if (textBytes > MAX_TEXT_BYTES) fail("公众号稿文字总量超过2 MiB限制，请减少内容后重试。");
  return { version: 1, title, author, intro, sections, privacy };
}

export function parsePublicationDraft(value: unknown): PublicationDraft {
  return validateDraft(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

function htmlText(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
}

function placementText(image: PublicationImage): string {
  return `[配图：${image.fileName}]`;
}

const PUBLICATION_BRAND = "小懂哥 · 私人音乐档案";

function metadataLines(section: PublicationSection, privacy: PublicationPrivacy): string[] {
  const lines: string[] = [];
  if (section.musicLabel.length > 0) lines.push(`音乐：${section.musicLabel}`);
  if (!privacy.hideRating && section.ratingText.length > 0) lines.push(`评分：${section.ratingText}`);
  if (!privacy.hideDate && section.dateText.length > 0) lines.push(`日期：${section.dateText}`);
  return lines;
}

function makeImages(draft: PublicationDraft): { images: PublicationImage[]; bySection: Map<number, PublicationImage> } {
  const images: PublicationImage[] = [];
  const bySection = new Map<number, PublicationImage>();
  draft.sections.forEach((section, index) => {
    if (!section.includeImage) return;
    // Saved drafts may intentionally omit the local cover bytes. Keep the
    // selection flag, but omit an unavailable image from export.
    if (section.coverDataUrl === null) return;
    const image: PublicationImage = {
      fileName: `codex_publication_image_${String(images.length + 1).padStart(3, "0")}.png`,
      dataUrl: section.coverDataUrl,
      caption: section.title,
    };
    images.push(image);
    bySection.set(index, image);
  });
  return { images, bySection };
}

function buildPlainText(draft: PublicationDraft, bySection: Map<number, PublicationImage>): string {
  const blocks: string[] = [];
  if (draft.author.length > 0) blocks.push(`作者：${draft.author}`);
  if (!draft.privacy.hideContent && draft.intro.length > 0) blocks.push(`导语：\n${draft.intro}`);
  draft.sections.forEach((section, index) => {
    const lines = [section.title, ...metadataLines(section, draft.privacy)];
    if (!draft.privacy.hideContent && section.content.length > 0) lines.push(`正文：\n${section.content}`);
    const image = bySection.get(index);
    if (image) lines.push(placementText(image));
    blocks.push(lines.join("\n"));
  });
  if (!draft.privacy.hideBrand) blocks.push(PUBLICATION_BRAND);
  return blocks.join("\n\n");
}

const FRAGMENT_SECTION_STYLE = "margin:0 0 24px 0;line-height:1.8;color:#202020;";
const FRAGMENT_HEADING_STYLE = "margin:0 0 8px 0;font-size:20px;line-height:1.5;font-weight:700;";
const FRAGMENT_META_STYLE = "margin:0;color:#666;font-size:14px;line-height:1.7;";
const FRAGMENT_BODY_STYLE = "margin:10px 0 0 0;white-space:normal;line-height:1.9;";
const FRAGMENT_NOTE_STYLE = "margin:10px 0 0 0;color:#666;font-size:14px;line-height:1.7;";
const FRAGMENT_FOOTER_STYLE = "margin:28px 0 0 0;color:#666;font-size:13px;line-height:1.7;";

function renderFragment(draft: PublicationDraft, bySection: Map<number, PublicationImage>): string {
  const chunks: string[] = [];
  if (draft.author.length > 0) chunks.push(`<p style="${FRAGMENT_META_STYLE}"><strong>作者：</strong>${htmlText(draft.author)}</p>`);
  if (!draft.privacy.hideContent && draft.intro.length > 0) {
    chunks.push(`<div style="${FRAGMENT_SECTION_STYLE}"><p style="${FRAGMENT_META_STYLE}"><strong>导语</strong></p><p style="${FRAGMENT_BODY_STYLE}">${htmlText(draft.intro)}</p></div>`);
  }
  draft.sections.forEach((section, index) => {
    const sectionChunks: string[] = [`<h2 style="${FRAGMENT_HEADING_STYLE}">${htmlText(section.title)}</h2>`];
    for (const line of metadataLines(section, draft.privacy)) sectionChunks.push(`<p style="${FRAGMENT_META_STYLE}">${htmlText(line)}</p>`);
    if (!draft.privacy.hideContent && section.content.length > 0) sectionChunks.push(`<div style="${FRAGMENT_BODY_STYLE}">${htmlText(section.content)}</div>`);
    const image = bySection.get(index);
    if (image) sectionChunks.push(`<p style="${FRAGMENT_NOTE_STYLE}">${htmlText(placementText(image))}</p>`);
    chunks.push(`<section style="${FRAGMENT_SECTION_STYLE}">${sectionChunks.join("")}</section>`);
  });
  if (!draft.privacy.hideBrand) chunks.push(`<p style="${FRAGMENT_FOOTER_STYLE}">${htmlText(PUBLICATION_BRAND)}</p>`);
  return chunks.join("");
}

function renderDocumentBody(draft: PublicationDraft, bySection: Map<number, PublicationImage>): string {
  const chunks: string[] = [`<h1 style="margin:0 0 24px 0;font-size:30px;line-height:1.4;">${htmlText(draft.title)}</h1>`];
  if (draft.author.length > 0) chunks.push(`<p style="${FRAGMENT_META_STYLE}"><strong>作者：</strong>${htmlText(draft.author)}</p>`);
  if (!draft.privacy.hideContent && draft.intro.length > 0) {
    chunks.push(`<div style="${FRAGMENT_SECTION_STYLE}"><p style="${FRAGMENT_META_STYLE}"><strong>导语</strong></p><p style="${FRAGMENT_BODY_STYLE}">${htmlText(draft.intro)}</p></div>`);
  }
  draft.sections.forEach((section, index) => {
    const sectionChunks: string[] = [`<h2 style="${FRAGMENT_HEADING_STYLE}">${htmlText(section.title)}</h2>`];
    for (const line of metadataLines(section, draft.privacy)) sectionChunks.push(`<p style="${FRAGMENT_META_STYLE}">${htmlText(line)}</p>`);
    const image = bySection.get(index);
    if (image) {
      sectionChunks.push(`<figure style="margin:14px 0;"><img src="${image.dataUrl}" alt="" style="display:block;max-width:100%;height:auto;"><figcaption style="${FRAGMENT_NOTE_STYLE}">${htmlText(image.caption)}</figcaption></figure>`);
    }
    if (!draft.privacy.hideContent && section.content.length > 0) sectionChunks.push(`<div style="${FRAGMENT_BODY_STYLE}">${htmlText(section.content)}</div>`);
    chunks.push(`<section style="${FRAGMENT_SECTION_STYLE}">${sectionChunks.join("")}</section>`);
  });
  if (!draft.privacy.hideBrand) chunks.push(`<p style="${FRAGMENT_FOOTER_STYLE}">${htmlText(PUBLICATION_BRAND)}</p>`);
  return chunks.join("");
}

function buildHtmlDocument(draft: PublicationDraft, bySection: Map<number, PublicationImage>): string {
  const csp = "default-src 'none'; base-uri 'none'; object-src 'none'; script-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; img-src data:; style-src 'unsafe-inline'";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${escapeHtml(draft.title)}</title></head><body style="max-width:720px;margin:0 auto;padding:32px 20px;background:#fff;color:#202020;overflow-wrap:break-word;word-break:break-word;font-family:system-ui,-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;">${renderDocumentBody(draft, bySection)}</body></html>`;
}

export function buildPublication(draft: PublicationDraft): Publication {
  const safeDraft = parsePublicationDraft(draft);
  // Bound embedded output before constructing large HTML strings or decoded image copies.
  const imageCharacters = safeDraft.sections.reduce((total, section) => total + (section.includeImage && section.coverDataUrl ? section.coverDataUrl.length : 0), 0);
  if (imageCharacters > MAX_PNG_DATA_URL_CHARACTERS) fail("所选配图总量超过8 MiB，请减少配图或分篇出稿。");
  const { images, bySection } = makeImages(safeDraft);
  return {
    title: safeDraft.title,
    plainText: buildPlainText(safeDraft, bySection),
    htmlFragment: renderFragment(safeDraft, bySection),
    htmlDocument: buildHtmlDocument(safeDraft, bySection),
    images,
  };
}
