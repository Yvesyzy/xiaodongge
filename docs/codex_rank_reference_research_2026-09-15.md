# 年度回顾案例研究 · 2026-09-15

## 用户要求与当前状态
Yves认为“年度专辑榜单”标题仍显得土，要求找网上实际案例。已使用Firecrawl检索、抓取，辅以网页检索与浏览器视觉核对。当前榜单预览和产品代码未改。

## 交付
- docs/designs/codex_rank_reference_board.html：三个真实案例，可点击来源看更多原图。图片通过原站加载，需要联网。
- docs/designs/codex_rank_reference_board.jpg：浏览器渲染的完整参考板，已目检。

## 实际观察
1. Spotify Wrapped 2025：Top Albums画面将两张大封面与三张小封面拼接，上方标题条较小，下方才是名次和专辑名。应借鉴图文权重与五封面组织，不直接复制图案或字体。
2. Apple Music Replay 2025：媒体截图中自然语言标题使用单色无衬线字，渐变在背景，标题不做金属字面处理。可借鉴减少同时争抢视线的效果。
3. 网易云音乐2024：入口画面以插画为主体，2024/年度听歌/报告在下方左对齐紧凑断行；说明同样是粗黑体，字号、行宽与插画关系比单独换字体更关键。

## 对小懂哥的设计判断（不是案例作者原话）
目前粗体鎏金标题、双边框和规则列表叠加，整体接近奖状。下一步建议保留青绿、金色、每页五张，重组标题层级为2026/年度专辑，加小字号榜单范围；中文字主体使用暖白，金属效果集中在年份或名次。可另做五封面拼贴方案对照。尚未实施这些建议。

## 来源与抓取记录
- Spotify官方设计说明：https://newsroom.spotify.com/2025-12-03/wrapped-marketing-campaign/ 。网页检索/打开成功，明确“visual mixtape”与图像、渐变、纹理方向。
- Spotify德国官方新闻稿：https://spotify_presse.prowly.com/437948-2025-wrapped-neue-features-machen-den-spotify-jahresruckblick-so-personlich-wie-nie-zuvor 。Web打开及配图浏览器加载成功；Firecrawl抓取失败ERR_TUNNEL_CONNECTION_FAILED，未将其标为抓取成功。
- Apple媒体实测：https://www.igen.fr/services/2025/12/apple-music-le-replay-2025-est-disponible-153701 。Firecrawl成功，输出.firecrawl/codex_rank_apple_2025.json；配图2860×2840浏览器解码成功。
- Apple官方Replay说明：https://artists.apple.com/support/5486-celebrate-years-accomplishments-replay 。Web打开成功，仅用于核实功能归属，不作截图来源。
- 网易云案例平台：https://www.epub360.com/h5anli/templatedetails/69159dbda222ba002d7c4a63/ 。Firecrawl成功，输出.firecrawl/codex_rank_netease_2024.json；主要可访问图是二维码，不作最终视觉案例。
- 网易云实际截图报道：https://finance.sina.cn/tech/2024-12-27/detail-ineawhzz2759760.d.html 。快科技报道/新浪转载；Firecrawl成功，输出.firecrawl/codex_rank_netease_screens.json；截图600×1335已在浏览器解码和目检。
- Firecrawl初始检索成功，输出.firecrawl/codex_rank_design_search.json。CLI 1.19.21已登录，状态页账户查询首次fetch failed，实际搜索和上述三次抓取成功。
- 三张参考图解码尺寸：Spotify608×1316、Apple2860×2840、网易云600×1335。参考板中最终不存在二维码占位。

## 下一步
让Yves先看实际参考；选定标题方向后再重做预览，避免仅重复更换本机字体。
