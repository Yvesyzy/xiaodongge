export const STORAGE_CORRUPTION_KEY = "music-feelings-storage-corruption:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StorageCorruption = {
  version: 1;
  key: string;
  raw: string;
  detectedAt: string;
};

export function readSafeJson<T>(storage: StorageLike, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const corruption: StorageCorruption = {
      version: 1,
      key,
      raw,
      detectedAt: new Date().toISOString(),
    };
    storage.setItem(STORAGE_CORRUPTION_KEY, JSON.stringify(corruption));
    storage.removeItem(key);
    throw new Error(`本地数据 ${key} 已损坏，原始内容已隔离，请前往备份页处理`);
  }
}

export function readStorageCorruption(storage: StorageLike): StorageCorruption | null {
  const raw = storage.getItem(STORAGE_CORRUPTION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)
      || value.version !== 1
      || typeof value.key !== "string"
      || typeof value.raw !== "string"
      || typeof value.detectedAt !== "string"
      || !Number.isFinite(Date.parse(value.detectedAt))) return null;
    return value as StorageCorruption;
  } catch {
    return null;
  }
}

export function clearStorageCorruption(storage: StorageLike) {
  storage.removeItem(STORAGE_CORRUPTION_KEY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
