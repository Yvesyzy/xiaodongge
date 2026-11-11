# 卓易通兼容适配实施计划

**Goal:** 按官方公开限制完善文件/相册/复制/媒体退化路径，生成 3.1.4 原签名测试 APK。

**Architecture:** 复用 NativeExport、现有流写入和备份校验；所有改变依据运行能力，避免猜鸿蒙/容器私有标记。新增说明页按需加载。

**Tech Stack:** 当前 React/Vite/Capacitor、标准 Android Java/MediaStore、已有 Playwright/JUnit。

**Spec:** ../specs/codex_2026-10-09_zhuoyitong_compat.md

## 全局约束

不加依赖或广泛存储权限，不改数据库结构，不绕过恢复锁/事务/隐私状态，不写其他助手配置。保留 3.1.3 交付，不重试此前被工具审核拒绝的清理脚本删除。

## 1. 可复现检查

- [x] 新增 `scripts/codex_check_zhuoyitong_compat.mjs`，先验证复制回退、缺锁说明与相册入口在现有版本失败；输出独立证据。
- [x] 记录 30 条实时公开问答摘录及来源映射；相册文件名 JUnit 覆盖中文、路径、控制字符和长度边界。

## 2. 原生与用户路径

- [x] `NativeExportPlugin.java`：系统入口异常回执；单文件回调 null 检查/后台流写入；相册 pending 写入及失败清理。
- [x] `NowPlayingPlugin.java`：媒体服务缺失、异常和通知设置不可达回执；仅在诊断时报告本地服务存在性。
- [x] `nativeExport.ts`：复用旧 DOM 复制回退、模态框与焦点清理；所有文件保存调用统一校验成功回执。
- [x] `App.tsx`、`codex_JournalExport.tsx`、`codex_ReviewShare.tsx`、`codex_DiagnosticsPage.tsx`：复用复制、相册按钮、缺锁说明和文件互通指引。
- [x] 新增 `codex_CompatibilityPage.tsx`，从更多页进入；提供用户需要的文件/图片/权限操作；旧视口单位增加回退。
- [x] 政策 JSON 与原生政策版本同步；版本 3.1.4 / versionCode 34。

## 3. 验证和交付

- [x] 新适配 4 组、既有鸿蒙 4 组与隐私 5 组通过；全量导出/阅读/备份回归通过。
- [x] 使用发布脚本运行 27 项门禁、Android JUnit 11/11、Release/lint、签名和 20+3 资源核验。
- [x] 核对 3.1.3→3.1.4 升级关系、SHA-256、实际权限未变；更新交接与 codex_status.txt。
- [ ] 清理受自动审批阻断：批量与缩小到单个中间 APK 的删除均未执行，本阶段删除 0 字节，缓存/中间包保留；见 `codex_cleanup.json`。真实鸿蒙测试待设备验证。
