# release 历史测试结果与截图盘点（2026-09-28）

范围：D:\codex\workspaces\小懂哥\release。本次只读盘点，没有删除、移动或覆盖 release 文件。大小为文件逻辑长度，1 MiB = 1,048,576 字节。盘点前 Git main 与 origin/main 同步且工作区干净；release 无 Git 跟踪文件。

## 总量

| 项目 | 数量 | 大小 |
| --- | ---: | ---: |
| release 全部文件 | 10,437 | 14,471,366,048 字节（13.48 GiB） |
| 保留的 codex_np1_api36.avd | 47 个文件 | 12,602,864,554 字节（11.74 GiB） |
| 排除该 AVD 后 | 10,390 个文件 | 1,868,501,494 字节（1.74 GiB） |
| APK | 8 个 | 773,317,314 字节（737.49 MiB） |
| PNG/JPG 图像 | 2,092 个 | 518,624,964 字节（494.60 MiB） |
| JSON | 1,153 个 | 19,079,924 字节（18.20 MiB） |
| LOG | 1,415 个 | 1,988,656 字节（1.90 MiB） |

JSON 与 LOG 按扩展名统计，包含工作树配置和构建文件，不能全部视为可删的测试结果。按 result/report/manifest/evidence/profile/backup/diagnos 文件名筛出的 JSON 为 470 个，共 1,487,135 字节；其中 codex_results.json 有 146 份，共 770,617 字节。结果本身占用很小。

## 主要占用与用途

| 目录或文件 | 大小 | 判断 |
| --- | ---: | --- |
| codex_netease_playback_20260922/ | 319,137,774 字节 | 官方网易云在线实播与原生媒体会话证据；两个 APK 占 316,409,626 字节。保留真实复现材料。 |
| codex_playback_regression_20260926/ | 313,653,081 字节 | 播放回归及签名包；四个 APK 占 305,361,148 字节。交接文档明确 playback-triad.apk 是最终同证书测试包，另三个较早包不应再安装。 |
| codex_v301_build_20260928/ | 209,379,165 字节 | v3.0.1 构建、升级与验收证据。测试 APK 75,773,270 字节，与顶层正式 APK SHA-256 完全相同；.next 生成目录 95,957,783 字节，其中缓存 73,380,602 字节。 |
| codex_worktrees_20260917/ | 121,549,546 字节 | 含 3 个注册 Git worktree，不能整体删除。 |
| 顶层 codex_xiaodongge-v3.0.1.apk | 75,773,270 字节 | 当前正式安装包，保留。 |
| codex_worktrees/ | 39,568,113 字节 | 历史工作副本，本轮未证明可删除。 |
| codex_t10_native_initial_20260923/ | 37,782,812 字节 | OCR 边界测试输入：两个约 12 MiB JPEG 和一个约 12 MiB BIN，并非普通截图。 |
| codex_t06_drafts_20260923/ | 34,665,845 字节 | 注册 Git worktree，保留。 |
| codex_t06_backup_tests_20260923/ | 26,867,223 字节 | 注册 Git worktree，保留。 |
| codex_t11_negative_assets_20260924/ | 24,345,397 字节 | 资产篡改负向证据，两个字体副本占主要空间。 |

## 图像重复情况

图像分布在 106 个顶层文件组；37 个组各有至少 30 张，共 1,716 张、375,865,337 字节。12 个 codex_validation* 文件组有 324 张、71,185,654 字节。5 个注册 Git worktree 所在的三个顶层文件组包含 278 张、68,566,770 字节，不能按普通历史截图清理。

对全部 2,092 张 PNG/JPG 逐文件计算 SHA-256：241 组内容重复，额外副本 1,391 张、371,384,771 字节（354.18 MiB）。这是保留每种不同内容一份时的理论上限，不是可直接释放的空间。重复图大量分布于不同验收轮次的 rank/ 和 yearbook/ 目录；逐张删除会破坏报告路径与原始证据。

