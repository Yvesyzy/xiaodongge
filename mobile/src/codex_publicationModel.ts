export type PublicationPrivacy = {
  hideRating: boolean;
  hideDate: boolean;
  hideBrand: boolean;
  hideContent: boolean;
};

// 结构化元信息：从乐评逐项带出，旧草稿没有这个字段时回退到扁平三行。
export type PublicationMetaField = {
  label: string;
  value: string;
  kind: "music" | "rating" | "date";
};

export type PublicationSection = {
  id: string;
  title: string;
  content: string;
  musicLabel: string;
  ratingText: string;
  dateText: string;
  metaFields?: PublicationMetaField[];
};

export type PublicationDraft = {
  version: 1;
  title: string;
  author: string;
  intro: string;
  sections: PublicationSection[];
  privacy: PublicationPrivacy;
};

export type Publication = {
  title: string;
  plainText: string;
  htmlFragment: string;
  htmlDocument: string;
  markdown: string;
};

const MAX_TITLE_CHARACTERS = 200;
const MAX_AUTHOR_CHARACTERS = 100;
const MAX_INTRO_CHARACTERS = 20_000;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_SECTIONS = 256;
const MAX_ID_CHARACTERS = 1_024;
const MAX_SECTION_TITLE_CHARACTERS = MAX_TEXT_BYTES;
const MAX_SECTION_METADATA_CHARACTERS = MAX_TEXT_BYTES;
const MAX_CONTENT_CHARACTERS = MAX_TEXT_BYTES;

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

function allowedKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], label: string): void {
  const allowed = new Set([...required, ...optional]);
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string" || !allowed.has(key)) || required.some((key) => !(key in value))) {
    fail(`${label}包含无法恢复的字段。`);
  }
}

const META_KINDS = new Set(["music", "rating", "date"]);
const MAX_META_FIELDS = 32;
const MAX_META_LABEL_CHARACTERS = 40;

