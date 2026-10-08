# 小懂哥宣传视频交接文档

> 2026-10-07接续：保留Yves选定的v6曲风层级版，已修复中段配乐过度衰减；当前两版成片通过连续性、完整解码及60秒播放检查。下文是制作历史，旧包由新版交付替代；当前状态见[音频修复交接](codex_session_summary_2026-10-07_video_audio_fix.md)及[工程说明](../../codex_video/README.md)。

日期：2026-09-30  
项目路径：`D:\codex\workspaces\codex\小懂哥`  
视频工程：`D:\codex\workspaces\codex\小懂哥\codex_video`  
状态：第一版双画幅成片已完成；第二轮“增强吸引力、参考优秀案例后重剪”已开始，案例研究完成，重剪尚未实施。

## 1. 交接范围

这份文档总结当前可访问的本次聊天和工作区证据。聊天上下文包含：用户提供的两段中文视频制作提示词、第一版制作与验收过程、用户对第一版“有点简单、不够抓眼球”的反馈、案例研究，以及当前准备进入第二版重剪的状态。没有把无法访问的其他聊天内容或外部受众反馈写成事实。

## 2. 用户目标与需求变化

### 初始目标

用户要求为 Android 应用《小懂哥 / xiaodongge》制作一支真正可播放、可交付的产品宣传片，不接受只写方案、分镜或示例代码。要求：

- 真实渲染 MP4，提供竖版和横版。
- 尽可能使用当前 v3.0.1 App 的真实 UI、真实 Logo、真实颜色和真实海报导出器。
- 叙事围绕“第一次听歌 → 记录 → 时间积累 → 重新遇见 → 个人音乐档案”。
- 视觉偏私人音乐档案、深绿/米白/琥珀、克制、像高质量产品片；避免普通功能 PPT、AI、赛博朋克和虚假功能。
- 不使用未经确认授权的商业音乐、商业图片、电影素材或私人数据。
- 交付源码、素材、README、来源审计、检查证据和可重渲染工程。

### 当前追加需求

用户观看第一版后明确反馈：

> “我目前看起来有点简单，没有很能抓住用户的眼球，不够吸引人。这样，你再找找别的案例，参考一下，然后作出修改。”

这意味着当前任务不再是证明“视频能播放”，而是提升第一秒的注意力、镜头密度、运动设计、信息揭晓和情绪高潮，同时保留真实 UI 与私人音乐档案定位。

## 3. 第一版已完成内容

### 成片

- [竖版 MP4](D:/codex/workspaces/codex/小懂哥/codex_video/output/codex_xiaodongge_portrait_1080p.mp4)：1080×1920，30 秒，30fps，900 帧，7,447,267 字节。
- [横版 MP4](D:/codex/workspaces/codex/小懂哥/codex_video/output/codex_xiaodongge_landscape_1080p.mp4)：1920×1080，30 秒，30fps，900 帧，6,542,238 字节。
- 编码：H.264 High、yuv420p、BT.709、AAC 48kHz 双声道、MP4 faststart。
- 竖版 SHA-256：`86656624ade3ca451243f5956022c8d281e954900a97f17bef4f3776b5cab806`。
- 横版 SHA-256：`7bf7697cb791ef9b7eb2b0f5550994f9a01372757fd1b7532fe517797e0b58bd`。

### 第一版镜头逻辑

第一版时间线在 [src/codex_index.tsx](D:/codex/workspaces/codex/小懂哥/codex_video/src/codex_index.tsx)：

| 时间 | 内容 |
|---|---|
| 0–3.5 秒 | 几何封面、档案卡、真实阅读页和品牌进入 |
| 3.5–7 秒 | 速记空状态、填写、真实保存结果 |
| 7–14 秒 | 乐评阅读、综合评分、情绪、曲风、四维评分 |
| 14–19 秒 | 盲重听表单、保存后的 223 天对照、分数和新听感 |
| 19–24 秒 | 月度记录、音乐年记和年度统计 |
| 24–27 秒 | 三张真实 Top 15 海报，冠军页为主视觉 |
| 27–30 秒 | 封面回环、Logo、品牌句“记录的不只是音乐，也是当时的你。” |

