# 2026-10-10 小懂哥清理与精简结果

Yves 已授权执行全目录审查的三项后续，并要求仅保留最新 3.2.0 APK 和必要文件。主要清理、源码/脚本精简与 Git 维护已完成；最后 9 个临时工具/合成测试文件的删除被自动审批拒绝，保留并列明，未重试或绕过。

## 实际结果

- 主清单实际删除 **5,244 个普通文件、1,979,355,104 字节**，解除 **5 个 junction**；共享 `node_modules` 目标保留，15 个保护文件摘要一致。116 个目标均已验证消失。
- 两次 npm 卸载共移除 **19 个依赖包**。已核实消失的 Three.js、类型、Filesystem 和 Electron 四个目录此前合计 **422,847,293 字节**；其余附带卸载包未计入这一字节下限。
- 核实的累计删除量至少 **2.40 GB**，包含本轮生成后清理的验证缓存。项目从约 **3.73 GB 降至 1.46 GB，净减约 2.27 GB**；统计为普通文件逻辑长度，不代表文件系统分配簇的精确释放量。
- 项目内仅剩一份 APK：`release/codex_v320_release_20261010/codex_xiaodongge-v3.2.0-36.apk`，75,796,464 字节，SHA-256 `6ba2da51083118f72d4d7c0d11831aaf2c405ba84c4368eface556bd8d98195f`。3.1.2/3.1.3/两份3.1.4/3.1.5、构建目录副本和 instrumentation 测试包已删除。
- `release/` 顶层仅保留原正式 3.2.0 交付与本次清理验收目录。必要旧验收记录去重后保存为 **248,504 字节**的归档，110 条原路径记录映射到 88 个独有文件；逐成员摘要已验证，不包含旧 APK、缓存、应用副本或过程截图集合。
- 保留个人 `.env`、Prisma 数据库/迁移、密钥与本机配置、原型/fixtures、字体源与许可、隐私/备份安全检查、视频最终 ZIP/成片/配乐/素材源码和其他助手配置。

## 源码与脚本变化

- 删除无调用的 `QuickMemoryCardPanel`、专用 `buildQuickMemoryCard` 与 Android 默认 Example 测试；保留仍在使用的分享/重听公共函数。
- 移除 `three`、`@types/three`、`@capacitor/filesystem`、`electron`，同步 npm 锁文件和 Capacitor 插件注册；原生注册现为 SQLite 插件。
- Windows 的 14 个运行源码文件及四个工具脚本与独立仓库逐字节一致；README 文档差异为独立仓库补充的安装/升级说明。确认完整承接后删除本项目副本、`main` 和 Electron；未修改 `D:\codex\workspaces\xiaodongge-windows`。
- 14 个 Vite 调用方共用 `scripts/codex_qa_harness.mjs`，固定 loopback/strict-port 约束，保留原有断言、隔离缓存、origin 覆盖及关闭流程。
- 五个 Android 检查共用 `scripts/codex_android_cdp.mjs`；项目 AVD 身份、WebView 等待/计时与 forward 清理保留，连接/清理失败按实际错误传播。
- debug/release/JUnit 共用 `scripts/codex_android_env.ps1`。发布可信基准更新为保留的正式 3.2.0 APK；保留摘要、原证书、包名、拒绝版本倒退与同 code 必须同版本名的校验，允许当前版本重建。
- 旧无障碍工具的对比度和 44px 扫描迁入现行检查，旧入口删除；报告仍是测量结果，未把它扩展成整站无障碍认证。
- 退役 v2.1.9 验包、四个历史榜单预览检查、一次性补推/旧 fixture/旧 AVD 工具；保留仍含独有回归断言或当前排障用途的手动检查。
- 视频移除五组重复别名，三套采集共用工程内 helper；现有 MP4、MP3、WAV 和冻结 ZIP 摘要未变。`codex_synthesize.py`、素材联系表和成片检查仍是实际依赖，保留。
- 导出日期复用 `localDateOf`，保留本地时区、空值和非法值行为；未重构有独立状态/用户激活要求的导出业务流程。

## 验证与边界

- 工程 27 项检查取得通过结果：首轮完整门禁 26 项通过，新增无障碍扫描因 `/capture` 使用编辑页 selector 失败；核对实际源码改为 `.quick-capture-form` 后，受影响检查单独复验通过。首轮失败报告保留，没有改写为通过。
- Android JUnit **14/14**；根/mobile 类型检查、质量门禁、网页构建、旧网页端合成数据库、存储/备份/导出/排名/阅读/交互与 mutation guards 均通过。
- 隐私、鸿蒙缺失 API/CSS 模拟、卓易通退化专项通过；视频采集公共层的真实 Chrome、固定时钟、视口及外部请求阻断检查通过。
- 主代理对 19 个重构 JS 文件作 AST 断言比较：14 个网页检查原有断言逐项保留；五个 Android 文件变化仅为将 AVD/socket/page 连接断言移入等价公共守卫。所有活动 PowerShell 文件解析通过，worker 隔离补丁均经审阅后按文件合入。
- 未启动 ADB/模拟器或连接手机，ADB/CDP 重构没有设备实测。保留 APK 是原已发布包，未构建替代同版本包、未发布/提交/推送；源码精简将在以后重建时进入原生包。
- 本轮停止的唯一 Gradle daemon 是本轮 JUnit 启动、已核实空闲的 8.13 实例；没有终止其他项目的 Node 进程。

## Git 维护

先核对和保存全部五份 reflog（54,453 字节）及 refs/index 快照；`reflog expire --stale-fix --expire=never --expire-unreachable=never --rewrite --all` 预演后仅移除五条损坏记录，保留健康历史。主清理随后删除 18 个已由 Git 报告的临时垃圾对象，366,632,960 字节。

最终 `git fsck --full --no-dangling` 退出 0；`git count-objects -v` 的 `garbage`/`size-garbage` 均为 0。HEAD 保持 `3ba6d8cb9f5c503ba3072925f01bef161c80b12e`，分支/标签/暂存内容未变，没有 gc/prune 提交对象或重写分支历史。

## 收尾未完成项

最后对九个精确绝对路径、非递归 PowerShell 删除的请求被自动执行审批拒绝，仅返回 `blocked by policy`，没有具体原因；命令未执行，实际删除 0 文件/0 字节。没有重复请求、换工具/shell 或用父目录删除绕过。

保留 **9 文件、135,939 字节**：五个本轮一次性工具、两个生成的 JUnit 配置/类路径文件、两个合成测试数据库。它们不含个人数据库或旧 APK。准确清单位于 `release/codex_cleanup_refactor_20261010/codex_temporary_cleanup.json`；一次性工具不要重新运行。

## 交接与证据

- 主删除清单及逐目标实际结果：`release/codex_cleanup_refactor_20261010/codex_cleanup_manifest.json`。
- 综合验证、唯一 APK/保护摘要与首次失败/复验边界：`release/codex_cleanup_refactor_20261010/codex_final_validation.json`。
- 必要旧验收：`release/codex_cleanup_refactor_20261010/codex_prior_validation_20261010.zip`。
- Git 恢复信息与操作日志：`release/codex_cleanup_refactor_20261010/codex_git_recovery/`。
- 现有未提交的历史交接改动保留；本次业务源码和工具精简均未暂存或提交。

后续可把本次维护作为独立提交；下一次发版前重新构建并实机验收移除未用原生插件后的安装包。不要从旧审查快照恢复已删除 APK 或旧脚本基准。
