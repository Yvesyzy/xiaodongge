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
export type JournalImagePage = {
  kind: JournalExportKind;
  title: string;
  lines: string[];
  entryIds: string[];
  entry?: ReviewEntry;
  continuation?: boolean;
  workLabel?: string;
  /** 1-based ranking shown on each line of the "rank" export. */
  ranks?: number[];
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
  // The ranking is self-contained (an album may outlive its review), so it never consumes the annual entry pool.
  if (kind === "rank") return planRankPages(year, input, options.topAlbums);
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

// Each ranked album occupies a fixed 6-line slot (1 title + 1 meta + up to 3 note lines + 1 gap).
// The slot uses a tighter 42px leading than the body's 46px; capacity is derived from the measured
// body area so a slot can never overrun the footer rule. No album is ever split across pages.
const RANK_ITEM_LINES = 5;
const RANK_LINE_HEIGHT = 42;
const RANK_NOTE_LINES = 2;
const RANK_BODY_TOP = 320;
const RANK_BODY_BOTTOM = 1560;
// Capacity is derived from the measured body area, so a slot can never overrun the footer rule.
const RANK_PAGE_ITEMS = Math.floor((RANK_BODY_BOTTOM - RANK_BODY_TOP) / (RANK_ITEM_LINES * RANK_LINE_HEIGHT));

function planRankPages(year: number, entries: ReviewEntry[], albums: YearTopAlbums | undefined): JournalImagePage[] {
  const list = albums?.albums ?? [];
  if (!list.length) throw new Error("还没有年度专辑榜单可导出；先创建榜单并保存");
  const ctx = canvasContext();
  const pages: JournalImagePage[] = [];
  let index = 0;
  while (index < list.length) {
    const slice = list.slice(index, index + RANK_PAGE_ITEMS);
    const lines: string[] = [];
    const ranks: number[] = [];
    for (const [offset, album] of slice.entries()) {
      const rank = index + offset + 1;
      const entry = rankEntryFor(album, entries, year);
      ranks.push(rank);
      lines.push(`${String(rank).padStart(2, "0")}　${album.albumName}`);
      lines.push(`${album.artistName || "未填写音乐人"} · ${rankRatingLabel(entry)}`);
      // A note longer than two lines is clipped here; the on-screen ranking keeps the full text.
      const noteLines = wrapJournalText(ctx, album.note.trim(), TEXT_WIDTH - 62);
      noteLines.slice(0, RANK_NOTE_LINES).forEach((line) => lines.push(line));
      if (noteLines.length > RANK_NOTE_LINES) lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + "…";
      for (let pad = Math.min(noteLines.length, RANK_NOTE_LINES); pad < RANK_NOTE_LINES; pad++) lines.push("");
      lines.push("");
    }
    pages.push({ kind: "rank", title: pages.length ? "我的年度专辑榜单 · 续" : "我的年度专辑榜单", lines, entryIds: [], ranks });
    index += RANK_PAGE_ITEMS;
  }
  return pages;
}

// A ranking album may outlive its review, so the rating falls back to a dash instead of failing the export.
function rankEntryFor(album: YearTopAlbum, entries: ReviewEntry[], year: number) {
  const key = JSON.stringify([album.albumName, album.artistName ?? ""]);
  return journalEntries(entries, year).find((entry) => entry.type === "album" && JSON.stringify([entry.albumName, entry.artistName ?? ""]) === key);
}

function rankRatingLabel(entry: ReviewEntry | undefined) {
  return entry ? journalRating(entry) : "原记录已删除";
}

function rankSubtitle(year: number, entries: ReviewEntry[], options: JournalImageOptions) {
  const albums = options.topAlbums?.albums ?? [];
  const graded = albums.filter((album) => rankEntryFor(album, entries, year)).length;
  return `名次由你排序 · 共 ${albums.length} 张专辑${graded ? ` · ${graded} 张有评分记录` : ""}`;
}

export async function renderJournalPage(year: number, entries: ReviewEntry[], page: JournalImagePage, index: number, total: number, now = new Date(), options: JournalImageOptions = {}) {
  const ctx = canvasContext();
  const dark = options.theme === "dark";
  const color = dark ? "#9bd4bf" : "#245448";
  const background = dark ? "#142a24" : "#fafaf7";
  const ink = dark ? "#f2f5ef" : "#202724";
  const muted = dark ? "#adc0b6" : "#68726d";
  const rule = dark ? "#36564a" : "#d6ddd7";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, JOURNAL_WIDTH, JOURNAL_HEIGHT);
  const text = (value: string, x: number, y: number, size = BODY_SIZE, fill = "#202724", weight = 400) => {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = fill; ctx.fillText(value, x, y);
  };
  text([!options.hideBrand && "小懂哥", !(options.review && options.hideDate) && String(year)].filter(Boolean).join(" · "), 72, 90, 28, color, 600);
  text(page.title, 72, 180, 54, ink, 700);
  text(page.kind === "rank" ? rankSubtitle(year, entries, options) : page.kind === "works" && page.entry ? `记录 ${entries.findIndex((entry) => entry.id === page.entry!.id) + 1} / ${entries.length}${options.hideDate ? "" : ` · ${journalDate(page.entry)}`}` : `按首次正式保存时间 · ${entries.length} 篇正式音乐记录`, 72, 235, 26, muted);
  if (page.kind === "works" && page.continuation && page.workLabel) {
    ctx.font = `600 28px ${FONT}`;
    const labelLines = wrapJournalText(ctx, `继续：${page.workLabel}`);
    if (labelLines.length > 2) labelLines[1] = labelLines[1].slice(0, -1) + "…";
    labelLines.slice(0, 2).forEach((line, lineIndex) => text(line, 72, 280 + lineIndex * 34, 28, color, 600));
  }
  if (page.kind === "rank") {
    page.lines.forEach((line, i) => {
      const slot = Math.floor(i / RANK_ITEM_LINES);
      const within = i % RANK_ITEM_LINES;
      const rank = page.ranks?.[slot];
      const y = RANK_BODY_TOP + i * RANK_LINE_HEIGHT;
      // The rank number doubles as the visual anchor, so the album title is the only bold line in a slot.
      if (within === 0 && rank) {
        text(String(rank).padStart(2, "0"), 72, y, 30, color, 700);
        text(line.slice(3), 134, y, 34, ink, 700);
      } else if (within === 1) {
        text(line, 134, y, 26, muted);
      } else if (line) {
        text(line, 134, y, 28, ink);
      }
      // The slot's trailing gap carries the hairline, so the rule never touches a note line.
      if (within === RANK_ITEM_LINES - 1 && i < page.lines.length - 1) {
        const ruleY = y - RANK_LINE_HEIGHT / 2;
        ctx.strokeStyle = rule; ctx.beginPath(); ctx.moveTo(72, ruleY); ctx.lineTo(1008, ruleY); ctx.stroke();
      }
    });
  } else if (page.kind === "cover") {
    if (page.entry) {
      const loaded = await drawJournalCover(ctx, page.entry, 270, 300, 540, false, options.theme);
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
    if (firstWork) await drawJournalCover(ctx, page.entry!, 72, 270, 205, true, options.theme);
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

async function drawJournalCover(ctx: CanvasRenderingContext2D, entry: ReviewEntry, x: number, y: number, size: number, placeholder = true, theme: JournalShareTheme = "paper") {
  if (placeholder) {
    ctx.fillStyle = theme === "dark" ? "#24463b" : "#e6ece7"; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = theme === "dark" ? "#9bd4bf" : "#245448"; ctx.font = `600 ${Math.round(size / 4)}px ${FONT}`;
  ctx.textAlign = "center"; ctx.fillText(Array.from(journalTitle(entry))[0] || "音", x + size / 2, y + size * .6); ctx.textAlign = "left";
  }
  const source = await journalCover(entry);
  if (!source?.startsWith("data:image/")) return false;
  const image = new Image();
  const loaded = await new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => { image.src = ""; resolve(false); }, 4000);
    image.onload = () => { clearTimeout(timer); resolve(true); };
    image.onerror = () => { clearTimeout(timer); resolve(false); };
    image.src = source;
  });
  if (!loaded) return false;
  const crop = Math.min(image.naturalWidth, image.naturalHeight);
  ctx.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, x, y, size, size);
  return true;
}
