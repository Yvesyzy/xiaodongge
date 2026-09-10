import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import "./codex_reading.css";

const PROGRESS_KEY = "codex-reading-progress-v1";
const PREFERENCES_KEY = "codex-reading-preferences-v1";
const ROUTES_KEY = "codex-route-scroll-v1";
function positions(key: string, storage: Storage): Record<string, number> {
  try {
    const data: unknown = JSON.parse(storage.getItem(key) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([, y]) => typeof y === "number" && Number.isFinite(y) && y >= 0).slice(-100));
  } catch { return {}; }
}
function savePosition(key: string, id: string, y: number, storage: Storage) {
  try {
    const saved = positions(key, storage); delete saved[id];
    // ponytail: keep the latest 100 reading locations; use a database if cross-device history is added.
    storage.setItem(key, JSON.stringify(Object.fromEntries([...Object.entries(saved), [id, y]].slice(-100))));
  } catch { /* Reading remains available when local storage is full or disabled. */ }
}

export function RouteScrollRestoration() {
  const location = useLocation();
  const navigation = useNavigationType();
  const query = new URLSearchParams(location.search);
  for (const transient of ["share", "saved", "card", "draftCleanup"]) query.delete(transient);
  const route = location.pathname + "?" + query.toString();
  const readingRoute = /^\/entries\/[^/]+$/.test(location.pathname) || /^\/summary\/\d+\/\d+$/.test(location.pathname) || location.pathname === "/summary" && ["work", "quotes"].includes(query.get("view") ?? "");
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    let y = navigation === "POP" || !readingRoute ? positions(ROUTES_KEY, sessionStorage)[route] ?? 0 : 0;
    let restoring = y > 0;
    const restore = () => {
      if (!restoring) return;
      if (document.documentElement.scrollHeight - window.innerHeight >= y) {
        window.scrollTo(0, y); restoring = false;
      }
    };
    window.scrollTo(0, 0);
    const observer = new ResizeObserver(restore);
    observer.observe(document.body); restore();
    const cancel = () => { restoring = false; };
    const record = () => { if (!restoring) y = window.scrollY; };
    const timer = window.setTimeout(cancel, 5000);
    window.addEventListener("scroll", record, { passive: true });
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    return () => {
      savePosition(ROUTES_KEY, route, y, sessionStorage);
      observer.disconnect(); clearTimeout(timer);
      window.removeEventListener("scroll", record); window.removeEventListener("wheel", cancel); window.removeEventListener("touchstart", cancel);
      window.history.scrollRestoration = previous;
    };
  }, [route, navigation, readingRoute]);
  return null;
}

export default function ReadingTools({ children, progressKey, title, backTo = "/timeline", backLabel = "目录", actions, footer }: {
  children: ReactNode; progressKey: string; title: string; backTo?: string; backLabel?: string; actions?: ReactNode; footer?: ReactNode;
}) {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
      return { size: ["small", "normal", "large"].includes(value?.size) ? String(value.size) : "normal", dark: value?.dark === true };
    } catch { return { size: "normal", dark: false }; }
  });
  const [resume, setResume] = useState(() => positions(PROGRESS_KEY, localStorage)[progressKey] ?? 0);
  const engaged = useRef(false);
  useEffect(() => {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Optional device preference. */ }
  }, [preferences]);
  useEffect(() => {
    engaged.current = false;
    setResume(positions(PROGRESS_KEY, localStorage)[progressKey] ?? 0);
    let y = 0;
    let timer: number | undefined;
    const engage = () => { engaged.current = true; };
    const save = () => { if (engaged.current) savePosition(PROGRESS_KEY, progressKey, y, localStorage); };
    const record = () => {
      if (!engaged.current) return;
      y = window.scrollY; clearTimeout(timer); timer = window.setTimeout(save, 350);
    };
    window.addEventListener("wheel", engage, { passive: true }); window.addEventListener("touchstart", engage, { passive: true }); window.addEventListener("keydown", engage);
    window.addEventListener("scroll", record, { passive: true }); window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer); save(); window.removeEventListener("wheel", engage); window.removeEventListener("touchstart", engage); window.removeEventListener("keydown", engage);
      window.removeEventListener("scroll", record); window.removeEventListener("pagehide", save);
    };
  }, [progressKey]);
  return <div className={`codex-reader codex-reader-${preferences.size}${preferences.dark ? " codex-reader-dark" : ""}`}>
    <header className="codex-reader-toolbar">
      <button type="button" onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate(backTo)}>← 返回</button>
      <span title={title}>{title}</span><div className="codex-reader-actions">{actions}</div>
    </header>
    {resume > 160 && <div className="codex-reader-resume"><span>上次读到这里</span><button onClick={() => { engaged.current = true; setResume(0); requestAnimationFrame(() => window.scrollTo(0, resume)); }}>继续阅读</button><button aria-label="关闭继续阅读提示" onClick={() => setResume(0)}>×</button></div>}
    <div className="codex-reader-content">{children}</div>
    <footer className="codex-reader-footer"><Link to={backTo}>{backLabel}</Link><label>字号 <select aria-label="阅读字号" value={preferences.size} onChange={(event) => setPreferences({ ...preferences, size: event.target.value })}><option value="small">小</option><option value="normal">标准</option><option value="large">大</option></select></label><button type="button" aria-pressed={preferences.dark} onClick={() => setPreferences({ ...preferences, dark: !preferences.dark })}>{preferences.dark ? "浅色" : "深色"}</button>{footer}</footer>
  </div>;
}