## 建议的下一轮清理顺序

1. 先核对 codex_playback_regression_20260926/ 中除最终 playback-triad.apk 外的三个旧 APK，共 228,762,942 字节（218.17 MiB）。playback-test.apk 与 playback-test-final.apk 的 SHA-256 完全相同；playback-verified.apk 是另一构建。删除前需核对引用、安装用途和回退需求。
2. 单独评估 codex_v301_build_20260928/checks/legacy-web/app/.next，95,957,783 字节（91.51 MiB）；其中 cache 为 73,380,602 字节。保留构建清单、验收结果、签名信息与正式 APK。
3. 再按完整测试轮次筛选重复截图；保留最终验收轮次、文档直接引用的路径以及失败/修复对照证据，生成精确清单后再清理。

当前保留 NP1 AVD、五个注册 worktree、正式 APK、网易云实播材料、playback-triad.apk、私人备份与签名材料。本轮没有执行删除。

## 后续执行：清理三个旧播放测试 APK

Yves 随后明确要求删除三个旧包。删除前逐项核对文件位于 release/codex_playback_regression_20260926/、不是重解析链接，且长度和 SHA-256 与盘点一致；三个文件均未被 Git 跟踪。已删除：

- codex_xiaodongge-v3.0-28-playback-test.apk：76,185,534 字节，SHA-256 B196A991AF4BFBA825B4C564F22ABBEF9DC9A5AD14F8CCADB09981EC29AF50BF。
- codex_xiaodongge-v3.0-28-playback-test-final.apk：76,185,534 字节，SHA-256 B196A991AF4BFBA825B4C564F22ABBEF9DC9A5AD14F8CCADB09981EC29AF50BF。
- codex_xiaodongge-v3.0-28-playback-verified.apk：76,391,874 字节，SHA-256 5904EA144E775D5089DFF69145F83950F92E9DCDACC717E5A1449F6BABAFEB11。

合计删除 228,762,942 字节（218.17 MiB）。复核三个旧路径均不存在，播放回归目录仅余 codex_xiaodongge-v3.0-28-playback-triad.apk 一份 APK，其 SHA-256 仍为 DDB9537E456F905055A59EF98259FCEE05B79612744FD165B49A1DC2175E9DF2。正式 v3.0.1 APK 与官方网易云测试 APK 的哈希也未变化。

当前 release 为 10,434 文件、14,242,603,106 字节（约 13.27 GiB）；排除 NP1 AVD 后为 1,639,738,552 字节（约 1.53 GiB）。APK 余 5 个，共 544,554,372 字节。上文“总量”表是删除前盘点快照，以本节为当前状态。

## 后续执行：清理未引用的历史测试目录

Yves 明确要求删除盘点出的历史测试目录。按 release 顶层实际目录名与项目文件全文检索，筛出 123 个没有被文档或脚本引用的目录。另用 Git worktree 清单排除所有登记工作树；被引用的回归证据、网易云实播目录、正式/最终 APK 和 NP1 AVD均不在删除范围。目标都位于 release 根目录，未含 .git、APK、签名密钥、.env 或音频；SQLite 文件名只发现测试脚本生成的 codex_legacy_fixture.db。

精确路径、原文件数/大小以及 19 个共享依赖 Junction 记录在 release/codex_test_cleanup_manifest_20260928.json。Junction 均指向项目根目录 node_modules；先逐个删除 Junction 项本身，再核实共享 node_modules 的顶层条目仍为 226，最后删除 123 个目录。目录删除共包含 4,109 个文件，逻辑长度 425,862,922 字节（约 406 MiB）；123/123 路径均不存在，无失败。所有 6 个 git worktree 仍存在。

以上数字是 123 个未引用目录清理完成时的快照：当时 release 有 66 个顶层目录、6,326 个文件，逻辑长度 13,816,774,845 字节（约 12.87 GiB）；当时保留 39 个 T 系列顶层目录。后续清理与当前状态见本文后续记录。

