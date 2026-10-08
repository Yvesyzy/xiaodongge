# Android 隐私整改实施计划

**Goal:** 落实Yves已选择的安卓隐私、SDK和权限整改。

**Architecture:** Android原生保存版本化同意；React先读取状态再挂载应用，共享敏感调用检查；MLKit按需初始化及受同意控制的后台组件。沿用现有数据库、桥接和UI，无新依赖。

**Tech Stack:** React/TypeScript、Capacitor、Java/Android、Playwright、既有JUnit检查。

**Spec:** `docs/superpowers/specs/codex_2026-10-08_android_privacy.md`

## Global Constraints

- 不改数据库结构、包名、签名、Windows行为；保留其他会话改动。
- 新文件使用`codex_`前缀；worker写操作在独立复制工作区中进行，主线程检查差异后集成。
- 身份和联系信息来自Yves明确回复，缺失不能猜。无注册、付款、托管部署或商店提审。
- 原生状态契约与policyVersion完全按设计文件；版本不符和桥接失败默认阻断敏感功能。

## Task 1: 原生同意、SDK和权限

文件：新增`android/app/src/main/java/com/yves/musicarchive/codex_PrivacyPlugin.java`；修改MainActivity.java、NowPlayingPlugin.java、ScreenshotOcrPlugin.java、AndroidManifest.xml；必要的最小原生检查放已有test目录。

- [ ] 原生SharedPreferences状态、版本检查和提交错误处理；媒体/目录/通知设置/OCR入口校验。
- [ ] 移除MlKitInitProvider，OCR时显式初始化；DataTransport组件默认禁用，撤回禁用并取消对应jobs，保存成功后关闭进程。
- [ ] 移除USE_BIOMETRIC/USE_FINGERPRINT合并权限，保留实际需要项；编译检查最终合并manifest。

## Task 2: React同意流程与联网边界

文件：新增`mobile/src/codex_privacy.ts`、`codex_PrivacyGate.tsx`及政策内容；修改main.tsx、nativeNowPlaying.ts、store.ts、App.tsx、QuickCapturePage.tsx。

- [ ] 在StorageGate之前读取原生状态，提供首次同意/拒绝和政策说明，读失败可重试。
- [ ] NowPlaying共享包装、天气fetch包装和取消、OCR校验、网络封面限制；拒绝仍能保存本地记录。
- [ ] 隐私页增加状态及开启/撤回操作，撤回前确认退出后果并检查恢复状态。
- [ ] 更新政策披露及用户提供的身份/邮箱，生成相同内容的独立HTML供后续发布。

## Task 3: 验收与交接

- [ ] 新增一个可运行Playwright隐私检查，覆盖状态流、无同意调用拦截和数据保留；更新已有Android模拟桥接的同意返回。
- [ ] 运行`npm test`、`npm run typecheck:mobile`、隐私检查及直接相关捕获/存储回归。
- [ ] 运行既有Android unit脚本，检查provider/后台组件/权限与OCR按需初始化；设备可用时进一步实测，未做的明确记录。
- [ ] 更新审查整改状态、session summary、codex_status.txt；核算本聊天文件生成量，达到清理阈值时按技能处理。

本计划由当前线程直接执行；已获Yves对整改工作的选择，正常实现决策不再次暂停询问。
