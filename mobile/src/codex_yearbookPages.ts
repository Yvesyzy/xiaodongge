import type { ReviewEntry } from "./types";
import type { JournalEdition, YearTopAlbum, YearTopAlbums } from "../../shared/backupAppData";
import { ENTRY_TYPE_LABELS } from "./types";
import { journalCover, journalDate, journalEntries, journalFuture, journalMonths, journalRating, journalTitle } from "./codex_yearbookModel";

export type JournalExportKind = "cover" | "overview" | "index" | "works" | "rank";
export type JournalShareTheme = "paper" | "dark";
export type JournalImageOptions = {
  hideContent?: boolean;
  hideRating?: boolean;
  hideDate?: boolean;
  hideBrand?: boolean;
  edition?: JournalEdition;
  theme?: JournalShareTheme;
  /** Annual top-albums ranking; required by the "rank" export kind. */
  topAlbums?: YearTopAlbums;
  /** Explicit single review mode; annual exports keep their normal filtering. */
  review?: boolean;
};
/** One ranked album as the poster needs it: a single line each for name/meta plus wrapped reason lines. */
export type JournalRankSlot = {
  rank: number;
  name: string;
  meta: string;
  notes: string[];
  /** Resolved review, used for the album art; absent when the record was deleted. */
  entry?: ReviewEntry;
};
export type JournalImagePage = {
  kind: JournalExportKind;
  title: string;
  lines: string[];
  entryIds: string[];
  entry?: ReviewEntry;
  continuation?: boolean;
  workLabel?: string;
  /** Structured ranking data; the "rank" poster never reads `lines`. */
  rankSlots?: JournalRankSlot[];
};
export const JOURNAL_WIDTH = 1080;
export const JOURNAL_HEIGHT = 1680;
const FONT = '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';
const BODY_SIZE = 32;
const LINE_HEIGHT = 46;
const TEXT_WIDTH = 936;

function canvasContext() {
  const canvas = document.createElement("canvas");
  canvas.width = JOURNAL_WIDTH;
  canvas.height = JOURNAL_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前设备无法生成图片");
  ctx.font = `${BODY_SIZE}px ${FONT}`;
  return ctx;
}

// Text is measured at export size; long reviews continue on new pages, never shrink or truncate.
export function wrapJournalText(ctx: CanvasRenderingContext2D, text: string, width = TEXT_WIDTH) {
  const lines: string[] = [];
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh-CN", { granularity: "grapheme" }) : null;
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    // Older WebViews still export; keep surrogate pairs, combining marks and joined emoji together.
    const segments = segmenter ? Array.from(segmenter.segment(paragraph), (part) => part.segment) : Array.from(paragraph).reduce<string[]>((parts, char) => {
      if (parts.length && (/^[\p{Mark}\p{Emoji_Modifier}\u200d\ufe0f]$/u.test(char) || parts[parts.length - 1].endsWith("\u200d"))) parts[parts.length - 1] += char;
      else parts.push(char);
      return parts;
    }, []);
    for (const segment of segments) {
      if (line && ctx.measureText(line + segment).width > width) { lines.push(line); line = ""; }
      line += segment;
    }
    lines.push(line);
  }
  return lines;
}

