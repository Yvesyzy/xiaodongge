# 年度总览：零记录与大量记录布局

通过内置 imagegen 生成，沿用简约 V2 总览风格；本轮仅交付静态效果图，未修改应用代码。

- [empty_simple_v2](./codex_yearbook_empty_simple_v2.png)
- [many_simple_v2](./codex_yearbook_many_simple_v2.png)

## 零记录

显示零篇正式记录，提供写第一篇记录和打开草稿箱入口，提示可切换年份。避免空图表和无数据导出，草稿不计入总结。零记录只代表没有正式写下的感受，不代表没有听音乐。

## 大量记录

示例共 128 篇、9 个记录月份。一至九月数量为 12、14、15、11、18、16、17、20、5，合计 128。十至十二月尚未到来，用横杠区分。

列表包含作品/感受搜索、月份筛选、时间排序。九月五篇展开，八月二十篇和七月十七篇折叠；通过“显示更早月份”继续查看。总数独立于展开状态显示，避免把展开五篇误认为只有五篇。保存概览与分批保存记录页分别提供入口。

实施阶段规则：筛选时区分匹配数量和全年数量；单月记录也需分批显示，避免一个高密度月份一次加载全部正文或大图。导出前预览总页数，每页保持可读字号并标页码，不能仅导出屏幕当前展开记录却称为全部。图中按钮仅表示交互方向。

## 验证与边界

已逐张查看标题、内容、入口和整体布局；月份标签与总数一致，九月展开五条与分组数一致。生成图中的柱长属于布局示意，正式图表需按真实数值统一线性比例绘制。所有作品、日期、数量均为示例。本轮原图复制 SHA-256 一致。真实手机字体、触控大小、搜索、筛选、分页与保存仍需可交互原型验证。

## 完整提示词

### empty_simple_v2

参考图：D:\codex\workspaces\小懂哥\docs\designs\codex_yearbook_overview_simple_v2.png

Create a single polished Chinese mobile UI mockup, flat portrait screen 1024x1792, no phone frame. Input image is style reference only. Match 小懂哥 simplified annual overview: solid near-white background, Chinese modern sans-serif, deep charcoal text, forest green accent, fine gray dividers, generous mobile readable typography, simple flat rows. No gold, ornate serif, paper texture, decorative vinyl, gradients, poetic copy, luxury styling, or relisten module. All data fictional. Footer exact “设计示意 · 示例内容”. Maintain clear small section spacing, no tiny text and no clutter. Top nav “← 我的音乐年记” left, year dropdown “2026 ▾” right. Heading “年度总览”. Subtitle “截至 2026.09.05 · 示例数据”. Design EMPTY YEAR / ZERO FORMAL RECORDS state. Below heading simple compact inline “0 篇正式记录”, never confuse zero writing records with zero listening. Do not show an empty bar chart, blank ratings, fictional quote or artwork, or export button. Main empty content section on plain white centered vertically in upper-middle with tiny restrained outline page-and-pencil icon, title “这一年还没有正式记录”, two-line supportive factual copy “写下一点听歌感受，正式保存后就会出现在这里。” Another smaller sentence “草稿不会计入年度总结。” Primary forest green full-width button “写第一篇记录”, secondary outlined full-width button “打开草稿箱”. Below modest horizontal divider and a small neutral practical reminder label “已有其他年份的记录？” with line “可以通过右上角切换年份查看。” Do not make year switching a third primary button. Keep the empty state calm, compact grouped content, comfortable whitespace, not a big illustration and not stuffed with tips. Every action naturally placed with generous tap size. Footer at bottom. Make it visibly the same app as reference, but with useful honest empty state instead of meaningless zero chart.

### many_simple_v2

参考图：D:\codex\workspaces\小懂哥\docs\designs\codex_yearbook_overview_simple_v2.png

Create a single polished Chinese mobile UI mockup, flat portrait screen 1024x1792, no phone frame. Input image is style reference only. Match 小懂哥 simplified annual overview: solid near-white background, Chinese modern sans-serif, deep charcoal text, forest green accent, fine gray dividers, generous mobile readable typography, simple flat rows. No gold, ornate serif, paper texture, decorative vinyl, gradients, poetic copy, luxury styling, or relisten module. All data fictional. Footer exact “设计示意 · 示例内容”. Maintain clear small section spacing, no tiny text and no clutter. Top nav “← 我的音乐年记” left, year dropdown “2026 ▾” right. Heading “年度总览”. Subtitle “截至 2026.09.05 · 示例数据”. Design MANY RECORDS state, 128 formal records. Below heading compact inline “128 篇记录 | 9 个记录月份”. Section “月份分布”, subtitle “按正式保存时间统计”. One compact twelve-position bar chart exact counts Jan12 Feb14 Mar15 Apr11 May18 Jun16 Jul17 Aug20 Sep5; October November December future en-dashes. Values above bars, months1月 through12月, correct relative bar heights and zero baseline. These nine values sum128. Keep tiny future legend “—：月份未到”, simple no heavy axes.
Below section “全部记录” and right “共 128 篇”. One compact search field “搜索作品或感受”, then a horizontal compact filter row “全部月份 ▾” and “时间倒序 ▾”.
List organized into MONTH GROUPS with count badges as plain text. Show expanded group header “9 月 · 5 篇” with up chevron. Show exactly five compact but readable rows, each small muted square album thumbnail left, title, date/type metadata beneath, chevron right:
“慢行” / “09.05 · 专辑”;
“晴天后的房间” / “09.04 · 专辑”;
“低速飞行” / “09.03 · 歌曲”;
“城市边缘” / “09.02 · 专辑”;
“晚风经过” / “09.01 · 专辑”.
Then two collapsed full-width month group rows “8 月 · 20 篇” and “7 月 · 17 篇” each right “展开 ▾”. Keep obvious that collapsed records still count.
Below a flat outlined button “显示更早月份”, and neutral helper “已展开 5 篇 / 全年 128 篇”. This explicitly communicates full coverage while not displaying128 rows on one image. Bottom forest green button “保存概览图片”, then secondary text link “分批保存记录页 →”. Do not say all128 records exported in a single image, do not compress font to fit all data. Use limited thumbnails, readable row density and clear hierarchy, standard functional UI. Footer demo label. All content fits without cropping, can be a taller screen screenshot if necessary.
