import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { assertStorageWritable } from "./codex_restoreState";
import { canLeavePage } from "./codex_Navigation";
import { getPrivacyStatus, initializePrivacy, setPrivacyConsent, subscribePrivacy } from "./codex_privacy";
import policy from "./codex_privacy_policy.json";

export function usePrivacyStatus() {
  return useSyncExternalStore(subscribePrivacy, getPrivacyStatus, getPrivacyStatus);
}

function PolicyContent() {
  return <article className="content-card privacy-copy codex-privacy-policy">
    <h2>{policy.title}</h2>
    <p>生效及更新日期：{policy.version}　运营主体：{policy.publisherType}</p>
    <p>隐私咨询：<a href={`mailto:${policy.contactEmail}`}>{policy.contactEmail}</a></p>
    {policy.sections.map(section => <section key={section.title}>
      <h3>{section.title}</h3><p>{section.text}</p>
      {section.links?.length ? <ul>{section.links.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>)}</ul> : null}
    </section>)}
  </article>;
}

export function AndroidPrivacySettings({ firstLaunch = false }: { firstLaunch?: boolean }) {
  const status = usePrivacyStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function choose(accepted: boolean) {
    if (busy) return;
    setError("");
    try {
      if (!accepted && status === "accepted") {
        assertStorageWritable();
        if (!canLeavePage()) throw new Error("请先保存当前输入，再撤回同意。");
        if (!window.confirm("撤回后会关闭小懂哥以停止增强功能和SDK。现有本地记录保留，再次打开后可手动记录。确认撤回并退出？")) return;
      }
      setBusy(true);
      await setPrivacyConsent(accepted);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "隐私选择保存失败，请重试。");
    } finally { setBusy(false); }
  }
  return <>
    <section className="content-card codex-privacy-choice" aria-label="隐私选择">
      <h2>{firstLaunch ? "先了解数据如何使用" : "增强功能的数据处理"}</h2>
      <p>手动写下听感，数据保存在本机。增强功能包括当前播放读取、Apple音乐目录补全、截图识别、联网天气和远程封面。</p>
      <p>截图在本机识别；ML Kit还会处理并向Google发送诊断指标。Apple、Google和天气服务可能涉及境外处理，详见下方完整政策。</p>
      <p>选择仅使用本地功能，仍可保存、查看、分析、导出和删除记录；之后可在这里重新选择。</p>
      <p role="status">{status === "accepted" ? "当前：已同意增强功能的数据处理" : status === "declined" ? "当前：仅使用本地功能" : "请选择是否开启增强功能"}</p>
      <div className="codex-privacy-actions">
        {status !== "accepted" ? <button type="button" className="primary-button" disabled={busy} onClick={() => void choose(true)}>同意并开启增强功能</button> : null}
        <button type="button" className="secondary-button" disabled={busy || status === "declined"} onClick={() => void choose(false)}>{status === "accepted" ? "撤回同意并退出" : "仅使用本地功能"}</button>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </section>
    <PolicyContent />
  </>;
}

export default function PrivacyGate({ children }: { children: ReactNode }) {
  const android = Capacitor.getPlatform() === "android";
  const status = usePrivacyStatus();
  const [ready, setReady] = useState(!android);
  const [error, setError] = useState("");
  async function load() {
    setError("");
    try { await initializePrivacy(); setReady(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "隐私选择读取失败，请重试。"); }
  }
  useEffect(() => { if (android) void load(); }, [android]);
  if (!android) return children;
  if (!ready) return <section className="page codex-privacy-screen">
    <h1>小懂哥</h1><p role="status">{error || "正在读取本机隐私选择…"}</p>
    {error ? <button type="button" onClick={() => void load()}>重试读取隐私选择</button> : null}
  </section>;
  if (status === "pending") return <section className="page codex-privacy-screen" aria-labelledby="codex-privacy-heading">
    <div className="page-heading"><h1 id="codex-privacy-heading">欢迎使用小懂哥</h1><p>先决定如何使用增强功能，之后随时可以调整。</p></div>
    <AndroidPrivacySettings firstLaunch />
  </section>;
  return children;
}