export async function planJournalPages(year: number, input: ReviewEntry[], kind: JournalExportKind, options: JournalImageOptions = {}): Promise<JournalImagePage[]> {
  if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;
  // Album art is cached per export; clearing here keeps an edited cover from going stale between exports.
  coverCache.clear();
  // The ranking is self-contained (an album may outlive its review), so it never consumes the annual entry pool.
  if (kind === "rank") return planRankPages(year, input, options);
  // The review flag is deliberately explicit so a month/year reflection cannot enter annual exports by accident.
  const entries = options.review ? input.slice() : journalEntries(input, year);
  if (!entries.length) throw new Error("这一年没有可导出的正式音乐记录");
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error("记录编号重复，请先检查数据");
  if (kind === "cover" || kind === "overview") return [{ kind, title: kind === "cover" ? "我的音乐年记" : "年度总览", lines: [], entryIds: entries.map((e) => e.id), entry: kind === "cover" ? entries.find((entry) => entry.id === input[0]?.id) : entries[0] }];
  const ctx = canvasContext();
  const pages: JournalImagePage[] = [];
  if (kind === "index") {
    let page: JournalImagePage = { kind, title: "全部记录索引", lines: [], entryIds: [] };
    entries.forEach((entry, index) => {
      const lines = wrapJournalText(ctx, `${index + 1}. ${journalTitle(entry)}\n${options.hideDate ? "" : journalDate(entry) + " · "}${entry.type === "song" ? "歌曲" : "专辑"} · ${entry.artistName || "未填写音乐人"}\n`);
      if (page.lines.length && lines.length <= 28 && page.lines.length + lines.length > 28) {
        pages.push(page); page = { kind, title: "全部记录索引", lines: [], entryIds: [] };
      }
      for (const line of lines) {
        if (page.lines.length === 28) { pages.push(page); page = { kind, title: "全部记录索引", lines: [], entryIds: [] }; }
        page.lines.push(line);
        if (!page.entryIds.includes(entry.id)) page.entryIds.push(entry.id);
      }
    });
    if (page.lines.length) pages.push(page);
  } else {
    entries.forEach((entry) => {
      const title = options.review && (entry.type === "month" || entry.type === "year") ? entry.title : journalTitle(entry);
      const metadata = `${title}${!options.hideContent && entry.title !== title ? `\n乐评标题：${entry.title}` : ""}\n${entry.artistName || "未填写音乐人"} · ${ENTRY_TYPE_LABELS[entry.type]}\n${[!options.hideDate && `记录于 ${journalDate(entry)}`, !options.hideRating && journalRating(entry)].filter(Boolean).join(" · ")}${!options.hideContent && entry.tags.length ? `\n标签：${entry.tags.join("、")}` : ""}\n\n`;
      const lines = wrapJournalText(ctx, metadata + (options.hideContent ? "正文已隐藏" : entry.content));
      let offset = 0;
      while (offset < lines.length) {
        const continuation = offset > 0;
        let capacity = continuation ? 26 : 22;
        const tail = lines.length - offset - capacity;
        if (tail > 0 && tail < 4) capacity -= 4 - tail;
        pages.push({ kind, title: continuation ? "作品与感受 · 续页" : "作品与感受", lines: lines.slice(offset, offset + capacity), entryIds: [entry.id], entry, continuation, workLabel: `${title} · ${ENTRY_TYPE_LABELS[entry.type]}` });
        offset += capacity;
      }
    });
  }
  ctx.canvas.width = 0;
  return pages;
}

/* ---- 年度榜单海报 ----------------------------------------------------------
 * The ranking gets its own poster identity instead of the paper/dark theme pair:
 * a deep green-black wash, a soft amber glow, a gold headed rule and medal-tinted
 * rank ticks. Every colour lives here so the whole look is retuned in one place.
 * ---------------------------------------------------------------------------- */
const RANK_BG_TOP = "#16291f";
const RANK_BG_BOTTOM = "#08120f";
const RANK_CREAM = "#f2eee3";
const RANK_SAGE = "#9cb2a5";
const RANK_NOTE = "#cfd8d0";
const RANK_GOLD = "#d8a94b";
const RANK_LINE = "#22463a";
const RANK_WATERMARK = "#1b352c";
/** Podium colours for ranks 1-3; everything below falls back to the quiet rule colour. */
const RANK_MEDALS = ["#e3b455", "#c8d0d2", "#c98b5a"];
const RANK_MARGIN = 72;
const RANK_RIGHT = 1008;
const RANK_BODY_TOP = 420;
const RANK_BODY_BOTTOM = 1560;
const RANK_SLOT = 228;
const RANK_COVER = 116;
const RANK_TEXT_X = 316;
const RANK_TEXT_WIDTH = RANK_RIGHT - RANK_TEXT_X;
const RANK_NOTE_LINES = 3;
// Capacity comes from the measured body area, so a slot can never overrun the footer rule.
const RANK_PAGE_ITEMS = Math.floor((RANK_BODY_BOTTOM - RANK_BODY_TOP) / RANK_SLOT);

