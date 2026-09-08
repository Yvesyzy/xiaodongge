# v2.6.1 备份导入修复交接

Yves 要求修复 Android 导入报错，并支持不含封面的 JSON 导出和跳过封面导入。采用现有备份格式与依赖，保留严格数据校验、导入前快照、事务回滚和撤销。

## 根因和更改

- `ExecuteSet: No value for values` 并非封面损坏。安装的 SQLite Android 插件对每条语句读取 `values`；导入的六条 DELETE 缺少这个参数。现统一补上空数组。
- 插件启用外键。现先插入 ReviewEntry，再插入 ListeningMoment，避免包含复听记录的备份导入失败。
- 兼容旧月报在手动归档月份中包含其他月份的收听日期；新 `dateBasis: createdAt` 月报仍检查日期归属，所有其他分析字段仍严格校验。
- 文件选择回调在 await 前保存 input，避免异步后访问已清空的 event.currentTarget。
- JSON 默认仍包含封面；取消勾选后生成 `-no-covers.json`。导入可勾选跳过备份封面，其他数据正常恢复并保留当前封面。切换选项重算预览，确认框明确覆盖范围。撤销快照始终包含封面。
- 版本升级为 2.6.1，versionCode 17，沿用 v2.5/v2.6 正式签名；没有覆盖已发布的 v2.6 包。

## 数据与验证

- 最初微信 JSON 路径在本轮核实时已不存在；现有 `release/codex_recovered_xiaodongge-20260906-225804.json` 含 6 条记录、1 个年度总结、2 个月度作品、9 张封面。该文件是前轮恢复副本，旧五月日历缓存已在前轮清理；本轮不再修改它。
- 新 `release/codex_no_covers_xiaodongge-20260906-225804.json` 仅将现有恢复副本的 covers 改为空数组，其他全部字段逐项深比较一致。SHA256：`1d964f37b675c96b93a2db8812315a46821ca18498a6f772cb91d39bb5a6ab5d`。
- 私人 JSON 和测试临时数据只在被忽略的 release 目录，未上传网络、未进入 Git。
- `npm.cmd run typecheck`、31 项 `npm.cmd test` 通过。
- `node scripts/codex_check_sqlite_backup.mjs [备份路径]`：使用真实 Node SQLite 和 Android executeSet 参数约束，开启外键。修复前稳定复现截图错误；修复后模拟复听、恢复版真实备份、无封面副本均通过导入/导出、全部表事务回滚、跳过损坏封面、撤销恢复验证。
- `node scripts/codex_check_legacy_backup.mjs`：旧/新月报边界、坏字段拒绝、异步选文件、跳过封面选项、导入确认、无封面导出、切换清理过时导出、390px 页面无横向溢出通过。
- 上述为桌面 SQLite 和浏览器自动化，不能替代手机实际覆盖安装、文件选择与导入验收。

## 交付状态

正式签名构建、lintVitalRelease、版本及 APK 四份 Web 资源哈希核验通过，结果见 `release/codex_v261_verification.json`。APK 为 `release/xiaodongge-v2.6.1.apk`，67,936,373 字节，SHA256 `ee67dc84df4187ca1798ab50ccfb27606ad30a69a262fa3fc65375f81577da79`；签名证书 SHA256 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与 v2.6 一致。构建入口为 `scripts/build-android-release.ps1`，本次清理生成资源采用 `release/codex_build_v261.ps1`，只将已验证位于工作区的生成目录移到 release 留存。

本轮未执行 Git 提交、推送或 GitHub Release 发布。保留原有 `.gitignore`、两个 Capacitor Gradle 文件的换行状态，以及 `.claude/`、`claude_status.txt`。后续先让 Yves 覆盖安装 v2.6.1 并核对六条记录，再按要求发布热修复。

## 后续：本地旧版本整理

Yves 要求清理之前的版本。旧正式包及中间构建采用可恢复归档，未永久删除文件、未释放磁盘空间，也未删除 Git/GitHub 版本历史。

- `release` 顶层唯一 APK 为 `xiaodongge-v2.6.1.apk`。
- 旧 v2.2、v2.3、v2.5（含未签名包及签名附件）、v2.6 的 APK/校验文件分别移动到 `release/codex_archive_2026-09-08/v2.2/`、`v2.3/`、`v2.5/`、`v2.6/`。历史交接文档里旧 `release/xiaodongge-v*.apk` 路径现按此映射查找；GitHub 下载地址不变。
- 五份旧 Web 构建副本移入归档目录的 `generated/`，其中 `codex_ux_verified`、`codex_web_assets_before_v2.5` 的历史引用也按此映射查找。
- 共归档 74 个文件、333.78 MiB，逐文件 SHA256 前后相同。完整来源、目的地和哈希清单在 `release/codex_archive_2026-09-08/codex_manifest.json`，状态为 `verified`；恢复时按清单移回原路径即可。
- v2.6.1 APK、两份私人恢复 JSON、签名恢复脚本和证明文件的哈希保持不变；源码、数据库、截图证据和现有 Android 构建输出保留原位。工作区外的正式签名密钥和备用副本没有触碰。
- 验证仅需文件存在性、归档及保留文件哈希、Git 状态；没有改应用行为，无需重新运行产品测试。
