import { lazy, Suspense } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  AbstractMusicMapPage,
  AlbumsPage,
  AggregateDetail,
  BackupPage,
  DraftsPage,
  EntryDetailPage,
  EntryFormPage,
  InsightsPage,
  MorePage,
  PrivacyPage,
  SearchPage,
  SongsPage,
  StorageIntegrityNotice,
} from "../../mobile/src/App";
import NavigationController, { canLeavePage } from "../../mobile/src/codex_Navigation";
import { RouteScrollRestoration } from "../../mobile/src/codex_ReadingTools";
import QuickCapturePage from "../../mobile/src/QuickCapturePage";
import { ArchivePage, DesktopHomePage } from "./codex_pages";

const YearbookPage = lazy(() => import("../../mobile/src/codex_YearbookPage"));
const RelistenPage = lazy(() => import("../../mobile/src/RelistenPage"));
const AlbumTimelinePage = lazy(() => import("../../mobile/src/codex_AlbumTimeline"));
const DiagnosticsPage = lazy(() => import("../../mobile/src/codex_DiagnosticsPage"));
const MonthlyListeningPage = lazy(() => import("../../mobile/src/ListeningYearbookView").then((module) => ({ default: module.MonthlyListeningPage })));
const YearlyListeningPage = lazy(() => import("../../mobile/src/ListeningYearbookView").then((module) => ({ default: module.YearlyListeningPage })));

const sidebarGroups: Array<{ label: string; items: Array<{ to: string; label: string; icon: string }> }> = [
  {
    label: "档案",
    items: [
      { to: "/", label: "首页", icon: "home" },
      { to: "/timeline", label: "全部记录", icon: "archive" },
      { to: "/albums", label: "专辑", icon: "album" },
      { to: "/songs", label: "歌曲", icon: "song" },
      { to: "/drafts", label: "草稿箱", icon: "draft" },
      { to: "/summary", label: "回顾", icon: "recap" },
    ],
  },
];

type NavIconName = "home" | "archive" | "album" | "song" | "draft" | "recap" | "backup" | "settings" | "plus" | "search";

function NavGlyph({ name }: { name: NavIconName }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "home") return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" /></svg>;
  if (name === "archive") return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M8 7h8M8 11h8M8 15h5" /></svg>;
  if (name === "album") return <svg {...common}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2" /><path d="M12 3.5v6.5" /></svg>;
  if (name === "song") return <svg {...common}><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>;
  if (name === "draft") return <svg {...common}><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 12h6M9 16h5" /></svg>;
  if (name === "recap") return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
  if (name === "backup") return <svg {...common}><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .2 2.2-2.1 1.2-1.7-1.3a8 8 0 0 1-2.2.9L13 20h-2l-.6-2a8 8 0 0 1-2.2-.9L6.5 18l-2.1-1.2.2-2.2a8 8 0 0 1-1.1-2l-2-.6v-2l2-.6a8 8 0 0 1 1.1-2l-.2-2.2L6.5 4l1.7 1.3a8 8 0 0 1 2.2-.9L11 2h2l.6 2.4a8 8 0 0 1 2.2.9L17.5 4l2.1 1.2-.2 2.2a8 8 0 0 1 1.1 2l2 .6v2l-2 .6a8 8 0 0 1-1.1 2Z" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  return <svg {...common}><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></svg>;
}

