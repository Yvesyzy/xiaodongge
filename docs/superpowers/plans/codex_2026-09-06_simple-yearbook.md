# 简约年度总结实施计划

**Goal:** 把已批准的封面、总览、作品及空/大量记录稿接成真实应用，并提供完整记录的分页图片导出。

**Architecture:** `/summary` 使用查询参数保存年份与页面状态，直接读取 `store.listEntries()` 的正式记录，复用 `inRecordingPeriod`。旧语义分析独立保留为入口，简约阅读和导出不依赖旧快照是否生成。Canvas 按固定字号测量文本并分配页，逐页渲染、保存和系统分享，复用 NativeExport。

**Tech Stack:** 已安装 React、React Router、Canvas、Capacitor、Playwright，无新增依赖、无数据库结构变更。

**Spec:** `docs/designs/codex_yearbook_simple_v2.md`、`codex_yearbook_overview_simple_v2.md`、`codex_yearbook_boundary_layouts_v2.md`，Yves 已要求实施并授权使用模拟记录验收。

## 约束

- 月份使用首次正式保存的 `createdAt` 本地日期，仅歌曲/专辑计入；自述单独保留，草稿不统计。
- 优先封面、总览、作品；重听和放映厅不在本轮新增。
- 实际页面可点击即为原型，开发预览使用独立浏览器模拟数据，不能写入用户数据。
- 保留旧月报、分析入口与已有未提交更改；不发布、不安装、不修改签名和数据库。

## 工作项

- [x] 新增 `mobile/src/codex_yearbookModel.ts`：年度过滤、十二月统计、作品标题和封面读取；错误不能伪装成零记录。
- [x] 新增 `mobile/src/codex_YearbookPage.tsx` 与样式，修改 `App.tsx` 路由：封面→总览→作品→原文；URL 保留年份、月份、搜索、排序。空态新建/草稿/切年；大量记录每组20条显示，月份折叠，总数与匹配数分开。
- [x] 新增 `mobile/src/codex_yearbookPages.ts` 与 `codex_JournalExport.tsx`：1080×1680 封面、概览、全量记录索引、作品全文分页。正文按 Canvas measureText 换行，逐页渲染和释放 URL，展示页数、包含记录数、页码；保存/分享取消不当作成功。
- [x] 新增 `scripts/codex_check_simple_yearbook.mjs`：独立 Chrome 存储测试 0/1/6/128 条、单月大集合、长文/emoji/长标题、无封面、搜索月份组合、跨年本地日期、全部分页无漏重复、PNG 下载与取消处理。旧 `codex_check_reports.mjs` 年报页面改为旧分析入口，其余回归继续运行。
- [x] 运行 `npm.cmd run typecheck`、`npm.cmd test`、两个浏览器回归、`npm.cmd run mobile:build`。查看390px与桌面真实渲染和导出截图，修复溢出及交互问题。
- [x] 保存可查看的本地预览入口、验证结果，更新 `codex_status.txt` 和当前会话交接。用户已明确没有真实数据，最终准确注明模拟验收和未做真机测试。

## 核验要点

```text
sum(monthCounts) === annualEntries.length
new Set(indexPages.flatMap(page => page.entryIds)).size === annualEntries.length
workPagesForEntry.flatMap(page => page.lines) === allWrappedLinesForEntry
0 <= currentPage < pages.length
```

不使用截图生成图当实际 UI；所有按钮连接到真实动作。字体按手机28/19/16/13px层级，正文可换行，图表共用线性比例。模拟原型与用户真实库隔离。