## 后续执行：复核并清理四项 T 系列输出（2026-09-28）

逐项核对剩余 39 个 T 系列目录后，清理两份被复核版取代的原始全量输出、两个已空目录，以及 T15 定向结果目录中的 Vite 缓存：`codex_t10_full_acceptance_20260924`、`codex_t15_full_20260924`、`codex_t12_final_20260924`、`codex_t14_native_20260924` 和 `codex_t15_final_20260924/vite-cache`。共移除 169 个文件、12,080,193 字节（11.52 MiB）；T10 初次 22/22 的历史结论及断言修正经过、T15 最终 25/25、T12/T14 APK 历史哈希仍保留在文档中。T06 两个 worktree、最终验收证据及其余文档引用目录保留。

T10 旧目录含一个指向项目根 `node_modules` 的 Junction。先只移除了该 Junction 项，再清理其余目录；项目根 `node_modules` 仍存在。T12/T14 文档已标明 APK 文件后来被清理，T10/T15 文档改为引用最终复核证据。记录提交 `2b1702c` 已推送 `origin/main`；清理后共有 35 个 T 系列目录。

## 后续复核：非 T 系列历史目录与图片（2026-09-28）

本节仅盘点，没有删除或移动文件。按 `release` 当前直接子目录统计：共 62 个目录（35 个 T 系列、27 个非 T 系列）、28 个顶层文件、6,157 个文件，逻辑长度 13,804,694,652 字节（约 12.86 GiB）；当前 APK 共 5 个、544,554,372 字节。非 T 系列目录共 3,561 个文件、13,457,999,124 字节，其中 `codex_np1_android_20260922/avd` 模拟器数据占 12,602,864,554 字节（约 11.74 GiB）。排除整个模拟器目录后，非 T 系列目录合计 855,067,610 字节（815.46 MiB）。

非 T 系列中有 572 个 PNG/JPG/JPEG 文件，合计 137,781,679 字节（131.40 MiB）。这些文件既包括界面截图，也包括应用图标、启动图等资源。逐文件 SHA-256 检出 108 组重复内容、306 份额外副本，理论重复长度 76,649,698 字节；重复组包含多份 Android 图标、启动图及测试图片，不代表这部分都能安全删除。全 `release` 当前共 1,239 个 PNG/JPG/JPEG 文件、323,217,716 字节。 逐张路径、大小、SHA-256 与相同摘要数量见 [codex_non_t_image_manifest_20260928.csv](codex_non_t_image_manifest_20260928.csv)。

扫描目录时跳过 14 个重解析链接：13 个指向项目根 `node_modules`，1 个指向 Android Cordova 插件目录；没有沿链接遍历或修改目标。27 个非 T 目录名均能在项目文档、状态、README 或脚本中找到引用。以下为逐目录统计，图像栏包含截图和资源图片，大小单位为 MiB（1 MiB = 1,048,576 字节）。

