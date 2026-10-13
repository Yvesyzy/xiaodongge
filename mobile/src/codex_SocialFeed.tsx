import { useEffect, useRef, useState, type FormEvent } from "react";
import { store } from "./store";
import { ENTRY_TYPE_LABELS, type ReviewEntry } from "./types";
import { useBackGuard } from "./codex_Navigation";
import { copyText, shareText } from "./nativeExport";
import { reviewSnapshot, type ReviewSnapshot, type SocialComment, type SocialPost } from "./codex_socialModel";
import type { SocialSession } from "./codex_socialClient";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "操作失败，请重试。";
type Props = { session: SocialSession; onFailure: (error: unknown) => void };
export default function SocialFeed({ session, initialEntryId, onFailure }: Props & { initialEntryId: string }) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState(Boolean(initialEntryId));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const active = useRef(true);
  async function refresh(append = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await session.api.feed(append ? cursor : null);
      if (!active.current) return;
      setPosts(current => append ? [...current, ...result.posts.filter(post => !current.some(item => item.id === post.id))] : result.posts);
      setCursor(result.nextCursor); setLoaded(true);
    } catch (reason) { if (active.current) { setError(errorMessage(reason)); onFailure(reason); } }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  useEffect(() => { active.current = true; void refresh(); return () => { active.current = false; }; }, [session]);
  useEffect(() => { if (initialEntryId) setCompose(true); }, [initialEntryId]);
  return <div className="codex-social-stack">
    <div className="codex-social-feed-toolbar"><div><h2>朋友的近况</h2><p>听到好音乐，总想和你说说。</p></div><div className="codex-social-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void refresh()}>刷新动态</button><button type="button" className="primary-button" disabled={compose} onClick={() => { setCompose(true); setNotice(""); }}>写动态</button></div></div>
    {compose ? <SocialComposer session={session} initialEntryId={initialEntryId} onFailure={onFailure} onClose={() => setCompose(false)} onPublished={post => { setPosts(current => [post, ...current.filter(item => item.id !== post.id)]); setLoaded(true); setCompose(false); setNotice("已发布到好友圈，仅你和当前好友可见。"); }} /> : null}
    {notice ? <p role="status" className="codex-social-notice">{notice}</p> : null}
    {error ? <p role="alert" className="error">{error}</p> : null}
    {!loaded ? <p role="status">{busy ? "正在读取听友动态…" : "暂时未能加载动态，可点击刷新重试。"}</p> : !posts.length ? <section className="content-card codex-social-empty"><span aria-hidden="true">♪</span><h3>听感，从第一次分享开始</h3><p>写一段近况，或在“朋友”中邀请听友。你的私人档案不会自动出现在这里。</p></section> : <div className="codex-social-posts">{posts.map(post => <PostCard key={post.id} post={post} session={session} onFailure={onFailure} onChanged={updated => setPosts(current => current.map(item => item.id === updated.id ? updated : item))} onDeleted={() => setPosts(current => current.filter(item => item.id !== post.id))} />)}</div>}
    {cursor ? <button type="button" className="secondary-button" disabled={busy} onClick={() => void refresh(true)}>{busy ? "正在读取…" : "加载更多动态"}</button> : null}
  </div>;
}

