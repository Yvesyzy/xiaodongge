import { localDateOf } from "./format";
import type { RelistenComparison } from "./relistenComparison";
import type { ListeningMoment, ReviewEntry } from "./types";

export type MemoryCardPrivacy = {
  hideContent: boolean;
  hideRating: boolean;
  hideDate: boolean;
  hideBrand: boolean;
};

export type MemoryCardModel = {
  eyebrow: string;
  title: string;
  subtitle: string;
  dateLine: string | null;
  ratingLine: string | null;
  moodLine: string | null;
  firstQuote: string | null;
  latestQuote: string | null;
  brand: string | null;
};

export function buildQuickMemoryCard(entry: ReviewEntry, privacy: MemoryCardPrivacy): MemoryCardModel {
  return {
    eyebrow: "刚刚记下",
    title: entry.songName ?? entry.title,
    subtitle: [entry.artistName, entry.albumName].filter(Boolean).join(" · "),
    dateLine: privacy.hideDate ? null : displayDate(entry.listenedAt),
    ratingLine: privacy.hideRating || entry.rating === null ? null : String(entry.rating) + (entry.ratingModifier ?? "") + " / 10",
    moodLine: entry.moods.length ? entry.moods.join(" · ") : null,
    firstQuote: privacy.hideContent ? null : entry.content,
    latestQuote: null,
    brand: privacy.hideBrand ? null : "小懂哥 · 私人音乐档案",
  };
}

export function buildRelistenMemoryCard(
  entry: ReviewEntry,
  moment: ListeningMoment,
  comparison: RelistenComparison,
  privacy: MemoryCardPrivacy,
): MemoryCardModel {
  const dates = privacy.hideDate ? null : [displayDate(entry.listenedAt), displayDate(moment.listenedAt)].filter(Boolean).join(" → ");
  const ratings = privacy.hideRating
    ? null
    : [ratingText(entry.rating, entry.ratingModifier), ratingText(moment.rating, moment.ratingModifier)].filter(Boolean).join(" → ");
  const moodParts = [
    comparison.moods.kept.length ? "保留 " + comparison.moods.kept.join("、") : "",
    comparison.moods.added.length ? "新增 " + comparison.moods.added.join("、") : "",
    comparison.moods.faded.length ? "淡出 " + comparison.moods.faded.join("、") : "",
  ].filter(Boolean);
  return {
    eyebrow: comparison.dayGap === null ? "再次听见" : "相隔 " + comparison.dayGap + " 天再次听见",
    title: entry.songName ?? entry.title,
    subtitle: [entry.artistName, entry.albumName].filter(Boolean).join(" · "),
    dateLine: dates,
    ratingLine: ratings,
    moodLine: moodParts.length ? moodParts.join(" ｜ ") : null,
    firstQuote: privacy.hideContent ? null : comparison.firstContent,
    latestQuote: privacy.hideContent ? null : comparison.latestContent,
    brand: privacy.hideBrand ? null : "小懂哥 · 私人音乐档案",
  };
}

export async function renderMemoryCard(model: MemoryCardModel, coverUrl: string | null) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前设备无法生成图片");
  drawBackground(context);
  await drawCover(context, coverUrl);

  context.fillStyle = "#c9973f";
  context.font = "600 28px system-ui, sans-serif";
  context.fillText(model.eyebrow, 92, 670);

  context.fillStyle = "#fffdf8";
  context.font = "700 70px system-ui, sans-serif";
  drawLines(context, model.title, 92, 760, 896, 82, 2);

  context.fillStyle = "rgba(255,253,248,.72)";
  context.font = "400 30px system-ui, sans-serif";
  drawLines(context, model.subtitle || "未填写歌手或专辑", 92, 865, 896, 42, 2);

  let y = 965;
  for (const line of [model.dateLine, model.ratingLine, model.moodLine].filter((value): value is string => !!value)) {
    context.fillStyle = "#fffdf8";
    context.font = "600 28px system-ui, sans-serif";
    y += drawLines(context, line, 92, y, 896, 40, 2) * 40 + 14;
  }

  const quotes = [model.firstQuote, model.latestQuote].filter((value): value is string => !!value);
  if (quotes.length) {
    context.strokeStyle = "rgba(201,151,63,.55)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(92, y + 12);
    context.lineTo(988, y + 12);
    context.stroke();
    y += 60;
    quotes.forEach((quote, index) => {
      context.fillStyle = index === quotes.length - 1 ? "#fffdf8" : "rgba(255,253,248,.68)";
      context.font = "400 28px system-ui, sans-serif";
      const prefix = quotes.length > 1 ? (index === 0 ? "初听｜" : "重听｜") : "";
      const maxLines = quotes.length > 1 ? 2 : 3;
      y += drawLines(context, prefix + quote, 92, y, 896, 38, maxLines) * 38 + 14;
    });
  }

  if (model.brand) {
    context.fillStyle = "rgba(255,253,248,.5)";
    context.font = "500 24px system-ui, sans-serif";
    context.fillText(model.brand, 92, 1360);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片生成失败")), "image/png");
  });
}

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

export const DEFAULT_PRIVACY: MemoryCardPrivacy = { hideContent: false, hideRating: false, hideDate: false, hideBrand: false };

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function displayDate(value: string | null) {
  return localDateOf(value)?.replaceAll("-", ".") ?? "";
}

function ratingText(value: number | null, modifier: string | null) {
  return value === null ? "" : String(value) + (modifier ?? "") + " / 10";
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, 1080, 1440);
  gradient.addColorStop(0, "#071f1b");
  gradient.addColorStop(0.6, "#17483e");
  gradient.addColorStop(1, "#0b3029");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1440);
  context.strokeStyle = "rgba(255,253,248,.08)";
  context.lineWidth = 2;
  for (let radius = 80; radius < 660; radius += 22) {
    context.beginPath();
    context.arc(925, 120, radius, 0, Math.PI * 2);
    context.stroke();
  }
}

async function drawCover(context: CanvasRenderingContext2D, coverUrl: string | null) {
  context.save();
  roundedRect(context, 92, 92, 896, 500, 32);
  context.clip();
  context.fillStyle = "#0b3029";
  context.fillRect(92, 92, 896, 500);
  if (coverUrl) {
    try {
      const image = await loadImage(coverUrl);
      const scale = Math.max(896 / image.width, 500 / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, 92 + (896 - width) / 2, 92 + (500 - height) / 2, width, height);
      context.fillStyle = "rgba(7,31,27,.22)";
      context.fillRect(92, 92, 896, 500);
      context.restore();
      return;
    } catch {
      // 封面不可读时保留唱片纹占位，不阻断卡片。
    }
  }
  context.strokeStyle = "rgba(201,151,63,.52)";
  context.lineWidth = 3;
  for (let radius = 48; radius < 320; radius += 28) {
    context.beginPath();
    context.arc(540, 342, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = "#c9973f";
  context.beginPath();
  context.arc(540, 342, 34, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawLines(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = Array.from(text.replace(/\s+/g, " ").trim());
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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("封面读取失败"));
    image.src = src;
  });
}
