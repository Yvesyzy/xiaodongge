# Windows 网易云当前播放读取排错

日期：2026-10-05（Asia/Shanghai）。作者：Codex。用户：Yves。

## 最新状态：2026-10-07 专辑与完整歌手修复

Yves 要求比较办法、拟定计划后直接解决。已在 Windows 主进程增加只读网易云播放队列补全，交付新便携程序；下面原包只读到单一歌手的记录属于修复前证据。正式个人档案未用于测试，网易云在验收后已恢复播放。

- 实播《当你环绕我》：专辑《商业与玩法》，歌手 `周乘羽 / 卡力老虎 / Matt吕彦良`。
- 完整乐评默认记录类型为专辑、标题为专辑名，歌曲字段保留《当你环绕我》；速记同样通过。已有手填标题和艺术家未被覆盖，正式记录数为 0，页面错误为 0。
- 暂停返回 `{"accessEnabled":true}`；恢复后再次返回完整歌曲、专辑及歌手。
- 10/10 Node 单测通过，覆盖 9 类补全/歧义/损坏边界。新 EXE 的 Windows 18 组回归和 12 组深浅主题/尺寸/缩放通过，包括便携目录搬移及屏蔽 HTTP/HTTPS 后冷启动、保存和导出。

新运行目录：`release/codex_xiaodongge_windows_3.1.1_x64_20261006_185159/`，EXE 为其中的 `codex_xiaodongge.exe`。同名 ZIP 为 170,688,564 字节，SHA-256 为 `1e5d9a0892cefc808a0f28564dce402d3fa3c529697b928e463122ea94fd2fed`。包内 98 项大小与哈希逐项通过，主进程/补全/SQLite/preload 与源码一致；原包 ZIP 的 SHA-256 仍为 `246e5ab276c910d3c1c4ad5de38357e62fa32211b03905931518d811322ca5c2`。目录时间戳沿用构建脚本的 UTC 格式，实际制作时间为北京时间 2026-10-07。

验收记录集中在 `release/codex_windows_album_acceptance_20261007/`：修复前/后 JSON、实际表单截图、原暂停恢复记录、18 组 Windows 验收及清理审计。设计和执行计划分别为 `docs/superpowers/specs/codex_2026-10-07_windows_album_metadata_design.md`、`docs/superpowers/plans/codex_2026-10-07_windows_album_metadata_plan.md`。

### 实现与可信边界

调用链为 `desktop/codex_main.cjs` 的 `getCurrentTrack` → 原生 `nowPlaying` → `desktop/codex_now_playing.cjs`。所有现有表单共用此返回，未改共享身份规则、表单守卫或 Android。新模块已进入 `scripts/codex_build_windows.mjs` 的复制清单。

只使用系统确认正在播放且来源为 `cloudmusic.exe` 的歌曲。`%LOCALAPPDATA%\NetEase\CloudMusic\webdata\file\playingList` 顶层为 `list`，使用 `resourceType === "track"` 的 `track.id`、`track.name`、`track.artists[].name` 和 `track.album.name`。两首目标曲目 ID 为 `3440172853` 和 `3440172363`，专辑均为《商业与玩法》。不采用已证实错误的 `fromInfo.sourceData` 或页面来源 `text`，不从历史队列或 FM 队列推断当前歌曲。

本机文件读取限制 8 MiB；只有精确、唯一、完整且无专辑冲突的记录才能补齐。暂停、其他播放器、歧义、坏文件或缺失文件保留原系统结果；队列只读，无新依赖、数据库变更或网络接口。Apple 精确查询与扩展查询均无目标歌曲，仍保留现有联网后备路径，不扩大共享匹配规则。

最小检查：`node --test desktop/codex_now_playing.test.cjs`；保持网易云实播后执行 `node scripts/codex_check_windows_playback.mjs`。后者检查最新 EXE 的完整乐评、速记、手填保护和系统暂停/恢复，并恢复播放。`scripts/codex_inspect_windows_sessions.ps1` 使用 Windows PowerShell 5.1，可只读枚举公开会话，也提供检查所需的 `Play`/`Pause` 控制。

### 2026-10-07 显式清理结果与剩余项

Yves 明确调用「任务文件清理」后，重新核对原清单、实际路径、运行进程、文件数量/字节数及 118 个保护哈希，再使用同一 PowerShell 运行时执行清理。原 10 个临时目标已全部不存在，实际删除 684 个普通文件、490,745,824 字节（约 468 MiB）。范围为六个实播/失败检查目录、旧设置诊断目录、Windows QA 的搬移副本及两个坐标诊断脚本；必要验收 JSON 和两张新版实播截图已集中保留。

最终运行目录、ZIP/SHA、源码、最小实播检查及原交付 ZIP 均保留，118 个保护文件大小/哈希一致。仅删除测试产物，没有新建测试 profile、重新运行整套测试或改变播放器状态；个人档案、视频、其他助手和其他任务的文件不在清理范围。

最后一个一次性执行脚本 `release/codex_windows_album_acceptance_20261007/codex_cleanup_execute.ps1` 的直接绝对路径删除命令被自动安全审核拒绝，仅返回 `blocked by policy`，没有更具体理由。因此当前清理状态为部分完成，剩余 1 个文件、4,918 字节，未报告为全部完成。累计生成量核实下限为 1,063,439,872 字节；已删量不扣回。精确路径、归属、实删量和剩余项见 `release/codex_windows_album_acceptance_20261007/codex_cleanup_checks.json`；交付检查的待清理数字已同步。

