# 鸿蒙兼容与启动优化实施计划

**Goal:** 修复有代码证据的旧 WebView 兼容问题与首页重复开销，交付可覆盖升级的原签名测试 APK。

**Architecture:** 复用现有 Store、封面解析和身份匹配规则；网页入口在应用模块运行前补齐缺少的标准 API。首页一次数据快照、一次封面读取，原生媒体读取独立于首屏提交。

**Tech Stack:** React 19.2.7、Vite 8.1.0、Capacitor 8.4.1、Android Java、现有 Playwright/Node 检查。

**Spec:** ../specs/codex_2026-10-09_harmony_compat.md

## 全局约束

- 不改数据库结构、不加权限、不更换签名、不上传或发布。
- 保留恢复日志、隐私检查、generation 屏障与现有身份合并语义。
- 桌面浏览器能力模拟和 CPU 降速不等同鸿蒙实测。
- 在当前聊天直接实施；自动执行用户已授权的常规选择。

## 1. 基线与可运行检查

- [x] 采集 3.1.2 生产 Web 基线；清理后摘要保留在最终目录 `earlier-evidence/`，临时完整网页副本已删除。
- [x] 新增 `scripts/codex_check_harmony_compat.mjs`，复用 freeLoopbackPort、Vite、Playwright；检查缺少新 API 时保存/阅读、首页读取计数与延迟媒体、身份分组语义及大量记录。
- [x] 修复前运行并保存失败证据；修复后使用同一脚本复核。

## 2. 兼容与首页

- [x] `mobile/vite.config.ts` 指定 `target: ["chrome74", "safari16.4"]`。
- [x] `mobile/src/main.tsx` 在应用导入前执行兼容模块；只为缺少的 API 注册实现。
- [x] `mobile/src/codex_privacy.ts` 兼容没有 `AbortSignal.any` 的环境；新兼容脚本验证外部取消、撤回及响应体取消，原隐私回归保持通过。
- [x] `mobile/src/store.ts` 批量封面读取，`getYearStats` 接受已读取记录；`mobile/src/App.tsx` 复用快照并提前提交首页。
- [x] `mobile/src/musicIdentity.ts` 加入查找索引，保留最终身份 matcher 与分组优先顺序。
- [x] `mobile/src/codex_ReadingTools.tsx` 和兼容 CSS 提供旧选择器回退；旧引擎简化阴影与模糊。

## 3. 诊断、版本与构建

- [x] 扩展现有 NowPlaying 诊断类型与 Android 实现，读取非唯一设备字段和实际 WebView 包版本，并在脱敏摘要显示。
- [x] 版本更新至 3.1.3 / versionCode 33，核对 package.json、锁文件根项目、Android 及说明。
- [x] 运行 `node scripts/codex_check_harmony_compat.mjs` 和隐私检查，既有身份/封面/阅读测试覆盖变更语义。
- [x] 使用 `scripts/build-android-release.ps1` 运行全量门禁、Android JUnit、生产构建、签名与资源校验，最终输出 `release/codex_harmony_signed_final_20261009/`；首次门禁失败证据保留在 `earlier-evidence/`。
- [x] 核对实际 APK 与 3.1.2 的升级关系，保留最终 APK/SHA/验收证据，更新交接；本轮清理已执行，最后 8,786 字节清理脚本因工具审批拒绝保留，详见交接。
