import { localDateOf } from "./format";
import type { YearlyListeningSnapshot } from "./listeningYearbook";
import type { ReviewEntry } from "./types";

export const YEARBOOK_POSTER_WIDTH = 1080;
export const YEARBOOK_POSTER_HEIGHT = 1680;
export const YEARBOOK_POSTER_MIME = "image/png";

export type YearbookPosterMetric = {
  name: string;
  count: number;
};

export type YearbookPosterQuote = {
  sentence: string;
  source: string;
};

export type YearbookPosterStats = {
  includedEntryCount: number;
  activeMonthCount: number;
  monthlyCounts: number[];
  feelings: YearbookPosterMetric[];
  subjects: YearbookPosterMetric[];
  quote: YearbookPosterQuote | null;
};

export function buildYearbookPosterStats(snapshot: YearlyListeningSnapshot, entries: ReviewEntry[]): YearbookPosterStats {
  const includedEntries = entries.filter((entry) => isReportEntry(entry) && localDateOf(entry.createdAt)?.startsWith(`${snapshot.year}-`));
  const ids = new Set(includedEntries.map((entry) => entry.id));
  if (snapshot.dateBasis !== "createdAt" || ids.size !== includedEntries.length || ids.size !== snapshot.analysis.sourceEntryCount || snapshot.analysis.sourceEntryIds.length !== ids.size || snapshot.analysis.sourceEntryIds.some((id) => !ids.has(id))) {
    throw new Error("记录与年度标本册不一致，请重新生成后再导出");
  }
  const monthlyCounts = Array.from({ length: 12 }, () => 0);
  for (const entry of includedEntries) {
    const date = localDateOf(entry.createdAt);
    const month = date ? Number(date.slice(5, 7)) : 0;
    if (month >= 1 && month <= 12) monthlyCounts[month - 1] += 1;
  }
  const quote = snapshot.analysis.representativeQuotes[0];
  const quoteEntry = quote ? entries.find((entry) => entry.id === quote.entryId) : undefined;
  return {
    includedEntryCount: includedEntries.length,
    activeMonthCount: monthlyCounts.filter((count) => count > 0).length,
    monthlyCounts,
    feelings: snapshot.analysis.feelings.slice(0, 3).map(toMetric),
    subjects: snapshot.analysis.subjects.slice(0, 3).map(toMetric),
    quote: quote && quote.sentence.trim()
      ? { sentence: cleanText(quote.sentence), source: quoteEntry?.songName ?? quoteEntry?.title ?? "年度代表原句" }
      : null,
  };
}

export async function renderYearbookPoster(snapshot: YearlyListeningSnapshot, entries: ReviewEntry[]) {
  const canvas = document.createElement("canvas");
  canvas.width = YEARBOOK_POSTER_WIDTH;
  canvas.height = YEARBOOK_POSTER_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前设备无法生成年度海报");
  const stats = buildYearbookPosterStats(snapshot, entries);
  drawPoster(context, snapshot, stats);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("年度海报生成失败")), YEARBOOK_POSTER_MIME);
  });
}

function drawPoster(context: CanvasRenderingContext2D, snapshot: YearlyListeningSnapshot, stats: YearbookPosterStats) {
  const margin = 72;
  const width = YEARBOOK_POSTER_WIDTH;
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  drawBackground(context, width, YEARBOOK_POSTER_HEIGHT);

  context.fillStyle = "#c9973f";
  context.font = "700 24px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText("PRIVATE LISTENING YEARBOOK", margin, 82);

  context.fillStyle = "#fffdf8";
  context.font = "900 102px system-ui, sans-serif";
  context.fillText(String(snapshot.year), margin, 194);
  context.fillStyle = "rgba(255,253,248,.78)";
  context.font = "500 30px system-ui, sans-serif";
  context.fillText("私人音乐档案 · 年度听感标本册", margin, 244);
  context.fillStyle = "#fffdf8";
  context.font = "700 48px system-ui, sans-serif";
  drawLines(context, snapshot.title, margin, 310, width - margin * 2, 58, 1);

  drawStatsPanel(context, margin, 366, width - margin * 2, 162, snapshot, stats);
  drawMonthlyPanel(context, margin, 558, width - margin * 2, 336, stats);
  drawMetricPanel(context, margin, 924, 456, 386, "年度主要感受", stats.feelings, "#c9973f");
  drawMetricPanel(context, 552, 924, 456, 386, "年度关注对象", stats.subjects, "#2b8173");
  drawQuotePanel(context, margin, 1340, width - margin * 2, 238, stats.quote);

  context.fillStyle = "rgba(255,253,248,.62)";
  context.font = "500 22px system-ui, sans-serif";
  context.fillText("月份按写下记录的时间统计 · 内容来自本地保存的年度记录", margin, 1630);
}

