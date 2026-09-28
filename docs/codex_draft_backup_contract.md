# T06 草稿备份与恢复契约

2026-09-23；对应已批准计划的 D4/D5。review_data 已完成实现前预审并条件放行，以下已补齐其交接与快照要求；不代表代码通过验收。

## 外部备份

- 导出格式升级为 `version: 6`，原 v5 字段保持，新增 `drafts: Array<{key: string, raw: string}>`。解析保留 `sourceVersion` 和 `draftsPresence: "absent" | "present"`。
- v1–v5 不得含 drafts，导入保留本机全部草稿；v6 必須含数组。v6 空数组表示替换为空，不能当作字段缺失。
- 复用 `entryDraft.ts` 的解析规则。新建 legacy 键、带非空 draftId 的新建键、带非空 entryId 的编辑键必须与内容严格对应；重复键、未知键、空后缀、无效 raw 全量拒绝。无 UUID 限制。
- 损坏草稿在草稿箱可见、可复制/导出原文、确认后可删除，不作为可继续编辑的草稿。含损坏草稿时拒绝生成声称完整有效的 v6 备份，引导先抢救整理，不静默略过。
- v6 替换整个草稿集合，预览显示新建/编辑数和本机将移除数；超过 10 份新建草稿拒绝，不截断。编辑草稿源记录缺失/更新不匹配则保留为冲突项，可抢救或手动转新建；转新建先可靠写入新键，再移除旧键，受配额限制。
- 不含封面导出或跳过封面导入同时清除有效草稿的 `coverDataUrl` 并设 `coverChanged=false`。其余字段保持；导入跳过封面时主封面集合保留。正常含封面路径保持 raw 原文。
- `backupHealth.ts` 新检查记录版本 6，并兼容读取历史版本 5 的健康记录。

## 内部快照与日志

外部备份仍走原 AppData 白名单，拒绝 `codex-restore-journal:v1`。用户导出排除恢复日志及设备备份健康。内部本机快照独立校验，不能借机放宽外部输入。

原生日志在现有 AppData 的 `codex-restore-journal:v1`；Web 日志在独立 localStorage 的 `music-feelings-restore-journal:v1`，不新增表。

日志：`version:1`、`operation:"import"|"undo"`、`phase:"prepared"|"data-written"|"rolling-back"`、`beforeBackup:string`、`beforeDrafts:Array<{key,raw}>`、`beforeAppData:Record<string,string>`、`beforeUndo:string|null`。Web 另保存 `beforeWebStorage:Record<string,string|null>`，只含现有六个主集合键，用于恢复其原始字节及键不存在状态；原生不使用此字段。

`beforeBackup` 包含经过原数据解析器验证的正式数据；`beforeDrafts` 保存草稿前缀下所有原键值，包括损坏原文，不按外部有效草稿规则过滤；`beforeAppData` 包含设备状态并排除日志本身；`beforeUndo` 保留原 UndoBackup 槽原文。

新撤销槽为内部封套 `{kind:"codex-import-undo",version:1,beforeBackup,beforeDrafts,beforeAppData,beforeWebStorage?}`，沿用已有 UndoBackup 表/现有 Web 槽。旧 v1–v5 撤销备份继续读取，缺少草稿表示撤销时保留当前草稿。新封套可恢复导入前损坏草稿原文，不能伪装成外部 v6 备份。撤销失败的日志还保留撤销前完整数据及原撤销槽，以便统一回滚。

## 并发与启动

- 同一 origin 使用 Web Locks。每个已挂载 App 保持共享会话租约，保障现有同步草稿/pagehide 保存；Store 外部异步入口也持共享锁直到全部异步工作结束，内部调用绑定原 Store，避免嵌套锁。
- 导入/撤销/恢复先启用本页写屏障并释放本页会话租约，再尝试独占锁。其他窗口仍打开或有存储任务未完成时，明确拒绝并提示关闭其他窗口/等待保存后重试，主数据、草稿、撤销点均零写入。不会偷偷排队后执行旧表单写入。
- 独占锁取得后才建立持久屏障 `music-feelings-restore-gate:v1` 并取快照。同步草稿的写/删入口和普通 Store 调用均检查屏障；恢复期间所有编辑暂停。它只表示暂停，恢复快照仍仅在上述日志中。
- 启动在 App 挂载前取得恢复锁、检查日志。所有未完成日志一律回滚；无日志但有遗留屏障说明数据操作未开始或已完整验证结束，持独占锁后才解除。未知/坏日志不删除，显示只读抢救页，提供原文与重试。
- 每次恢复尝试使本页旧异步调用代次失效；锁内再次核对。屏障及错误不会靠 React 按钮禁用代替底层保护。
- 不支持 Web Locks 的环境不得执行跨存储导入/撤销，明确提示，不能用不具备互斥性的计时器冒充锁。

