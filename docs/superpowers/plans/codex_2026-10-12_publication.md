# 公众号出稿实施计划

**Goal:** 基于已有记录本地生成可编辑公众号稿，复制与导出配图，交付原签名测试版。

**Architecture:** 纯TypeScript模型和ZIP打包；懒加载React编排/预览；沿用NativeExport保存/分享与新增HTML剪贴板。两个独立工作目录分别产出纯模型及原生改动，主代理负责UI与最终整合。

**Tech Stack:** 已有React/TypeScript/Vite/Capacitor/Android；不新增依赖。

**Spec:** `docs/superpowers/specs/codex_2026-10-12_publication.md`。用户已选择实施第2项，按现有授权直接执行常规实现选择，不重复询问。

## Task 1: 纯模型和ZIP（隔离worker）

- [x] 创建`codex_publicationModel.ts`、`codex_publicationZip.ts`及同名单测，接口严格按spec。
- [x] 跑`node --test mobile/src/codex_publicationModel.test.ts mobile/src/codex_publicationZip.test.ts`，验证安全与标准ZIP读取。

## Task 2: NativeExport（隔离worker）

- [x] 在隔离目录修改已复制NativeExportPlugin.java，新增安全HTML复制及ZIP格式验证；提供有意义的纯Java测试。
- [x] 主代理逐项审阅整合后执行现有Android单测编译，不冒充真机剪贴板验收。

## Task 3: UI、草稿和导出（主代理）

- [x] 新建`codex_PublicationComposer.tsx`、`codex_PublicationPage.tsx`、`codex_publicationAssets.ts`、`codex_publication.css`，复用实际store及导出函数。
- [x] 新增本机文字草稿恢复/错误处理与所有导出统一隐私；不修改原文、正式记录数据库或旧备份格式。
- [x] 接入ReviewShare、年记榜单和更多页；新增nativeExport.ts HTML复制，旧分享路径保持可用。
- [x] 类型检查、生产构建和独立Playwright流程通过；检查实际ZIP/HTML/PNG产物。

## Task 4: 交付（主代理）

- [x] 版本递增为3.4.0(38)，加入发布门禁并构建原签名APK；不推送发布。
- [ ] 写使用说明和交接，核对本轮累计产物，清理仅属于本任务的已无用途副本；历史受阻删除不重试。

使用说明／交接和清理台账已完成；31工程检查、23安卓单测及签名／25+3资源核对通过。清理删除命令被自动审批拒绝（blocked by policy，无具体理由），未启动，实际删除0，保留16目标，不重试绕过。功能与测试包已交付，最后一项仅清理执行受阻。
