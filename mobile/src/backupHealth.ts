export const BACKUP_HEALTH_KEY = "backup-health:v1";

export type BackupPreview = {
  exportedAt: string;
  entryCount: number;
  summaryCount: number;
  monthlySummaryCount: number;
  coverCount: number;
  listeningMomentCount: number;
};

export type BackupHealth = BackupPreview & {
  version: 1;
  backupVersion: 5;
  verifiedAt: string;
  byteLength: number;
  sha256: string;
  lastSavedAt?: string;
  lastSavedFileName?: string;
};

export async function inspectBackup(raw: string, preview: BackupPreview, verifiedAt = new Date().toISOString()): Promise<BackupHealth> {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed) || parsed.version !== 5) throw new Error("备份不是当前 SQLite v5 格式");
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    version: 1,
    backupVersion: 5,
    verifiedAt,
    byteLength: bytes.byteLength,
    sha256: Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(""),
    ...preview,
  };
}

export function parseBackupHealth(raw: string | null): BackupHealth | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)
      || value.version !== 1
      || value.backupVersion !== 5
      || !isIsoDate(value.exportedAt)
      || !isIsoDate(value.verifiedAt)
      || !isNonNegativeInteger(value.byteLength)
      || typeof value.sha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(value.sha256)
      || !isNonNegativeInteger(value.entryCount)
      || !isNonNegativeInteger(value.summaryCount)
      || !isNonNegativeInteger(value.monthlySummaryCount)
      || !isNonNegativeInteger(value.coverCount)
      || !isNonNegativeInteger(value.listeningMomentCount)
      || (value.lastSavedAt !== undefined && !isIsoDate(value.lastSavedAt))
      || (value.lastSavedFileName !== undefined && typeof value.lastSavedFileName !== "string")) return null;
    return value as BackupHealth;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isIsoDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