function SocialComposer({ session, initialEntryId, onFailure, onClose, onPublished }: Props & { initialEntryId: string; onClose: () => void; onPublished: (post: SocialPost) => void }) {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [entryId, setEntryId] = useState(initialEntryId);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [includeRating, setIncludeRating] = useState(false);
  const [includeDate, setIncludeDate] = useState(false);
  const [includeCover, setIncludeCover] = useState(false);
  const [cover, setCover] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const attempt = useRef<{ signature: string; clientId: string } | null>(null);
  const active = useRef(true);
  const dirty = Boolean(text.trim() || entryId);
  const entry = entries.find(item => item.id === entryId);
  const snapshot = entry ? reviewSnapshot(entry, { rating: includeRating, date: includeDate, cover: includeCover ? cover : null }) : null;
  useBackGuard(() => !busy && (!dirty || window.confirm("这段动态还没有发布，确认放弃并离开？")));
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, busy]);
  useEffect(() => {
    active.current = true;
    let valid = true;
    void store.listEntries().then(result => {
      if (!valid) return;
      setEntries(result);
      const selected = result.find(item => item.id === initialEntryId);
      if (selected) setText(selected.content);
      else if (initialEntryId) { setEntryId(""); setError("这篇本地乐评已不存在，可以直接写一段动态。"); }
    }).catch(reason => { if (valid) setError(`本地乐评读取失败：${errorMessage(reason)}。仍可直接写动态。`); }).finally(() => { if (valid) setReady(true); });
    return () => { valid = false; active.current = false; };
  }, [initialEntryId]);
  useEffect(() => {
    let valid = true;
    setCover(null);
    if (!entry || !includeCover) { setCoverBusy(false); return; }
    setCoverBusy(true);
    void store.getEntryCover(entry).then(async value => {
      if (!value || !/^data:image\/(png|jpeg|webp);base64,/.test(value)) throw new Error("这篇乐评还没有可分享的本地封面，可取消封面选项后发布。");
      const image = await compactCover(value);
      if (valid) setCover(image);
    }).catch(reason => { if (valid) setError(errorMessage(reason)); }).finally(() => { if (valid) setCoverBusy(false); });
    return () => { valid = false; };
  }, [entry, includeCover]);
  function select(value: string) {
    const selected = entries.find(item => item.id === value);
    if (selected && text.trim() && text !== entry?.content && !window.confirm("选择这篇乐评会替换当前动态正文，确认继续？")) return;
    setEntryId(value); setError("");
    if (selected) setText(selected.content);
    setIncludeCover(false);
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !text.trim() || coverBusy || includeCover && !cover) return;
    lock.current = true; setBusy(true); setError("");
    const content = text.trim();
    const signature = JSON.stringify({ text: content, review: snapshot });
    if (!attempt.current || attempt.current.signature !== signature) attempt.current = { signature, clientId: crypto.randomUUID() };
    try { const post = await session.api.publish(attempt.current.clientId, content, snapshot); if (active.current) onPublished(post); }
    catch (reason) { if (active.current) { setError(errorMessage(reason)); onFailure(reason); } }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  return <section className="content-card codex-social-composer" aria-labelledby="codex-social-compose-title"><div className="codex-social-section-title"><h2 id="codex-social-compose-title">写给朋友</h2><button type="button" className="secondary-button" disabled={busy} onClick={() => { if (!dirty || window.confirm("动态尚未发布，确认放弃这次输入？")) onClose(); }}>取消发布</button></div>
    <form className="codex-social-form" onSubmit={event => void publish(event)}><fieldset disabled={busy || !ready}>
      <label>关联本地乐评<select value={entryId} onChange={event => select(event.target.value)}><option value="">不关联，直接写动态</option>{entries.map(item => <option key={item.id} value={item.id}>{ENTRY_TYPE_LABELS[item.type]} · {item.title}</option>)}</select></label>
      <label>动态正文<textarea name="social-post-text" rows={6} maxLength={20000} value={text} onChange={event => setText(event.target.value)} required placeholder="今天听了什么？有什么想和朋友说的？" /></label>
      <small>{text.length.toLocaleString("zh-CN")} / 20,000 字符。发布前可以删改；本地原文保持完整。</small>
      {entry ? <div className="codex-social-options"><label><input type="checkbox" checked={includeRating} onChange={event => setIncludeRating(event.target.checked)} />分享评分</label><label><input type="checkbox" checked={includeDate} onChange={event => setIncludeDate(event.target.checked)} />分享听歌日期</label>{entry.type === "album" || entry.type === "song" ? <label><input type="checkbox" checked={includeCover} onChange={event => { setIncludeCover(event.target.checked); setError(""); }} />分享本地封面</label> : null}</div> : null}
      <div className="codex-social-publish-preview" aria-label="即将发布的内容"><small>发布预览 · 好友可见</small>{snapshot ? <ReviewSummary review={snapshot} /> : null}<p>{text || "正文会显示在这里"}</p></div>
      {coverBusy ? <p role="status">正在准备封面…</p> : null}
      <button className="primary-button" type="submit" disabled={!text.trim() || coverBusy || includeCover && !cover}>{busy ? "正在发布…" : "发布到好友圈"}</button>
      <button className="secondary-button" type="button" disabled={!text} onClick={() => { void copyText(text).catch(reason => setError(errorMessage(reason))); }}>复制未发布正文</button>
    </fieldset></form>
    {!ready ? <p role="status">正在读取本地乐评…</p> : null}{error ? <p role="alert" className="error">{error}</p> : null}
  </section>;
}

