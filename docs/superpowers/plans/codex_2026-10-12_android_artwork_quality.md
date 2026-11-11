# Android 封面清晰度实施计划

**Goal:** 取消自动封面的额外分辨率和有损编码损失，构建原签名覆盖安装测试 APK。

**Architecture:** 保持 NowPlaying 同会话桥接，原生比较候选，URI 原字节、Bitmap 原尺寸 PNG；前端扩大合法封面范围，复用存储与竞态保护。native worker 仅在隔离副本修改原生/helper/测试，主代理负责前端、集成、运行验证和交付。

**Spec:** `docs/superpowers/specs/codex_2026-10-12_android_artwork_quality.md`

工作根 `D:\codex\workspaces\codex\小懂哥`；已有 Android API36 SDK/JDK21、Node24.13.0、PowerShell7.6.5，原签名由既有构建脚本加载，不输出凭据。输入为现有源文件和合成媒体图片；证据/隔离副本位于 `release/codex_android_quality_20261012`，最终签名包使用独立 `release/codex_android_quality_signed_20261012`。可用系统镜像 API36/google_apis_playstore/x86_64；如运行模拟器，仅创建项目内独立 AVD，不使用个人 Pixel_8a 数据。保留现有被自动审批阻断的其他任务清理脚本，不重试。

- [x] Native worker：原生/helper测试隔离副本已交付；主代理核对基线后串行集成，并修正高精度Bitmap、坏图验证和同次调用回退。
- [x] 主代理：更新 `mobile/src/codex_playbackCover.ts` 的字节/像素验证及 `scripts/codex_check_capture_regressions.mjs` 大图/草稿/备份断言；960×640、1,902,968字节PNG在预览、草稿、SQLite及完整备份中保持原SHA-256。保留共同工作区他人修改。
- [x] 验证：31/31完整工程门禁、30/30 Android JUnit、最终原签名APK的15/15图像instrumentation，以及独立F16/P3精度探针通过。补齐连续读取与真实content提供者测试，修复线程交接窗口，保留原有安全断言。
- [x] 交付：原签名3.4.1(39) APK与SHA已核验，README／交接已更新，未推送／发布。清理557普通文件、1个任务junction；34保护摘要不变，保留最终包、必要源码／复现检查和验收记录，详见交付目录`codex_cleanup_checks.json`。
