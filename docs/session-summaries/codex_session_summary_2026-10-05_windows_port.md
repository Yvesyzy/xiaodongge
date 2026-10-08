# 小懂哥 Windows 首版交付与验收

日期：2026-10-05（Asia/Shanghai）。作者：Codex。用户：Yves。工作区：`D:\codex\workspaces\codex\小懂哥`。

Yves 已批准直接实施，首版采用本地存储和 Android JSON 备份迁移。Windows x64 便携测试包已完成，全部工作区验收通过；未发布到外部服务，未提交或推送 Git。

## 交付文件

- ZIP：`release/codex_xiaodongge_windows_3.1.1_x64_20261004_171821.zip`，170,686,696 字节，约 162.78 MiB。文件名时间使用 UTC，用户所在日期为 2026-10-05。
- SHA-256：`246e5ab276c910d3c1c4ad5de38357e62fa32211b03905931518d811322ca5c2`。外部哈希文件在同名 `.zip.sha256.txt`。
- 解压完整目录后运行 `codex_xiaodongge.exe`，保留 DLL、`locales` 与 `resources`。无需安装 Node、npm 或数据库。
- 包内 `codex_package_manifest.json` 列出 97 个交付文件；ZIP 另含清单本身。全部文件在 ZIP 内逐项读取并验证大小和 SHA-256。
- 最新包元数据：`release/codex_windows_latest.json`。二次哈希与当前主进程、preload、SQLite、原生脚本一致性证据：`release/codex_windows_delivery_checks.json`。
- 说明：`desktop/codex_README.md`；包内副本：`codex_使用说明.md`。包内不含测试 profile、合成档案或个人数据。

## 完成的功能

- Electron 独立窗口、系统标题栏与缩放、固定侧栏、首页、搜索/类型/年份筛选及列表/阅读双栏档案库。返回列表保留选择和滚动位置。
- 双栏编辑复用当前表单、草稿、六项评分和旧评分规则；保持长文阅读、专辑/歌曲聚合、重听、月度/年度回顾及海报导出入口。暖白/深灰/青绿深浅主题已落地。
- 复用既有 Capacitor 自定义平台与 SQLiteConnection/Store；主进程用 Node 内置 SQLite。正式数据固定在 `%APPDATA%\xiaodongge-windows\archive\music_feelings_archive.sqlite`；草稿和偏好在同一应用数据目录的 Chromium 存储中。
- JSON v1–v6 导出、隔离内存 SQLite 预演、整库恢复、恢复日志、失败回滚和撤销。旧词曲分保持原意；v1–v5 缺少草稿时保留本机草稿，v6 按备份替换草稿；成功撤销消耗本次撤销快照。
- 原生 Windows 保存/文件夹选择、剪贴板及本地导出文件夹；取消保存返回取消，批量同名碰撞报告已保存部分并保留原文件。
- 隐藏运行的 Windows PowerShell/WinRT 媒体会话与本机 OCR。仅使用正在播放的会话，暂停不作为当前播放；OCR 返回原图尺寸和文字框，保留超时、文件/图像大小限制和人工校正。
- 保留 renderer 沙箱、上下文隔离、无 Node 权限、受控本地协议/CSP、IPC 来源与参数校验；数据库禁止任意路径、ATTACH、扩展加载和写文件函数。

## 验证结果

实测系统为 Windows 11 中文家庭版 x64 build 26200，桌面 DPI 为 150%。运行时 Electron 44.5.1、Node 24.21.0、SQLite 3.53.4、Chromium 152.0.7977.130。

| 检查 | 结果与范围 |
| --- | --- |
| 内置 SQLite 检查 | 实际 Electron 运行时 6/6 通过；持久化/重开、参数绑定、事务失败回滚、外键级联、重载后连接登记、隔离预演与不安全输入拒绝 |
| 共享单测 | 当前源码 `npm.cmd test` 32/32 通过 |
| 类型检查 | 根工程、desktop、mobile 的 `tsc --noEmit --incremental false` 均通过 |
| 共享备份回归 | `release/codex_windows_acceptance/codex_draft_backup_results.json`；网页与模拟原生分支通过，属于共享逻辑检查，不代替 Android 真机验收 |
| 真正解压后的 Windows 包 | `release/codex_windows_acceptance/codex_windows_checks.json`，18 组全部通过 |
| 布局与可读性 | 1366×768、1920×1080 逻辑窗口 ×100%/125%/150% 页面缩放 ×深浅主题，共12组；无横向溢出，编辑框文字对比度达到4.5:1；实际截图已目检 |
| 包完整性 | ZIP 97 项大小/哈希及文件数量核对通过；仅含本次构建资源，主进程等四个源文件与打包版本哈希一致 |

