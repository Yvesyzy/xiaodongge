import { assertStorageWritable } from "./codex_restoreState";
export const STORAGE_CORRUPTION_KEY = "music-feelings-storage-corruption:v1";
export const STORAGE_CORRUPTION_EVENT = "codex:storage-corruption-changed";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StorageCorruption = {
  version: 1;
  key: string;
  raw: string;
  detectedAt: string;
};

type StorageCorruptionArchive = {
  version: 2;
  items: StorageCorruption[];
};

export function readSafeJson<T>(storage: StorageLike, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const existing = readStorageCorruptions(storage).find((item) => item.key === key && item.raw === raw);
    if (existing) {
      throw new Error(`本地数据 ${key} 已损坏，隔离副本已存在，原始内容仍保留，请前往备份页处理`);
    }
    try {
      preserveStorageCorruption(storage, key, raw);
    } catch (error) {
      const detail = error instanceof Error ? `：${error.message}` : "";
      throw new Error(`本地数据 ${key} 已损坏，隔离副本保存失败，原始内容仍保留${detail}`);
    }
    try {
      storage.removeItem(key);
    } catch (error) {
      const detail = error instanceof Error ? `：${error.message}` : "";
      throw new Error(`本地数据 ${key} 已损坏，原文已保存但原始键无法清除${detail}`);
    }
    throw new Error(`本地数据 ${key} 已损坏，原始内容已隔离，请前往备份页处理`);
  }
}

/** Read every retained corruption, including a legacy version: 1 singleton. */
export function readStorageCorruptions(storage: StorageLike): StorageCorruption[] {
  const raw = storage.getItem(STORAGE_CORRUPTION_KEY);
  const parsed = decodeArchive(raw);
  if (!parsed && raw !== null) {
    // Keep a malformed archive visible and make the normal integrity guard stop writes.
    // Its raw value remains copyable until the user explicitly clears this slot.
    return [{ version: 1, key: STORAGE_CORRUPTION_KEY, raw, detectedAt: new Date().toISOString() }];
  }
  return parsed?.items ?? [];
}

/** Backward-compatible singleton read for existing callers. */
export function readStorageCorruption(storage: StorageLike): StorageCorruption | null {
  return readStorageCorruptions(storage)[0] ?? null;
}

/** Preserve a raw source without removing its original storage key. */
export function preserveStorageCorruption(storage: StorageLike, key: string, raw: string): StorageCorruption {
  const stored = storage.getItem(STORAGE_CORRUPTION_KEY);
  const decoded = decodeArchive(stored);
  if (stored !== null && !decoded) throw new Error("损坏数据隔离槽格式无效，未覆盖已有隔离内容");
  const existing = decoded?.items ?? [];
  const sameKey = existing.find((item) => item.key === key);
  if (sameKey) {
    if (sameKey.raw === raw) return sameKey;
    throw new Error(`本地数据 ${key} 已有隔离副本，未覆盖已有原文`);
  }
  const corruption: StorageCorruption = { version: 1, key, raw, detectedAt: new Date().toISOString() };
  const items = [...existing, corruption];
  const next = stored === null && items.length === 1
    ? JSON.stringify(corruption)
    : JSON.stringify({ version: 2, items } satisfies StorageCorruptionArchive);
  storage.setItem(STORAGE_CORRUPTION_KEY, next);
  const verified = readStorageCorruptions(storage).find((item) => item.key === key && item.raw === raw);
  if (!verified) throw new Error("隔离副本写入后校验失败，未覆盖原始内容");
  notifyCorruptionChanged(storage);
  return verified;
}

export function clearStorageCorruption(storage: StorageLike, key?: string) {
  assertStorageWritable();
  if (key === undefined) {
    storage.removeItem(STORAGE_CORRUPTION_KEY);
    notifyCorruptionChanged(storage);
    return;
  }
  const stored = storage.getItem(STORAGE_CORRUPTION_KEY);
  const decoded = decodeArchive(stored);
  if (!decoded) {
    if (key === STORAGE_CORRUPTION_KEY) storage.removeItem(STORAGE_CORRUPTION_KEY);
    notifyCorruptionChanged(storage);
    return;
  }
  const remaining = decoded.items.filter((item) => item.key !== key);
  if (!remaining.length) {
    storage.removeItem(STORAGE_CORRUPTION_KEY);
  } else {
    storage.setItem(STORAGE_CORRUPTION_KEY, JSON.stringify({ version: 2, items: remaining } satisfies StorageCorruptionArchive));
  }
  notifyCorruptionChanged(storage);
}

function notifyCorruptionChanged(storage: StorageLike) {
  if (typeof window !== "undefined" && storage === window.localStorage) {
    window.dispatchEvent(new Event(STORAGE_CORRUPTION_EVENT));
  }
}

function decodeArchive(raw: string | null): { items: StorageCorruption[] } | null {
  if (raw === null) return { items: [] };
  try {
    const value = JSON.parse(raw) as unknown;
    if (isCorruption(value)) return { items: [value] };
    if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.items) || value.items.some((item) => !isCorruption(item))) return null;
    return { items: value.items as StorageCorruption[] };
  } catch {
    return null;
  }
}

function isCorruption(value: unknown): value is StorageCorruption {
  return isRecord(value)
    && value.version === 1
    && typeof value.key === "string"
    && typeof value.raw === "string"
    && typeof value.detectedAt === "string"
    && Number.isFinite(Date.parse(value.detectedAt));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