function Sidebar() {
  return (
    <aside className="desktop-sidebar" aria-label="主导航">
      <div className="desktop-brand">
        <div className="desktop-brand-mark" aria-hidden="true">♪</div>
        <div><strong>小懂哥</strong><span>我的音乐记录</span></div>
      </div>
      <NavLink to="/new" className="desktop-new-button"><NavGlyph name="plus" />新建乐评</NavLink>
      <nav className="desktop-nav">
        {sidebarGroups.map((group) => (
          <div key={group.label} className="desktop-nav-group">
            <span className="desktop-nav-label">{group.label}</span>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `desktop-nav-item${isActive ? " active" : ""}`}
              >
                <span className="desktop-nav-icon"><NavGlyph name={item.icon as NavIconName} /></span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="desktop-nav-bottom">
        <NavLink to="/backup" className={({ isActive }) => `desktop-nav-item${isActive ? " active" : ""}`}>
          <span className="desktop-nav-icon"><NavGlyph name="backup" /></span><span>备份与恢复</span>
        </NavLink>
        <NavLink to="/more" className={({ isActive }) => `desktop-nav-item${isActive ? " active" : ""}`}>
          <span className="desktop-nav-icon"><NavGlyph name="settings" /></span><span>设置</span>
        </NavLink>
      </div>
    </aside>
  );
}

function routeTitle(pathname: string) {
  if (pathname === "/") return "首页";
  if (pathname.startsWith("/entries/")) return pathname.endsWith("/edit") ? "编辑乐评" : "阅读记录";
  if (pathname === "/new") return "新建乐评";
  if (pathname === "/capture") return "速记";
  if (pathname.startsWith("/albums")) return "专辑";
  if (pathname.startsWith("/songs")) return "歌曲";
  if (pathname.startsWith("/summary")) return "回顾";
  if (pathname === "/backup") return "备份与恢复";
  if (pathname === "/more") return "设置";
  return "全部记录";
}

function DesktopHeader() {
  const location = useLocation();
  return (
    <header className="desktop-topbar">
      <div>
        <span className="desktop-breadcrumb">档案室</span>
        <h1>{routeTitle(location.pathname)}</h1>
      </div>
      <div className="desktop-topbar-actions">
        <NavLink to="/timeline" className="desktop-search-link" aria-label="搜索记录"><NavGlyph name="search" /> <span>搜索记录</span></NavLink>
        <NavLink to="/new" className="desktop-top-new">新建记录</NavLink>
      </div>
    </header>
  );
}

function RouteFallback() {
  return <p className="desktop-route-fallback" role="status">正在打开页面…</p>;
}

function RoutedPages() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<DesktopHomePage />} />
        <Route path="/timeline" element={<ArchivePage />} />
        <Route path="/capture" element={<QuickCapturePage />} />
        <Route path="/new" element={<EntryFormPage mode="create" />} />
        <Route path="/entries/:id" element={<EntryDetailPage />} />
        <Route path="/entries/:id/edit" element={<EntryFormPage mode="edit" />} />
        <Route path="/relisten/:entryId" element={<RelistenPage />} />
        <Route path="/albums" element={<AlbumsPage />} />
        <Route path="/albums/timeline" element={<AlbumTimelinePage />} />
        <Route path="/albums/detail" element={<AggregateDetail kind="album" />} />
        <Route path="/songs" element={<SongsPage />} />
        <Route path="/songs/detail" element={<AggregateDetail kind="song" />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/summary" element={<YearbookPage />} />
        <Route path="/summary/analysis" element={<YearlyListeningPage />} />
        <Route path="/summary/:year/:month" element={<MonthlyListeningPage />} />
        <Route path="/abstract-map" element={<AbstractMusicMapPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/backup" element={<BackupPage />} />
        <Route path="/drafts" element={<DraftsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/diagnostics" element={<DiagnosticsPage />} />
        <Route path="/more" element={<MorePage />} />
      </Routes>
    </Suspense>
  );
}

export default function DesktopApp() {
  return (
    <div className="desktop-app-shell app-shell" onClickCapture={event => {
      const link = (event.target as Element).closest("a[href]");
      if (link?.getAttribute("href")?.startsWith("#/") && !canLeavePage()) event.preventDefault();
    }}>
      <NavigationController />
      <RouteScrollRestoration />
      <Sidebar />
      <div className="desktop-main-column">
        <DesktopHeader />
        <main className="desktop-route-main">
          <StorageIntegrityNotice />
          <RoutedPages />
        </main>
      </div>
    </div>
  );
}
