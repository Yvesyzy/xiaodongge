# 小懂哥 Windows 端迁移与页面重设计方案

日期：2026-10-03（Asia/Shanghai）。作者：Codex。用户：Yves。
状态：源码核对与设计建议完成；Windows 产品实现尚未开始。数据衔接方式已向 Yves 提问，本文件分别写明本地迁移和自动同步的边界。

## 推荐路线

以当前安卓版 3.1.1 的业务与数据规则为基底，新增 Windows 桌面入口和专用页面，使用 Electron 承载现有 React/TypeScript 前端，主数据保存在本机 SQLite。第一步交付首页、档案库和乐评编辑页原型，再完成桌面存储、备份和原生功能。

这是结合仓库技术栈作出的工程建议。Electron 支持使用 JavaScript、HTML、CSS 构建 Windows 桌面应用并自带 Chromium/Node.js，能延续项目现有语言。实际包体、启动时间和内存占用须在构建后测量。

| 路线 | 适用情况 | 本项目取舍 |
| --- | --- | --- |
| Electron + 现有 React/TypeScript | 优先延续当前前端与 JavaScript 开发链 | 推荐。自带运行时，需承担其包体和更新维护成本 |
| Tauri 2 + 现有 React/TypeScript | 优先利用系统 WebView，接受 Rust 开发链 | 可行。Windows 开发需要 Rust、Microsoft C++ Build Tools 和 WebView2；离线安装时还要处理运行时交付 |