function planRankPages(year: number, entries: ReviewEntry[], options: JournalImageOptions): JournalImagePage[] {
  const list = options.topAlbums?.albums ?? [];
  if (!list.length) throw new Error("还没有年度专辑榜单可导出；先创建榜单并保存");
  const ctx = canvasContext();
  const yearly = journalEntries(entries, year);
  const pages: JournalImagePage[] = [];
  let index = 0;
  while (index < list.length) {
    const slots = list.slice(index, index + RANK_PAGE_ITEMS).map((album, offset) => {
      const entry = rankEntryFor(album, yearly);
      // A reason longer than the slot is clipped here; the on-screen ranking keeps the full text.
      const cap = options.hideContent ? 0 : RANK_NOTE_LINES;
      ctx.font = `28px ${FONT}`;
      const wrapped = cap ? wrapJournalText(ctx, album.note.trim(), RANK_TEXT_WIDTH) : [];
      if (wrapped.length > cap) wrapped[cap - 1] = clipped(ctx, wrapped[cap - 1], RANK_TEXT_WIDTH);
      // Name and meta are single-line labels, so they are measured and clipped at their own sizes.
      ctx.font = `700 34px ${FONT}`;
      const name = clipped(ctx, album.albumName, RANK_TEXT_WIDTH);
      ctx.font = `26px ${FONT}`;
      const meta = clipped(ctx, [album.artistName || "未填写音乐人", options.hideRating ? "" : rankRatingLabel(entry)].filter(Boolean).join(" · "), RANK_TEXT_WIDTH);
      return { rank: index + offset + 1, name, meta, notes: wrapped.slice(0, cap), entry } satisfies JournalRankSlot;
    });
    pages.push({ kind: "rank", title: pages.length ? "年度专辑榜单 · 续" : "我的年度专辑榜单", lines: [], entryIds: [], rankSlots: slots });
    index += RANK_PAGE_ITEMS;
  }
  return pages;
}

// A ranking album may outlive its review, so the rating falls back to a dash instead of failing the export.
function rankEntryFor(album: YearTopAlbum, yearly: ReviewEntry[]) {
  const key = JSON.stringify([album.albumName, album.artistName ?? ""]);
  return yearly.find((entry) => entry.type === "album" && JSON.stringify([entry.albumName, entry.artistName ?? ""]) === key);
}

function rankRatingLabel(entry: ReviewEntry | undefined) {
  return entry ? journalRating(entry) : "原记录已删除";
}

function rankSubtitle(yearly: ReviewEntry[], options: JournalImageOptions) {
  const albums = options.topAlbums?.albums ?? [];
  const graded = albums.filter((album) => rankEntryFor(album, yearly)).length;
  return `名次由你排序 · 共 ${albums.length} 张专辑${graded ? ` · ${graded} 张有评分记录` : ""}`;
}

