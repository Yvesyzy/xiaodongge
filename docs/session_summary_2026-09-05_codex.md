# Codex 交接：报告日期、草稿与年度海报

后续研究：Yves 认为标本册仍简单，要求参考平台案例。已完成官方来源研究，形成 `docs/codex_2026-09-05_yearbook-design-directions.md`。推荐私人音乐杂志主体、故事式预览、分页面分享；三种方向和数据边界详见该文档。研究阶段未修改应用代码，未把提案当作已实施功能。

## 当前状态

代码实现、浏览器交互回归、PNG 导出和 Android 调试构建完成。未发布、未推送、未在手机安装。正式覆盖安装包等待 Yves 提供原发布签名配置路径；当前进程、用户、系统作用域均未配置四项 XIAODONGGE 签名变量，旧交接中的 D:\xiaodongge-signing 路径也未找到。

## 根因与修复

- 旧月报用手填 `year/month` 选记录，用 `listenedAt` 构造日快照；跨月时保存成功，但读取校验拒绝。旧年报吞掉月份错误，静默漏掉该月全部记录。
- 现在月报、年报、首页年度数字、报告日历背景统一按 `createdAt` 的本地日期计算。它是乐评首次正式保存时间，编辑保留原值。发行日期、首次收听、手填归档年月不决定报告月份。草稿不参与统计；月度/年度自述单独展示，不重复当作歌曲/专辑乐评分析。
- 保存生成结果前先校验；年度任何月份失败会明确报错并保留旧年报；全年来源 ID 和数量必须覆盖全部符合条件的乐评。
- 新快照携带 `dateBasis: createdAt`，旧口径或数据变化提示重新生成。浏览器本地旧月报的损坏快照保留文字回退；备份导入仍严格校验。
- 首页文字增加浅色衬底，第三行换成草稿数量及入口；加号菜单提供速记、完整、草稿。
- 完整编辑和速记均增加独立的“保存草稿”，允许正文为空；正式提交继续要求正文。草稿续写恢复原模式，并补齐首次收听字段；修复新建草稿在 render 中改路由导致 URL 未携带草稿 ID 的问题。
- 年度增加数字总览、完整十二月柱状图、评分作品、全部来源清单和自述入口。
- `codex_YearbookExport.tsx` / `codex_yearbookPoster.ts` 生成 1080×1680 PNG、预览、下载/系统保存、系统分享。导出前校验记录与快照一致，旧快照不可导出。NativeExport 增加可选 base64 图片编码，保留 UTF-8 文本路径，限制 8 MiB、验证 Base64 与 PNG 文件头。

## 验证证据

- `npm.cmd exec prisma -- generate`：修复本地缺失生成客户端；未改 Prisma schema 或数据库。
- `npm.cmd run typecheck`：通过。
- `npm.cmd test`：30 项全部通过。
- 启动 `npm.cmd run mobile:dev -- --port 5173` 后运行 `node.exe scripts/codex_check_reports.mjs`：通过。
- 专项浏览器测试使用独立浏览器存储中的六条测试数据：五月报告保存/重载、年报全部六条、月份失败保留旧年报、跨年 UTC 本地归档、旧坏月报文字回退并重新生成、十二根柱、三个创建入口、空正文草稿、正式校验、容量不足保留编辑页、完整/速记续写，以及 PNG 预览/下载文件头和 1080×1680 尺寸。
- Chrome Playwright，Asia/Shanghai，390×844 手机与 1280×900 桌面。Browser plugin 不可用，复用已安装 Chrome。截图人工查看：首页可读，月份柱无横向溢出，PNG 没有标题/数字重叠。未出现未捕获页面异常。
- `npm.cmd run mobile:build`：通过，保留既有大于 500 kB chunk 警告。
- `npm.cmd exec cap -- copy android`：通过；未运行 sync，保留原有两处 Gradle 工作区变更。
- 本机缓存 Gradle 8.13 `--offline --no-daemon --init-script scripts/gradle-mirrors.init.gradle assembleDebug`：BUILD SUCCESSFUL，157 tasks。初次沙箱拒绝读取 SDK package.xml，获准后在沙箱外完成。
- ADB `devices`：无连接设备。微信/朋友圈目标应用、系统保存位置、取消保存、原生图片附件实际接收仍待真机验收。

调试 APK：`android/app/build/outputs/apk/debug/app-debug.apk`

- 大小：70,489,551 bytes
- SHA-256：0949391A402DAA77DCC435E6446B609B3066D42F5209C3DC1B22466782A8556B
- 此包是调试签名，不能作为已有正式版的覆盖升级包。

