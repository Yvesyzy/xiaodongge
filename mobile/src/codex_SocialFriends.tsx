import { useEffect, useRef, useState, type FormEvent } from "react";
import { copyText, shareText } from "./nativeExport";
import type { SocialSession } from "./codex_socialClient";
import type { Friends } from "./codex_socialModel";

const message = (error: unknown) => error instanceof Error ? error.message : "操作失败，请重试。";
export default function SocialFriends({ session, onFailure }: { session: SocialSession; onFailure: (error: unknown) => void }) {
  const [data, setData] = useState<Friends | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [code, setCode] = useState("");
  async function refresh() { const value = await session.api.friends(); if (active.current) setData(value); }
  async function action(run: () => Promise<void>, success = "", reload = true) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await run(); if (active.current) { if (success) setNotice(success); if (reload) await refresh(); } }
    catch (reason) { if (active.current) { setError(message(reason)); onFailure(reason); } }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  useEffect(() => {
    active.current = true;
    void action(refresh, "", false);
    return () => { active.current = false; };
  }, [session]);
  const invitation = invite ? `来小懂哥和我交换听感吧。\n好友圈服务：${session.endpoint}\n邀请码：${invite.code}\n在“好友圈 → 朋友”填写邀请码；申请需要我确认。` : "";
  function sendRequest(event: FormEvent) {
    event.preventDefault();
    void action(async () => { await session.api.requestFriend(code.trim()); if (active.current) setCode(""); }, "好友申请已发送，等待对方确认。");
  }
  return <div className="codex-social-stack">
    <section className="content-card">
      <div className="codex-social-section-title"><h2>邀请一位听友</h2><button type="button" className="secondary-button" disabled={busy} onClick={() => void action(async () => { const next = await session.api.invite(); if (active.current) setInvite(next); }, "", false)}>生成邀请码</button></div>
      <p>把邀请码发给朋友，对方申请后由你确认。每个邀请码只能使用一次。</p>
      {invite ? <div className="codex-social-invitation"><code>{invite.code}</code><small>有效至 {new Date(invite.expiresAt).toLocaleString("zh-CN")}</small><div className="codex-social-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void action(async () => { await copyText(invitation); }, "邀请文字已复制。", false)}>复制邀请</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void action(async () => { const result = await shareText(invitation, "小懂哥听友邀请"); if (active.current) setNotice(result === "cancelled" ? "已取消分享。" : result === "opened" ? "已打开系统分享，请选择接收方。" : "邀请文字已复制，可粘贴给朋友。"); }, "", false)}>分享邀请</button>
      </div></div> : null}
      <form className="codex-social-form" onSubmit={sendRequest}><label>朋友的邀请码<input value={code} onChange={event => setCode(event.target.value)} name="social-invite-code" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={128} disabled={busy} placeholder="只粘贴邀请码" /></label><button type="submit" className="primary-button" disabled={busy || !code.trim()}>发送好友申请</button></form>
    </section>
    <section className="content-card"><div className="codex-social-section-title"><h2>好友申请</h2><button type="button" className="secondary-button" disabled={busy} onClick={() => void action(refresh, "", false)}>刷新朋友</button></div>
      {!data ? <p role="status">{busy ? "正在读取朋友列表…" : "朋友列表尚未加载，可重试刷新。"}</p> : !data.incoming.length && !data.outgoing.length ? <p className="codex-social-empty">暂时没有待处理的申请。</p> : <ul className="codex-social-people">
        {data.incoming.map(request => <li key={request.id}><div><strong>{request.from.displayName}</strong><small>@{request.from.username} 想和你成为听友</small></div><div className="codex-social-actions"><button className="primary-button" type="button" disabled={busy} onClick={() => void action(() => session.api.acceptFriend(request.id), "已成为好友，刷新动态即可互相查看听感。")}>接受申请</button><button className="secondary-button" type="button" disabled={busy} onClick={() => void action(() => session.api.cancelFriend(request.id), "已拒绝申请。")}>拒绝</button></div></li>)}
        {data.outgoing.map(request => <li key={request.id}><div><strong>{request.to.displayName}</strong><small>等待 @{request.to.username} 确认</small></div><button className="secondary-button" type="button" disabled={busy} onClick={() => void action(() => session.api.cancelFriend(request.id), "已取消申请。")}>取消申请</button></li>)}
      </ul>}
    </section>
    <section className="content-card"><h2>我的听友{data ? ` · ${data.friends.length}` : ""}</h2>{data?.friends.length ? <ul className="codex-social-people">{data.friends.map(friend => <li key={friend.id}><div><strong>{friend.displayName}</strong><small>@{friend.username}</small></div><button className="secondary-button codex-social-danger" type="button" disabled={busy} onClick={() => { if (window.confirm(`解除与 ${friend.displayName} 的好友关系？解除后不能继续互相查看动态。`)) void action(() => session.api.removeFriend(friend.id), "已解除好友关系。双方不再能查看彼此动态。"); }}>解除好友</button></li>)}</ul> : <p className="codex-social-empty">朋友不必很多，先邀请一位懂你音乐的人。</p>}</section>
    {notice ? <p role="status" className="codex-social-notice">{notice}</p> : null}{error ? <p role="alert" className="error">{error}</p> : null}
  </div>;
}