export async function renderJournalPage(year: number, entries: ReviewEntry[], page: JournalImagePage, index: number, total: number, now = new Date(), options: JournalImageOptions = {}) {
  const ctx = canvasContext();
  // The ranking paints its own poster; it never mixes with the shared paper/dark furniture.
  if (page.kind === "rank") return drawRankPage(ctx, year, entries, page, index, total, now, options);
  const dark = options.theme === "dark";
  const color = dark ? "#9bd4bf" : "#245448";
  const background = dark ? "#142a24" : "#fafaf7";
  const ink = dark ? "#f2f5ef" : "#202724";
  const muted = dark ? "#adc0b6" : "#68726d";
  const rule = dark ? "#36564a" : "#d6ddd7";
  const coverPalette = dark ? COVER_DARK : COVER_PAPER;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, JOURNAL_WIDTH, JOURNAL_HEIGHT);
  const text = (value: string, x: number, y: number, size = BODY_SIZE, fill = "#202724", weight = 400) => {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = fill; ctx.fillText(value, x, y);
  };
  text([!options.hideBrand && "小懂哥", !(options.review && options.hideDate) && String(year)].filter(Boolean).join(" · "), 72, 90, 28, color, 600);
  text(page.title, 72, 180, 54, ink, 700);
  text(page.kind === "works" && page.entry ? `记录 ${entries.findIndex((entry) => entry.id === page.entry!.id) + 1} / ${entries.length}${options.hideDate ? "" : ` · ${journalDate(page.entry)}`}` : `按首次正式保存时间 · ${entries.length} 篇正式音乐记录`, 72, 235, 26, muted);
  if (page.kind === "works" && page.continuation && page.workLabel) {
    ctx.font = `600 28px ${FONT}`;
    const labelLines = wrapJournalText(ctx, `继续：${page.workLabel}`);
    if (labelLines.length > 2) labelLines[1] = labelLines[1].slice(0, -1) + "…";
    labelLines.slice(0, 2).forEach((line, lineIndex) => text(line, 72, 280 + lineIndex * 34, 28, color, 600));
  }
  if (page.kind === "cover") {
    if (page.entry) {
      const loaded = await drawJournalCover(ctx, page.entry, 270, 300, 540, false, coverPalette);
      if (!loaded) {
        text(String(year), 72, 490, 120, color, 600);
        text("我的音乐年记", 72, 580, 44, color, 600);
        ctx.font = `36px ${FONT}`;
        wrapJournalText(ctx, journalTitle(page.entry)).slice(0, 3).forEach((line, i) => text(line, 72, 675 + i * LINE_HEIGHT, 36, ink));
      }
    }
    text(String(year), 72, 955, 72, color, 600);
    text(`${entries.length} 篇记录 · ${journalMonths(entries).filter(Boolean).length} 个记录月份`, 72, 1040, 36);
    const selected = entries.filter((e) => options.edition?.entryIds.includes(e.id));
    text(selected.length ? `年度代表作品 · ${selected.length} 篇` : "作品与记录日历 / 年度摘录", 72, 1120, 30, "#68726d");
    ctx.font = `32px ${FONT}`;
    const chosenQuote = page.entry && options.edition?.quotes[page.entry.id];
    const title = options.hideContent ? (page.entry ? journalTitle(page.entry) : "") : options.edition?.message || (chosenQuote && page.entry?.content.includes(chosenQuote) ? chosenQuote : page.entry?.content || "");
    const shown = wrapJournalText(ctx, title);
    if (shown.length > 5) shown[4] = shown[4].slice(0, -1) + "…";
    shown.slice(0, 5).forEach((line, i) => text(line, 72, 1190 + i * LINE_HEIGHT));
    ctx.font = `26px ${FONT}`;
    const credits = selected.length ? selected.map(journalTitle).join(" / ") : page.entry ? `封面作品 · ${journalTitle(page.entry)}` : "";
    wrapJournalText(ctx, credits).slice(0, 2).forEach((line, i) => text(line, 72, 1460 + i * 36, 26, muted));
  } else if (page.kind === "overview") {
    const counts = journalMonths(entries);
    text(`${entries.length} 篇记录`, 72, 355, 56, color, 600);
    text(`${counts.filter(Boolean).length} 个记录月份`, 580, 355, 40);
    text("月份分布", 72, 465, 38, "#202724", 600);
    const maximum = Math.max(1, ...counts);
    const baseline = 905;
    ctx.strokeStyle = "#d6ddd7"; ctx.beginPath(); ctx.moveTo(72, baseline); ctx.lineTo(1008, baseline); ctx.stroke();
    counts.forEach((count, i) => {
      const x = 72 + i * 78;
      const height = count / maximum * 320;
      ctx.fillStyle = color; if (count) ctx.fillRect(x + 18, baseline - height, 42, height);
      ctx.textAlign = "center";
      text(!count && journalFuture(year, i + 1, now) ? "—" : String(count), x + 39, baseline - height - 20, 27);
      text(`${i + 1}月`, x + 39, baseline + 48, 26, muted);
      ctx.textAlign = "left";
    });
    text("0：暂无记录    —：月份未到", 72, 1055, 28, muted);
    text(`专辑乐评 ${entries.filter((e) => e.type === "album").length} 篇`, 72, 1190, 36);
    text(`歌曲乐评 ${entries.filter((e) => e.type === "song").length} 篇`, 580, 1190, 36);
    text("本图为年度数量概览。", 72, 1350, 30);
    text("全部作品与正文可分别保存为分页图片。", 72, 1410, 30, "#68726d");
  } else {
    const firstWork = page.kind === "works" && !page.continuation && page.entry;
    if (firstWork) await drawJournalCover(ctx, page.entry!, 72, 270, 205, true, coverPalette);
    const start = firstWork ? 530 : 350;
    page.lines.forEach((line, i) => text(line, 72, start + i * LINE_HEIGHT, BODY_SIZE, ink));
  }
  ctx.strokeStyle = rule; ctx.beginPath(); ctx.moveTo(72, 1590); ctx.lineTo(1008, 1590); ctx.stroke();
  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  if (!options.hideDate) text(`整理于 ${date}`, 72, 1638, 24, muted);
  ctx.textAlign = "right"; text(`第 ${index + 1} / ${total} 页`, 1008, 1638, 24, muted);
  try {
    return await new Promise<Blob>((resolve, reject) => ctx.canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片生成失败")), "image/png"));
  } finally { ctx.canvas.width = 0; }
}