截图与测试海报保存在 `D:\codex\.codex-home\visualizations\2026\09\05\01a06f8f-96fb-7e20-b8f6-bc4c8b62363f\`，均使用测试数据。隔离子任务副本已移到该目录的 `codex_export_work`，正式源文件由主代理检查并修正后集成。

## 下一步

1. 获得原签名配置路径后使用既有发布证书构建正式覆盖包，使用新产物名，避免覆盖 `release/xiaodongge-v2.3.apk`；比对签名、包名、版本及 SHA-256。
2. 手机覆盖安装后重新生成月报/年报，以新日期口径重建；核对真实六条记录的来源清单。
3. 真机验证空正文草稿恢复、系统保存 PNG、取消反馈和微信/朋友圈图片分享。

`.claude/` 与 `claude_status.txt` 未修改；未更改私人项目总结归档。当前更改未提交。

## 年度总结视觉提案追加（2026-09-05）

Yves 要求同时制作杂志封面、作品页、重听对照页三张效果图，以及放映厅方案进行比较。使用内置 imagegen 生成四张原图，保存在 docs/designs/：

- codex_yearbook_magazine_cover.png：1024×1536，纸色杂志封面、作品拼贴、目录与年度摘句。
- codex_yearbook_magazine_work.png：1024×1536，作品图片、记录日期、评分、原文摘录与批注。
- codex_yearbook_magazine_relisten.png：1024×1536，两次记录日期、评分、原文对照与变化。
- codex_yearbook_story_theater.png：1536×1024，深色放映厅开场、作品瞬间、重听转折三幕总览。
- codex_yearbook_mockup_prompts.md：完整提示词、示例数据声明、文件链接、方案比较及实现边界。

逐张视觉检查已完成：主标题和正文可读，黑胶装饰不遮挡杂志文字；示例日期相差 97 天，与画面一致。复制文件与生成原图的 SHA-256 一致。作品、艺术家、评分和摘录均为演示数据。图片是静态设计提案；本轮未修改应用代码、未增加动画或发布安装包。

建议以杂志为总结主体，放映厅为可选年度开场。下一步在 Yves 选择后制作可交互原型，或调整指定页面的视觉密度；正式实现仍需验证手机字号、长文、缺失封面、缺少重听记录和分享导出。

## 简约 V2 视觉精修

Yves 明确要求减少重听对照投入，优先前面的封面、作品内容；字号、内容密度、配色简约，避免过度华丽和文艺。已基于旧图使用内置 imagegen 制作 docs/designs/codex_yearbook_cover_simple_v2.png 与 codex_yearbook_work_simple_v2.png，完整提示词和设计目标见 docs/designs/codex_yearbook_simple_v2.md。

已逐张查看：取消装饰性宋体、金色花纹、纸纹和黑胶拼贴，近白背景、无衬线字、深灰正文与墨绿强调；作品页缩小图片，正文空间增加；两页移除重听入口。两张 1024×1536 原图已归档，SHA-256 复制一致。全部采用示例数据；未修改应用代码，未生成新安装包。旧稿保留供对照。下一步可按 V2 制作手机可点击原型，再验证真实记录的长短文和图片导出。

## 简约年度总览追加

Yves 选择补充同风格年度总览页。使用内置 imagegen 生成 docs/designs/codex_yearbook_overview_simple_v2.png，说明和完整提示词为同名 .md。视觉检查通过：十二月完整，五月 2、六月 1、七月 1、八月 2，合计六条；列表六条按日期倒序，与分布一致；尚未到来的月份用横杠。原图复制 SHA-256 一致。所有作品和数据为示例，交互仅为静态设计。未修改应用代码。下一步可按封面→总览→作品页制作手机交互原型；重听对照仍为低优先级。

## 零记录与大量记录布局追加

按 Yves 要求补充两张静态图：docs/designs/codex_yearbook_empty_simple_v2.png 和 codex_yearbook_many_simple_v2.png，提示词及详细交互边界见 codex_yearbook_boundary_layouts_v2.md。使用内置 imagegen，沿用简约风格。零记录显示新建和草稿入口；128 条示例按月分组，九月展开五条，其他月份折叠或继续显示；保留全年总数，支持搜索筛选，概览与记录页分开保存。月份标签数值合计128且与摘要一致；柱长为视觉示意，正式实现需严格线性比例。已逐张视觉检查与复制哈希核对。数据全为示例，未改应用代码。下一步可制作可点击原型并验证空数据、跨月筛选、单月高密度记录、长标题与分页导出。重听对照保持低优先级。