function ReviewSummary({ review }: { review: ReviewSnapshot }) {
  return <div className="codex-social-review">{review.coverDataUrl ? <img src={review.coverDataUrl} alt={`${review.title}封面`} width={76} height={76} loading="lazy" /> : <span className="codex-social-cover-placeholder" aria-hidden="true">♫</span>}<div><small>{ENTRY_TYPE_LABELS[review.type]}</small><strong>{review.title}</strong><span>{[review.albumName, review.songName, review.artistName].filter(Boolean).join(" / ")}</span>{review.rating !== null ? <span>评分 {review.rating.toFixed(1)}</span> : null}{review.listenedAt ? <span>{new Date(review.listenedAt).toLocaleDateString("zh-CN")}</span> : null}</div></div>;
}

function PostCard({ post, session, onFailure, onChanged, onDeleted }: Props & { post: SocialPost; onChanged: (post: SocialPost) => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsOpened, setCommentsOpened] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function action(run: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await run(); }
    catch (reason) { if (active.current) { setError(errorMessage(reason)); onFailure(reason); } }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  const short = !expanded && post.text.length > 600;
  const sharingText = [`${post.author.displayName} · 小懂哥听感`, post.review?.title, post.review ? [post.review.albumName, post.review.songName, post.review.artistName].filter(Boolean).join(" / ") : "", post.review?.rating != null ? `评分：${post.review.rating.toFixed(1)}` : "", post.review?.listenedAt ? `听歌日期：${new Date(post.review.listenedAt).toLocaleDateString("zh-CN")}` : "", "", post.text].filter(value => value !== null && value !== undefined).join("\n");
  return <article className="content-card codex-social-post" aria-label={`${post.author.displayName}的动态`}>
    <header><span className="codex-social-avatar" aria-hidden="true">{Array.from(post.author.displayName)[0]}</span><div><strong>{post.author.displayName}</strong><small>@{post.author.username} · <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString("zh-CN")}</time></small></div><span className="codex-social-visibility">好友可见</span></header>
    <p className="codex-social-post-text">{short ? `${post.text.slice(0, 600)}…` : post.text}</p>{post.text.length > 600 ? <button type="button" className="codex-social-text-button" onClick={() => setExpanded(!expanded)}>{expanded ? "收起正文" : "展开全文"}</button> : null}
    {post.review ? <ReviewSummary review={post.review} /> : null}
    <div className="codex-social-post-actions">
      <button type="button" aria-pressed={post.likedByMe} disabled={busy} onClick={() => void action(async () => { await session.api.like(post.id, !post.likedByMe); const value = await session.api.post(post.id); if (active.current) onChanged(value); })}>{post.likedByMe ? "已赞" : "点赞"} {post.likeCount || ""}</button>
      <button type="button" aria-expanded={showComments} onClick={() => { setCommentsOpened(true); setShowComments(!showComments); }}>评论 {post.commentCount || ""}</button>
      <button type="button" disabled={busy} onClick={() => void action(async () => { const result = await shareText(sharingText, post.review?.title || "小懂哥听友动态"); if (active.current) setNotice(result === "cancelled" ? "已取消分享。" : result === "opened" ? "已打开系统分享，请选择接收方。分享后的副本由接收方保存。" : "分享文字已复制，可粘贴发送。分享后的副本由接收方保存。"); })}>分享文字</button>
      {post.author.id === session.user.id ? <button type="button" className="codex-social-danger" disabled={busy} onClick={() => { if (window.confirm("删除这条已发布动态及其互动？本地私人乐评保留。")) void action(async () => { await session.api.deletePost(post.id); if (active.current) onDeleted(); }); }}>删除动态</button> : null}
    </div>
    {commentsOpened ? <div hidden={!showComments}><Comments post={post} session={session} onFailure={onFailure} onChanged={onChanged} /></div> : null}
    {notice ? <p role="status">{notice}</p> : null}{error ? <p role="alert" className="error">{error}</p> : null}
  </article>;
}

