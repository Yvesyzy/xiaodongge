export { BACKUP_HEALTH_KEY } from "../../shared/backupAppData";

export type BackupPreview = {
  sourceVersion: number;
  draftsPresence: "absent" | "present";
  draftCount: number;
  newDraftCount: number;
  editDraftCount: number;
  localDraftCount: number;
  exportedAt: string;
  entryCount: number;
  summaryCount: number;
  monthlySummaryCount: number;
  coverCount: number;
  listeningMomentCount: number;
};

export type BackupHealth = Omit<BackupPreview, "sourceVersion" | "draftsPresence" | "draftCount" | "newDraftCount" | "editDraftCount" | "localDraftCount"> & Partial<Pick<BackupPreview, "draftCount">> & {
  version: 1;
  backupVersion: 5 | 6;
  verifiedAt: string;
  byteLength: number;
  sha256: string;
  lastSavedAt?: string;
  lastSavedFileName?: string;
};

export async function inspectBackup(raw: string, preview: BackupPreview, verifiedAt = new Date().toISOString()): Promise<BackupHealth> {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed) || parsed.version !== 6) throw new Error("备份不是当前 v6 格式");
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    version: 1,
    backupVersion: 6,
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
      || (value.backupVersion !== 5 && value.backupVersion !== 6)
      || (value.backupVersion === 6 && !isNonNegativeInteger(value.draftCount))
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