function drawBackground(context: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#071f1b");
  gradient.addColorStop(0.55, "#17483e");
  gradient.addColorStop(1, "#0b3029");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(255,253,248,.07)";
  context.lineWidth = 2;
  for (let radius = 130; radius < 900; radius += 30) {
    context.beginPath();
    context.arc(width - 44, 154, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = "rgba(201,151,63,.08)";
  context.beginPath();
  context.arc(118, height - 114, 260, 0, Math.PI * 2);
  context.fill();
}

function drawStatsPanel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, snapshot: YearlyListeningSnapshot, stats: YearbookPosterStats) {
  drawPanel(context, x, y, width, height, "rgba(255,253,248,.98)");
  const columns = [
    ["写下记录", String(stats.includedEntryCount), "条"],
    ["有效月份", String(stats.activeMonthCount), "个月"],
    ["分析字数", String(snapshot.analysis.characterCount), "字"],
  ] as const;
  const columnWidth = width / columns.length;
  columns.forEach(([label, value, suffix], index) => {
    if (index) {
      context.strokeStyle = "rgba(7,31,27,.13)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x + columnWidth * index, y + 28);
      context.lineTo(x + columnWidth * index, y + height - 28);
      context.stroke();
    }
    const center = x + columnWidth * (index + 0.5);
    context.textAlign = "center";
    context.fillStyle = "#557067";
    context.font = "600 23px system-ui, sans-serif";
    context.fillText(label, center, y + 48);
    context.fillStyle = "#07352e";
    context.font = "900 64px system-ui, sans-serif";
    context.fillText(`${value} ${suffix}`, center, y + 122, columnWidth - 36);
    context.textAlign = "left";
  });
}

function drawMonthlyPanel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, stats: YearbookPosterStats) {
  drawPanel(context, x, y, width, height, "rgba(255,253,248,.98)");
  context.fillStyle = "#07352e";
  context.font = "800 32px system-ui, sans-serif";
  context.fillText("十二个月的听感轨迹", x + 30, y + 54);
  context.fillStyle = "#7a8a82";
  context.font = "500 21px system-ui, sans-serif";
  context.fillText("每根柱代表该月写下的正式记录", x + 30, y + 89);

  const chartX = x + 42;
  const chartY = y + 120;
  const chartWidth = width - 84;
  const chartHeight = 156;
  const gap = 18;
  const barWidth = (chartWidth - gap * 11) / 12;
  const max = Math.max(1, ...stats.monthlyCounts);
  context.strokeStyle = "rgba(7,31,27,.13)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(chartX, chartY + chartHeight);
  context.lineTo(chartX + chartWidth, chartY + chartHeight);
  context.stroke();
  stats.monthlyCounts.forEach((count, index) => {
    const barHeight = count ? Math.max(10, count / max * 118) : 5;
    const barX = chartX + index * (barWidth + gap);
    const barY = chartY + chartHeight - barHeight;
    context.fillStyle = count ? (index % 2 ? "#2b8173" : "#c9973f") : "rgba(7,31,27,.15)";
    roundedRect(context, barX, barY, barWidth, barHeight, 10);
    context.fill();
    if (count) {
      context.fillStyle = "#07352e";
      context.font = "700 20px system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText(String(count), barX + barWidth / 2, barY - 10);
    }
    context.fillStyle = "#557067";
    context.font = "600 19px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(`${index + 1}月`, barX + barWidth / 2, chartY + chartHeight + 36);
    context.textAlign = "left";
  });
}

function drawMetricPanel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, title: string, metrics: YearbookPosterMetric[], accent: string) {
  drawPanel(context, x, y, width, height, "rgba(255,253,248,.98)");
  context.fillStyle = accent;
  context.fillRect(x + 28, y + 30, 8, 42);
  context.fillStyle = "#07352e";
  context.font = "800 30px system-ui, sans-serif";
  context.fillText(title, x + 56, y + 62);
  if (!metrics.length) {
    context.fillStyle = "#7a8a82";
    context.font = "500 23px system-ui, sans-serif";
    drawLines(context, "这一年还没有足够的词语显影", x + 30, y + 160, width - 60, 36, 2);
    return;
  }
  const max = Math.max(1, ...metrics.map((metric) => metric.count));
  metrics.forEach((metric, index) => {
    const rowY = y + 126 + index * 78;
    context.fillStyle = "#07352e";
    context.font = "700 24px system-ui, sans-serif";
    context.fillText(metric.name, x + 30, rowY);
    context.fillStyle = "#557067";
    context.font = "600 20px system-ui, sans-serif";
    context.textAlign = "right";
    context.fillText(`${metric.count} 次`, x + width - 30, rowY);
    context.textAlign = "left";
    context.fillStyle = "rgba(7,31,27,.1)";
    roundedRect(context, x + 30, rowY + 22, width - 60, 12, 6);
    context.fill();
    context.fillStyle = accent;
    roundedRect(context, x + 30, rowY + 22, Math.max(18, (width - 60) * metric.count / max), 12, 6);
    context.fill();
  });
}

function drawQuotePanel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, quote: YearbookPosterQuote | null) {
  drawPanel(context, x, y, width, height, "rgba(7,31,27,.78)");
  context.fillStyle = "#c9973f";
  context.font = "700 21px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText("ORIGINAL VOICE", x + 30, y + 42);
  if (!quote) {
    context.fillStyle = "rgba(255,253,248,.7)";
    context.font = "500 26px system-ui, sans-serif";
    context.fillText("这一年还没有可展示的代表原句", x + 30, y + 112);
    return;
  }
  context.fillStyle = "#fffdf8";
  context.font = "500 29px system-ui, sans-serif";
  drawLines(context, `“${quote.sentence}”`, x + 30, y + 94, width - 60, 38, 3);
  context.fillStyle = "rgba(255,253,248,.66)";
  context.font = "500 21px system-ui, sans-serif";
  drawLines(context, `— ${quote.source}`, x + 30, y + height - 28, width - 60, 28, 1);
}

function drawPanel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  context.save();
  context.shadowColor = "rgba(0,0,0,.16)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
  roundedRect(context, x, y, width, height, 28);
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function drawLines(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = Array.from(cleanText(text));
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line + word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  const consumed = lines.join("").length;
  if (consumed < words.length && lines.length) {
    while (context.measureText(lines[lines.length - 1] + "…").width > maxWidth) lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1);
    lines[lines.length - 1] += "…";
  }
  lines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
  return lines.length;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function isReportEntry(entry: ReviewEntry) {
  return entry.type === "song" || entry.type === "album";
}

function toMetric(metric: { name: string; count: number }): YearbookPosterMetric {
  return { name: metric.name, count: metric.count };
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
