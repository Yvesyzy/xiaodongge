import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { blobToBase64, buildQuickMemoryCard, DEFAULT_PRIVACY, downloadBlob, renderMemoryCard, type MemoryCardPrivacy } from "./shareCard";
import type { ReviewEntry } from "./types";


export default function QuickMemoryCardPanel({ entry, coverUrl, emphasized = false }: { entry: ReviewEntry; coverUrl: string | null; emphasized?: boolean }) {
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveCard() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const blob = await renderMemoryCard(buildQuickMemoryCard(entry, privacy), coverUrl);
      const fileName = "xiaodongge-quick-" + dateStamp() + ".png";
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({ path: fileName, data: await blobToBase64(blob), directory: Directory.Documents });
        setMessage("已保存到 Documents/" + fileName);
      } else {
        downloadBlob(blob, fileName);
        setMessage("快速记录卡已生成");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "记忆卡保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={emphasized ? "memory-card-controls emphasized" : "memory-card-controls"}>
      <div>
        <span className="page-eyebrow">本地 PNG</span>
        <h2>保存这次听见</h2>
        <p>先选择要隐藏的信息，图片只在本机生成。</p>
      </div>
      <div className="privacy-options">
        {([
          ["hideContent", "隐藏正文"],
          ["hideRating", "隐藏评分"],
          ["hideDate", "隐藏日期"],
          ["hideBrand", "隐藏小懂哥名称"],
        ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={privacy[key]} onChange={(event) => setPrivacy((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
      </div>
      <button type="button" className="primary-button full" onClick={saveCard} disabled={saving}>{saving ? "生成中" : "保存快速记录卡"}</button>
      {message ? <p className="hint" role="status">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function dateStamp() {
  const date = new Date();
  return String(date.getFullYear()) + String(date.getMonth() + 1).padStart(2, "0") + String(date.getDate()).padStart(2, "0");
}