function Comments({ post, session, onFailure, onChanged }: Props & { post: SocialPost; onChanged: (post: SocialPost) => void }) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const active = useRef(true);
  const attempt = useRef<{ text: string; clientId: string } | null>(null);
  useBackGuard(() => !busy && (!text.trim() || window.confirm("评论尚未发送，确认放弃并离开？")));
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (text.trim() || busy) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [text, busy]);
  async function action(run: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await run(); }
    catch (reason) { if (active.current) { setError(errorMessage(reason)); onFailure(reason); } }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  async function load(append = false) {
    const value = await session.api.comments(post.id, append ? cursor : null);
    if (!active.current) return;
    setComments(current => append ? [...current, ...value.comments.filter(comment => !current.some(item => item.id === comment.id))] : value.comments);
    setCursor(value.nextCursor); setReady(true);
  }
  useEffect(() => { active.current = true; void action(() => load()); return () => { active.current = false; }; }, [post.id, session]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const content = text.trim();
    if (!content) return;
    if (!attempt.current || attempt.current.text !== content) attempt.current = { text: content, clientId: crypto.randomUUID() };
    const clientId = attempt.current.clientId;
    void action(async () => {
      await session.api.comment(post.id, clientId, content);
      if (!active.current) return;
      setText(""); attempt.current = null;
      await load();
      const updated = await session.api.post(post.id); if (active.current) onChanged(updated);
    });
  }
  return <section className="codex-social-comments" aria-label="动态评论">{!ready ? <p role="status">{busy ? "正在读取评论…" : "评论未能加载，请重试。"}</p> : !comments.length ? <p>还没有评论，和朋友说说你的感受。</p> : <ul>{comments.map(comment => <li key={comment.id}><div><strong>{comment.author.displayName}</strong><small>{new Date(comment.createdAt).toLocaleString("zh-CN")}</small></div><p>{comment.text}</p>{comment.author.id === session.user.id || post.author.id === session.user.id ? <button type="button" className="codex-social-text-button codex-social-danger" disabled={busy} onClick={() => { if (window.confirm("删除这条评论？")) void action(async () => { await session.api.deleteComment(comment.id); await load(); const updated = await session.api.post(post.id); if (active.current) onChanged(updated); }); }}>删除评论</button> : null}</li>)}</ul>}
    <div className="codex-social-actions"><button type="button" className="codex-social-text-button" disabled={busy} onClick={() => void action(() => load())}>刷新评论</button>{cursor ? <button type="button" className="codex-social-text-button" disabled={busy} onClick={() => void action(() => load(true))}>加载更多评论</button> : null}</div>
    <form className="codex-social-form" onSubmit={submit}><label>写评论<textarea rows={2} value={text} onChange={event => setText(event.target.value)} name="social-comment-text" maxLength={2000} required disabled={busy} /></label><div className="codex-social-actions"><button type="submit" className="primary-button" disabled={busy || !text.trim()}>{busy ? "正在处理…" : "发送评论"}</button><button type="button" className="secondary-button" disabled={busy || !text} onClick={() => { void copyText(text).catch(reason => setError(errorMessage(reason))); }}>复制未发送评论</button></div></form>{error ? <p role="alert" className="error">{error}</p> : null}
  </section>;
}

async function compactCover(value: string): Promise<string> {
  if (value.length > 12 * 1024 * 1024) throw new Error("本地封面过大，请更换较小图片或取消分享封面。");
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("本地封面读取失败，可取消封面后发布。")); image.src = value; });
  const size = Math.max(image.naturalWidth, image.naturalHeight);
  if (!size || size > 16384) throw new Error("封面尺寸无效或过大。");
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 640 / size);
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前设备无法准备封面，可取消封面后发布。");
  context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const result = canvas.toDataURL("image/jpeg", 0.78);
  if (!result.startsWith("data:image/jpeg;base64,") || result.length > 349550) throw new Error("封面压缩后仍过大，可取消封面后发布。");
  return result;
}
