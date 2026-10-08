# 小懂哥 Windows 独立 GitHub 发布交接

日期：2026-10-07（Asia/Shanghai）。作者：Codex。用户：Yves。

## 完成结果

Yves 已明确授权直接创建独立仓库、提交推送和发布 Release。本次从既有工作区显式复制 Windows 必需源码与授权文件，建立独立目录 `D:\codex\workspaces\xiaodongge-windows`，没有复制旧 Git 历史、Android 原生工程、Next/Prisma 工程、个人数据、签名材料或助手配置。

- 公开仓库：https://github.com/Yvesyzy/xiaodongge-windows
- 默认分支：`main`。
- 源码提交：`d6b4c9bb8a10a38d343a874c38855f01521c787f`，104 个文件、24,968 行新增。
- 标签：`v3.1.1`；annotated tag 对象 `0d5b35f637b24137bf05d442553e97cc914a2e74`。
- 正式 Release：https://github.com/Yvesyzy/xiaodongge-windows/releases/tag/v3.1.1 ，已公开并设为最新版本。
- Release ID：`405350123`，不是草稿或预发布。

README、CHANGELOG、MIT License、Windows 使用说明、两张合成数据截图、发行说明和可公开的验收 JSON 均已随源码推送。README 包含下载安装、网易云 SMTC、数据目录、Android JSON 迁移、更新、构建、检查和实际验收边界。

独立 package.json 与锁文件移除了 Windows 不使用的 Next、Prisma、Three 和 Android 构建依赖，直接依赖版本固定为既有锁文件的实际版本。根 tsconfig 使用 Vite/client 和 Node 类型，解决脱离 Next 后缺少 CSS 声明的问题。业务代码未改，92 个复制的业务源文件/检查/原使用说明/授权文件与原工作区逐项 SHA-256 一致。

手机端工作区仍为 `D:\codex\workspaces\codex\小懂哥`，远端仍为 `https://github.com/Yvesyzy/xiaodongge.git`，本地 HEAD 仍是 `9ae4e01a037690e59aed1e9ac71091baa0e27acc`。本次只向原工作区追加自己的交接和状态记录，保留其所有既有未提交修改，没有推送手机端。

## 发行文件

本次从独立源码重新构建的 ZIP：

`release/codex_xiaodongge_windows_3.1.1_x64_20261007_032400.zip`

大小：170,688,569 字节。SHA-256：

`8c45c18a6d18d62b4d0d22733ff04fc6eb65797921a45c3ee84db7f012ea35ff`

同名 `.zip.sha256.txt` 为 121 字节，SHA-256 为 `f89cb8d0c4ca7d649c6a61d74880c6cce8d2842f56ab5ea1bfcaf09635a29d41`。ZIP 和校验文件均已上传；GitHub API 返回的资产大小与 `digest` 均与本地一致。完整可运行目录也保留在独立仓库的 `release/` 下。

`release/codex_windows_latest.json` 记录本地完整路径；`release/` 被 Git 忽略，不上传该元数据及源快照。GitHub Release 只附带 ZIP 和 SHA-256 文件。

## 验证

- 独立 `npm.cmd ci` 安装 145 个包完成；Electron 44.5.1 运行时复用原工作区同版本文件，并由官方安装脚本检查已安装状态。
- `npm.cmd run typecheck` 通过，`npm.cmd test` 48/48 通过。
- 新发行程序 18 组桌面回归通过，1366×768 / 1920×1080、100% / 125% / 150%、深浅主题共 12 组布局通过。
- 覆盖备份预演/整库恢复/失败回滚/撤销、草稿写入及配额失败保护、SQLite、原生保存/取消/批量碰撞/剪贴板、OCR、目录搬移及屏蔽 HTTP/HTTPS 后离线冷启动/保存/导出。
- ZIP 98 个清单文件逐项大小/哈希通过；主进程、preload、SQLite、网易云补全模块和原生辅助脚本与源码匹配。
- npm 生产依赖在官方 registry 的审计为 0 项已知漏洞。机器默认 npmmirror 审计端点不支持该 API，已改为命令级官方 registry 查询，没有改动全局配置。
- 秘钥格式扫描、被排除路径检查、README/文档本地链接检查通过；新编写文件的 Git 空白检查通过。完整初始导入中保留上游原有少量行尾空格/末尾空行，没有为此改动业务源码或授权原文。
- luna_worker 完成独立只读审计；主代理已验证其四项验收条件。字体原始 WOFF 元数据显示 Noto Sans SC、Adobe Source 版权声明及 SIL OFL 1.1，与保留的许可证一致。使用说明中的网易云实际验证版本保留为可复现环境信息。
- GitHub 远端 main、annotated tag、README blob、Release 说明、最新 Release ID、两个资产大小和 SHA-256 均与本地核对一致。

证据：公开 `docs/codex_release_verification_v3.1.1.json`；本地 `release/codex_github_release_checks.json`、`release/codex_npm_audit_production.json`、`release/codex_windows_publish_acceptance/codex_windows_checks.json`。

## 清理与当前状态

本对话核实累计生成量下限为 1,577,663,005 字节，超过 200,000,000 字节后已自动使用「任务文件清理」。删除本次 Windows QA 的合成 profile、便携搬移副本、多余截图及一次性清理脚本，共 207 个文件、406,861,783 字节；206 个受保护成果的大小和 SHA-256 前后一致。验收 JSON 已集中保留，两张合成截图已进入 README。

随后核对完 GitHub 资产后又删除 1 个临时 API 响应副本，保留精简的正式发布核验记录；该小型副本不计入上述已核实的删除字节数。最终源码、必要依赖、Git 元数据、运行目录、ZIP/SHA 和必要文档/验收记录保留。原项目既有运行包、其他任务产物和个人档案不在本次清理范围。

状态：Windows 独立仓库与 v3.1.1 Release 发布完成。后续 Windows 修改从新目录进行，手机端继续在原目录维护。

可选下一步：实际 Windows 10 验收和个人 Android JSON 备份迁移；制作应用图标、签名与安装包。当前发行包未签名，没有安装向导、自动更新或云同步。
