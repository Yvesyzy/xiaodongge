# 小懂哥 Windows 首版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. 本会话按 Yves 已批准的直接实施要求执行，采用只读检查与隔离写入、主线程审查集成；未安装的附加执行技能不作为继续工作的前置条件。

**Goal:** 交付可运行的 Windows 本地音乐档案程序，包含桌面首页、档案浏览、写作、现有回顾及安全备份能力。

**Architecture:** Electron preload 在页面模块加载前注册现有 Capacitor 自定义 electron 平台；沿用已安装 SQLiteConnection 和 Store，主进程用 Node 内置 SQLite 实现实际调用到的插件方法。桌面 React/Vite 使用独立外壳、首页和档案布局，现有编辑、阅读、回顾和导出规则单一维护。Windows 原生媒体与 OCR 使用隐藏运行的系统 Windows PowerShell/WinRT 脚本。

**Tech Stack:** 当前 React/TypeScript/Vite、Capacitor core 8.4.1、SQLite 插件 8.1.0、Electron（安装后核对内置 Node/SQLite）、Windows PowerShell 5.1/WinRT、现有 Playwright。

**Spec:** ../specs/codex_2026-10-03_windows_port_design.md

## Global Constraints

- 本地优先，JSON v6 迁移；现有 v1–v6 校验、恢复日志、预演、撤销及旧评分规则保留。
- 新脚本和产物使用 codex_ 前缀，所有文件落在现有项目工作区。
- 界面加载本地资源，保留上下文隔离和沙箱；IPC 校验方法、参数、文件名及数据库名。
- 合成记录验证；用户数据目录与测试数据目录隔离；覆盖升级沿用同一数据目录。
- 主线程集成，写入任务使用独立目录，保留其他会话未提交修改。
- 1366×768、1920×1080、深浅主题与100%/125%/150%缩放验证；键盘可操作。

## Task 1: Electron 与 SQLite 闭环

**Files:** Create `desktop/codex_main.cjs`, `desktop/codex_preload.cjs`, `desktop/codex_sqlite.cjs`, `desktop/codex_sqlite.test.cjs`; Modify `package.json` and lockfile.

**Interfaces:** 使用实际安装库已确认的 `window.CapacitorCustomPlatform = { name: "electron", plugins: { CapacitorSQLite } }`。SQLite 插件参数/结果按 `node_modules/@capacitor-community/sqlite/src/definitions.ts` 和 Store 实际调用读取确定。

- [x] 验证内置运行时：`require('node:sqlite').DatabaseSync` 在 Node 与 Electron 内均可执行 create/insert/query/close。
- [x] 增加最小事务检查，覆盖参数绑定、失败回滚、外键级联、持久化重开和隔离预演连接。
- [x] 主进程限定本地内容与受控 IPC，preload 仅开放存储/文件/媒体/OCR所需函数。
- [x] 以真实 SQLite 和实际 Store 验证 v6 备份导入、导出、预演、撤销与失败恢复。

## Task 2: Windows 原生接口和文件能力

**Files:** Create `desktop/native/codex_windows_native.ps1`; platform bridge files in `desktop/`; Modify existing plugin registration files only to add electron implementations.

**Interfaces:** `NowPlaying.getCurrentTrack()` 沿用 `{ accessEnabled, title?, artistName?, albumName?, musicMetadata? }`；`ScreenshotOcr.recognize({ dataUrl })` 沿用 `{ text, width, height, lines: [{ text, left, top, right, bottom }] }`；文件方法按现有 `nativeExport.ts`。

- [x] 在隔离目录验证 Windows 媒体会话和本机 OCR；辅助进程隐藏运行、超时退出。
- [x] 使用系统文件对话框与剪贴板；取消保存返回 `cancelled`，部分批量失败返回原有 `partial` 结构。
- [x] 文件内容、图像大小、路径与导出文件名校验；预演数据库使用内存连接，临时导出由程序自行管理。
- [x] 核对所有插件调用方，并调整 Windows 专属提示和诊断文本。

## Task 3: 桌面页面

**Files:** Create `desktop/index.html`, `desktop/codex_vite.config.ts`, `desktop/tsconfig.json`, `desktop/src/codex_main.tsx`, `desktop/src/codex_App.tsx`, `desktop/src/codex_pages.tsx`, `desktop/src/codex_desktop.css`; Modify `mobile/src/App.tsx` with minimal named exports.

**Interfaces:** HashRouter、StorageGate、NavigationController、RouteScrollRestoration 与现有 Store；旧页面函数与 props 以源码核对报告为准。

- [x] 按批准的暖白/深灰/青绿方向建立图像设计参考、色彩与排版规则，使用合成数据。
- [x] 完成固定导航、桌面首页、列表/详情档案库；筛选与返回保持列表上下文。
- [x] 现有编辑规则复用，写作区与辅助信息并排；草稿自动保存、六项平均及旧评分行为完整回归。
- [x] 回顾、聚合、重听、分享及备份入口连通；所有控件实际工作。

## Task 4: 验证与交付

**Files:** Create `scripts/codex_check_windows.mjs`, `scripts/codex_build_windows.mjs`, `desktop/codex_README.md`; update本轮交接及 Codex 状态。

- [x] 最小存储检查通过后运行当前共享单测、类型检查和相关移动端回归。
- [x] Playwright 使用独立 profile 验证 Electron 真窗口、保存重开、备份往返、原生桥、主题/缩放与页面布局。
- [x] 本机没有 Browser/IAB 工具，使用已安装 Playwright/Electron；将设计参考与实际截图通过 view_image 对照。
- [x] 将运行时、本地页面和原生脚本打包为新的 Windows 便携测试包；校验文件清单、哈希、离线启动和固定数据目录及运行目录迁移的数据保留。
- [x] 交付运行方法、实际通过的检查及目标播放器/系统/签名限制；不将历史 Android 检查作为 Windows 验收。


## 实施结果（2026-10-05）

Windows x64 首版已交付。实际 Electron SQLite 检查6/6、共享单测32/32、根/desktop/mobile类型检查、最终解压包18组验收及12组布局矩阵通过。最终ZIP的97个文件逐项校验大小和SHA-256；页面直接构建到新包目录，避免带入历史资源。

便携版采用关闭旧版后解压新版到新目录的更新方法。已验证固定应用数据身份和运行目录搬移后的档案/草稿保留；真正跨版本升级待有后续Windows发布版本时验证。Windows10、Yves常用播放器和实际安卓设备的个人备份迁移尚未实测，测试包未签名。详见[首版交付与验收](../../session-summaries/codex_session_summary_2026-10-05_windows_port.md)。
