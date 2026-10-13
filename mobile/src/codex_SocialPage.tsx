import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { hasPrivacyConsent } from "./codex_privacy";
import { usePrivacyStatus } from "./codex_PrivacyGate";
import { canLeavePage } from "./codex_Navigation";
import { getSocialSession, loginSocial, readSocialEndpoint, restoreSocialSession, saveSocialEndpoint, signOutSocial, SocialApiError, subscribeSocialSession, type SocialSession } from "./codex_socialClient";
import SocialFeed from "./codex_SocialFeed";
import SocialFriends from "./codex_SocialFriends";
import "./codex_social.css";

export const socialError = (error: unknown) => error instanceof Error ? error.message : "操作失败，请重试。";

export default function SocialPage() {
  const session = useSyncExternalStore(subscribeSocialSession, getSocialSession, getSocialSession);
  const privacy = usePrivacyStatus();
  const [params] = useSearchParams();
  const entryId = params.get("entry") || "";
  const [tab, setTab] = useState<"feed" | "friends" | "account">("feed");
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState("");
  const [notice, setNotice] = useState("");
  const allowed = hasPrivacyConsent();
  useEffect(() => {
    let active = true;
    if (!allowed) { setRestoring(false); return; }
    setRestoring(true);
    void restoreSocialSession().catch(error => { if (active) setRestoreError(socialError(error)); }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [privacy, allowed]);
  useEffect(() => { if (entryId) setTab("feed"); }, [entryId]);
  useEffect(() => {
    const leave = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.href === window.location.href) return;
      if (!canLeavePage()) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener("click", leave, true);
    return () => document.removeEventListener("click", leave, true);
  }, []);

  function fail(error: unknown) {
    if (error instanceof SocialApiError && error.status === 401) {
      setNotice("登录已过期，当前输入仍保留。请先复制未发送的内容，再到账号页退出并重新登录。");
    }
  }
  async function retryRestore() {
    setRestoreError(""); setRestoring(true);
    try { await restoreSocialSession(); }
    catch (error) { setRestoreError(socialError(error)); }
    finally { setRestoring(false); }
  }
  return <section className="page codex-social" aria-labelledby="codex-social-title">
    <header className="page-heading codex-social-heading">
      <div><p className="codex-social-eyebrow">与朋友交换听感</p><h1 id="codex-social-title">好友圈</h1><p>留给自己，也分享给懂你的朋友。</p></div>
      <Link className="secondary-button" to="/more">更多</Link>
    </header>
    <p className="codex-social-privacy">只有你主动发布的内容会上传。本地档案与草稿留在本机。</p>
    {notice ? <p role="status" className="codex-social-notice">{notice}</p> : null}
    {!allowed ? <section className="content-card"><h2>当前使用本地功能</h2><p>开启好友圈需要同意联网数据处理，私人档案仍可照常使用。</p><Link className="primary-button" to="/privacy">查看隐私与联网功能</Link></section>
      : restoring ? <p role="status">正在读取安全登录状态…</p>
      : session ? <>
        <div className="codex-social-identity"><span className="codex-social-avatar" aria-hidden="true">{Array.from(session.user.displayName)[0]}</span><div><strong>{session.user.displayName}</strong><small>@{session.user.username} · 好友可见</small></div></div>
        <nav className="codex-social-tabs" aria-label="好友圈页面">
          {([ ["feed", "动态"], ["friends", "朋友"], ["account", "账号"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => { if (value === tab || canLeavePage()) setTab(value); }}>{label}</button>)}
        </nav>
        {tab === "feed" ? <SocialFeed key={`${session.endpoint}:${session.user.id}`} session={session} initialEntryId={entryId} onFailure={fail} />
          : tab === "friends" ? <SocialFriends session={session} onFailure={fail} />
          : <SocialAccount session={session} onNotice={setNotice} onFailure={fail} />}
      </> : <>
        {restoreError ? <section className="content-card"><p role="alert" className="error">{restoreError}</p><div className="codex-social-actions"><button type="button" className="secondary-button" onClick={() => void retryRestore()}>重试读取登录状态</button><button type="button" className="secondary-button" onClick={() => { void signOutSocial(false).then(() => setRestoreError("")).catch(error => setRestoreError(socialError(error))); }}>清除本机登录状态</button></div></section> : null}
        {!restoreError ? <SocialAuth onLogin={() => { setNotice(""); setRestoreError(""); setTab("feed"); }} /> : null}
      </>}
  </section>;
}

function SocialAuth({ onLogin }: { onLogin: () => void }) {
  const [register, setRegister] = useState(false);
  const [endpoint, setEndpoint] = useState(readSocialEndpoint);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const address = saveSocialEndpoint(endpoint);
      await loginSocial(address, { username: username.trim(), password, ...(register ? { displayName: displayName.trim() } : {}) }, register);
      setPassword(""); onLogin();
    } catch (reason) { setError(socialError(reason)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="content-card codex-social-auth">
    <h2>{register ? "建立你的听友身份" : "和朋友在这里相遇"}</h2>
    <p>使用同一个好友圈服务，才可以邀请彼此。</p>
    <div className="codex-social-tabs" aria-label="账号操作"><button type="button" aria-pressed={!register} disabled={busy} onClick={() => { setRegister(false); setError(""); }}>登录</button><button type="button" aria-pressed={register} disabled={busy} onClick={() => { setRegister(true); setError(""); }}>注册账号</button></div>
    <form onSubmit={event => void submit(event)} className="codex-social-form">
      <fieldset disabled={busy}>
        <label>好友圈服务地址<input type="url" name="social-endpoint" value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://你的好友圈域名" required autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
        <label>用户名<input name="social-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={3} maxLength={32} pattern="[a-z0-9_]{3,32}" aria-describedby="codex-social-username-help" /></label>
        <small id="codex-social-username-help">3–32 位小写字母、数字或下划线。</small>
        {register ? <label>昵称<input name="social-display-name" value={displayName} onChange={event => setDisplayName(event.target.value)} required maxLength={40} autoComplete="nickname" /></label> : null}
        <label>密码<input type="password" name="social-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete={register ? "new-password" : "current-password"} /></label>
        <small>{register ? "至少 12 位；请使用独立密码并自行妥善保管。" : "使用注册时设置的密码。"}</small>
        <button type="submit" className="primary-button">{busy ? "正在连接…" : register ? "注册并进入好友圈" : "登录好友圈"}</button>
      </fieldset>
      {error ? <p role="alert" className="error">{error}</p> : null}
    </form>
    <p className="codex-social-note">账号和发布内容保存在你连接的服务端。{Capacitor.getPlatform() === "android" ? "本机登录凭据加密保存；密码不会保存在手机。" : "当前浏览器仅临时登录，刷新后需要重新登录。"}</p>
  </section>;
}

function SocialAccount({ session, onNotice, onFailure }: { session: SocialSession; onNotice: (value: string) => void; onFailure: (error: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  async function logout() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await signOutSocial(); onNotice("已退出好友圈。本地私人记录保留。"); }
    catch (reason) { setError(socialError(reason)); onNotice(socialError(reason)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !window.confirm("注销会永久删除此服务上的账号、动态、评论和好友关系，本地私人档案保留。确认注销？")) return;
    lock.current = true; setBusy(true); setError("");
    try { await session.api.deleteAccount(password); await signOutSocial(false); onNotice("社交账号已注销，本地私人记录保留。"); }
    catch (reason) { setError(socialError(reason)); onFailure(reason); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="content-card codex-social-account">
    <h2>我的账号</h2><dl><dt>用户名</dt><dd>@{session.user.username}</dd><dt>好友圈服务</dt><dd>{session.endpoint}</dd></dl>
    <p>动态独立保存，修改或删除本地乐评不会自动撤回已发布内容。需要撤回时，在动态中删除。</p>
    <button type="button" className="secondary-button" disabled={busy} onClick={() => void logout()}>{busy ? "正在处理…" : "退出登录"}</button>
    <details className="codex-social-delete-account"><summary>注销社交账号</summary><p>永久删除服务端账号及关联社交数据；不会删除本机私人档案。已被朋友另存或转发的副本需另外处理。</p><form className="codex-social-form" onSubmit={event => void remove(event)}><label>输入密码确认<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required disabled={busy} maxLength={128} /></label><button type="submit" className="secondary-button codex-social-danger" disabled={busy}>永久注销账号</button></form></details>
    {error ? <p className="error" role="alert">{error}</p> : null}
  </section>;
}