function validateMetaFields(value: unknown, sectionIndex: number): PublicationMetaField[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail(`第${sectionIndex + 1}篇文章的元信息列表格式不正确。`);
  if (value.length > MAX_META_FIELDS) fail(`第${sectionIndex + 1}篇文章的元信息项目过多。`);
  return value.map((item, fieldIndex) => {
    const label = `第${sectionIndex + 1}篇文章的第${fieldIndex + 1}项元信息`;
    const field = record(item, label);
    exactKeys(field, ["label", "value", "kind"], label);
    const fieldLabel = text(field.label, `${label}名称`, MAX_META_LABEL_CHARACTERS, true);
    const fieldValue = text(field.value, `${label}内容`, MAX_SECTION_METADATA_CHARACTERS, true);
    if (typeof field.kind !== "string" || !META_KINDS.has(field.kind)) fail(`${label}类型不正确。`);
    return { label: fieldLabel, value: fieldValue, kind: field.kind as PublicationMetaField["kind"] };
  });
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
  // coverDataUrl / includeImage 是旧版草稿遗留的配图字段，读取时容忍但不再进入导出结果。
  allowedKeys(section, ["id", "title", "content", "musicLabel", "ratingText", "dateText"], ["metaFields", "coverDataUrl", "includeImage"], `第${sectionIndex + 1}篇文章`);
  const id = text(section.id, `第${sectionIndex + 1}篇文章的id`, MAX_ID_CHARACTERS, true);
  const title = text(section.title, `第${sectionIndex + 1}篇文章的标题`, MAX_SECTION_TITLE_CHARACTERS, true);
  const content = text(section.content, `第${sectionIndex + 1}篇文章的正文`, MAX_CONTENT_CHARACTERS);
  const musicLabel = text(section.musicLabel, `第${sectionIndex + 1}篇文章的音乐信息`, MAX_SECTION_METADATA_CHARACTERS);
  const ratingText = text(section.ratingText, `第${sectionIndex + 1}篇文章的评分`, MAX_SECTION_METADATA_CHARACTERS);
  const dateText = text(section.dateText, `第${sectionIndex + 1}篇文章的日期`, MAX_SECTION_METADATA_CHARACTERS);
  const metaFields = validateMetaFields(section.metaFields, sectionIndex);
  return { id, title, content, musicLabel, ratingText, dateText, ...(metaFields ? { metaFields } : {}) };
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
  const textBytes = [title, author, intro, ...sections.flatMap((section) => [section.id, section.title, section.content, section.musicLabel, section.ratingText, section.dateText,
    ...(section.metaFields ?? []).flatMap((field) => [field.label, field.value])])]
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

const PUBLICATION_BRAND = "小懂哥 · 私人音乐档案";

const RATING_DIMENSIONS_PER_LINE = 3;

// 元信息分三组：基本信息（专辑/艺术家/歌曲）→ 评分 → 日期。组内每行一段，组间留两个空行。
// 六个评分维度比较密集，每三项合成同一段落；用「 · 」在段落内分隔，
// 不依赖公众号导入器不支持的行尾双空格硬换行。
function metadataGroups(section: PublicationSection, privacy: PublicationPrivacy): string[][] {
  const fields = section.metaFields;
  if (!fields || fields.length === 0) {
    const groups: string[][] = [];
    if (section.musicLabel.length > 0) groups.push([`音乐：${section.musicLabel}`]);
    if (!privacy.hideRating && section.ratingText.length > 0) groups.push([`评分：${section.ratingText}`]);
    if (!privacy.hideDate && section.dateText.length > 0) groups.push([`日期：${section.dateText}`]);
    return groups;
  }
  const music: string[] = [];
  const ratings: string[] = [];
  const dates: string[] = [];
  let dimensionLine: string[] = [];
  const flushDimensions = () => {
    if (dimensionLine.length === 0) return;
    ratings.push(dimensionLine.join(" · "));
    dimensionLine = [];
  };
  for (const field of fields) {
    if ((field.kind === "rating" && privacy.hideRating) || (field.kind === "date" && privacy.hideDate)) continue;
    const line = `${field.label}：${field.value}`;
    if (field.kind === "music") { music.push(line); continue; }
    if (field.kind === "date") { dates.push(line); continue; }
    if (field.label === "评分") { flushDimensions(); ratings.push(line); continue; }
    dimensionLine.push(line);
    if (dimensionLine.length === RATING_DIMENSIONS_PER_LINE) flushDimensions();
  }
  flushDimensions();
  return [music, ratings, dates].filter((group) => group.length > 0);
}


// 单篇且章节标题与推文标题相同时只保留顶部标题，避免导入后出现两遍同名标题。
function sectionHeadingVisible(draft: PublicationDraft, section: PublicationSection): boolean {
  return draft.sections.length > 1 || section.title !== draft.title;
}

// 公众号文档导入只可靠支持基础 Markdown；本地图片不会随 .md 转存，导出只保留文字。
function mdSafe(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mdLine(value: string): string {
  return mdSafe(value)
    .replace(/^(\s*)(#{1,6}|[-+*])(?=\s|$)/, "$1\\$2")
    .replace(/^(\s*)(\d+)(\.\s)/, "$1$2\\$3");
}

function mdBody(value: string): string {
  return value.split(/\r\n|\r|\n/).map(mdLine).join("\n");
}

function mdMetaLine(value: string): string {
  return mdLine(value.replace(/\r\n|\r|\n/g, " "));
}

function buildMarkdown(draft: PublicationDraft): string {
  const oneLine = (value: string) => mdSafe(value).replace(/\r\n|\r|\n/g, " ");
  const blocks: string[] = [`# ${oneLine(draft.title)}`];
  if (draft.author.length > 0) blocks.push(`作者：${oneLine(draft.author)}`);
  if (!draft.privacy.hideContent && draft.intro.length > 0) {
    blocks.push(draft.intro.split(/\r\n|\r|\n/).map((line) => `> ${mdSafe(line)}`).join("\n"));
  }
  for (const section of draft.sections) {
    const sectionBlocks: string[] = sectionHeadingVisible(draft, section) ? [`## ${oneLine(section.title)}`] : [];
    // 公众号文档导入会吞掉「行尾双空格」硬换行，只有空行分隔的段落能稳定保留逐行排版。
    // 组内一个空行、组间两个空行，导入后基本信息 / 评分 / 日期三块自然分开。
    const groups = metadataGroups(section, draft.privacy);
    if (groups.length > 0) {
      sectionBlocks.push(groups.map((group) => group.map(mdMetaLine).join("\n\n")).join("\n\n\n"));
    }
    if (!draft.privacy.hideContent && section.content.length > 0) sectionBlocks.push(mdBody(section.content));
    if (sectionBlocks.length > 0) blocks.push(sectionBlocks.join("\n\n"));
  }
  if (!draft.privacy.hideBrand) blocks.push(`---\n\n${PUBLICATION_BRAND}`);
  return `${blocks.join("\n\n")}\n`;
}

function buildPlainText(draft: PublicationDraft): string {
  const blocks: string[] = [];
  if (draft.author.length > 0) blocks.push(`作者：${draft.author}`);
  if (!draft.privacy.hideContent && draft.intro.length > 0) blocks.push(`导语：\n${draft.intro}`);
  for (const section of draft.sections) {
    const lines = [...(sectionHeadingVisible(draft, section) ? [section.title] : [])];
    const meta = metadataGroups(section, draft.privacy).map((group) => group.join("\n")).join("\n\n");
    if (meta.length > 0) lines.push(meta);
    if (!draft.privacy.hideContent && section.content.length > 0) lines.push(`正文：\n${section.content}`);
    blocks.push(lines.join("\n"));
  }
  if (!draft.privacy.hideBrand) blocks.push(PUBLICATION_BRAND);
  return blocks.join("\n\n");
}

const FRAGMENT_SECTION_STYLE = "margin:0 0 24px 0;line-height:1.8;color:#202020;";
const FRAGMENT_HEADING_STYLE = "margin:0 0 8px 0;font-size:20px;line-height:1.5;font-weight:700;";
const FRAGMENT_META_STYLE = "margin:0;color:#666;font-size:14px;line-height:1.7;";
// 组内每行留一个行距、组间再多留一段，与 Markdown 的「组内空一行、组间空两行」对齐。
const FRAGMENT_META_LINE_STYLE = "margin:0 0 8px 0;color:#666;font-size:14px;line-height:1.7;";
const FRAGMENT_META_GROUP_STYLE = "margin:0 0 8px 0;";
const FRAGMENT_BODY_STYLE = "margin:10px 0 0 0;white-space:normal;line-height:1.9;";
const FRAGMENT_FOOTER_STYLE = "margin:28px 0 0 0;color:#666;font-size:13px;line-height:1.7;";

function renderFragment(draft: PublicationDraft): string {
  const chunks: string[] = [];
  if (draft.author.length > 0) chunks.push(`<p style="${FRAGMENT_META_STYLE}"><strong>作者：</strong>${htmlText(draft.author)}</p>`);
  if (!draft.privacy.hideContent && draft.intro.length > 0) {
    chunks.push(`<div style="${FRAGMENT_SECTION_STYLE}"><p style="${FRAGMENT_META_STYLE}"><strong>导语</strong></p><p style="${FRAGMENT_BODY_STYLE}">${htmlText(draft.intro)}</p></div>`);
  }
  for (const section of draft.sections) {
    const sectionChunks: string[] = sectionHeadingVisible(draft, section) ? [`<h2 style="${FRAGMENT_HEADING_STYLE}">${htmlText(section.title)}</h2>`] : [];
    for (const group of metadataGroups(section, draft.privacy)) {
      sectionChunks.push(`<div style="${FRAGMENT_META_GROUP_STYLE}">${group.map((line) => `<p style="${FRAGMENT_META_LINE_STYLE}">${htmlText(line)}</p>`).join("")}</div>`);
    }
    if (!draft.privacy.hideContent && section.content.length > 0) sectionChunks.push(`<div style="${FRAGMENT_BODY_STYLE}">${htmlText(section.content)}</div>`);
    chunks.push(`<section style="${FRAGMENT_SECTION_STYLE}">${sectionChunks.join("")}</section>`);
  }
  if (!draft.privacy.hideBrand) chunks.push(`<p style="${FRAGMENT_FOOTER_STYLE}">${htmlText(PUBLICATION_BRAND)}</p>`);
  return chunks.join("");
}

function renderDocumentBody(draft: PublicationDraft): string {
  const chunks: string[] = [`<h1 style="margin:0 0 24px 0;font-size:30px;line-height:1.4;">${htmlText(draft.title)}</h1>`];
  if (draft.author.length > 0) chunks.push(`<p style="${FRAGMENT_META_STYLE}"><strong>作者：</strong>${htmlText(draft.author)}</p>`);
  if (!draft.privacy.hideContent && draft.intro.length > 0) {
    chunks.push(`<div style="${FRAGMENT_SECTION_STYLE}"><p style="${FRAGMENT_META_STYLE}"><strong>导语</strong></p><p style="${FRAGMENT_BODY_STYLE}">${htmlText(draft.intro)}</p></div>`);
  }
  for (const section of draft.sections) {
    const sectionChunks: string[] = sectionHeadingVisible(draft, section) ? [`<h2 style="${FRAGMENT_HEADING_STYLE}">${htmlText(section.title)}</h2>`] : [];
    for (const group of metadataGroups(section, draft.privacy)) {
      sectionChunks.push(`<div style="${FRAGMENT_META_GROUP_STYLE}">${group.map((line) => `<p style="${FRAGMENT_META_LINE_STYLE}">${htmlText(line)}</p>`).join("")}</div>`);
    }
    if (!draft.privacy.hideContent && section.content.length > 0) sectionChunks.push(`<div style="${FRAGMENT_BODY_STYLE}">${htmlText(section.content)}</div>`);
    chunks.push(`<section style="${FRAGMENT_SECTION_STYLE}">${sectionChunks.join("")}</section>`);
  }
  if (!draft.privacy.hideBrand) chunks.push(`<p style="${FRAGMENT_FOOTER_STYLE}">${htmlText(PUBLICATION_BRAND)}</p>`);
  return chunks.join("");
}

function buildHtmlDocument(draft: PublicationDraft): string {
  const csp = "default-src 'none'; base-uri 'none'; object-src 'none'; script-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; img-src data:; style-src 'unsafe-inline'";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${escapeHtml(draft.title)}</title></head><body style="max-width:720px;margin:0 auto;padding:32px 20px;background:#fff;color:#202020;overflow-wrap:break-word;word-break:break-word;font-family:system-ui,-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;">${renderDocumentBody(draft)}</body></html>`;
}

// Android SAF 与系统分享都把 EXTRA_TITLE 当作文件名。专辑名/歌曲名可能含路径分隔符、
// 控制字符或结尾点号，直接拼接会让文件提供器拒绝或截断，因此统一清洗后再补 .md。
const MD_FILE_NAME_MAX_CHARACTERS = 60;
const MD_FILE_NAME_FALLBACK = "公众号稿";
const MD_FILE_NAME_UNSAFE = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
function mdFileNameStem(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(MD_FILE_NAME_UNSAFE, " ").replace(/\s+/gu, " ").replace(/^[.\s]+|[.\s]+$/gu, "");
  return Array.from(cleaned).slice(0, MD_FILE_NAME_MAX_CHARACTERS).join("").replace(/[.\s]+$/gu, "");
}
/** 单篇按「专辑 → 歌曲 → 章节标题」命名；多篇合辑与年度榜单用推文标题。 */
export function publicationMarkdownFileName(draft: PublicationDraft): string {
  const section = draft.sections.length === 1 ? draft.sections[0] : null;
  const metaValue = (label: string) => section?.metaFields?.find(field => field.label === label)?.value ?? "";
  const candidates = section
    ? [metaValue("专辑"), metaValue("歌曲"), section.title, draft.title, MD_FILE_NAME_FALLBACK]
    : [draft.title, MD_FILE_NAME_FALLBACK];
  return `${candidates.map(mdFileNameStem).find(Boolean) ?? MD_FILE_NAME_FALLBACK}.md`;
}

export function buildPublication(draft: PublicationDraft): Publication {
  const safeDraft = parsePublicationDraft(draft);
  return {
    title: safeDraft.title,
    plainText: buildPlainText(safeDraft),
    htmlFragment: renderFragment(safeDraft),
    htmlDocument: buildHtmlDocument(safeDraft),
    markdown: buildMarkdown(safeDraft),
  };
}
