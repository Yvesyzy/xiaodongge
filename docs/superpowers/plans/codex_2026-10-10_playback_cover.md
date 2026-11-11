# 当前播放自动封面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 识别系统当前播放时自动预览封面，保存乐评和速记时保存本地封面。

**Architecture:** 原生通道按需返回独立的 `coverDataUrl`，音乐元数据和首页轻量读取保持原有结构。表单将自动封面绑定作品身份并随草稿保留来源；自动保存只补缺失封面，手动上传仍可更换。

**Tech Stack:** 现有 Android/Java、Capacitor、React/TypeScript、SQLite、Playwright。

**Spec:** `docs/session-summaries/codex_session_summary_2026-10-10_cover_feasibility.md`，Yves 于 2026-10-10 已确认直接实施。

## Global Constraints

- 保留共享工作区已有修改；只读子代理复查，主代理负责写入、集成、验收。
- 沿用隐私同意与通知使用权校验；不扫描播放器私有目录，不读取其他通知正文。
- 只在新建/速记/编辑的当前播放读取请求图片；不增加后台持续收集。
- 图片缺失或读取失败不能丢失歌曲信息；限制输入体积、解码尺寸和网络时间。
- 自动封面不能覆盖已有封面；作品身份变化后不可将旧图保存给新作品。
- 兼容旧草稿和 JSON v6；不更改数据库结构。

### Task 1: 原生读取与桥接合同

Files: `android/app/src/main/java/com/yves/musicarchive/NowPlayingPlugin.java`、新增 `CodexNowPlayingArtwork.java`；`mobile/src/nativeNowPlaying.ts`、`mobile/src/nowPlaying.ts`。

- [x] 新增可选调用 `getCurrentTrack({ includeArtwork: true })`；无选项请求不解码图片。
- [x] 从同一会话读取 `METADATA_KEY_ALBUM_ART` / `METADATA_KEY_ART` / `METADATA_KEY_DISPLAY_ICON`，必要时读取可访问的 content/HTTPS URI；限制图片尺寸和输入字节，不处理任意本机文件路径。
- [x] 顶层返回 `coverDataUrl`；解析只接受有界的 PNG/JPEG/WebP data URL，异常图片单独舍弃。
- [x] Android 编译与 15 项单测通过；Bitmap instrumentation 编译通过，设备运行尚未验证。

### Task 2: 表单、草稿和保存

Files: `mobile/src/App.tsx`、`QuickCapturePage.tsx`、`entryDraft.ts`、`store.ts`；新增 `codex_playbackCover.ts`。

- [x] 根据 `entryCoverTarget` 和现有规范化构造身份绑定；图片解码成功后才预览。
- [x] 新旧草稿兼容地保存可选 `coverFromPlayback`，手动选择图片时清除此标记；编辑作品身份时清除不匹配的自动图。
- [x] 两种写作入口均将封面随记录保存；自动封面采用条件插入，已有手动封面保持优先。
- [x] 读取失败、切歌和手动选图竞态保留用户内容；封面保存失败不重复创建正文记录。

### Task 3: 验证与手机测试包

Files: `scripts/codex_check_capture_regressions.mjs`、新增或现有原生封面测试；隐私说明与版本文件、交接记录。

- [x] 合成桥接 PNG 验证完整乐评/速记预览、SQLite 封面持久化、草稿往返、既有封面保留、坏图降级和身份变化。
- [x] 执行 `node scripts/codex_check_capture_regressions.mjs --output release/codex_cover_20261010/capture-verified` 与移动类型检查。
- [x] 同步隐私说明，完成现有项目与 Android 检查，使用原签名构建版本递增测试 APK；核对资源、版本、签名和 SHA-256。
- [x] 记录实际验收范围，保留目标手机/鸿蒙兼容尚未验证的边界，并更新交接。
- [ ] 清理本聊天缓存：超过阈值，批量命令被自动执行审批审核拒绝，实际删除 0 文件，未重试或绕过；保留清单及最终 APK。

Self-review: 两种写作入口、草稿来源、手动优先、身份竞态和原生图片边界均有对应任务；本计划采用主代理集成与只读并行复查，不依赖未列出的技能安装。