第一版已经修过：首帧空白、浏览器存储超额、固定导航遮挡、片脚和手机相交、中间文件全范围 YUV、音频尾部时长、重听评分文字裁切。第一版最终检查通过后才交付。

## 4. 第一版工程与证据入口

- [视频工程 README](D:/codex/workspaces/codex/小懂哥/codex_video/README.md)：安装、采集、渲染、检查和目录说明。
- [素材来源审计](D:/codex/workspaces/codex/小懂哥/codex_video/VIDEO_SOURCE_AUDIT.md)：当前 v3.0.1 路由、功能、原生边界、素材来源和禁止声称的能力。
- [第一版成片验收记录](D:/codex/workspaces/codex/小懂哥/codex_video/codex_video_review.md)：技术参数、抽帧、完整播放、导演自评和风险边界。
- [最终视频检查 JSON](D:/codex/workspaces/codex/小懂哥/codex_video/qa/codex_video_checks.json)：ffprobe、解码、响度、抽帧和 Chrome 播放证据。
- [Git 版本统计](D:/codex/workspaces/codex/小懂哥/codex_video/qa/codex_project_git_version_stats.md)：完整提交级统计。
- [上一份视频交接](D:/codex/workspaces/codex/小懂哥/docs/session-summaries/codex_session_summary_2026-09-29_video.md)：第一版完成时的交接记录。

## 5. 第一版使用的真实内容与边界

真实采集的当前移动端页面包括：速记、完整乐评、乐评阅读、评分、情绪、曲风、四维评分、盲重听、月度回顾、音乐年记和年度 Top 15 海报。Top 15 海报由当前项目的 `planJournalPages` / `renderJournalPage` 生成。

演示数据全部在隔离浏览器上下文中创建，作品、音乐人、乐评和封面为合成内容；没有读取 `.data`、Prisma、Android SQLite 或私人数据库。配乐由 [scripts/codex_synthesize.py](D:/codex/workspaces/codex/小懂哥/codex_video/scripts/codex_synthesize.py) 程序合成，没有商业歌曲、录音采样或外部音频。

不能在重剪版中声称：流媒体播放、AI 推荐、AI 写乐评、自动记录全部听歌、云同步、识别所有播放器、原生读取一定成功、全面真机验证或平台上传已完成。

## 6. 案例研究已完成，得到的可执行结论

本轮已通过 Firecrawl 和浏览器读取以下公开案例页面。只研究方法，不下载或使用案例中的图片、视频或音乐。

