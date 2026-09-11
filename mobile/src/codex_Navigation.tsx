import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

const BACK_EVENT = "codex:request-back";
const guards: Array<() => boolean> = [];
const NativeNavigation = registerPlugin<{
  addListener(event: "backRequested", listener: () => void): Promise<PluginListenerHandle>;
  exitApp(): Promise<void>;
}>("CodexNavigation");

export function requestBack(backTo?: string) {
  window.dispatchEvent(new CustomEvent(BACK_EVENT, { detail: backTo }));
}

export function useBackGuard(check: () => boolean) {
  const current = useRef(check);
  useLayoutEffect(() => { current.current = check; });
  useEffect(() => {
    const guard = () => current.current();
    guards.push(guard);
    return () => { const index = guards.indexOf(guard); if (index >= 0) guards.splice(index, 1); };
  }, []);
}

function routeIdentity(pathname: string, search: string) {
  const query = new URLSearchParams(search);
  for (const key of ["share", "saved", "card", "draftCleanup"]) query.delete(key);
  return pathname + (query.size ? `?${query}` : "");
}

function parentRoute(pathname: string, search: string) {
  if (pathname.startsWith("/albums/")) return "/albums";
  if (pathname.startsWith("/songs/")) return "/songs";
  if (pathname === "/summary") {
    const query = new URLSearchParams(search);
    query.set("view", ["work", "quotes"].includes(query.get("view") ?? "") ? "overview" : "cover");
    query.delete("entry");
    return `/summary?${query}`;
  }
  const month = pathname.match(/^\/summary\/(\d+)\/(\d+)$/);
  if (month) return `/summary?year=${month[1]}&view=months`;
  if (pathname.startsWith("/summary/")) return "/summary";
  if (/^\/entries\/[^/]+\/edit$/.test(pathname)) return pathname.replace(/\/edit$/, "");
  if (pathname.startsWith("/entries/")) return "/timeline";
  if (pathname.startsWith("/relisten/")) return `/entries/${pathname.split("/")[2]}`;
  return "/";
}

export default function NavigationController() {
  const location = useLocation();
  const navigation = useNavigationType();
  const navigate = useNavigate();
  const trail = useRef<Array<{ key: string; path: string; idx: number }>>([]);
  const lastExit = useRef(0);
  const pending = useRef(false);
  const [notice, setNotice] = useState("");

  useLayoutEffect(() => {
    const record = { key: location.key, path: routeIdentity(location.pathname, location.search), idx: Number(window.history.state?.idx ?? 0) };
    const found = trail.current.findIndex(item => item.key === record.key);
    if (found >= 0) trail.current = trail.current.slice(0, found + 1);
    else if (navigation === "REPLACE") trail.current = [...trail.current.slice(0, -1), record];
    else trail.current.push(record);
    // ponytail: remember at most 100 visited pages; use persisted history if cross-session navigation is needed.
    trail.current = trail.current.slice(-100);
    lastExit.current = 0; pending.current = false; setNotice("");
  }, [location.key, location.pathname, location.search, navigation]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => { setNotice(""); lastExit.current = 0; }, 2000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const reset = () => { lastExit.current = 0; setNotice(""); };
    document.addEventListener("visibilitychange", reset);
    window.addEventListener("pagehide", reset);
    return () => { document.removeEventListener("visibilitychange", reset); window.removeEventListener("pagehide", reset); };
  }, []);

  useEffect(() => {
    const back = (event: Event) => {
      if (pending.current) return;
      const dialog = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1);
      if (dialog) { dialog.dispatchEvent(new Event("cancel", { cancelable: true })); return; }
      const sheet = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')).at(-1);
      if (sheet) { sheet.querySelector<HTMLButtonElement>('[data-codex-back], button[aria-label="关闭"]')?.click(); return; }
      const menu = Array.from(document.querySelectorAll<HTMLDetailsElement>("details.codex-reader-menu[open], details.codex-list-share[open]")).at(-1);
      if (menu) { menu.open = false; menu.querySelector("summary")?.focus(); return; }
      if (guards.some(check => !check())) return;
      const fallback = (event as CustomEvent<string | undefined>).detail;
      const rootTab = ["/", "/albums", "/songs", "/timeline", "/search", "/more"].includes(location.pathname)
        || location.pathname === "/summary" && ["", "cover", "months"].includes(new URLSearchParams(location.search).get("view") ?? "");
      if (location.pathname === "/") {
        if (!Capacitor.isNativePlatform()) return;
        const now = Date.now();
        if (lastExit.current && now - lastExit.current < 2000) {
          lastExit.current = 0;
          void NativeNavigation.exitApp().catch(() => setNotice("暂时无法退出，请重试"));
        } else { lastExit.current = now; setNotice("再返回一次即可退出小懂哥"); }
        return;
      }
      pending.current = true;
      if (rootTab) { navigate("/", { replace: true }); return; }
      const current = routeIdentity(location.pathname, location.search);
      const target = [...trail.current.slice(0, -1)].reverse().find(item => item.path !== current
        && !/^\/(new|capture)(\?|$)/.test(item.path) && !/^\/entries\/[^/]+\/edit/.test(item.path));
      const delta = target ? target.idx - Number(window.history.state?.idx ?? 0) : 0;
      if (target && delta < 0) navigate(delta);
      else navigate(fallback || parentRoute(location.pathname, location.search), { replace: true });
    };
    window.addEventListener(BACK_EVENT, back);
    return () => window.removeEventListener(BACK_EVENT, back);
  }, [location, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    let handle: PluginListenerHandle | undefined;
    void NativeNavigation.addListener("backRequested", () => requestBack()).then(value => {
      if (active) handle = value; else void value.remove();
    }).catch(() => setNotice("返回控制加载失败，请重新打开应用"));
    return () => { active = false; void handle?.remove(); };
  }, []);

  return notice ? <div className="codex-back-notice" role="status">{notice}</div> : null;
}
