import { FormEvent, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MOOD_CATEGORIES, MOOD_TAGS } from "../../shared/moods";
import { toAlbumFirstRecognition } from "./albumFirst";
import { countNewDrafts, createNewDraftId, MAX_NEW_DRAFTS, readEntryDraft, removeEntryDraft, writeEntryDraft, type EntryDraft, type EntryDraftCaptureMode } from "./entryDraft";
import { findEntryIdentityMatches, sameMusicIdentity, type MusicIdentity } from "./musicIdentity";
import { mergeMusicMetadata } from "./musicMetadata";
import { NowPlaying } from "./nativeNowPlaying";
import { readSharedMusic } from "./nativeSharedMusic";
import { applyAppleCatalogMatch, findAppleCatalogMatch, parseCatalogSearchResult, parseNowPlayingResult, type ParsedNowPlayingResult } from "./nowPlaying";
import { quickCaptureToEntryInput, recentSavedMoods } from "./quickCapture";
import RatingSlider from "./RatingSlider";
import { store } from "./store";
import type { EntryType, MusicMetadata, RatingModifier, ReviewEntry } from "./types";

export default function QuickCapturePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftId, setDraftId] = useState<string | null>(() => {
    const fromUrl = searchParams.get("draft")?.trim();
    if (fromUrl) return fromUrl;
    return countNewDrafts(localStorage) < MAX_NEW_DRAFTS ? createNewDraftId() : null;
  });
  const [title, setTitle] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("album");
  const [songName, setSongName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [content, setContent] = useState("");
  const [moods, setMoods] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [ratingModifier, setRatingModifier] = useState<RatingModifier | null>(null);
  const [listenedOn, setListenedOn] = useState(() => localToday());
  const [musicMetadata, setMusicMetadata] = useState<MusicMetadata | null>(null);
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [recentMoods, setRecentMoods] = useState<string[]>([]);
  const [matches, setMatches] = useState<ReviewEntry[]>([]);
  const [identityOpen, setIdentityOpen] = useState(!Capacitor.isNativePlatform());
  const [pendingTrack, setPendingTrack] = useState<ParsedNowPlayingResult | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const shareId = searchParams.get("share")?.trim() ?? null;
  const sharedMusic = readSharedMusic(shareId);

  useEffect(() => {
    if (!draftId) {
      setReady(true);
      return;
    }
    const result = readEntryDraft(localStorage, "create", null, draftId);
    if (result.status === "valid" && result.draft.captureMode === "full") {
      navigate("/new?draft=" + encodeURIComponent(draftId), { replace: true });
      return;
    }
    if (result.status === "valid") applyDraft(result.draft);
    if (result.status === "invalid") setError("快速草稿格式损坏，未覆盖当前输入");
    const next = new URLSearchParams(searchParams);
    if (next.get("draft") !== draftId) {
      next.set("draft", draftId);
      setSearchParams(next, { replace: true });
    }
    setReady(true);
  }, [draftId]);

  useEffect(() => {
    let active = true;
    void store.listEntries().then((items) => {
      if (!active) return;
      setEntries(items);
      setRecentMoods(recentSavedMoods(items));
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "记录读取失败");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ready && Capacitor.isNativePlatform() && !shareId) void refreshNowPlaying(false);
  }, [ready, shareId]);

  useEffect(() => {
    if (ready && Capacitor.isNativePlatform() && shareId) void refreshNowPlaying(false);
  }, [ready, shareId]);

  useEffect(() => {
    if (!ready || !draftId || !dirtyRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        writeDraft("quick");
        setMessage("快速草稿已保存");
      } catch (err) {
        setError(err instanceof Error ? err.message : "快速草稿保存失败");
      }
    }, 300);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [albumName, artistName, content, draftId, entryType, listenedOn, moods, musicMetadata, rating, ratingModifier, ready, songName, title]);

  useEffect(() => {
    if (!ready || !Capacitor.isNativePlatform()) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshNowPlaying(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, title, songName, artistName, albumName, musicMetadata]);

  function applyDraft(draft: EntryDraft) {
    setEntryType(draft.fields.type);
    setTitle(draft.fields.title);
    setSongName(draft.fields.songName);
    setArtistName(draft.fields.artistName);
    setAlbumName(draft.fields.albumName);
    setContent(draft.fields.content);
    setMoods(draft.selectedMoods);
    setRating(readRating(draft.fields.rating));
    setRatingModifier(draft.fields.ratingModifier === "+" || draft.fields.ratingModifier === "-" ? draft.fields.ratingModifier : null);
    setListenedOn(draft.fields.listenedAt || localToday());
    setMusicMetadata(draft.musicMetadata);
    dirtyRef.current = !!draft.fields.content || !!draft.fields.title || !!draft.fields.songName;
  }

  function writeDraft(captureMode: EntryDraftCaptureMode) {
    if (!draftId) throw new Error("快速草稿数量已达上限");
    const [year, month] = listenedOn.split("-");
    writeEntryDraft(localStorage, {
      version: 2,
      mode: "create",
      captureMode,
      entryId: null,
      draftId,
      baseUpdatedAt: null,
      savedAt: new Date().toISOString(),
      fields: {
        type: entryType,
        title,
        year,
        month: String(Number(month)),
        albumName,
        songName,
        artistName,
        listenedAt: listenedOn,
        tags: "",
        rating: rating === null ? "" : String(rating),
        ratingModifier: ratingModifier ?? "",
        ratingProduction: "",
        ratingSongwriting: "",
        ratingOriginality: "",
        ratingResonance: "",
        content,
      },
      genreSelection: { level1: "", level2: "", level3: "" },
      selectedGenreTags: [],
      selectedMoodGroupId: MOOD_CATEGORIES.find((group) => group.moods.some((mood) => moods.includes(mood)))?.id ?? MOOD_CATEGORIES[0].id,
      selectedMoods: moods,
      coverDataUrl: null,
      coverChanged: false,
      ocrText: "",
      recognizedFields: null,
      musicMetadata,
      compositeRatingLocked: false,
      inspiration: false,
    });
  }

  async function refreshNowPlaying(protectDirty: boolean) {
    setBusy(true);
    setError("");
    try {
      let result = parseNowPlayingResult(await NowPlaying.getCurrentTrack());
      if (!result.accessEnabled) {
        setMessage("请先授予通知使用权；仍可手动填写快速记录。");
        return;
      }
      if (!result.fields) {
        setMessage("没有读到正在播放的歌曲，仍可手动填写。");
        return;
      }
      const nextIdentity: MusicIdentity = { ...result.fields, musicMetadata: result.musicMetadata };
      const currentIdentity: MusicIdentity = { songName, artistName, albumName, musicMetadata };
      if (protectDirty && dirtyRef.current && !sameMusicIdentity(currentIdentity, nextIdentity)) {
        setPendingTrack(result);
        setMessage("当前播放已经变化，现有输入没有被覆盖。");
        return;
      }

      result = await enrichNowPlaying(result);
      applyTrack(result);
      setMessage("已读取当前播放");
    } catch (err) {
      setError(err instanceof Error ? err.message : "当前播放读取失败");
    } finally {
      setBusy(false);
    }
  }

  async function enrichNowPlaying(result: ParsedNowPlayingResult) {
    const fields = result.fields;
    const song = fields?.songName?.trim();
    const artist = fields?.artistName?.trim();
    if (!fields || !song || !artist) return result;
    try {
      const options = { title: song, artistName: artist, ...(fields.albumName ? { albumName: fields.albumName } : {}) };
      const china = parseCatalogSearchResult(await NowPlaying.searchCatalog({ ...options, country: "CN" }));
      let match = findAppleCatalogMatch(fields, china);
      if (!match) {
        const unitedStates = parseCatalogSearchResult(await NowPlaying.searchCatalog({ ...options, country: "US" }));
        match = findAppleCatalogMatch(fields, unitedStates);
      }
      if (!match) return result;
      const enriched = applyAppleCatalogMatch(fields, mergeMusicMetadata(result.musicMetadata, musicMetadata), match);
      return { ...result, fields: enriched.fields, musicMetadata: enriched.musicMetadata };
    } catch {
      return result;
    }
  }

  function applyTrack(result: ParsedNowPlayingResult, preferredType: EntryType = entryType) {
    if (!result.fields) return;
    const mergedMetadata = mergeMusicMetadata(result.musicMetadata, musicMetadata);
    const recognized = preferredType === "song"
      ? { fields: result.fields, musicMetadata: mergedMetadata }
      : toAlbumFirstRecognition(result.fields, mergedMetadata);
    setEntryType(recognized.fields.type ?? "song");
    setTitle(recognized.fields.title?.trim() ?? "");
    setSongName(recognized.fields.songName?.trim() ?? "");
    setArtistName(recognized.fields.artistName?.trim() ?? "");
    setAlbumName(recognized.fields.albumName?.trim() ?? "");
    setMusicMetadata(recognized.musicMetadata);
    setIdentityOpen(!recognized.fields.albumName);
    setPendingTrack(null);
  }

  function edit(setter: (value: string) => void, value: string) {
    dirtyRef.current = true;
    setter(value);
  }

  function toggleMood(mood: string) {
    dirtyRef.current = true;
    setMoods((current) => current.includes(mood) ? current.filter((item) => item !== mood) : [...current, mood]);
  }

  async function switchToPendingTrack() {
    if (!pendingTrack || !draftId) return;
    try {
      writeDraft("quick");
      if (countNewDrafts(localStorage) >= MAX_NEW_DRAFTS) throw new Error("新建草稿已达上限，请先清理草稿箱");
      const nextDraftId = createNewDraftId();
      setDraftId(nextDraftId);
      setSearchParams({ draft: nextDraftId }, { replace: true });
      clearForm();
      applyTrack(await enrichNowPlaying(pendingTrack), "album");
      dirtyRef.current = false;
      setMessage("原草稿已保存，已切换到新的当前播放");
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换歌曲失败");
    }
  }

  function clearForm() {
    setEntryType("album");
    setTitle("");
    setSongName("");
    setArtistName("");
    setAlbumName("");
    setContent("");
    setMoods([]);
    setRating(null);
    setRatingModifier(null);
    setListenedOn(localToday());
    setMusicMetadata(null);
    setMatches([]);
  }

  async function saveQuickRecord(forceNew = false) {
    setBusy(true);
    setError("");
    try {
      const input = quickCaptureToEntryInput({ type: entryType, title, songName, artistName, albumName, musicMetadata, content, moods, rating, ratingModifier, listenedOn });
      const existing = findEntryIdentityMatches(entries, input);
      if (!forceNew && existing.length) {
        setMatches(existing);
        setMessage(existing.length === 1 ? "已经有这个专辑或歌曲档案，可以追加听感或新建另一篇。" : "找到多条相同音乐档案，请选择要追加的记录。");
        return;
      }
      const saved = await store.createEntry(input);
      let draftCleanupFailed = false;
      if (draftId) {
        try {
          removeEntryDraft(localStorage, "create", null, draftId);
        } catch {
          draftCleanupFailed = true;
        }
      }
      navigate("/entries/" + saved.id + "?card=quick" + (draftCleanupFailed ? "&draftCleanup=failed" : ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "快速记录保存失败");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void saveQuickRecord();
  }

  function expandFull() {
    try {
      writeDraft("full");
      navigate("/new?draft=" + encodeURIComponent(draftId as string));
    } catch (err) {
      setError(err instanceof Error ? err.message : "草稿转换失败");
    }
  }

  if (!draftId) return (
    <section className="page">
      <div className="page-heading"><h1>快速记下</h1><p>新建草稿已达上限，请先清理草稿箱。</p></div>
      <Link className="primary-button full" to="/drafts">打开草稿箱</Link>
    </section>
  );

  const artwork = musicMetadata?.artworkUri ?? null;
  return (
    <section className="page quick-capture-page">
      <div className="page-heading">
        <span className="page-eyebrow">60 秒听感</span>
        <h1>快速记下</h1>
        <p>先留下真实的一句话，之后随时展开成完整乐评。</p>
      </div>

      <section className="quick-track-card">
        {artwork ? <img src={artwork} alt="" /> : <div className="quick-record-placeholder" aria-hidden="true"><span /></div>}
        <div>
          <strong>{albumName || title || "还没有专辑信息"}</strong>
          <span>{[artistName, musicMetadata?.displayTitle || songName].filter(Boolean).join(" · ") || "读取当前播放，或手动填写"}</span>
        </div>
        {Capacitor.isNativePlatform() ? <button type="button" className="secondary-button" onClick={() => refreshNowPlaying(false)} disabled={busy}>{busy ? "读取中" : "读取当前播放"}</button> : null}
      </section>

      {pendingTrack ? (
        <section className="track-change-note">
          <strong>当前播放已经变化</strong>
          <p>现有输入没有被覆盖。可以继续当前记录，或保存草稿后切换。</p>
          <div className="action-row">
            <button type="button" className="secondary-button" onClick={() => setPendingTrack(null)}>继续当前记录</button>
            <button type="button" className="primary-button" onClick={switchToPendingTrack}>保存并切换</button>
          </div>
        </section>
      ) : null}

      {sharedMusic ? (
        <section className="shared-music-card" aria-label="Android 分享内容">
          <strong>{sharedMusic.subject || "从其他应用分享"}</strong>
          <p>{sharedMusic.text}</p>
          <small>分享文字仅作为核对线索；专辑、歌曲和歌手仍以当前媒体会话与目录补全为准。</small>
        </section>
      ) : null}

      <form className="quick-capture-form" onSubmit={submit}>
        <label>一句话感受<textarea rows={5} value={content} onChange={(event) => edit(setContent, event.target.value)} placeholder="这一次，哪里最打动你？" required /></label>
        <label>收听日期<input type="date" value={listenedOn} onChange={(event) => edit(setListenedOn, event.target.value)} required /></label>
        {message ? <p className="hint" role="status">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="primary-button full" type="submit" disabled={busy}>{busy ? "保存中" : `保存${entryType === "album" ? "专辑" : "歌曲"}听感`}</button>
        <button className="secondary-button full" type="button" disabled={busy || !ready} onClick={() => {
          try {
            writeDraft("quick");
            navigate("/drafts");
          } catch (err) { setError(err instanceof Error ? err.message : "草稿保存失败"); }
        }}>保存草稿</button>

        <details className="quick-extras">
          <summary>补充评分、情绪和音乐信息</summary>
          <RatingSlider value={rating} modifier={ratingModifier} onChange={(nextRating, nextModifier) => {
            dirtyRef.current = true;
            setRating(nextRating);
            setRatingModifier(nextModifier);
          }} label="此刻评分" />

          <fieldset className="quick-moods">
            <legend>此刻情绪</legend>
            {recentMoods.length ? <div className="quick-mood-group"><span>最近使用</span><div>{recentMoods.map((mood) => <button type="button" key={mood} className={moods.includes(mood) ? "selected" : ""} onClick={() => toggleMood(mood)}>{mood}</button>)}</div></div> : null}
            <details>
              <summary>全部情绪</summary>
              <div className="quick-mood-all">{MOOD_TAGS.map((mood) => <button type="button" key={mood} className={moods.includes(mood) ? "selected" : ""} onClick={() => toggleMood(mood)}>{mood}</button>)}</div>
            </details>
          </fieldset>

          <details className="quick-identity-fields" open={identityOpen} onToggle={(event) => setIdentityOpen(event.currentTarget.open)}>
            <summary>音乐信息</summary>
            <label>记录类型<select value={entryType} onChange={(event) => { dirtyRef.current = true; setEntryType(event.target.value as EntryType); }}><option value="album">专辑</option><option value="song">歌曲</option></select></label>
            <label>标题<input value={title} onChange={(event) => edit(setTitle, event.target.value)} /></label>
            <label>歌曲<input value={songName} onChange={(event) => edit(setSongName, event.target.value)} /></label>
            <div className="form-grid">
              <label>歌手<input value={artistName} onChange={(event) => edit(setArtistName, event.target.value)} /></label>
              <label>专辑<input value={albumName} onChange={(event) => edit(setAlbumName, event.target.value)} /></label>
            </div>
          </details>
        </details>
        <button className="secondary-button full" type="button" onClick={expandFull}>展开完整乐评</button>
      </form>

      {matches.length ? (
        <section className="quick-match-sheet">
          <h2>已有相同音乐档案</h2>
          <p>追加听感会保留第一次记录，也能在以后看见评分和情绪变化。</p>
          <div className="card-list">
            {matches.map((entry) => <Link key={entry.id} className="entry-card" to={"/relisten/" + entry.id}><h3>{entry.title}</h3><p>{entry.year} · {entry.rating === null ? "未评分" : entry.rating + "/10"}</p></Link>)}
          </div>
          <button type="button" className="secondary-button full" onClick={() => void saveQuickRecord(true)}>仍然新建另一篇听感</button>
        </section>
      ) : null}
    </section>
  );
}

function readRating(value: string) {
  const rating = Number(value);
  return value && Number.isFinite(rating) && rating >= 0.5 && rating <= 10 ? rating : null;
}

function localToday() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return String(date.getFullYear()) + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}