// The ranking poster: its own background, header hierarchy, cover art and footer.
async function drawRankPage(ctx: CanvasRenderingContext2D, year: number, entries: ReviewEntry[], page: JournalImagePage, index: number, total: number, now: Date, options: JournalImageOptions) {
  try {
    // Deep green-black wash plus an amber glow that the oversized year sits inside.
    const wash = ctx.createLinearGradient(0, 0, 0, JOURNAL_HEIGHT);
    wash.addColorStop(0, RANK_BG_TOP); wash.addColorStop(1, RANK_BG_BOTTOM);
    ctx.fillStyle = wash; ctx.fillRect(0, 0, JOURNAL_WIDTH, JOURNAL_HEIGHT);
    const glow = ctx.createRadialGradient(980, 90, 0, 980, 90, 680);
    glow.addColorStop(0, "rgba(216,169,75,.15)"); glow.addColorStop(1, "rgba(216,169,75,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, JOURNAL_WIDTH, 460);

    const text = (value: string, x: number, y: number, size = 28, fill = RANK_CREAM, weight = 400) => {
      ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = fill; ctx.fillText(value, x, y);
    };
    // The year is set as a watermark, not a data label; keeping it right of x=720 leaves the title clear.
    ctx.textAlign = "right";
    text(String(year), RANK_RIGHT, 250, 130, RANK_WATERMARK, 700);
    ctx.textAlign = "left";
    if (!options.hideBrand) text("小懂哥", RANK_MARGIN, 100, 26, RANK_GOLD, 600);
    text("ANNUAL TOP ALBUMS".split("").join(" "), RANK_MARGIN, 168, 24, RANK_SAGE, 600);
    text(page.title, RANK_MARGIN, 262, 54, RANK_CREAM, 700);
    text(rankSubtitle(journalEntries(entries, year), options), RANK_MARGIN, 314, 26, RANK_SAGE);
    // The rule is a hairline carrying a solid gold head; that head is the poster's strongest accent.
    ctx.lineWidth = 3; ctx.strokeStyle = RANK_GOLD;
    ctx.beginPath(); ctx.moveTo(RANK_MARGIN, 372); ctx.lineTo(RANK_MARGIN + 132, 372); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "rgba(216,169,75,.28)";
    ctx.beginPath(); ctx.moveTo(RANK_MARGIN, 372); ctx.lineTo(RANK_RIGHT, 372); ctx.stroke();

    const slots = page.rankSlots ?? [];
    for (const [i, slot] of slots.entries()) {
      const top = RANK_BODY_TOP + i * RANK_SLOT;
      const medal = RANK_MEDALS[slot.rank - 1] ?? null;
      // A coloured tick opens every slot: medal tones for the podium, the quiet rule tone below it.
      ctx.fillStyle = medal ?? RANK_LINE;
      clipRounded(ctx, RANK_MARGIN, top + 62, 6, 46, 3); ctx.fill();
      text(String(slot.rank).padStart(2, "0"), RANK_MARGIN + 20, top + 96, medal ? 46 : 40, medal ?? RANK_SAGE, 700);
      await drawRankCover(ctx, slot, top + 44);
      text(slot.name, RANK_TEXT_X, top + 52, 34, RANK_CREAM, 700);
      text(slot.meta, RANK_TEXT_X, top + 92, 26, RANK_SAGE);
      slot.notes.forEach((line, n) => text(line, RANK_TEXT_X, top + 134 + n * 38, 28, RANK_NOTE));
      if (i < slots.length - 1) {
        ctx.strokeStyle = RANK_LINE; ctx.beginPath();
        ctx.moveTo(RANK_MARGIN, top + RANK_SLOT); ctx.lineTo(RANK_RIGHT, top + RANK_SLOT); ctx.stroke();
      }
    }

    ctx.strokeStyle = RANK_LINE; ctx.beginPath(); ctx.moveTo(RANK_MARGIN, 1590); ctx.lineTo(RANK_RIGHT, 1590); ctx.stroke();
    const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    if (!options.hideDate) text(`整理于 ${date}`, RANK_MARGIN, 1638, 24, RANK_SAGE);
    ctx.textAlign = "right"; text(`第 ${index + 1} / ${total} 页`, RANK_RIGHT, 1638, 24, RANK_SAGE); ctx.textAlign = "left";

    return await new Promise<Blob>((resolve, reject) => ctx.canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片生成失败")), "image/png"));
  } finally { ctx.canvas.width = 0; }
}

// Album art is the poster's anchor image and the same covers are reused across pages and thumbnails,
// so each one is fetched once per export. planJournalPages clears the cache before every run.
const coverCache = new Map<string, HTMLImageElement | null>();

async function drawRankCover(ctx: CanvasRenderingContext2D, slot: JournalRankSlot, y: number) {
  if (slot.entry) await drawJournalCover(ctx, slot.entry, 168, y, RANK_COVER, true, COVER_RANK, 10);
  else {
    // A review that has been deleted still gets a tile, lettered with the album's first character.
    ctx.save();
    clipRounded(ctx, 168, y, RANK_COVER, RANK_COVER, 10); ctx.clip();
    ctx.fillStyle = COVER_RANK.background; ctx.fillRect(168, y, RANK_COVER, RANK_COVER);
    ctx.fillStyle = COVER_RANK.ink; ctx.font = `600 ${Math.round(RANK_COVER / 4)}px ${FONT}`;
    ctx.textAlign = "center"; ctx.fillText(Array.from(slot.name)[0] || "音", 168 + RANK_COVER / 2, y + RANK_COVER * .6); ctx.textAlign = "left";
    ctx.restore();
  }
  // A hairline ring keeps dark album art from bleeding into the poster background.
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(216,169,75,.22)";
  clipRounded(ctx, 168.5, y + .5, RANK_COVER - 1, RANK_COVER - 1, 10); ctx.stroke();
}

// Rounded clip built from arcTo so WebViews without roundRect still render the poster covers.
function clipRounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

// Single-line labels clip with an ellipsis instead of wrapping; ctx.font must already be set.
function clipped(ctx: CanvasRenderingContext2D, value: string, width: number) {
  if (ctx.measureText(value).width <= width) return value;
  let out = value;
  while (out && ctx.measureText(out + "…").width > width) out = out.slice(0, -1);
  return out + "…";
}

function loadCoverImage(source: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => { image.src = ""; resolve(null); }, 4000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); resolve(null); };
    image.src = source;
  });
}

