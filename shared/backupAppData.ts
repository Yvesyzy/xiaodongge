import { parseWeatherLocation, parseWeatherRecord } from "./listeningContext.ts";
import type { ListeningLayer, SemanticOverride } from "./listeningAnalysis.ts";

// 备份与本地应用数据的键白名单。导出包含所有键、导入按此白名单校验；
// 新增 AppData 键时必须同时更新 readBackupAppData，否则自导出的备份无法再导入。
export const WEATHER_LOCATION_KEY = "listening-weather-location";
export const SEMANTIC_OVERRIDES_KEY = "listening-semantic-overrides";
export const DAILY_RESURFACING_KEY = "daily-resurfacing";
export const BACKUP_HEALTH_KEY = "backup-health:v1";
export const JOURNAL_EDITION_PREFIX = "journal-edition:";
export type JournalEdition = { coverId: string | null; entryIds: string[]; quotes: Record<string, string>; message: string };

export function readJournalEdition(value: unknown): JournalEdition {
  if (!isRecord(value) || (value.coverId !== null && typeof value.coverId !== "string") || !Array.isArray(value.entryIds) || value.entryIds.length > 3 || value.entryIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(value.entryIds).size !== value.entryIds.length || typeof value.message !== "string" || value.message.length > 120 || !isRecord(value.quotes) || Object.entries(value.quotes).some(([id, quote]) => !id || typeof quote !== "string" || !quote.trim() || quote.length > 180)) throw new Error("年度精选格式无效");
  return { coverId: value.coverId as string | null, entryIds: value.entryIds as string[], quotes: value.quotes as Record<string, string>, message: value.message };
}

export type DailyResurfacingState = {
  date: string;
  entryId: string | null;
  dismissed: boolean;
};

export function readBackupAppData(value: unknown) {
  if (!isRecord(value)) throw new Error("appData 必须是对象");
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "string") throw new Error("appData 值必须是字符串");
    if (key === WEATHER_LOCATION_KEY) parseWeatherLocation(JSON.parse(raw));
    else if (key.startsWith("listening-weather:")) parseWeatherRecord(JSON.parse(raw));
    else if (key.startsWith("listening-quote:")) readPreferredQuote(JSON.parse(raw));
    else if (/^journal-edition:[1-9]\d{0,3}$/.test(key)) readJournalEdition(JSON.parse(raw));
    else if (key === DAILY_RESURFACING_KEY) {
      if (!parseDailyResurfacingState(raw)) throw new Error("今日重逢状态格式无效");
    } else if (key === SEMANTIC_OVERRIDES_KEY) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("本地语义校正格式无效");
      parsed.forEach(readSemanticOverride);
    } else if (key === BACKUP_HEALTH_KEY) {
      // 设备本地状态，兼容旧备份；新备份导出时已过滤该键
    } else throw new Error(`appData 包含不支持的键：${key}`);
    result[key] = raw;
  }
  return result;
}

export function readPreferredQuote(value: unknown) {
  if (!isRecord(value) || typeof value.entryId !== "string" || !value.entryId || typeof value.sentence !== "string" || !value.sentence.trim()) throw new Error("代表原句格式无效");
  return { entryId: value.entryId, sentence: value.sentence };
}

export function readSemanticOverride(value: unknown): SemanticOverride {
  if (!isRecord(value) || !isListeningLayer(value.layer) || typeof value.term !== "string" || !value.term.trim() || (value.action !== "exclude" && value.action !== "move")) throw new Error("本地语义校正格式无效");
  const targetLayer = value.targetLayer === null ? null : isListeningLayer(value.targetLayer) ? value.targetLayer : null;
  if (value.action === "move" && !targetLayer) throw new Error("语义分类校正缺少目标类别");
  return { layer: value.layer, term: value.term.trim(), action: value.action, targetLayer: value.action === "exclude" ? null : targetLayer };
}

export function parseDailyResurfacingState(raw: string | null) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return null;
    if (record.entryId !== null && (typeof record.entryId !== "string" || !record.entryId.trim())) return null;
    if (typeof record.dismissed !== "boolean") return null;
    return { date: record.date, entryId: record.entryId, dismissed: record.dismissed } as DailyResurfacingState;
  } catch {
    return null;
  }
}

function isListeningLayer(value: unknown): value is ListeningLayer {
  return value === "feeling" || value === "subject" || value === "expression" || value === "genre";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
