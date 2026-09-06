# 月报、草稿与年度标本册实施计划

目标：修复生成后无法展示及年度漏计，统一按正式记录首次保存时间归档；改善首页、显式草稿保存及年度图片交付。

按 Yves 的授权直接执行常规设计选择。保留既有黑胶风格，文字使用浅色衬底；首页第三行改草稿入口；加号提供完整、速记、草稿。现有自动保存继续使用，显式保存允许正文为空，正式提交仍校验正文。

- [x] 用 Vite + Playwright 在隔离浏览器存储复现月份与日期不一致的快照拒绝、全年静默跳月。
- [x] mobile/src/listeningYearbook.ts、store.ts：共享 createdAt 归档规则；生成前解析验证；年度失败明确报错，校验完整来源 ID；旧快照保留并提示更新。
- [x] mobile/src/App.tsx、QuickCapturePage.tsx、entryDraft.ts：首页与创建菜单、显式草稿、续写保留原字段。
- [x] mobile/src/ListeningYearbookView.tsx、styles.css：年度数据总览、十二月柱图、作品清单、语义证据折叠；区分实时数量和旧快照。
- [x] 独立隔离执行导出模块：Canvas PNG 预览、系统保存、系统分享；复用 NativeExport 增加二进制图片能力，保留文本导出。
- [x] 类型检查、既有测试、手机/桌面浏览器回归、移动构建、Android 编译与签名构建条件核对。调试构建通过；正式签名配置缺失。
- [x] 更新 codex_status.txt 和本次 session_summary；不覆盖 cc 记录，不触碰已有 Android Gradle 改动。

验证重点：六条已保存歌曲/专辑乐评必须全部入册；专辑发行日期、首次收听、手填归档年月不改变写作月份；UTC 跨月按本地日期；月报解析失败不显示已保存；草稿失败不离开页面；PNG 有效且原有 JSON/TXT/CSV 路径保留。
