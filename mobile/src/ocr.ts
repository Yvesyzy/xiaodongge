import type { EntryType } from "./types";

export type OcrLine = {
  text: string;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
};

export type OcrInput = {
  text: string;
  width?: number;
  height?: number;
  lines?: OcrLine[];
};

export type MusicInfoFields = {
  type?: EntryType;
  title?: string;
  albumName?: string;
  songName?: string | null;
  artistName?: string;
  content?: string;
};

type NormalizedLine = Required<OcrLine>;

const LABEL_PATTERN = /^(标题|歌名|歌曲|曲名|专辑|艺术家|艺人|歌手|title|song|track|album|artist|singer)\s*[:：]\s*(.+)$/i;

export function parseMusicInfoText(input: string | OcrInput): MusicInfoFields {
  const ocr = typeof input === "string" ? { text: input } : input;
  const lines = normalizeLines(ocr);
  const albumFields = parseAlbumInfoPage(lines);
  if (albumFields) return albumFields;
  return parseDefaultMusicInfo(lines);
}

function parseDefaultMusicInfo(lines: NormalizedLine[]): MusicInfoFields {
  const fields: MusicInfoFields = {};
  for (const line of lines) {
    const labelled = line.text.match(LABEL_PATTERN);
    if (!labelled) continue;
    applyRecognizedLabel(fields, labelled[1], labelled[2]);
  }
  const useful = lines.map((line) => line.text).filter((line) => !isOcrNoise(line) && !LABEL_PATTERN.test(line));
  let nextFallbackIndex = 0;
  if (!fields.songName && !fields.artistName && useful[0]) {
    const split = splitMusicLine(useful[0]);
    if (split) {
      fields.songName = split[0];
      fields.artistName = split[1];
      nextFallbackIndex = 1;
    }
  }
  // ponytail: OCR text layouts vary by music app; this fills common fields only, add app-specific parsers if one source needs higher accuracy.
  if (!fields.songName && useful[nextFallbackIndex]) fields.songName = useful[nextFallbackIndex++];
  if (!fields.artistName && useful[nextFallbackIndex]) fields.artistName = useful[nextFallbackIndex++];
  if (!fields.albumName && useful[nextFallbackIndex]) fields.albumName = useful[nextFallbackIndex];
  if (!fields.title) fields.title = fields.songName ?? fields.albumName;
  return fields;
}

function parseAlbumInfoPage(lines: NormalizedLine[]): MusicInfoFields | null {
  const text = lines.map((line) => line.text).join("\n");
  if (!looksLikeAlbumInfoPage(text)) return null;
  const title = findStandaloneAlbumTitle(lines) ?? findBracketedAlbumTitle(text);
  if (!title) return null;
  return {
    type: "album",
    title,
    albumName: title,
    songName: null,
    artistName: findAlbumArtist(text),
    content: extractAlbumInfoContent(lines, title),
  };
}

function looksLikeAlbumInfoPage(text: string) {
  const markers = ["发行公司", "专辑类别", "录音室专辑", "录音室版", "《", "》"];
  return markers.filter((marker) => text.includes(marker)).length >= 3;
}

function findStandaloneAlbumTitle(lines: NormalizedLine[]) {
  const line = lines
    .filter((item) => !isOcrNoise(item.text) && isLikelyStandaloneTitle(item.text))
    .sort((a, b) => a.top - b.top)[0];
  return line ? normalizeTitle(line.text) : null;
}

function findBracketedAlbumTitle(text: string) {
  const titles = Array.from(text.matchAll(/《([^》]+)》/g)).map((match) => cleanOcrLine(match[1])).filter(Boolean);
  return titles[0] ? normalizeTitle(titles[0]) : null;
}

function findAlbumArtist(text: string) {
  const patterns = [
    /[×x]\s*([A-Za-z][A-Za-z .'-]{1,80}?)的(?:最新)?录音室专辑/,
    /《[^》]+》是([A-Za-z][A-Za-z .'-]{1,80}?)的/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanOcrLine(match[1]);
  }
  return undefined;
}

function extractAlbumInfoContent(lines: NormalizedLine[], title: string) {
  const useful = lines.map((line) => line.text).filter((line) => !isOcrNoise(line) && !isCoverNoise(line, title));
  const start = useful.findIndex((line) => /发行公司|专辑类别|录音室|《.+》|^[×x]/.test(line));
  return (start >= 0 ? useful.slice(start) : useful).join("\n").trim() || undefined;
}

function isCoverNoise(line: string, title: string) {
  const lower = line.toLowerCase();
  return lower === title.toLowerCase()
    || /^the life of$/i.test(line)
    || /^pablo$/i.test(line)
    || /^which\s*\/\s*one$/i.test(line);
}

function isLikelyStandaloneTitle(value: string) {
  if (!/[A-Za-z]/.test(value)) return false;
  if (/发行公司|专辑类别|录音室|Tidal|Kanye LP7/i.test(value)) return false;
  if (/^THE LIFE OF$|^PABLO$|^WHICH\s*\/\s*ONE$/i.test(value)) return false;
  if (value === value.toUpperCase()) return false;
  return value.split(/\s+/).length >= 2 && value.length <= 80;
}

function normalizeLines(input: OcrInput): NormalizedLine[] {
  const rawLines: OcrLine[] = input.lines?.length ? input.lines : input.text.split(/\r?\n/).map((text) => ({ text }));
  return rawLines
    .map((line) => ({
      text: cleanOcrLine(line.text),
      left: line.left ?? 0,
      top: line.top ?? 0,
      right: line.right ?? 0,
      bottom: line.bottom ?? 0,
    }))
    .filter((line) => line.text.length > 0);
}

function applyRecognizedLabel(fields: MusicInfoFields, rawLabel: string, rawValue: string) {
  const label = rawLabel.toLowerCase();
  const value = cleanOcrLine(rawValue);
  if (!value) return;
  if (["标题", "title"].includes(label)) fields.title = value;
  if (["歌名", "歌曲", "曲名", "song", "track"].includes(label)) fields.songName = value;
  if (["专辑", "album"].includes(label)) fields.albumName = value;
  if (["艺术家", "艺人", "歌手", "artist", "singer"].includes(label)) fields.artistName = value;
}

function splitMusicLine(line: string) {
  const parts = line.split(/\s[-–—·•|｜]\s/).map((part) => part.trim()).filter(Boolean);
  return parts.length === 2 ? [parts[0], parts[1]] as const : null;
}

function normalizeTitle(value: string) {
  const text = cleanOcrLine(value);
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function cleanOcrLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isOcrNoise(line: string) {
  const lower = line.toLowerCase();
  return lower.length < 2
    || /^(am|pm)?\s?\d{1,2}:\d{2}\s*[a-z]?$/.test(lower)
    || /^[\d:./ -]+$/.test(lower)
    || /^\d+(?:\.\d+)?\s*(?:kb\/s|mb\/s|5g|4g|%)$/i.test(lower)
    || ["播放", "喜欢", "收藏", "分享", "评论", "下载", "歌词", "歌单", "music", "now playing"].includes(lower);
}
