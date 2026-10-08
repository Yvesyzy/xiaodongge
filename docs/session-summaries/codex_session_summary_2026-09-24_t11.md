# T11 发布质量入口交接（2026-09-24）

在 `codex/v29-p1` 的未提交工作区完成 T11。正式构建入口 `scripts/build-android-release.ps1` 现在先运行 22 组项目全量检查与 8 项 Android JUnit，再清理已核实的生成目录、重建网页资源、Capacitor 同步、Gradle `assembleRelease`/`lintVitalRelease`、核对签名/版本/包名与 APK 内资产集合。任一步失败即停止，不会复制交付 APK。`package.json` 的构建命令改用 PowerShell 7；旧 2.1.9 验证脚本已标明历史用途，不在当前入口调用。

版本的真实来源是 `android/app/build.gradle`：`versionName=2.9`、`versionCode=27`，比原发布 APK 的 26 正好高一档。脚本显式检查 npm `2.9.0` 与 Android `2.9` 的零补丁表示差异，并核对 `capacitor.config.ts` 的 appId。当前正式证书 SHA-256 是 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`；原发布 v2.9 包哈希 `f8923da74bb59af85bf5c86fee582e6890f4327f8091ce28c5154247fa0968c0` 仍不变。

新的 `scripts/codex_verify_apk_assets.mjs` 逐项比较清洁 `mobile/dist`、Capacitor staging 和 APK `assets/public/` 的文件集合与 SHA-256，只额外接受已确认 0 字节的 `cordova.js`/`cordova_plugins.js`。APK 的 `native-bridge.js` 与两个 Capacitor JSON 分别同真实来源比哈希；其余 `assets/` 下的额外 JS、CSS、HTML、JSON 或字体文件会拒绝。39 个 APK 资产均列入哈希清单，其中 9 个 public 文件和 3 个受控平台文件完成精确核对；其余是 ML Kit 模型及 Android 启动配置文件。资源报告只能写入项目 `release/`，已有报告不能覆盖。

最终本地签名测试包：`release/codex_t11_signed_test_delivered_20260924/codex_xiaodongge-v2.9-27-test.apk`，79,270,327 字节，SHA-256 `961fffb76bd280ab9b677cf1db86a0872f2d69eb988c6f376edef6f9cd5c9bc6`。同目录 `build_manifest.json` 记录源提交/dirty 文件、版本、签名、大小和哈希；`checks/codex_results.json` 为 22/22 通过，`android-unit/` 为 8/8 通过，`assets.json` 为资源清单，`gate.log`、`android-unit-gate.log`、`mobile-build.log`、`capacitor-sync.log`、`gradle.log` 留存执行输出。该包没有安装到 Yves 手机，没有覆盖 v2.9 原包，也没有提交、推送或公开发布。

`release/codex_t11_negative_assets_20260924/` 保留受控负向证据：staging 旧 JS、staging 文件改动、APK public 旧 JS、APK public 文件改动、APK 非 public 旧 JS 均使资产检查返回非零；输出写到 `docs/` 或覆盖已有报告亦被拒绝。临时注入 TypeScript 错误使发布入口停在类型检查，未生成 APK；暂改 versionCode 为 26、暂改预期签名摘要均在预检被拒绝。所有临时源码修改经原字节备份恢复，恢复哈希核对通过。`release/codex_t11_negative_type_20260924/` 保存类型失败时的检查日志，正常完整检查随后重跑通过。

复查先指出输出与递归清理路径的祖先 junction 可能越界；现已在解析 `release` 前检查重解析点，并逐级拒绝输出路径和两个生成目录中的任何 `LinkType`/`ReparsePoint`，清理还要求目标为目录。独立只读复核确认代码边界已关闭。自动审批审查拒绝了创建/移除 junction 的实测命令，工具仅给出 `blocked by policy`，因此没有该项实际 junction 故障注入证据；未尝试绕过。普通越界输出路径已实测拒绝且未创建目录。

本次发布检查还暴露了旧草稿回归把今日重逢日期固定为 2026-09-23 的跨日误报；已改为读取浏览器本地日期。定向草稿矩阵及最终 22 组全量检查通过。下一工作包是 T12 同一项目 AVD 上的性能基线、按需加载和全字形字体评估；随后继续 S4 五项创新与 T18 集成验收。
