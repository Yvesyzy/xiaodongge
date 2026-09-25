# 2026-09-23 T06 草稿备份与中断恢复交接

## 范围和结果

在 `codex/v29-p1`、基线 `b563e3249424cb72ff08846ce3c9698c20fc0d98` 的既有未提交工作区继续 v2.9 全量计划。本次完成 S2 的 T06（D4/D5）；下一项为 T07 统一作品统计，T08/T10 及 S3–S5 仍未完成。未提交、推送、发布或修改 Yves 个人档案。真实验证只使用新浏览器上下文、合成档案及项目专用 Android36 模拟器 `codex_np1_api36`，结束后模拟器已停止，ADB 转发为空。

草稿箱现在列出损坏草稿及原始内容，可复制、导出或经确认删除；计数与占用额相符。备份外部格式升为 v6，草稿以原键/原文保存；v1–v5 导入保留本地草稿，v6 空数组明确清空。草稿键与内容、重复项、配额以及冲突编辑草稿严格校验；含损坏草稿时拒绝声称完整的导出，不静默丢弃。无封面导出/导入会同时清除草稿中的待保存封面字段。

导入/撤销先写可恢复日志，再修改正式数据、Undo 槽与草稿；任一写入失败、重启或强制中断会在启动屏障下统一回滚到操作前。原生主库和 Undo 使用同一 SQLite 事务，草稿及日志跨 SQLite/localStorage 由日志保护。Web 同一 origin 使用 Web Locks 互斥，并拒绝在其他窗口打开或保存进行中时开始导入。恢复代次使旧表单、首页异步结果、封面转换等不能写回；页面恢复后重新挂载，成功和拒绝原因仍能显示。未知/损坏日志保留原文，进入只读抢救页。

## 验证证据

- `release/codex_t06_full_acceptance_20260923/codex_results.json`：20 组完整检查全部通过，退出 0；含基础测试、根/mobile 类型、质量门槛、构建、既有回归和反向故障注入。
- `release/codex_t06_full_acceptance_20260923/draft-backup/codex_draft_backup_results.json`：Web 与 Node SQLite 模拟桥均通过，31 个草稿/备份场景和 31 个故障点；Web 对 16 个实际持久写入边界逐一强制中断后重载，比较六集合原字节、Undo、草稿和设备状态。真实 UI 覆盖取消、导入提示、撤销提示、第二窗口拒绝及关窗重试。
- `release/codex_t06_native_acceptance_20260923/codex_native_draft_backup_results.json`：实际 CapacitorSQLite v6 导入、清空草稿、撤销通过；SQLite 已 COMMIT 后阻断后续 native/localStorage 写入，强制结束进程并重启，主表、Undo、草稿原文回滚与日志/屏障清除通过。两张屏障/恢复截图位于同目录。
- 最终 `assembleDebug` 成功；`release/codex_t06_native_acceptance_20260923/codex_t06_debug.apk` 为 82,563,081 字节，SHA-256 `485FD6349A5529E02218F6146BCDA3C31F48811C96F8CFBAF325DB23F494CE05`。它是调试产物，未签名发布；正式 v2.9 APK 未改。
- `git diff --check` 退出 0，仅 Git LF/CRLF 提示。首次全量运行因旧采集脚本未等待启动屏障失败，修复脚本时序后重跑；另一次草稿故障矩阵将页面滚动记录误计为备份持久写入边界，限定为实际备份键后通过；失败证据保留在原目录。

`review_data` 在实现前审阅契约，代码只读复查先报告聚合封面旧转换、恢复后页面重挂载、多窗口测试竞态，以及后续发现的拒绝提示丢失。主代理逐项修补并扩展 UI 回归；最终只读复核确认这些问题关闭。两名隔离执行者因代理额度错误中断，其遗留改动由主代理审查、选择性集成，不能记为执行者独立交付。

## 兼容和接续

旧版 APK 不能导入 v6 JSON，当前没有把 v6 自动降级为旧格式的工具；不要通过卸载应用尝试回退，否则可能丢本机数据。新版调试包也未进行 Yves 手机/正式签名覆盖安装验收。T06 真实 Android 验证只覆盖项目专用模拟器和所述故障路径，不能推断所有 OEM 或系统文件提供器。

下一项按计划是 T07：先对照 `sameAlbumIdentity`、`sameMusicIdentity`、首页 `calculateYearStats`、聚合列表及年记 `AnnualFacts` 的现有口径，确定缺艺人、目录 ID、重复记录规则，再在同一 fixture 下验证各入口的作品数、记录数和评分平均。T08/T10 及后续阶段按计划继续。执行台账见 `docs/codex_v29_execution_ledger.md`。
