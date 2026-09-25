import { lazy, Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { getRestoreState, subscribeRestoreState } from "./codex_restoreState";
import { store } from "./store";

let startup: Promise<void> | undefined;
const DiagnosticsPage = lazy(() => import("./codex_DiagnosticsPage"));
export default function StorageGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const state = useSyncExternalStore(subscribeRestoreState, getRestoreState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState("");
  useEffect(() => {
    let active = true;
    startup ??= store.recoverPendingRestore();
    void startup.then(() => { if (active) setReady(true); }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, []);
  async function retry() {
    setError("");
    try { await store.recoverPendingRestore(); setReady(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "恢复失败"); }
  }
  async function rescue() {
    try { setEvidence(await store.getRecoveryEvidence()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "原文读取失败"); }
  }
  const blocked = state.busy || !!state.error || !!error || !ready;
  return <>
    {blocked && location.pathname === "/diagnostics" ? <Suspense fallback={<p role="status">正在打开诊断页…</p>}><DiagnosticsPage /></Suspense> : null}
    {blocked && location.pathname !== "/diagnostics" ? <section className="page form-card" role="status">
      <h1>{state.busy || (!ready && !error && !state.error) ? "正在检查和恢复档案…" : "档案恢复尚未完成"}</h1>
      <p>保存已暂停，恢复完成后继续使用。</p>
      {state.error || error ? <p role="alert">{state.error || error}</p> : null}
      <button type="button" disabled={state.busy} onClick={() => void retry()}>重试恢复</button>
      <button type="button" disabled={state.busy} onClick={() => void rescue()}>查看抢救原文</button>
      <Link to="/diagnostics">查看本机诊断</Link>
      {evidence ? <textarea aria-label="恢复抢救原文" readOnly rows={12} value={evidence} /> : null}
    </section> : null}
    {ready && !blocked ? <div key={state.generation}>{children}</div> : null}
  </>;
}
