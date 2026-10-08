import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MOOD_TAGS } from "../../shared/moods";
import { formatDateOnly } from "./format";
import { compareRelisten } from "./relistenComparison";
import RatingSlider from "./RatingSlider";
import { blobToBase64, buildRelistenMemoryCard, DEFAULT_PRIVACY, downloadBlob, renderMemoryCard, type MemoryCardPrivacy } from "./shareCard";
import { NativeExport } from "./nativeExport";
import { store } from "./store";
import { useBackGuard } from "./codex_Navigation";
import type { ListeningMoment, RatingModifier, ReviewEntry } from "./types";


export default function RelistenPage() {
  const { entryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const momentId = searchParams.get("moment");
  const [entry, setEntry] = useState<ReviewEntry | null>(null);
  const [moment, setMoment] = useState<ListeningMoment | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [ratingModifier, setRatingModifier] = useState<RatingModifier | null>(null);
  const [moods, setMoods] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [listenedOn, setListenedOn] = useState(() => localToday());
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const acceptedBack = useRef(false);
  const submitLock = useRef(false);
  const exportLock = useRef(false);

  useBackGuard(() => {
    if (saving) return false;
    if (!dirty || moment) return true;
    if (!window.confirm("这次听感还没有保存，确认放弃并离开？")) return false;
    acceptedBack.current = true;
    setDirty(false);
    return true;
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      if (!entryId) throw new Error("记录 ID 缺失");
      const entryPromise = store.getEntry(entryId);
      const momentPromise = momentId ? store.getListeningMoment(momentId) : Promise.resolve(null);
      const [nextEntry, nextMoment] = await Promise.all([entryPromise, momentPromise]);
      if (!nextEntry) throw new Error("没有找到这条记录");
      if (momentId && (!nextMoment || nextMoment.entryId !== nextEntry.id)) throw new Error("没有找到这次追加听感");
      const nextCover = await loadCover(nextEntry);
      if (!active) return;
      setEntry(nextEntry);
      setMoment(nextMoment);
      setCoverUrl(nextCover);
      setDirty(false);
    })().catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "重听记录读取失败");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [entryId, momentId]);

  useEffect(() => {
    if (!dirty || moment) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, moment]);

  useEffect(() => {
    if (!dirty || saving || moment) return;
    const interceptLink = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[href]");
      const href = anchor?.getAttribute("href") ?? "";
      if (!href.startsWith("#/")) return;
      event.preventDefault();
      setPendingHref(href);
    };
    document.addEventListener("click", interceptLink, true);
    return () => document.removeEventListener("click", interceptLink, true);
  }, [dirty, moment, saving]);

  useEffect(() => {
    if (!dirty || saving || moment) return;
    const confirmBackNavigation = () => {
      if (acceptedBack.current) { acceptedBack.current = false; return; }
      if (window.confirm("这次听感还没有保存，确认放弃并离开？")) {
        setDirty(false);
      } else {
        window.history.forward();
      }
    };
    window.addEventListener("popstate", confirmBackNavigation);
    return () => window.removeEventListener("popstate", confirmBackNavigation);
  }, [dirty, moment, saving]);

  const comparison = useMemo(() => entry && moment ? compareRelisten(entry, moment) : null, [entry, moment]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entry || submitLock.current) return;
    submitLock.current = true;
    setSaving(true);
    setError("");
    try {
      if (!content.trim()) throw new Error("请写下一句话感受");
      const saved = await store.createListeningMoment(entry.id, {
        listenedAt: localDateInputToIso(listenedOn),
        rating,
        ratingModifier: rating === null ? null : ratingModifier,
        moods,
        content: content.trim(),
      });
      setDirty(false);
      setMoment(saved);
      setSearchParams({ moment: saved.id }, { replace: true });
      setMessage("这次听感已经保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加听感保存失败");
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  function toggleMood(mood: string) {
    setDirty(true);
    setMoods((current) => current.includes(mood) ? current.filter((item) => item !== mood) : [...current, mood]);
  }

  async function saveCard() {
    if (!entry || !moment || !comparison || exportLock.current) return;
    exportLock.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const blob = await renderMemoryCard(buildRelistenMemoryCard(entry, moment, comparison, privacy), coverUrl);
      const fileName = relistenFileName(moment.id);
      if (Capacitor.isNativePlatform()) {
        const result = await NativeExport.saveFile({ fileName, mimeType: "image/png", encoding: "base64", content: await blobToBase64(blob) });
        setMessage(result.status === "cancelled" ? "已取消保存重听对比卡" : `已保存重听对比卡：${fileName}`);
      } else {
        downloadBlob(blob, fileName);
        setMessage(`已开始下载重听对比卡：${fileName}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "记忆卡保存失败");
    } finally {
      exportLock.current = false;
      setSaving(false);
    }
  }

  async function shareCard() {
    if (!entry || !moment || !comparison || exportLock.current) return;
    exportLock.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const blob = await renderMemoryCard(buildRelistenMemoryCard(entry, moment, comparison, privacy), coverUrl);
      const fileName = relistenFileName(moment.id);
      if (Capacitor.isNativePlatform()) {
        await NativeExport.shareFile({ fileName, mimeType: "image/png", encoding: "base64", content: await blobToBase64(blob) });
        setMessage(Capacitor.getPlatform() === "electron" ? "已打开导出文件夹，可以复制或发送这张重听对比卡" : "已打开系统分享，可发送这张重听对比卡");
      } else {
        const file = new File([blob], fileName, { type: "image/png" });
        const shareAvailable = typeof navigator.share === "function"
          && (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));
        if (!shareAvailable) {
          downloadBlob(blob, fileName);
          setMessage("当前浏览器不支持直接分享，已改为下载重听对比卡");
          return;
        }
        await navigator.share({ files: [file], title: "重听对比卡", text: "小懂哥重听对比卡" });
        setMessage("已打开系统分享，可发送这张重听对比卡");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") setMessage("已取消分享，当前设置已保留");
      else setError(err instanceof Error ? `分享失败：${err.message}` : "分享失败，请重试");
    } finally {
      exportLock.current = false;
      setSaving(false);
    }
  }

  if (loading) return <SimplePage title="再次听见"><p className="hint">正在读取这段音乐记忆…</p></SimplePage>;
  if (error && !entry) return <SimplePage title="再次听见"><p className="error">{error}</p><Link className="secondary-button" to="/">返回首页</Link></SimplePage>;
  if (!entry) return <SimplePage title="再次听见"><p className="error">没有找到这条记录</p></SimplePage>;

  if (moment && comparison) return (
    <SimplePage title="再次听见" text="旧评价现在才重新出现。以下只描述两次记录之间的事实变化。">
      <TrackHero entry={entry} coverUrl={coverUrl} />
      <section className="relisten-reveal">
        <span className="relisten-gap">{comparison.dayGap === null ? "再次听见" : "相隔 " + comparison.dayGap + " 天"}</span>
        <div className="relisten-rating-change">
          <div><span>第一次</span><strong>{ratingText(entry.rating, entry.ratingModifier)}</strong></div>
          <i aria-hidden="true">→</i>
          <div><span>这一次</span><strong>{ratingText(moment.rating, moment.ratingModifier)}</strong></div>
        </div>
        {comparison.rating.difference !== null ? <p className="relisten-fact">{ratingChangeText(comparison.rating.difference)}</p> : null}
        <div className="mood-change-grid">
          <MoodChange label="保留" values={comparison.moods.kept} />
          <MoodChange label="新增" values={comparison.moods.added} />
          <MoodChange label="淡出" values={comparison.moods.faded} />
        </div>
        <div className="relisten-quotes">
          <blockquote><span>{formatDateOnly(entry.listenedAt)}</span>{comparison.firstContent}</blockquote>
          <blockquote><span>{formatDateOnly(moment.listenedAt)}</span>{comparison.latestContent}</blockquote>
        </div>
      </section>

      <section className="memory-card-controls">
        <h2>保存重听对比卡</h2>
        <div className="privacy-options">
          {([
            ["hideContent", "隐藏正文"],
            ["hideRating", "隐藏评分"],
            ["hideDate", "隐藏日期"],
            ["hideBrand", "隐藏小懂哥名称"],
          ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={privacy[key]} onChange={(event) => setPrivacy((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
        </div>
        <div className="export-output-actions native-export-actions">
          <button type="button" className="primary-button" onClick={() => void saveCard()} disabled={saving}>{saving ? "生成中" : Capacitor.isNativePlatform() ? "保存重听对比卡" : "下载重听对比卡"}</button>
          <button type="button" className="secondary-button" onClick={() => void shareCard()} disabled={saving}>{Capacitor.getPlatform() === "electron" ? "打开导出文件夹" : "系统分享"}</button>
        </div>
      </section>
      {message ? <p className="hint" role="status">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <Link className="secondary-button full" to={"/entries/" + entry.id}>返回原记录</Link>
    </SimplePage>
  );

  return (
    <SimplePage title="再次听见" text="先写下此刻的判断，提交后才会看到过去的评分、情绪和正文。">
      <TrackHero entry={entry} coverUrl={coverUrl} />
      <form className="relisten-form" onSubmit={submit}>
        <RatingSlider value={rating} modifier={ratingModifier} onChange={(nextRating, nextModifier) => {
          setDirty(true);
          setRating(nextRating);
          setRatingModifier(nextModifier);
        }} label="这一次的评分" />
        <fieldset className="quick-moods">
          <legend>这一次的情绪</legend>
          <div className="quick-mood-all">{MOOD_TAGS.map((mood) => <button type="button" key={mood} className={moods.includes(mood) ? "selected" : ""} onClick={() => toggleMood(mood)}>{mood}</button>)}</div>
        </fieldset>
        <label>一句话感受<textarea rows={5} value={content} onChange={(event) => { setDirty(true); setContent(event.target.value); }} placeholder="不要看过去，现在的你听见了什么？" required /></label>
        <label>收听日期<input type="date" value={listenedOn} onChange={(event) => { setDirty(true); setListenedOn(event.target.value); }} required /></label>
        {message ? <p className="hint" role="status">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="primary-button full" disabled={saving}>{saving ? "保存中" : "保存并揭晓"}</button>
      </form>
      {pendingHref ? (
        <section className="leave-confirm" role="alertdialog" aria-modal="true" aria-label="离开未保存的重听记录">
          <strong>这次听感还没有保存</strong>
          <p>离开后当前输入会丢失。</p>
          <div className="action-row">
            <button type="button" data-codex-back className="secondary-button" onClick={() => setPendingHref(null)}>继续填写</button>
            <button type="button" className="danger-button" onClick={() => {
              const href = pendingHref;
              setDirty(false);
              setPendingHref(null);
              window.location.hash = href;
            }}>放弃并离开</button>
          </div>
        </section>
      ) : null}
    </SimplePage>
  );
}

function SimplePage({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return <section className="page relisten-page"><div className="page-heading"><span className="page-eyebrow">私人重听实验</span><h1>{title}</h1>{text ? <p>{text}</p> : null}</div>{children}</section>;
}

function TrackHero({ entry, coverUrl }: { entry: ReviewEntry; coverUrl: string | null }) {
  return (
    <section className="relisten-track">
      {coverUrl ? <img src={coverUrl} alt="" /> : <div className="quick-record-placeholder" aria-hidden="true"><span /></div>}
      <div><strong>{entry.type === "album" ? entry.albumName ?? entry.title : entry.songName ?? entry.title}</strong><span>{(entry.type === "album" ? [entry.artistName] : [entry.artistName, entry.albumName]).filter(Boolean).join(" · ") || "音乐信息未填写"}</span></div>
    </section>
  );
}

function MoodChange({ label, values }: { label: string; values: string[] }) {
  return <div><span>{label}</span><strong>{values.length ? values.join("、") : "无"}</strong></div>;
}

async function loadCover(entry: ReviewEntry) {
  return store.getEntryCover(entry);
}

function ratingText(value: number | null, modifier: RatingModifier | null) {
  return value === null ? "未评分" : String(value) + (modifier ?? "") + "/10";
}

function ratingChangeText(difference: number) {
  if (difference === 0) return "两次数值评分相同";
  return difference > 0 ? "数值评分上升 " + difference : "数值评分下降 " + Math.abs(difference);
}

function localDateInputToIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (!year || !month || !day || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("收听日期无效");
  return date.toISOString();
}

function localToday() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return String(date.getFullYear()) + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function relistenFileName(momentId: string) {
  return "xiaodongge-relisten-" + localToday().replaceAll("-", "") + "-" + momentId + ".png";
}

