import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Link } from "react-router-dom";
import { version as APP_VERSION } from "../../package.json";
import { BACKUP_HEALTH_KEY, parseBackupHealth } from "./backupHealth";
import { getRestoreState, RESTORE_GATE_KEY, WEB_RESTORE_JOURNAL_KEY } from "./codex_restoreState";
import { listEntryDrafts } from "./entryDraft";
import { NowPlaying } from "./nativeNowPlaying";
import { copyText } from "./nativeExport";
import { readStorageCorruptions } from "./storageSafety";
import { store } from "./store";

declare const __CODEX_WEB_BUILD_ID__: string;

export type DiagnosticsSnapshot = {
  appVersion: string;
  webBuildId: string;
  installedPackage: string;
  backupVerifiedAt: string;
  backupSavedAt: string;
  validDrafts: string;
  damagedDrafts: string;
  storageState: string;
  notificationAccess: string;
  runtimeEnvironment: string;
  webEngine: string;
  renderingMode: string;
  restoreLock: string;
  mediaService: string;
  clipboardService: string;
  resourceCheck: string;
  errorCodes: string[];
};

const UNKNOWN = "未知";

export async function readDiagnostics(): Promise<DiagnosticsSnapshot> {
  const chromiumVersion = navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1];
  const result: DiagnosticsSnapshot = {
    appVersion: APP_VERSION,
    webBuildId: __CODEX_WEB_BUILD_ID__,
    installedPackage: Capacitor.isNativePlatform() ? UNKNOWN : "仅 Android 安装包适用",
    backupVerifiedAt: UNKNOWN,
    backupSavedAt: UNKNOWN,
    validDrafts: UNKNOWN,
    damagedDrafts: UNKNOWN,
    storageState: UNKNOWN,
    notificationAccess: Capacitor.isNativePlatform() ? UNKNOWN : "仅 Android 可读",
    runtimeEnvironment: Capacitor.getPlatform(),
    webEngine: chromiumVersion ? `Chromium ${chromiumVersion}` : UNKNOWN,
    renderingMode: document.documentElement.classList.contains("codex-basic-rendering") ? "兼容渲染" : "标准渲染",
    restoreLock: typeof navigator.locks?.request === "function" ? "接口存在；实际恢复仍会校验独占锁" : "不可用；保留导出，暂停导入与撤销",
    mediaService: UNKNOWN,
    clipboardService: UNKNOWN,
    resourceCheck: "运行时未核验；构建检查结果以打包清单为准",
    errorCodes: [],
  };
  try {
    const drafts = listEntryDrafts(localStorage);
    result.validDrafts = String(drafts.filter(draft => draft.status !== "invalid").length);
    result.damagedDrafts = String(drafts.filter(draft => draft.status === "invalid").length);
  } catch { result.errorCodes.push("draft_scan_failed"); }
  try {
    const restore = getRestoreState();
    const hasGate = localStorage.getItem(RESTORE_GATE_KEY) !== null || localStorage.getItem(WEB_RESTORE_JOURNAL_KEY) !== null;
    const corruptions = readStorageCorruptions(localStorage).length;
    result.storageState = restore.busy || hasGate || !!restore.error ? "只读：恢复屏障或错误" : "未检测到只读屏障；数据库完整性未核验";
    if (corruptions) result.storageState += `；损坏隔离项 ${corruptions}`;
  } catch { result.errorCodes.push("storage_read_failed"); }
  try {
    const raw = await store.getStoredAppData(BACKUP_HEALTH_KEY);
    const health = parseBackupHealth(raw);
    if (raw && !health) result.errorCodes.push("backup_health_invalid");
    if (health) {
      result.backupVerifiedAt = new Date(health.verifiedAt).toISOString();
      result.backupSavedAt = health.lastSavedAt ? new Date(health.lastSavedAt).toISOString() : UNKNOWN;
    }
  } catch {
    result.storageState = `${result.storageState === UNKNOWN ? "" : `${result.storageState}；`}应用数据读取失败，数据库状态未知`;
    result.errorCodes.push("backup_read_failed");
  }
  if (["android", "electron"].includes(Capacitor.getPlatform())) {
    try {
      const native = await NowPlaying.getDiagnostics();
      if (typeof native.versionName !== "string" || !Number.isSafeInteger(native.versionCode)
        || typeof native.notificationAccessEnabled !== "boolean") throw new Error("invalid diagnostics shape");
      result.installedPackage = `${native.versionName} (${native.versionCode})`;
      if (Capacitor.getPlatform() === "android") {
        result.mediaService = typeof native.mediaAvailable === "boolean" ? native.mediaAvailable ? "存在；实际读取取决于权限和运行环境" : "未提供；可使用粘贴、截图或手动记录" : UNKNOWN;
        result.clipboardService = typeof native.clipboardAvailable === "boolean" ? native.clipboardAvailable ? "存在；实际复制以操作结果为准" : "未提供；将尝试网页复制回退" : UNKNOWN;
        const text = (value: unknown) => typeof value === "string" ? value.replace(/[\r\n]/g, " ").slice(0, 80) : UNKNOWN;
        result.runtimeEnvironment = `${text(native.manufacturer)} ${text(native.model)}；Android API ${Number.isSafeInteger(native.androidApi) ? native.androidApi : UNKNOWN}`;
        if (typeof native.webViewVersion === "string" && native.webViewVersion !== UNKNOWN) {
          result.webEngine = `${text(native.webViewPackage)} ${text(native.webViewVersion)}`;
        }
      }
      result.notificationAccess = Capacitor.getPlatform() === "electron"
        ? `系统媒体会话${native.mediaAvailable ? "可用" : "不可用"}；OCR ${native.ocrAvailable ? (native.ocrLanguages ?? []).join("、") : "不可用"}`
        : native.notificationAccessKnown === false ? "未知：系统未提供通知访问状态" : native.notificationAccessEnabled ? "已开启" : "未开启";
    } catch { result.errorCodes.push("native_diagnostics_failed"); }
  }
  return result;
}

