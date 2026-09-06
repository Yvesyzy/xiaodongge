# 五项体验改进实施清单

**Goal:** 落实 Yves 已确认的首页、写作、年度精选、信息一致性、导出改进，统一十分制显示。

**Architecture:** 保留现有 React 表单与草稿调用链，调整布局；年度编辑信息存入现有 AppData 并纳入备份验证。导出沿用 Canvas 分页与原生插件，不修改评分数据或数据库结构。

**Tech Stack:** React、TypeScript、Canvas、Capacitor、Android Java。

**Spec:** 2026-09-06 会话中提出的五项方案，Yves 已明确批准全部实施。

## 约束
- 简约、正文优先；原有十分制数据不转换。
- 草稿保存独立，保留自动保存、恢复与错误保护。
- 年度最多自选三篇代表作品；摘句必须来自对应原文；允许年度寄语。
- 图片隐私设置同时作用于预览和保存；逐页处理避免全年图片驻留内存。
- 不覆盖已发布的 v2.5 安装包或标签，不改动 Claude 文件。

## 实施与验证
- [x] App.tsx / styles.css：首页顺序、草稿摘要、十分制和记录日期，正文前置并折叠补充信息。验证草稿、正式保存与移动端位置。
- [x] codex_YearbookPage.tsx / shared/backupAppData.ts：年度精选、原句、寄语持久化和备份兼容，合并重复入口。验证刷新、跨年、删除来源与导出一致性。
- [x] codex_JournalExport.tsx / codex_yearbookPages.ts / NativeExportPlugin.java：预览缩略导航、隐私、选页和批量操作。验证全量分页、取消、失败、PNG尺寸和原生编译。
- [x] 运行 typecheck、现有测试和补充浏览器回归；更新交接文件并报告验证边界。