## 写入状态表

### 预审补充（2026-09-23）

- 精确 Web 六键：`music-feelings-mobile-entries`、`music-feelings-mobile-summaries`、`music-feelings-mobile-monthly-summaries`、`music-feelings-mobile-covers`、`music-feelings-mobile-listening-moments`、`music-feelings-mobile-app-data`。`music-feelings-mobile-import-undo` 只进入 beforeUndo；日志、gate、损坏隔离槽均不进入六键快照。beforeBackup 为有效 v6 正式数据，drafts 固定空数组，AppData 排除设备健康及日志；beforeAppData 保留全部设备状态。恢复前校验六键原文解析后的数据与 beforeBackup/beforeAppData 一致。
- 回滚在独占锁和已校验日志下直接还原六键原文，不调用普通完整性守卫写函数；不删除或覆盖损坏隔离槽。清除隔离原文也检查恢复屏障。
- importBackup、restoreImportUndo、recoverPendingRestore、getRecoveryEvidence 不走普通共享锁 Proxy；其内部 this 绑定原 Store。previewImportUndo 改为纯读取，损坏撤销槽保留并报错。
- Home 初始化、封面文件转换、表单多步保存、备份健康保存等在工作流开始捕获代次，每次 await 后的后续写入前检查代次；天气请求整体留在 Store 共享锁内。恢复后的旧 continuation 不得再写。回归覆盖延迟 Home 和天气返回。
- 释放会话租约必须等待 request Promise 结束；pagehide 不主动释放租约。成功后在持久 gate 仍存在时重新取得共享租约，再比对本轮 gate token 后清除 gate。gate/prepared/日志移除/gate 清除失败保留可重试只读状态，不报告成功。
- 编辑草稿 draftId 必须为 null；新建 legacy 的 entryId、draftId、baseUpdatedAt 都为 null。
- exclusive 回调结束前先提交 shared-session request（不在回调内等待），释放 exclusive 后等待该 request 取得租约，再核对 token 并清除 gate；token 不符保留 gate，进入只读。普通 pagehide 不释放会话租约。
- 原生回滚以 beforeAppData 为完整 AppData 真值，替换 beforeBackup.appData（不合并目标状态），再加入当前 rolling-back 日志。校验 beforeBackup.appData 等于 beforeAppData 排除设备健康后的用户数据，矛盾快照拒绝恢复。

| 边界 | 写入 | 中断/异常 |
|---|---|---|
| 无日志 | 独占锁内取并校验 before；写 prepared 日志 | 日志未写成功不改变主数据/草稿/原撤销点 |
| prepared | 原生单个 executeSet 写主数据、新撤销槽、data-written 日志；Web 在日志保护下依次写六集合及撤销槽 | 任意失败/重启都恢复 before，不继续导入 |
| data-written | 逐个写入目标草稿，再移除目标不存在的原草稿；回读全部目标数据、草稿、AppData、撤销点 | 任意位置中断都恢复 before |
| rolling-back | 先记录回滚阶段；原生单事务恢复主库/AppData/原撤销槽并保留日志；Web 还原六键原文；再还原草稿精确集合 | 失败保留日志与屏障，禁止编辑；重启/重试执行同一次幂等回滚 |
| 验证完成 | 仅在完整目标或完整 before 核对一致后移除日志，最后解除屏障并重新持会话租约 | 日志移除失败仍为未完成；不显示成功，不丢弃快照 |

## 验证与文件责任

主代理：`store.ts`、`main.tsx`、`backupHealth.ts`、恢复屏障模块/启动界面、App 的备份页、契约与集成。独立 D4 执行者仅在隔离工作区改 `entryDraft.ts`、App 的草稿相关区域和草稿回归；主代理审查后按文件/区域集成。

新增 `scripts/codex_check_draft_backup.mjs`：v1–v6、空/缺字段、重复/无效键、超过配额、无封面字段往返、冲突、取消、撤销及每个持久写入点中断；重载后精确比较 before。Web 两窗口验证自动保存/导入互斥及恢复后重试。SQLite 使用既有 Node SQLite 桥接故障注入，同时保留真实 Capacitor SQLite 验证层级，不把模拟当作真机。

根/mobile 类型与现有 storage/capture/sqlite/legacy/native/完整入口回归仍必需。测试只用新上下文、合成档案和专用测试设备，不操作 Yves 的正式数据，不修改数据库结构。