export function diagnosticsCopyText(snapshot: DiagnosticsSnapshot) {
  return [
    `应用版本：${snapshot.appVersion}`,
    `Web 构建标识：${snapshot.webBuildId}`,
    `已安装${Capacitor.getPlatform() === "electron" ? " Windows" : " Android"} 包：${snapshot.installedPackage}`,
    `运行环境：${snapshot.runtimeEnvironment}`,
    `WebView 内核：${snapshot.webEngine}`,
    `界面渲染：${snapshot.renderingMode}`,
    `安全恢复锁：${snapshot.restoreLock}`,
    `媒体会话服务：${snapshot.mediaService}`,
    `系统剪贴板：${snapshot.clipboardService}`,
    `备份验证时间：${snapshot.backupVerifiedAt}`,
    `备份保存时间：${snapshot.backupSavedAt}`,
    `格式有效草稿：${snapshot.validDrafts}`,
    `损坏草稿：${snapshot.damagedDrafts}`,
    `存储状态：${snapshot.storageState}`,
    `${Capacitor.getPlatform() === "electron" ? "Windows 媒体与 OCR" : "通知读取权限"}：${snapshot.notificationAccess}`,
    `资源校验：${snapshot.resourceCheck}`,
    `读取代码：${snapshot.errorCodes.length ? snapshot.errorCodes.join(", ") : "无"}`,
  ].join("\n");
}

export default function DiagnosticsPage() {
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    let active = true;
    void readDiagnostics().then(value => { if (active) setSnapshot(value); });
    return () => { active = false; };
  }, []);
  return <section className="page">
    <h1>本机诊断</h1>
    <p className="lead">只读取本机状态。复制内容不含曲目、乐评、草稿原文、封面或文件路径。</p>
    <Link to="/more">返回更多</Link>
    {snapshot ? <>
      <div className="form-card"><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{diagnosticsCopyText(snapshot)}</pre></div>
      <button className="primary-button" type="button" onClick={() => {
        void copyText(diagnosticsCopyText(snapshot))
          .then(() => setCopyStatus("诊断摘要已复制"), () => setCopyStatus("复制失败，可长按上方摘要选择复制"));
      }}>复制脱敏诊断</button>
      {copyStatus && <p role="status">{copyStatus}</p>}
    </> : <p role="status">正在读取本机状态…</p>}
  </section>;
}
