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
