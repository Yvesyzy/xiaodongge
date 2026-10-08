# 原目录按功能分批提交 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将 Yves 已有的原目录源码和文档改动按功能提交到本地 Git，保留成品压缩包、备份及归属不明文件原位，不推送。

**Architecture:** 复用 Git 的补丁暂存与显式路径暂存。混合文件按实际 diff hunk 拆分；不为整理提交改写业务实现。主代理串行执行所有写入、暂存和提交，两个子代理只读核对 Windows 与宣传片依赖。

**Tech Stack:** Git 2.55.0.windows.2、PowerShell 7.6.5、Node 24.13.0、项目既有 TypeScript/Vite/Playwright/Node 检查。

**Spec:** `docs/session-summaries/codex_session_summary_2026-10-08_git_status.md`；Yves 在本会话选择第 1 项“按功能整理并分批提交原目录改动”，本计划直接在当前会话执行，不再要求执行方式确认。

## Global Constraints

- 工作根：`D:\codex\workspaces\codex\小懂哥`；起始 HEAD：`9ae4e01a037690e59aed1e9ac71091baa0e27acc`，分支 `main`。
- 本轮不写入 `D:\codex\workspaces\xiaodongge-windows`，不推送、不打标签、不发布。
- 保留已有业务源码字节；本轮计划、核查与交接记录新增或追加。完整门禁暴露榜单导航后的即时 count 断言竞态：首次失败、独立复测通过，错误捕获页已出现按钮；只为该验收脚本增加按钮出现的等待，保留原断言，不修改产品行为。
- 不执行 `git add .`、`git clean`、reset、rebase、amend、强推或移动原文件。原文档删除项只与已存在的归档文件配对暂存，形成重命名提交。
- 根目录宣传片 ZIP/SHA、0 字节 `({src`、`docs/skill-updates/` 中技能备份 ZIP 不纳入提交、不删除。
- 本轮证据、补丁及暂存树验证目录：`release/codex_git_commit_20261008/`，已由既有 `release/` 规则忽略。
- React 参考技能静态扫描为 `CAUTION`，本轮不启用；复用仓库现有检查，扫描报告只作本地审计。

## Task 1: 文档归档与历史清理证据

- [x] 核对 27 个旧路径与 `docs/session-summaries/` 中同名文件，保留搬迁后的实际内容。
- [x] 暂存历史总结、`docs/codex_v29_execution_ledger.md`、3 份既有计划的路径更新、`zcode_status.txt` 的既有路径改动、README 中纯归档路径/结构图改动。
- [x] 同批保留 9 月 28 日工作区整理、目录清理和截图去重交接及 `docs/codex_non_t_image_dedup_plan_20260928.md`/CSV、`docs/codex_release_inventory_2026-09-28.md`。
- [x] 检查暂存差异和重命名配对；提交 `docs: archive session notes and cleanup records`。

## Task 2: 分享分页样式修复

- [x] 仅暂存 `mobile/src/codex_JournalExport.tsx` 的 `codex_yearbook.css` 导入、`mobile/src/codex_reviewShare.css`、`scripts/codex_check_review_share.mjs` 和 9 月 30 日分享交接。
- [x] 验证分享专项与暂存快照类型检查；提交 `fix(share): load full-review styles and theme colors`。

## Task 3: 六项评分及旧数据兼容

- [x] 按实际 diff 暂存 `App.tsx`、`store.ts`、`QuickCapturePage.tsx`、`codex_check_draft_backup.mjs` 中评分段；其余桌面段保留。
- [x] 同批暂存 `entryDraft.ts`、`quickCapture.ts`、`types.ts`、`mobile/codex_journal_fixtures.mjs`、评分/SQLite检查、Android覆盖升级测试、`scripts/codex_start_six_rating_avd.ps1` 及六项评分规格/计划/交接。
- [x] 验证旧评分保留、缺项、均分、草稿恢复与 SQLite/备份回滚；提交 `feat(ratings): add six-part scores with legacy preservation`。

## Task 4: 阅读字数、按钮间距与本地版本

- [x] 暂存 `App.tsx` 的正文页脚与聚合操作链接段、`styles.css`、`codex_reading.css`、`codex_neumorphism.css`、阅读/聚合检查和验证器新增阅读入口。
- [x] 暂存 `package.json`/锁文件的现有版本段和 `android/app/build.gradle`，保持 `3.1.1 (31)` 一致；README 手机端版本/说明及两份阅读规格/计划/交接同批。
- [x] 验证阅读/聚合检查、版本一致性和暂存快照类型检查；提交 `fix(reading): show body counts and align action spacing`。

## Task 5: Android 构建等待修复

- [x] 仅暂存 `scripts/build-android-release.ps1` 的既有改动。
- [x] 使用 PowerShell AST 解析验证脚本；参考已保存的 JUnit/构建管道修复验收，不安装手机或重建 APK。
- [x] 提交 `fix(android): run unit checks without a nested shell`。

## Task 6: 原目录 Windows 移植源码

- [x] 根据只读核对结论暂存 `desktop/`、`mobile/src/codex_desktopBridge.ts`、桌面构建/检查脚本、设计图与规格/计划/交接。
- [x] 暂存共享界面的剩余桌面桥接段、`nativeExport.ts`、`nativeNowPlaying.ts`、`codex_restoreState.ts` 和 package/lock 中桌面入口及依赖。
- [x] 验证 Node 桌面单测、桌面 TypeScript 与 Vite 构建；不重打包 Electron 或操作真实播放器/用户数据库。
- [x] 提交 `feat(desktop): preserve Windows port and native bridges`。

## Task 7: 宣传片可重建源码与资产

- [x] 按只读核对的实际清单暂存 `codex_video/` 必需源码、素材、锁文件、授权与说明；不暂存成品、QA输出或根目录 ZIP/SHA。
- [x] 核对源码引用、时间轴、音频/字体及既有验收记录，不重复渲染视频；提交 `feat(video): add promotional source and assets`。

## Task 8: 本轮交接及最终验收

- [x] 保留必要的纯审计 JSON 与后续咨询/签名交接，排除技能回退 ZIP。
- [x] 在原工作区运行既有完整门禁一次：`node scripts/codex_verify_project.mjs --scope full --output release/codex_git_commit_20261008/validation`；检查结果 JSON 与各退出码。
- [x] 核对逐批暂存范围、类型检查、提交路径和白空间；恢复后核对当前验证快照与实时远端。相同树的普通合并已保留两边历史，后续隐私整改不纳入本轮。
- [x] 按任务文件清理规则检查：历史生成量已超过阈值；恢复时原验证目录已由其他会话清除。本次删除 0 文件，无新增临时物，必要结论写入最终 JSON 与交接。
- [x] 追加 `codex_status.txt`，保存本轮会话总结；提交 `docs: record local commit verification and handover`。
- [x] 回报实际提交列表、验证范围、仍保留在本地的文件和未推送状态。


## 恢复后的协作结果

7 个功能提交已完成。Yves 说明 WorkBuddy 也提交了部分更改；恢复时其他会话已提交剩余文档并清理原验证目录，保留其结果。重新完成 32 单测及两套类型检查后发现并行隐私整改持续写入；该新工作不纳入本轮收尾。

实时远端更新到 73d1630；普通合并 ee368f0 的合并前后树完全一致，只对齐历史。根目录成品 ZIP 经哈希复核后添加精确忽略规则。详细验证与边界见 docs/codex_local_commit_verification_20261008.json 和 docs/session-summaries/codex_session_summary_2026-10-08_local_commits.md。原完整门禁最终 27/27 通过，但其旧输出目录已不存在，不作为现存文件提供。
