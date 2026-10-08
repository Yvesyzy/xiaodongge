# 正文字数与聚合按钮间距 Implementation Plan

> **For agentic workers:** Execute inline in the current session; preserve all existing worktree changes. Yves has authorized routine UI and equivalent implementation choices without confirmation.

**Goal:** 修正聚合页操作间距并在正文右下角显示字数。
**Architecture:** 复用现有聚合链接样式和正文 article，字数直接从当前记录读取。扩展既有浏览器检查，不增加依赖或存储结构。
**Tech Stack:** React、CSS、TypeScript、Vite、Playwright。
**Spec:** `docs/superpowers/specs/codex_2026-10-02_reading_spacing_design.md`

## Global Constraints

- 格式固定为 `字数：XXXX`，位于正文末尾、听感注记之前。
- 统计表达式为 `entry.content.trim().length`，保持报告统计口径。
- 保留六项评分、旧记录、分享行为和其他未提交修改。
- 新文档和证据使用 `codex_` 前缀，仅写入当前项目。

## Task 1: 聚合页间距

Files: `mobile/src/App.tsx`、`mobile/src/styles.css`、`scripts/codex_check_album_relisten.mjs`。

- [x] 在既有专辑/歌曲聚合回归中，验证封面、重听按钮、跨年按钮、记录列表之间均有 18px 间隔；记录修改前的失败。
- [x] 两个聚合链接使用 `aggregate-action-link`，替换原来的单按钮类；样式为 `display: flex; margin-bottom: 18px;`。
- [x] 检查 320/390/430/768px 与深浅主题下的间距、无溢出及重听/跨年链接目标。

## Task 2: 正文字数

Files: `mobile/src/App.tsx`、`mobile/src/codex_reading.css`、`scripts/codex_check_reading.mjs`、`scripts/codex_verify_project.mjs`。

- [x] 扩展阅读检查：短文 `  正文 ABC，123。\n第二行🎵  ` 显示 `字数：17`；长文及四种类型的计数正确，位于 article 末尾、听感注记之前。
- [x] 在正文 article 内增加 `<footer className="content-word-count">字数：{entry.content.trim().length}</footer>`，设置 16px 上间距、13px 小字、右对齐与现有 muted 颜色。
- [x] 阅读检查复用 `qaOptions` 参数并纳入项目验证器，测试正文编辑保存后字数更新以及正文/评分未被阅读修改。

## Task 3: 验证与交接

- [x] 首次针对性门禁的基础检查通过，阅读导航检查失败后修正测试流程；最终由签名构建完成全部 27 项门禁，结果 `release/codex_ui_polish_delivery_20261002/checks/codex_results.json`。
- [x] 阅读截图发现重听按钮贴着分隔线，在 `codex_reading.css` 设置操作行 16px 上边距，并检查实际布局。
- [x] 递增 `android/app/build.gradle`、`package.json` 和 `package-lock.json` 为 `3.1.1 (31)`；执行 `pwsh -NoProfile -File scripts/build-android-release.ps1 -OutputDirectory release/codex_ui_polish_delivery_20261002`，通过完整工程门禁、Android JUnit、签名/版本与资源校验。
- [x] 修正 `build-android-release.ps1` 单测调用的多余 PowerShell 子进程，并以新 Gradle 启动复查 8 项单测、正常管道返回。
- [x] 目视核验新截图，检查 `git diff --check`，关闭本轮测试进程，保留证据。
- [x] 更新 `codex_status.txt` 与 `docs/session-summaries/codex_session_summary_2026-10-02_reading_spacing.md`，报告实际验证和交付状态。