| 目录 | 文件 / MiB | 图像数 | 用途与复核结论 |
|---|---:|---:|---|
| `codex_android_unit_20260921_144240` | 5 / 0.030 | 0 | Android 单元测试结果，文档引用；保留。 |
| `codex_audit_v29_20260916` | 37 / 4.093 | 17 | v2.9 审计及可视化记录，计划和审计文档引用；保留。 |
| `codex_audit_v29_build_20260916` | 8 / 11.508 | 0 | 审计构建证据，审计交接引用；保留。 |
| `codex_capture_regressions` | 2 / 0.046 | 1 | `codex_check_capture_regressions.mjs` 的默认输出；保留。 |
| `codex_capture_review_fixed_20260922` | 2 / 0.046 | 1 | 修正后的播放捕获回归证据，交接文档引用；保留。 |
| `codex_dependency_drift_before_20260922` | 3 / 0.004 | 0 | 修复前依赖版本偏差证据，交接文档引用；保留。 |
| `codex_draft_dark_20260927` | 12 / 0.535 | 5 | 深色乐评最终复测截图与结果；保留。 |
| `codex_draft_records` | 3 / 0.146 | 1 | `codex_check_draft_records.mjs` 的默认输出；保留。 |
| `codex_mobile_experience_qa` | 2 / 0.133 | 2 | 阅读、回顾、分享三个检查脚本共用的输出目录；保留。 |
| `codex_netease_playback_20260922` | 29 / 304.353 | 1 | 网易云实播/媒体会话证据、官方 App 和测试 APK、测试音频；保留。 |
| `codex_neumorphism_qa` | 18 / 0.963 | 17 | 新拟态检查脚本输出及界面截图；保留。 |
| `codex_np1_android_20260922` | 63 / 12,019.092 | 1 | 唯一 NP1 AVD 数据与原生测试日志；保留。 |
| `codex_p1_security_20260917` | 5 / 0.027 | 0 | 安全审计结果，安全文档和台账引用；保留。 |
| `codex_playback_regression_20260926` | 69 / 80.958 | 6 | 播放回归证据及最终 `playback-triad.apk`；先前三个旧 APK 已清理；保留最终包。 |
| `codex_review_data_20260922` | 136 / 15.688 | 0 | 乐评/恢复检查数据，交接文档引用；含一条共享依赖 Junction；保留。 |
| `codex_v29_rank_qa` | 4 / 2.945 | 4 | 榜单海报检查脚本输出；保留。 |
| `codex_v30_release_20260925` | 165 / 9.168 | 45 | v3.0 构建、升级和验收证据；保留。 |
| `codex_v301_build_20260928` | 552 / 199.680 | 45 | v3.0.1 构建、升级截图、清单及测试结果；保留正式构建记录。内含 73,380,602 字节可再生成的 `.next/cache`，另有一个与顶层正式 APK SHA-256 相同的测试包副本。 |
| `codex_validation_2026-09-21T14-50-48-153Z` | 123 / 7.532 | 36 | 18 组完整验证证据，执行台账引用；保留。 |
| `codex_validation_2026-09-26T17-25-17-653Z` | 146 / 8.494 | 43 | 草稿箱/深色乐评 26/26 验收证据，状态记录引用；保留。 |
| `codex_validation_final_20260922` | 124 / 7.580 | 37 | 依赖重建后、Prisma Client 生成前的阶段性通过结果；文档说明它不代表最终锁定环境，保留为过程记录。 |
| `codex_validation_locked_20260922` | 3 / 0.007 | 0 | Prisma Client 未生成时的失败阶段记录，文档引用；保留。 |
| `codex_validation_locked_final_20260922` | 126 / 7.592 | 37 | 锁定依赖和生成 Prisma Client 后的最终 18 组集成证据；保留。 |
| `codex_validation_np1_20260922` | 17 / 0.070 | 1 | 独立复查前的 NP1 测试快照，文档明确标为非最终结果；保留过程记录。 |
| `codex_validation_review_web_20260922` | 66 / 0.204 | 0 | 旧 Web 隔离服务和 CRUD 回归证据；保留。 |
| `codex_worktrees` | 482 / 37.735 | 96 | `share`、`year` 两份旧源码副本。它们不在 Git worktree 列表中，`.git` 文件指向的管理目录不存在，`git rev-parse` 失败；内容尚未与主分支逐项比较，暂保留。 |
| `codex_worktrees_20260917` | 1,359 / 115.919 | 176 | `capture`、`data`、`native` 三个已登记 Git worktree；保留。 |

`codex_v301_build_20260928` 内的测试 APK 与顶层 `codex_xiaodongge-v3.0.1.apk` SHA-256 同为 `83e623d3092c3a2f84e463c4ecea4a5550c214795c4a10792d9a3da631870525`。清理缓存或重复包可释放空间，但本轮按盘点要求未执行删除。`codex_worktrees/share`、`year` 的 37.74 MiB 源码副本需先比较其文件与 Git 历史后再决定是否清理。