18 组验收包括：独立 profile 的空库启动；键盘六项评分及正式保存；真实文件字节、剪贴板、取消和批量部分失败；立即关闭的草稿保存及恢复；草稿配额失败阻止离开和关闭；预演不改变正式库；v1–v6 往返与撤销；提交替换后注入失败的完整回滚；重启解除已验证的恢复屏障；损坏草稿及 data-written 恢复日志的启动恢复；旧总分和旧词曲分编辑；实际生成月报/年报后的完整备份；筛选/选择/内部滚动及长文返回；诊断与构建标识；真实媒体桥/OCR；布局矩阵；移动整个运行目录、屏蔽 HTTP/HTTPS 后冷重载、草稿恢复及离线正式保存/导出。

原生媒体辅助程序另用合成 Windows 系统媒体会话验证正在播放、暂停与无会话行为，证据在 `release/codex_windows_acceptance/codex_media_session_test_report.json`。本轮实际 OCR 可用语言为 `en-US` 和 `zh-Hans-CN`。

## 本轮修正与工程状态

真实验收发现并修正了档案返回时过早清除选择、列表内部滚动丢失、深色编辑框继承不完整、缩放截图裁切与 renderer 重载后重复登记数据库连接。高 DPI 的档案截图改用 Electron 原生 `capturePage()`；最终程序坐标检查和真实截图均通过。

打包脚本直接将 Vite 构建到新创建的包目录，不复制开发 `desktop/dist` 中的历史资源。按 Yves 后续要求，早期包、失败验收目录与重复解压副本已删除；交付只保留上述最新 ZIP 和一份可直接运行的完整目录。

根 README、Windows 使用说明、实施计划与自己的 `codex_status.txt` 已更新。保留 Android、视频、文档整理和其他会话改动；未接触用户正式档案及其他助手配置/记忆。

## 收尾清理（2026-10-05）

Yves 明确要求删除测试冗余和过程临时文件。已删除46处文件或目录、2,764个普通文件、3,902,960,621字节（约3.63 GiB）：18次测试的 profile/合成数据库/图片与日志、重复解压和移动目录副本、旧包及哈希、Electron 下载缓存、缩放诊断、隔离 worker 副本、原始抓取与查询文件、开发 `desktop/dist`。三个指向 mobile/shared/node_modules 的 junction 仅解除链接，目标完整保留。

最终程序与 ZIP、外部哈希、最新包元数据和逐项完整性报告保留。三个验收结果 JSON 已集中到 `release/codex_windows_acceptance/`，复制前后 SHA-256 一致；原报告中的 profile/output 字段记录历史测试位置，其临时目录现已删除。来源清单保留公开 URL 和获取时间，原始抓取已清理。

清理前后3,019个保护文件哈希一致；最终运行目录97项及ZIP哈希未变。随后以独立空库 profile 实际启动最终 EXE，页面重载、SQLite 和版本检查通过，无页面错误；这个检查 profile、盘点文件和一次性清理脚本也已删除。审计记录为 `release/codex_windows_acceptance/codex_cleanup_checks.json`，其中列出的46个删除目标均已确认不存在。

可直接运行保留的最终目录；从源码运行时，先按使用说明执行 `npm.cmd run windows:build` 重新生成开发页面。本轮临时文件清理全部完成，无待删项。

## 使用边界与后续

- 本轮提供未签名便携测试包，没有安装向导、自动更新或云同步。JSON 导入会整体覆盖 Windows 本机数据，须先预演并保留原备份。
- 面向 Windows 10/11 x64；目前只有本机 Windows 11 实测。实际 Android 设备与 Windows 之间的个人备份迁移、Windows 10 以及 Yves 常用播放器尚未验收。
- 当前播放取决于播放器是否提供 Windows 系统媒体会话。合成会话结果不代表网易云/QQ/其他第三方播放器通过。OCR 语言和可解码格式取决于系统组件。
- 便携更新使用“关闭旧版、解压新版到新目录、运行新版”的方式。已验证固定应用数据身份与运行目录搬移保留数据；尚无历史 Windows 发布版本可做跨版本升级测试。
- 可选下一步：使用 Yves 的 Android 备份和常用 Windows 播放器验收；按使用反馈调整界面；制作品牌图标、签名与安装包。需 Yves 选择后开展主要后续工作。