官方依据：[Electron 简介](https://www.electronjs.org/docs/latest/)、[Tauri 前置条件](https://v2.tauri.app/start/prerequisites/)、[Tauri Windows 安装器](https://v2.tauri.app/distribute/windows-installer/)。具体框架版本和 SQLite 驱动在实现时依据实际安装包与运行时验证后锁定。

## 已确认的基底

- [package.json](../../../package.json) 为 3.1.1，依赖包含 React、React Router、Vite 和 Capacitor；当前构建入口是 `mobile:dev` / `mobile:build`。
- [mobile/src/main.tsx](../../../mobile/src/main.tsx) 通过 HashRouter 与 StorageGate 启动移动端；[mobile/src/App.tsx](../../../mobile/src/App.tsx) 包含路由、表单、页面和 Android 能力调用，需要按实际复用范围拆出业务逻辑。
- [mobile/src/types.ts](../../../mobile/src/types.ts) 已有 `ReviewEntry`、六项评分字段、音乐元数据、追加听感及聚合类型。
- [mobile/src/store.ts](../../../mobile/src/store.ts) 的 Android 主数据走 Capacitor SQLite，非原生分支走 localStorage；草稿仍由现有 Storage 格式保存。直接套入桌面窗口会进入网页存储分支，必须增加 Windows 存储实现。
- JSON 备份为 v6，接受 v1–v6；现有导入具有差异预览、隔离预演、恢复日志和撤销。六项评分新增字段仍使用 v6 格式。
- 旧 `src/app/` 为 Next.js/Prisma 页面。[README.md](../../../README.md) 明确它与手机数据库独立，功能和评分规则不同。新 Windows 版以当前移动端领域模型为基准。
- 已读取 Codex、Claude Code、ZCode 状态及六项评分、3.1.1 排版交接。仓库存在其他会话的未提交改动，后续实现应逐文件保持这些改动。

## 复用和适配范围

| 内容 | Windows 处理方式 |
| --- | --- |
| 曲风与情绪分类、音乐身份归并、分析规则 | 复用现有纯逻辑及 `shared/` 模块 |
| 六项评分、旧总分与旧词曲保留、草稿解析 | 复用规则和格式；桌面重做控件呈现 |
| 月度/年度回顾、重听对照、榜单与海报内容 | 复用数据计算和导出模型；桌面重做浏览与编辑布局 |
| 正式记录、封面、追加听感、本地应用数据 | Windows SQLite 保存，沿用当前字段与备份语义 |
| 草稿、阅读设置、主题与阅读位置 | 保留现有内容格式，明确设备本地保存位置和升级后的恢复行为 |
| Android 当前播放、OCR、系统分享和导航插件 | 逐项改为 Windows 能力与交互 |

共享规则保持单一维护。只在桌面功能确实需要时提取当前移动端内的逻辑，修改共享函数前检查所有调用方；页面外壳、路由布局和平台接口分别实现。

Electron 的数据库、文件读写及系统能力放在主进程；界面通过 preload 中有限的接口访问。保留上下文隔离、沙箱与输入校验，界面层只加载应用自己的本地页面。官方依据：[Electron preload 与进程通信](https://electronjs.org/docs/latest/tutorial/tutorial-preload)。

## 桌面页面设计

视觉方向为私人音乐档案室：暖白背景、深灰正文、青绿点缀，封面和原文作为主要视觉内容。沿用现有可授权字体与曲风/情绪含义，减少装饰性阴影，建立浅色与深色两套清晰层级。窗口使用系统标题栏和常规最小化、最大化、关闭行为。

全局侧栏包含首页、全部记录、专辑、歌曲、草稿、回顾；搜索与新建作为固定高频入口，备份与设置放在侧栏底部。以上是界面分组，具体路由在实现时从现有路由及其调用关系确定。

| 页面 | 布局及交互 |
| --- | --- |
| 首页 | 今日重逢、继续草稿和最近记录并排组织；新建入口可选择速记或完整乐评 |
| 档案库 | 左侧全局导航，中间筛选与记录列表，右侧当前记录详情；支持列表/封面网格切换，选择记录时保留筛选和列表位置 |
| 专辑/歌曲 | 封面网格展示音乐身份与记录数量；详情并排呈现乐评、重听和跨年轨迹，保持不同目录来源的区分 |
| 乐评编辑 | 正文为主写作区；作品信息、曲风、情绪和六项评分位于侧面面板；持续显示草稿保存状态，完整评分后按原规则计算平均 |
| 阅读 | 限制正文行宽，保留字号、独立阅读主题、续读与字数；长文阅读可收起列表和辅助面板 |
| 回顾 | 月度/年度切换、月份导航和作品内容同时可见；年记采用适合宽屏的翻阅布局，导出仍保留现有海报尺寸和内容规则 |
| 备份与设置 | 展示设备数据状态、备份差异和恢复结果；取消文件选择不显示为保存成功，导入确认明确展示新增、更新、移除范围 |

宽窗口展示导航、列表、详情三栏；较窄窗口展示导航与主要内容，详情和辅助面板按需打开。编辑状态切换布局不丢正文或评分；键盘焦点、Tab 顺序、Esc 关闭浮层、搜索和保存操作均有明确行为。

首批原型只覆盖首页、档案库和乐评编辑，使用合成记录，包含空状态、长标题、长正文、旧评分、六项评分不完整、保存失败及深浅主题。

## 数据衔接

推荐首版维持本地优先，通过现有 JSON v6 备份迁移。Windows 使用独立数据库，导入后保留记录 ID、创建/更新时间、评分、封面、草稿、重听与榜单。两端采用相同备份校验规则，并验证旧 v1–v5 的兼容行为。

当前导入是整库恢复，会产生新增、更新及移除。它没有逐记录双向合并规则；两端分叉修改后轮流导入会覆盖变化。Windows 首版必须继续提供差异预览、隔离预演、失败恢复和撤销，并明确告知导入的作用。

如果 Yves 选择自动同步，先另行确定存储服务、身份验证、删除传播、草稿/封面同步和冲突处理，再实现同步。当前的 `updatedAt` 和整库备份不足以直接提供可靠双向同步。同步选择不影响本轮三个页面原型的制作。

## Windows 原生能力

- 文件导入、另存为、图片导出和文本复制优先使用桌面框架提供的系统能力，数据保存到用户专属应用数据目录，升级沿用同一目录。
- 当前播放走 Windows 系统媒体会话原生接口。Microsoft 提供可枚举可用会话的 [GetSessions](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager.getsessions?view=winrt-28000)；原生桥、系统要求及播放器实际元数据需实测。界面保留手动填写入口。
- 截图 OCR 复用已有识别文本解析；图像识别引擎需要 Windows 实现。开始这项实现前确认 Yves 实际使用的桌面播放器与截图样本，保留人工校正和识别失败反馈。
- Android 其他应用的分享入口按 Windows 可用的文件、图片或文本输入方式重新设计。系统分享能力以实际接收端验证结果为准。

## 实施与验收顺序

1. **三页原型**：检查档案浏览、新建/续写、六项评分、长文阅读的完整流程；1366×768 与 1920×1080、100%/125%/150% 缩放、深浅主题下无内容遮挡和关键控件溢出。
2. **桌面底座**：增加独立 Windows 入口，完成窗口、应用数据目录、SQLite 和文件选择；保存、关闭、重启后内容一致，失败时保留已有数据。
3. **核心闭环**：实现新建、编辑、草稿、搜索、聚合、回顾与备份；用合成数据验证 Android 导出→Windows 导入→Windows 导出→Android 导入，以及无封面、旧格式、撤销和失败恢复。
4. **原生功能**：按实际播放器验证当前播放和截图 OCR；验证取消保存、分享接收、中文路径与图片内容。
5. **Windows 测试包**：验证安装、覆盖升级、重启与数据保留，测量启动和资源使用，记录系统与播放器版本；明确安装包签名状态后交付 Yves 体验。

当前仓库已有 `npm.cmd test`、类型检查、Web 构建及专项验证入口。复用逻辑发生变化时运行相关检查；Windows 独有行为增加最小可运行检查，Android 的既有能力同步回归。已有 3.1.1 交接中的通过结果属于历史验证，本轮只完成读取与设计核对。

## 来源与交接

本地主要证据：`package.json`、`mobile/src/main.tsx`、`mobile/src/App.tsx`、`mobile/src/store.ts`、`mobile/src/types.ts`、`mobile/src/nativeNowPlaying.ts`、`mobile/src/nativeExport.ts`、`mobile/src/nativeSharedMusic.ts`、`mobile/src/entryDraft.ts`、`shared/`、README、状态文件及两份最新 App 交接。

公开资料通过 [Firecrawl 技能](D:/codex/.codex-home/skills/firecrawl/SKILL.md) 与官方文档检索核对，保存时间、文件和检索范围见 [.firecrawl 来源清单](../../../.firecrawl/codex_windows_source_manifest.md)。本轮交接见 [Windows 方案会话总结](../../session-summaries/codex_session_summary_2026-10-03_windows_port.md)。
