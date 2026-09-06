import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { blobToBase64, downloadBlob } from "./shareCard";
import { NativeExport } from "./nativeExport";
import { buildYearbookPosterStats, renderYearbookPoster, YEARBOOK_POSTER_MIME, type YearbookPosterStats } from "./codex_yearbookPoster";
import type { YearlyListeningSnapshot } from "./listeningYearbook";
import type { ReviewEntry } from "./types";

export type YearbookExportProps = {
  snapshot: YearlyListeningSnapshot;
  entries: ReviewEntry[];
};

type PosterState = {
  blob: Blob;
  url: string;
  stats: YearbookPosterStats;
};

type ExportAction = "save" | "share" | null;

export function YearbookExport({ snapshot, entries }: YearbookExportProps) {
  const [poster, setPoster] = useState<PosterState | null>(null);
  const [action, setAction] = useState<ExportAction>(null);
  const [status, setStatus] = useState("正在生成年度海报……");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setPoster(null);
    setError("");
    setStatus("正在生成年度海报……");
    void Promise.resolve().then(async () => {
      const stats = buildYearbookPosterStats(snapshot, entries);
      const blob = await renderYearbookPoster(snapshot, entries);
      return { stats, blob };
    }).then(({ stats, blob }) => {
      objectUrl = URL.createObjectURL(blob);
      if (!active) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      setPoster({ blob, url: objectUrl, stats });
      setStatus("年度海报已生成，可预览、保存或分享");
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "年度海报生成失败");
      setStatus("");
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [snapshot, entries]);

  async function savePoster() {
    if (!poster || action) return;
    setAction("save");
    setError("");
    const fileName = yearbookFileName(snapshot.year);
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await NativeExport.saveFile({
          fileName,
          mimeType: YEARBOOK_POSTER_MIME,
          content: await blobToBase64(poster.blob),
          encoding: "base64",
        });
        setStatus(result.status === "cancelled" ? "已取消保存年度海报" : `年度海报已保存：${fileName}`);
      } else {
        downloadBlob(poster.blob, fileName);
        setStatus(`已开始下载年度海报：${fileName}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? `保存失败：${reason.message}` : "保存失败，请重试");
      setStatus("");
    } finally {
      setAction(null);
    }
  }

  async function sharePoster() {
    if (!poster || action) return;
    setAction("share");
    setError("");
    const fileName = yearbookFileName(snapshot.year);
    try {
      if (Capacitor.isNativePlatform()) {
        await NativeExport.shareFile({
          fileName,
          mimeType: YEARBOOK_POSTER_MIME,
          content: await blobToBase64(poster.blob),
          encoding: "base64",
        });
        setStatus("已打开系统分享，可发送这张年度海报");
      } else {
        const file = new File([poster.blob], fileName, { type: YEARBOOK_POSTER_MIME });
        const shareAvailable = typeof navigator.share === "function"
          && (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));
        if (!shareAvailable) {
          downloadBlob(poster.blob, fileName);
          setStatus("当前浏览器不支持直接分享，已改为下载年度海报");
          return;
        }
        await navigator.share({ files: [file], title: `${snapshot.year} 年度听感标本册`, text: "小懂哥年度听感海报" });
        setStatus("已打开系统分享，可发送这张年度海报");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") {
        setStatus("已取消分享年度海报");
      } else {
        setError(reason instanceof Error ? `分享失败：${reason.message}` : "分享失败，请重试");
        setStatus("");
      }
    } finally {
      setAction(null);
    }
  }

  return (
    <section className="codex-yearbook-export" aria-labelledby="codex-yearbook-export-title">
      <style>{YEARBOOK_EXPORT_CSS}</style>
      <div className="codex-yearbook-export-heading">
        <div>
          <span className="codex-yearbook-export-eyebrow">SHAREABLE PNG</span>
          <h2 id="codex-yearbook-export-title">保存年度海报</h2>
          <p>把这一年的记录、月份轨迹和代表原句装进一张 1080px 图片，方便发给微信或朋友圈。</p>
        </div>
        <span className="codex-yearbook-export-badge">{snapshot.year}</span>
      </div>
      {poster ? (
        <>
          <div className="codex-yearbook-export-preview">
            <img src={poster.url} alt={`${snapshot.year} 年度听感标本册海报预览`} />
          </div>
          <p className="codex-yearbook-export-note">本次图片包含 {poster.stats.includedEntryCount} 条正式音乐记录；代表原句会随图片公开。</p>
          <div className="codex-yearbook-export-actions">
            <button type="button" className="codex-yearbook-export-primary" onClick={() => void savePoster()} disabled={!!action}>
              {action === "save" ? "准备保存……" : Capacitor.isNativePlatform() ? "保存到设备" : "下载 PNG"}
            </button>
            <button type="button" className="codex-yearbook-export-secondary" onClick={() => void sharePoster()} disabled={!!action}>
              {action === "share" ? "准备分享……" : "系统分享"}
            </button>
          </div>
        </>
      ) : null}
      {status ? <p className="codex-yearbook-export-status" role="status" aria-live="polite">{status}</p> : null}
      {error ? <p className="codex-yearbook-export-error" role="alert">{error}</p> : null}
    </section>
  );
}

export default YearbookExport;

function yearbookFileName(year: number) {
  return `xiaodongge-yearbook-${year}.png`;
}

const YEARBOOK_EXPORT_CSS = `
.codex-yearbook-export { margin-top: 24px; padding: 22px; border: 1px solid rgba(7,31,27,.12); border-radius: 24px; background: linear-gradient(145deg, rgba(255,253,248,.98), rgba(236,245,239,.9)); box-shadow: 0 16px 36px rgba(7,31,27,.09); }
.codex-yearbook-export-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.codex-yearbook-export-eyebrow { color: #9c6e20; font: 800 11px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; }
.codex-yearbook-export h2 { margin: 7px 0 6px; color: #07352e; font-size: clamp(22px, 4vw, 30px); }
.codex-yearbook-export p { margin: 0; color: #61736b; line-height: 1.65; }
.codex-yearbook-export-badge { display: grid; flex: 0 0 62px; width: 62px; height: 62px; place-items: center; border: 2px solid #c9973f; border-radius: 50%; color: #07352e; font: 800 17px ui-monospace, SFMono-Regular, Menlo, monospace; }
.codex-yearbook-export-preview { margin: 20px auto 14px; max-width: 390px; overflow: hidden; border-radius: 18px; background: #07352e; box-shadow: 0 10px 24px rgba(7,31,27,.2); }
.codex-yearbook-export-preview img { display: block; width: 100%; height: auto; }
.codex-yearbook-export-note { font-size: 13px; }
.codex-yearbook-export-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
.codex-yearbook-export-actions button { min-height: 48px; border-radius: 13px; padding: 10px 14px; font: 800 15px system-ui, sans-serif; cursor: pointer; }
.codex-yearbook-export-actions button:disabled { cursor: wait; opacity: .58; }
.codex-yearbook-export-primary { border: 1px solid #c9973f; background: #07352e; color: #fffdf8; }
.codex-yearbook-export-secondary { border: 1px solid rgba(7,31,27,.18); background: #fffdf8; color: #07352e; }
.codex-yearbook-export-status { margin-top: 12px !important; color: #287565 !important; font-size: 13px; }
.codex-yearbook-export-error { margin-top: 12px !important; color: #9b332f !important; font-size: 13px; }
@media (max-width: 420px) { .codex-yearbook-export { padding: 17px; border-radius: 18px; } .codex-yearbook-export-actions { grid-template-columns: 1fr; } }
`;
