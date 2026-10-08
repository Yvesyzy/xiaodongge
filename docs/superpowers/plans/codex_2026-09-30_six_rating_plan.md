# 六项评分 Implementation Plan

> 执行方式：主线程顺序写入共享工作区；只读审查交给 `luna_worker`。未提供 superpowers 执行技能时按本计划执行。Yves 的自动执行指令优先于技能中的常规确认步骤。

**Goal:** 完成六项平均评分，并在同签名升级中保留原有记录与评分。

**Architecture:** 扩展既有评分字段与持久化映射，保留旧版 `ratingSongwriting`。表单直接从六项状态计算平均分，以 `output` 展示，备份解析保持兼容。

**Tech Stack:** React 19、TypeScript 6、Capacitor 8、SQLite、既有 Playwright 验证器、PowerShell 7.6.5 / Node 24.13.0。

**Spec:** `docs/superpowers/specs/codex_2026-09-30_six_rating_design.md`

## Global Constraints

- 工作目录 `D:\codex\workspaces\codex\小懂哥`；保留现有未提交改动。
- 新字段 `ratingLyrics`、`ratingComposition`、`ratingVocals`；旧 `ratingSongwriting` 不删除、不自动拆分。
- 每项 0.5–10 分、0.5 步进，六项平均分保留一位小数；未完整时保留原总分与修饰符。
- 备份版本 6，兼容版本 1–6；不使用用户真实数据库测试。
- 本地 APK 版本 3.1.0（30），包名 `com.yves.musicarchive`，沿用正式签名；不安装手机或发布。

## Task 1: 持久化兼容

**Files:** `mobile/src/types.ts`、`mobile/src/store.ts`、`mobile/src/entryDraft.ts`；检查 `quickCapture.ts` 与 `QuickCapturePage.tsx` 的既有调用。

**Interfaces:** `ReviewEntry` 和 `EntryInput` 增加可选 `number | null` 三字段；`EntryDraftFields` 增加可选 `string` 三字段。`Store.createEntry`、`updateEntry`、`exportBackup`、`importBackup`、`restoreImportUndo` 的签名保持原样。

- [x] 在 `scripts/codex_check_sqlite_backup.mjs` 用新增字段构造非空合成记录，保留其它缺失字段的旧记录，验证新增字段保留与旧缺失项规范为空。
- [x] 修改 schemaSql、按列检查、两个 INSERT、UPDATE、entryValues、rowToEntry、readEntry、validateEntry。所有 SQL 参数顺序一致，新值用 `?? null`，保留范围/半步校验。
- [x] 草稿解析仅包含实际提供的可选字符串字段，旧草稿原始数据保持可恢复；速记的空值映射补齐。
- [x] 验证 SQLite 往返/回滚/撤销及旧表新增列；新字段非法值应拒绝，不写入。

## Task 2: 表单、总分与详情

**Files:** `mobile/src/App.tsx`、`scripts/codex_check_interaction_accessibility.mjs`。

**Interfaces:** 六个状态直接传递既有 `RatingSlider`。`readDraftFields` 返回新字段；表单隐藏值与提交的 rating 同为当前六项平均分，旧分数仅在未补齐时使用。

- [x] 更新测试为制作、词、曲、人声、原创性、共鸣各 0.5，共鸣为 1 时总分 0.6；制作为 1 时总分 0.7，保存重载仍为 0.7。修改前检查明确失败于不存在的词滑块。
- [x] 加入新字段状态、记录和草稿恢复；删除旧四项平均分 effect，使用直接计算表达式：`Math.round(dimensions.reduce((sum, value) => sum + value, 0) / 6 * 10) / 10`，仅在六项非空时运行。
- [x] 多维模式用只读 `output` 展示总分和现有样式，旧词曲用文字展示和隐藏字段保存；同步保存、草稿依赖、详情展示。
- [x] 增加旧锁定/未锁定 ± 记录正文编辑不改分数、补齐后取平均、草稿重载、清空一项保留已有分数的检查；截图核对 320/390px 深浅主题。审查补充放弃草稿恢复全部评分的修复及检查。

## Task 3: 验证与交付

**Files:** `package.json`、`package-lock.json`、`android/app/build.gradle`、`README.md`、`codex_status.txt`、新交接总结。

**Interfaces:** `scripts/build-android-release.ps1` 现有构建流程；APK 元数据、正式签名证书与包内 Web 资源校验。

- [x] 将版本统一更新为 3.1.0，versionCode 为 30；保持包名与签名配置。
- [x] 最终运行 `pwsh -NoProfile -File scripts/build-android-release.ps1 -OutputDirectory release/codex_six_rating_delivery_20260930`，含26项全量工程检查、8项Android单测；中间失败与独立重现证据保留于交接说明。
- [x] 按现有正式签名脚本本地打包并检查版本/包名/证书及 APK 包内资源；使用独立 API36 AVD 和同签名仪器测试验证旧正式包覆盖升级、旧记录全部旧列保留及新增评分写回，不操作手机真实数据。
- [x] `git diff --check`；读取 cleanup 技能完成只读收尾检查；更新交接与状态，报告 APK 路径、测试结果及手机体验待验证。