async function journalCoverImage(entry: ReviewEntry) {
  const cached = coverCache.get(entry.id);
  if (cached !== undefined) return cached;
  const source = await journalCover(entry);
  const image = source?.startsWith("data:image/") ? await loadCoverImage(source) : null;
  coverCache.set(entry.id, image);
  return image;
}

type CoverPalette = { background: string; ink: string };
const COVER_PAPER: CoverPalette = { background: "#e6ece7", ink: "#245448" };
const COVER_DARK: CoverPalette = { background: "#24463b", ink: "#9bd4bf" };
const COVER_RANK: CoverPalette = { background: "#1d3a30", ink: "#d8a94b" };

async function drawJournalCover(ctx: CanvasRenderingContext2D, entry: ReviewEntry, x: number, y: number, size: number, placeholder = true, palette: CoverPalette = COVER_PAPER, radius = 0) {
  if (placeholder) {
    ctx.save();
    if (radius) { clipRounded(ctx, x, y, size, size, radius); ctx.clip(); }
    ctx.fillStyle = palette.background; ctx.fillRect(x, y, size, size);
    ctx.fillStyle = palette.ink; ctx.font = `600 ${Math.round(size / 4)}px ${FONT}`;
    ctx.textAlign = "center"; ctx.fillText(Array.from(journalTitle(entry))[0] || "音", x + size / 2, y + size * .6); ctx.textAlign = "left";
    ctx.restore();
  }
  const image = await journalCoverImage(entry);
  if (!image) return false;
  ctx.save();
  if (radius) { clipRounded(ctx, x, y, size, size, radius); ctx.clip(); }
  const crop = Math.min(image.naturalWidth, image.naturalHeight);
  ctx.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, x, y, size, size);
  ctx.restore();
  return true;
}
