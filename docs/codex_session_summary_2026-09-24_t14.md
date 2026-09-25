# T14 恢复差异与隔离预演交接（2026-09-24）

在 `codex/v29-p1` 未提交工作区完成 T14。备份页现在先显示格式校验，再由“预演恢复并查看差异”对正式记录、年度/月度总结、重听记录、封面、榜单/AppData、草稿分别展示新增、同 ID 更新、相同、本机将移除数量。预演通过后才允许点击正式导入；正式导入仍要求覆盖确认。报告绑定输入备份 SHA-256、跳过封面选项、本机正式数据与草稿摘要；文本/选项变化清除报告，本机变化在提交前及独占锁内再次拒绝，零写入的过期拒绝不会留下恢复屏障。

解析沿用 `parseBackup`，新增 ID/唯一年份与月份的重复检查、ListeningMoment 来源引用检查；封面键继续由现有解析器校验。隔离预演沿用正式 `writeBackup`，Web 写入独立内存 Storage 后回读六集合、草稿和撤销槽；Android 使用随机 `codex_restore_preview_` 专用 SQLite 文件和隔离草稿存储，事务写入后经真实 CapacitorSQLite 插件回读，再关闭连接。预演不写正式数据库、草稿、撤销槽或备份健康。预演只能证明当时的格式、逻辑写入与回读；正式设备容量和系统文件选择器是独立边界。

Web 合成用例 `scripts/codex_check_restore_preview.mjs` 覆盖七类差异、跳过封面、v5 无草稿保留、坏引用、重复 ID、坏封面键、过期报告和配额注入。`release/codex_t14_full_20260924/codex_results.json` 显示 24/24 组检查通过。最后改动仅为备份页“格式校验通过”提示，受影响的旧版备份、草稿备份和恢复预演用例再次验证于 `release/codex_t14_final_targeted_retry_20260924/`。首次定向复测发现草稿脚本在异步确认框显示前立即读取文案，改为等待确认框事件后原样复测通过；产品导入流程没有回退。

项目专用 Android36 `codex_np1_api36` 模拟器安装调试包后，`scripts/codex_check_restore_preview_android.mjs` 通过真实插件验证：隔离库创建前不存在、`executeSet` 事务和回读完成、连接关闭、临时数据库仍存在；正式 SQLite 七张表和整个 Web 存储前后逐字节一致。再注入隔离 `executeSet` 写失败，连接仍关闭，页面报告失败，正式数据继续一致。证据 `release/codex_t14_android_final_20260924/codex_results.json`。调试包 `release/codex_t14_native_20260924/codex_t14_debug.apk`，88,531,483 字节，SHA-256 `BFBF74063D13256C19DA79D3515D2043B994791162057523009FF94734D7241B`；它包含 T14 功能代码，最后的文字提示改动没有重新打包。

临时 SQLite 数据库留在项目模拟器内；依据计划及 AGENTS 的删除授权约束，本轮未删除任何数据库。模拟器已停止，ADB 设备和端口转发为空；没有接触 Yves 个人手机、提交、推送或公开发布。T12 冷启/首次导出门槛仍未关闭；下一项为 T15 跨年专辑轨迹。