功能、打包和验收已完成；剩余脚本待删除策略允许后处理，或由 Yves 在资源管理器删除。后续日常验证使用新版 EXE。未提交、推送、上传或公开发布。

### 2026-10-07 上午当前歌曲确认

Yves 回复“我在放了”后，当前 WinRT 会话为 `cloudmusic.exe / Playing`，歌曲《我真的还想再活500年》，系统仍只提供歌手周乘羽、专辑为空。新版 EXE 的独立 profile 实播检查再次通过：补齐专辑《商业与玩法》和歌手 `周乘羽 / 卡力老虎`，完整乐评默认专辑、保留歌曲名，速记、手填保护和暂停/恢复通过，正式记录为 0，页面错误为 0，已恢复播放。没有修改业务代码或重打包。

新证据保留在验收目录中的 `codex_playback_confirmation.json` 和 `codex_read_now_playing_confirmation.png`；原检查目录 `release/codex_windows_live_playback_1791339543643/` 的 80 个测试文件、13,843,670 字节已在 Yves 后续显式清理请求中删除。

## 根因与处理

Yves 反馈 Windows 版在网易云正在播放《黄人至上》时提示没有读到歌曲。检查原生脚本、Electron 主进程、preload、共享解析及表单调用后，请 Yves 保持实际歌曲播放，复现 Windows `mediaSessionCount = 0`、原生返回 `{"accessEnabled":true}`。

本机网易云版本为 `3.1.41.205529`，安装路径为 `D:\LenovoSoftstore\Install\wangyiyunyinyue\cloudmusic.exe`。实际设置界面「设置 → 系统 → 开启SMTC」未勾选；启用后媒体会话立即变为 1，既有读取链可用。通过播放器界面勾选此选项，没有改动网易云文件、个人档案、业务代码或 Windows 运行包。

## 验证

- 原生读取成功：`title = 黄人至上`、`artistName = 卡力老虎`、`musicMetadata.sourcePackage = cloudmusic.exe`。
- 原交付 `release/codex_xiaodongge_windows_3.1.1_x64_20261004_171821/codex_xiaodongge.exe` 使用独立 profile 启动，真实歌曲自动填入乐评表单，页面错误为 0，正式记录计数为 0；没有自动保存乐评。
- 暂停时原交付包的原生脚本返回 `{"accessEnabled":true}`，没有误报歌曲；恢复播放后再次读到同一首歌。检查结束已恢复网易云播放。
- 这首歌的原生会话没有提供专辑字段；Apple 目录未找到可确认的匹配，表单保留实际歌曲及歌手，没有推断专辑。

早期设置诊断及隔离 profile 已清理。原暂停/恢复 JSON 保留为 `release/codex_windows_album_acceptance_20261007/codex_original_pause_resume.json`；修复前实播结果集中在同目录 `codex_playback_before.json`，新版实际表单截图及实播结果也保留在该验收目录。

最小实播检查：保持网易云播放后执行 `node scripts/codex_check_windows_playback.mjs`。该检查自动读取 `release/codex_windows_latest.json`，新建独立 profile，只检验真实网易云媒体返回与表单，不保存正式乐评。

早期两个固定窗口坐标诊断脚本已清理。暂停/恢复已改用保留的 `scripts/codex_inspect_windows_sessions.ps1` 原生控制，并由最小实播检查调用，无需依赖旧窗口尺寸或按钮坐标。

## 2026-10-05 阶段状态与交接

本机当前播放问题已解决，原 Windows 程序继续使用。根 README 和 Windows 使用说明已补充准确的网易云设置路径。未重新打包、提交、推送或发布；其他会话改动保留。

该阶段文件累计小于 200,000,000 字节；当时保留了诊断截图、最小检查及隔离 profile。后续专辑修复与显式清理已将必要结论集中保留，并删除这些临时目录；最小实播检查继续保留。

## 2026-10-07 实播复测

Yves 回复正在播放后，最初采样有两个媒体会话，原生接口返回 Windows 媒体播放器中的《小懂哥 — 私人音乐档案》。后续枚举只有网易云会话，先报告 `Paused`，再次采样报告 `Playing`。这些采样发生在不同时间，没有据此断言两个会话同时播放时的选择错误。

网易云进入 `Playing` 后，实际元数据为 `Title = 当你环绕我`、`Artist = 周乘羽`、`PlaybackType = Music`、`SourceAppUserModelId = cloudmusic.exe`，专辑字段为空。现有 Windows EXE 的独立 profile 实播检查通过：歌曲进入表单、页面错误为 0、正式记录数为 0；Apple 目录仍未找到可确认匹配。本轮没有改动业务代码、运行包或正式档案。

该阶段修复前实播结果已汇总到 `release/codex_windows_album_acceptance_20261007/codex_playback_before.json`，原临时目录已清理；不同时间的会话采样结论保留在上文。只读会话检查入口仍为 `powershell.exe -NoProfile -File scripts/codex_inspect_windows_sessions.ps1`，加载现有原生函数并枚举系统公开的会话状态及元数据。

当时两个实播检查目录及原诊断目录合计 29,513,523 字节，累计生成量低于 200,000,000 字节。后续专辑补全已经完成；上述临时目录已按显式清理请求删除，必要验收结果保留在统一验收目录。
