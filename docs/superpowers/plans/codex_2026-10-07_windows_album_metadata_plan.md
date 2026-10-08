# Windows 专辑读取修复执行计划

对应设计：`docs/superpowers/specs/codex_2026-10-07_windows_album_metadata_design.md`。Yves 已授权比较方案后直接执行。采用标准库和已存在的网易云数据，不增加依赖，不改共享表单或 Android。

1. 新增 `desktop/codex_now_playing.cjs`：对原生返回的网易云当前歌曲，只读有大小限制的本机 `playingList`，精确且唯一匹配 `track.name` 与 `track.artists[].name`，验证已有专辑无冲突，再返回完整歌手和专辑。失败保留原生结果。
2. 新增 `desktop/codex_now_playing.test.cjs`：用已核实的公开曲目结构和合成冲突记录检查正常补全、其他来源、暂停空结果、同名歌、版本歧义、字段损坏、专辑冲突、文件缺失/损坏/超限。运行 `node --test desktop/codex_now_playing.test.cjs`。
3. 将主进程 `getCurrentTrack` 接入补全函数；打包脚本复制新增模块。扩展 `scripts/codex_check_windows_playback.mjs`，检查专辑优先记录、原歌曲名、完整歌手、暂停不读取和正式记录数为零。所有真实 UI 检查使用独立 profile。
4. 构建新的 Windows 便携版。运行现有 `scripts/codex_check_windows.mjs`，以及增强后的实播检查；核对实际网易云曲目与表单。若仍有未通过项，修复后只重测受影响项。
5. 更新 Windows 使用说明、README、播放修复交接及 `codex_status.txt`。保留最终运行目录、ZIP、SHA-256、小型验收报告和最小检查。达到累计 200,000,000 字节阈值后按任务文件清理技能删除本聊天已完成任务的 profile、复制运行目录及无用诊断截图，再核对最终哈希和引用。

验收结果随后写入交接记录；原包和个人档案不在本次删除范围。

## 执行结果

步骤 1–4 已完成，10/10 Node 单测、新 EXE 实播、18 组 Windows 回归和 12 组布局检查通过。运行目录为 `release/codex_xiaodongge_windows_3.1.1_x64_20261006_185159/`，98 项 ZIP 内容大小/哈希通过。

步骤 5 的文档及证据整理完成。Yves 显式调用任务文件清理后，原 10 个临时目标已全部删除，实际删除 684 个普通文件、490,745,824 字节，118 个保护文件大小/哈希一致。最终运行包、ZIP/SHA、源码、最小检查及必要实播/回归记录保留。

本次一次性清理执行脚本的直接删除命令仍被自动审核拒绝，返回 `blocked by policy`；剩余 `release/codex_windows_album_acceptance_20261007/codex_cleanup_execute.ps1` 1 个文件、4,918 字节，清理状态为部分完成。精确审计为 `release/codex_windows_album_acceptance_20261007/codex_cleanup_checks.json`，详细交接为 `docs/session-summaries/codex_session_summary_2026-10-05_windows_now_playing.md`。
