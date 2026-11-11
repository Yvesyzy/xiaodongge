# 小懂哥好友圈实施计划

**Goal:** 实现独立社交服务和手机端账号、朋友、动态互动，保留私人档案和原分享链路。

**Architecture:** Node 24 内置 HTTP/SQLite 独立服务；懒加载 React 客户端；Android Keystore 会话存储。服务端、安卓新插件在独立临时工作目录并行生产，主代理审查后逐文件整合。

**Tech Stack:** 已有 React 19 / TypeScript 6 / Vite 8 / Capacitor 8；Node 24.13.0、node:sqlite、node:crypto；Android KeyStore。

**Spec:** `docs/superpowers/specs/codex_2026-10-10_social_network.md`。Yves 已在范围选择中批准好友圈方案；常规实现选择依其 AGENTS.md 自动执行，不追加等效选择审批。

## 全局约束

- 不开放旧 Next/Prisma 私人接口，不改本地数据库结构，不覆盖现有未提交修改。
- 只有主动发布快照上传；新接口、字段、限制严格遵照 spec。
- 所有外部请求使用有超时的 `privacyFetch`；Android HTTPS，token 不进入 localStorage/备份/日志。
- 新产物使用 codex_ 前缀；最终交接保留在当前项目。
- 浏览器 QA 输出在 `release/codex_social_validation_20261010`；此路径遵循 Yves 的项目内产物规则。
- 没有服务器配置时交付本机可运行版本，不冒充公网部署。

## Task 1: 独立服务端（隔离 worker）

Files: 新建 `social/codex_server.mjs`、`social/codex_server.test.mjs`、`social/codex_README.md`、部署配置（如确有必要）。

Interface: spec 全部 API；导出 `createSocialServer({ dbPath, allowedOrigins? })`，返回 `{ server, close }`，便于根代理启动隔离测试；CLI 仅在直接执行时启动。

- [x] 在独立目录写服务端安全/跨账号集成测试，数据只用合成临时数据库。
- [x] 实现独立建表、认证/限流/Origin检查、邀请双向确认、每条访问授权、幂等写入、退出和注销。
- [x] Run: `node --test social/codex_server.test.mjs`；全部通过后报告精确结果，根代理复核并重跑。

## Task 2: 安卓会话存储（隔离 worker）

Files: 新建 `android/app/src/main/java/com/yves/musicarchive/codex_SocialSessionPlugin.java`；必要纯 Java 验证 helper 与单测。根代理负责在 `MainActivity.java` 注册。

Interface: spec 的 `CodexSocialSession` 三个方法；不联网、不记录密码/凭据，不修改现有原生插件。

- [x] 读取当前原生插件/隐私/单测模式；在独立目录创建新插件。
- [x] 实现 AES/GCM Keystore 加密、输入校验、持久写入回执与损坏状态。
- [x] 根代理整合后 Run: `pwsh -NoProfile -File scripts/codex_check_android_unit.ps1`；检查实际编译结果，真机未验如实记录。

## Task 3: 手机端整合（主代理）

Files: 新建 `mobile/src/codex_socialClient.ts`、`codex_SocialPage.tsx`、`codex_social.css`；小范围修改 `App.tsx`、`nativeExport.ts`、`NativeExportPlugin.java`、`codex_privacy_policy.json`；更新 npm scripts 与 `.gitignore`。

Interfaces: 客户端 JSON 类型对应 spec；使用已核实的 `store.listEntries()`、`store.getEntry(id)`、`store.getEntryCover(entry)` 和 `privacyFetch`。每次切换服务端/退出使旧请求失效。

- [x] 实现显式 HTTPS 地址配置、内存/安卓加密会话、超时/错误/响应格式检查。
- [x] 实现账号入口、动态发布预览/选择乐评/隐私字段、动态分页、点赞、评论和删除。
- [x] 实现邀请/接收/取消/解除好友，账号退出/注销；用户删除需在产品内确认。
- [x] 复用系统图片分享；新增系统纯文字分享并保持 opened 回执，不虚报已发送。
- [x] 更新隐私政策，网络仍按同意状态控制；社交操作不写本地档案。
- [x] Run: `npm.cmd run typecheck:mobile`、`npm.cmd run mobile:build`；修复实际错误。

## Task 4: 综合验证与交付（主代理）

- [x] 使用现有 QA harness / Playwright 独立上下文，运行服务端与手机端两个账号真实联调；保存最小截图/结果。
- [x] 服务端 API 直接核验第三账号和解除好友权限；前端覆盖错误重试、刷新登录状态和窄屏无横向溢出。
- [x] Run: 现有相关隐私、原文分享和 Android 检查；根据调用影响选择现有验证集合，不重复无关全量测试。
- [x] 审查新 diff，不改动其他会话结果；更新 README、codex_status.txt 和会话交接。
- [x] 核对本聊天累计新增量；按实际规则处理已无用途的本任务临时物，保留源码和验证记录。