1. [Mayda — Spotify Wrapped 2024](https://mayda.co/projects/wrapped-2024/)
   - 页面说明其为 Spotify Wrapped 设计系统制作一组“energetic 360 visuals”，通过 tease and reveal 逐步揭晓年度数据。
   - 可借鉴：先制造期待，再揭晓结果；信息不一次性平铺；同一套视觉语言能在不同屏幕和裁切中保持强识别。

2. [BUCK — Spotify Premium](https://buck.co/work/spotify-premium)
   - 页面说明其制作 15 个静态和动画图像，并使用“secondary layer”把主视觉拆成可适配不同屏幕的背景层。
   - 可借鉴：把封面、海报和 UI 拆成前景/背景/信息层；同一视觉母题在不同镜头里重复变形，增强连续性和品牌记忆。

3. [ManvsMachine — iMac Pro / Apple](https://mvsm.com/project/imac-pro)
   - 页面说明其先建立一套控制形态与运动的算法结构，再让整个影片保持同一运动语法。
   - 可借鉴：不要让每个页面各自淡入淡出；建立一个贯穿全片的“唱片环 / 时间线 / 卡片展开”运动母题。

4. [Apple — Don’t Blink](https://www.youtube.com/watch?v=jk6sz25OZgw)
   - 搜索到的案例是 Apple 用极高信息密度和快速节奏在短片中连续揭示产品重点。
   - 可借鉴：开头几秒必须有明确视觉动作和信息钩子；镜头可以更短，但每次切换都要产生新的信息。

## 7. 对第一版问题的判断

### 已确认问题

- 开头的几何封面和字幕漂亮，但动作单一，不能在第一秒制造“发生了什么”的问题意识。
- 第一版大量使用“字幕 + 单个 UI 裁片”的并列布局，画面秩序稳定，却缺少前后镜头之间的形态连接。
- 真实 UI 的展示方式偏说明书，用户看到的是页面，而不是一个人的音乐记忆正在形成。
- 中段评分、情绪、曲风、四维评分连续出现，信息完整但节奏像功能清单。
- 年度海报虽是视觉最强的素材，出现得较晚，之前没有建立足够的视觉能量。
- 原创配乐整体克制，适合旧版氛围，但第二版需要更明确的脉冲、停顿和揭晓点。

### 不应误改的优点

- 深绿、米白、琥珀配色与 App 当前主题相符。
- 真实 UI 和真实海报增强了可信度。
- “第一次听见 / 这一次听见”是很好的情绪核心。
- 223 天、新旧评分、新听感和年度海报构成了差异化，不应被纯炫技覆盖。

## 8. 第二版建议方向

推荐重剪为“记忆被重新播放”的结构，重点不是增加更多页面，而是增加镜头事件：

| 时间 | 第二版建议 | 目的 |
|---|---|---|
| 0–1.2 秒 | 直接从极近的唱片纹理、日期或评分数字切入；让数字/纹理快速聚焦，暂不放完整 Logo | 首秒抓住注意力 |
| 1.2–3.5 秒 | 封面环线与真实档案卡做 match cut；档案卡中的封面/评分位置与下一镜 UI 对齐 | 把合成视觉和真实 UI 连成一件事 |
| 3.5–7 秒 | 速记输入从空白到一句话，用光标、文字出现和保存按钮的瞬间作为节拍点 | 把“记录”变成动作，不只是展示页面 |
| 7–11 秒 | 让已保存的卡片扩展成阅读页，再切到评分和情绪控件；减少解释字幕，增加连续推近/横移 | 提高真实 UI 的动态感 |
| 11–14.5 秒 | 四维评分不要四段平铺；用四条评分线或一个分数从真实控件中抽出，最后回到完整界面 | 把功能信息压缩成一个视觉事件 |
| 14.5–19.5 秒 | 音乐突然变安静；盲重听保持空白，再揭晓“相隔 223 天 / 8 → 9.5 / 从孤独到陪伴” | 建立情绪反差和记忆点 |
| 19.5–24 秒 | 月份记录像胶片/档案卡快速累积，年记卡片从一张变成一册 | 用数量和时间制造成长感 |
| 24–27.5 秒 | Top 15 海报成为第二个高潮，三页不是平铺，而是从背景层、碎片、数字 15 聚合成冠军页 | 给最强视觉足够空间 |
| 27.5–30 秒 | 画面留白，音乐收束，最后一句只出现一次；Logo 最后出现 | 让品牌句留下，而非过早消耗 |

第二版的核心改动应该集中在 `codex_video/src/codex_index.tsx` 的镜头时间线和少量辅助图形；不需要重做 App，也不需要引入第三方视频素材。

## 9. 第二版实现注意事项

- 原版 MP4 不删除，输出新文件名，例如 `codex_xiaodongge_portrait_v2_1080p.mp4` 和 `codex_xiaodongge_landscape_v2_1080p.mp4`。
- 修改前复制或记录当前 `src/codex_index.tsx` 的哈希，方便对比；不要覆盖第一版验收证据。
- 可复用现有素材：`codex_cover_00.png`、`codex_archive_card.png`、`codex_reader.png`、`codex_quick_*`、`codex_rating.png`、`codex_moods.png`、`codex_dimensions*.png`、`codex_comparison*.png`、`codex_months_grid.png`、`codex_yearbook.png`、`codex_year_facts.png`、`codex_poster_1..3.png`。
- 先实现一个 5 秒新版开场和一个 5 秒年度海报高潮，再跑 stills 目检；不要整片渲染后才发现节奏仍然平。
- 参考案例只提供运动和剪辑方法，不应把 Spotify、Apple 或其他品牌的画面、音乐、Logo 带入片中。
- 如果修改配乐，仍使用原创程序合成，必须重新检查 30 秒、响度、真峰值和无削波。
- 最终检查仍需包括：两画幅、900 帧、全片解码、完整浏览器播放、关键帧联系表、中文和 UI 裁切检查。

## 10. 可直接执行的下一聊天提示词

```text
请继续制作《小懂哥》宣传视频第二版，不要从零重做第一版。

项目路径：D:\codex\workspaces\codex\小懂哥
视频工程：D:\codex\workspaces\codex\小懂哥\codex_video
先读：
1. docs/session-summaries/codex_session_summary_2026-09-30_video_handoff.md
2. codex_video/README.md
3. codex_video/VIDEO_SOURCE_AUDIT.md
4. codex_video/codex_video_review.md
5. codex_video/src/codex_index.tsx

当前状态：第一版已完成并验收，MP4、素材和证据都在 codex_video/output、public、qa。不要删除或覆盖第一版。用户认为第一版“有点简单、不够抓眼球”，要求参考优秀案例后重剪。

已研究案例：
- https://mayda.co/projects/wrapped-2024/：tease/reveal、动态年度数据、强视觉系统。
- https://buck.co/work/spotify-premium：15 个动画视觉、secondary layer、主视觉拆层适配。
- https://mvsm.com/project/imac-pro：统一的算法式运动结构和贯穿全片的运动语法。
- https://www.youtube.com/watch?v=jk6sz25OZgw：短时间高信息密度和快速产品揭示。

第二版要求：
- 第一秒更有钩子：从唱片纹理、日期、评分或封面极近景切入，避免完整 Logo 和普通淡入开场。
- 用 match cut、连续推近、横移、卡片展开、图形与 UI 对齐，让页面之间发生形态连接。
- 评分/情绪/曲风不要像功能清单；压缩成一个视觉事件。
- 14.5–19.5 秒保留情绪停顿，再揭晓 223 天、8→9.5 和新听感。
- 24–27.5 秒让 Top 15 海报形成全片第二个高潮。
- 最后一句“记录的不只是音乐，也是当时的你。”只出现一次，保留收束留白。
- 继续使用当前 v3.0.1 真实 UI、真实 Logo、真实海报导出和隔离演示数据；不使用外部照片、商业歌曲或参考案例素材。
- 先做新版开场 5 秒和海报高潮 5 秒，生成 stills 检查，再改完整时间线。
- 新版输出单独文件名：codex_xiaodongge_portrait_v2_1080p.mp4、codex_xiaodongge_landscape_v2_1080p.mp4。

完成后必须：
1. 重新渲染两画幅。
2. 用现有 codex_check.mjs 检查编码、900 帧、时长、音频、解码和浏览器全片播放。
3. 生成新版 final_frames 联系表并目检 22 个时间点。
4. 写一份 v2 验收说明，明确与第一版的差异。
5. 保留第一版 MP4、哈希和验收证据。
6. 不提交、不推送、不上传、不改正式 APK 或 App 业务源码。
```

## 11. Git 与工作区状态

当前分支为 `main`，Git HEAD 为 `9ae4e01`（`docs: inventory non-T release evidence`）。第一版视频工程仍是未跟踪目录，根工作区还存在本次任务开始前已有的文档和状态改动；不要使用 reset、checkout 或清理命令覆盖它们。

完整统计见 [codex_project_git_version_stats.md](D:/codex/workspaces/codex/小懂哥/codex_video/qa/codex_project_git_version_stats.md)。统计口径为 Git 提交级 `git log --numstat`：113 commits、1002 次文件变更、50,598 行新增、11,017 行删除、124 次二进制文件变更；工作区另有 35 个已跟踪文件变更和 100 个未跟踪文件。视频目录的 output、qa、node_modules 和缓存由视频工程 `.gitignore` 忽略，不能把这些忽略生成物误认为已提交。

## 12. 当前结束点

下一聊天应从“第二版 5 秒开场和 5 秒年度高潮的设计与 stills 验证”开始。不要重新审计第一版全部功能，不要重做演示数据，不要重新下载参考素材，也不要把第一版已经通过的技术验收当作第二版验收。第二版完成后，必须有独立的新 MP4、新检查 JSON、新联系表和新验收说明。
