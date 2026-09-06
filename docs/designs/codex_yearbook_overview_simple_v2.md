# 简约年度总览效果图

使用内置 imagegen，参考简约 V2 封面生成静态总览页。

[原尺寸图片](./codex_yearbook_overview_simple_v2.png)

## 已检查

- 近白底、无衬线字、深灰正文、墨绿重点，与封面和作品页保持一致。
- 十二个月均显示，五月 2、六月 1、七月 1、八月 2，合计 6 篇，分布在 4 个月。
- 一至四月和九月显示 0；十至十二月尚未到来，显示横杠并附图例。
- 列表完整显示六条，日期倒序，与图表分布一致。
- 全部数据和作品图均为设计示例，不是 Yves 真实记录。筛选、原文入口和保存按钮是静态设计，不代表本轮已实现功能。
- 原图已复制进项目，SHA-256 一致。

## 后续

可按封面、总览、作品页的顺序制作手机交互原型；验证真实长短标题、0/1/6/大量记录、月份筛选和分页导出。重听对照维持低优先级。

## 完整提示词

Create ONE high-fidelity mobile UI mockup for 小懂哥年度总览, portrait 1024x1536, flat screen no phone frame. Attached image is style reference: same near-white background, modern Chinese sans-serif font, deep gray text and sparse forest green accents, subtle gray dividers. Practical simple design, no gold, ornate serif, paper texture, vinyl, poetic slogans, hero picture, gradients or relisten feature. Clear typography, compact but readable, enough space for all six rows, no cutoff. All data fictional, exact footer “设计示意 · 示例内容”.
Top navigation “← 我的音乐年记”, right “2026 ▾”. Main heading “年度总览”. Subtitle “截至 2026.09.05 · 示例数据”.
A compact inline summary “6 篇记录 | 4 个记录月份”, not giant stat cards.
Section “月份分布”, helper “按正式保存时间统计”. A clean bar chart with TWELVE equal positions labeled 1月 through12月. Exact counts: Jan0 Feb0 Mar0 Apr0 May2 Jun1 Jul1 Aug2 Sep0. May and August dark-green bars both height2, June and July both height1 half as tall. Show count above bars. Zero months have small 0 on baseline no positive bar. October November December FUTURE show gray en-dash instead of zero. Tiny legend “0：暂无记录    —：月份未到”. Chart must total6 across four active months, keep all twelve labels readable.
Section heading “全部记录”, right “6 篇 · 时间倒序”.
EXACTLY SIX plain full-width list rows with fine divider, small 42px-equivalent cover thumbnail left, 16px-equivalent title, smaller gray date/type under title, subtle chevron right. Distinct muted fictional album artwork, coastal dusk sunset for 晚风经过.
1 慢行 / 2026.08.23 · 专辑
2 晴天后的房间 / 2026.08.08 · 专辑
3 低速飞行 / 2026.07.12 · 歌曲
4 城市边缘 / 2026.06.06 · 专辑
5 晚风经过 / 2026.05.18 · 专辑
6 小岛来信 / 2026.05.03 · 歌曲
No scores or extra statistics. All six rows visible. Bottom small helper “点击月份筛选，点击记录查看原文”, then full-width green button “保存总览图片”, then demo footer. Clean, restrained, usable data and source overview matching reference, no excess decoration. Actual counts must match exactly.
