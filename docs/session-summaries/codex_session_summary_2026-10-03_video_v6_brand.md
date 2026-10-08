# 小懂哥一分钟品牌宣传片第六版交接

> 2026-10-07接续：保留Yves选定的v6曲风层级版，已修复中段配乐过度衰减；当前两版成片通过连续性、完整解码及60秒播放检查。下文是制作历史，旧包由新版交付替代；当前状态见[音频修复交接](codex_session_summary_2026-10-07_video_audio_fix.md)及[工程说明](../../codex_video/README.md)。

日期：2026-10-03。执行者：Codex。项目：`D:\codex\workspaces\codex\小懂哥`。

## Yves的要求与当前状态

Yves授权：「如果我给你一分钟的时长，你能做到什么，请尽情发挥吧」。此前明确要求浅色版、浅深切换、音乐质感与卡点，以及完成后删除旧视频和冗余脚本／文件。本轮据此制作完整60秒横竖品牌片，并在通过验收后清理被替代的v5及重复产物。

主题为「把听过，变成记得」。两支MP4、独立原创MP3、当前可重渲染工程与本机验收齐全；全部制作、编码与删除已完成，没有运行中的渲染或待完成清理。等待Yves观看成片。

## 当前交付

以下相对于`codex_video/`：

| 文件 | 规格／字节数 |
|---|---|
| `output/codex_xiaodongge_portrait_v6_1080p.mp4` | 1080×1920，11,395,912字节 |
| `output/codex_xiaodongge_landscape_v6_1080p.mp4` | 1920×1080，9,843,578字节 |
| `output/codex_original_score_v6.mp3` | 60秒独立原创配乐，1,921,581字节 |
| `output/codex_xiaodongge_v6_sha256.txt` | 两支MP4的SHA-256摘要 |

两支MP4均精确60秒／30fps／1800帧，H.264 High Level4.1、yuv420p、limited BT.709、AAC 48kHz双声道、faststart。

竖版SHA-256：`aa5db4604b483cc3e8151a3d8aae471ee8697cbb25475edfddd8aafeb3a9682c`。

横版SHA-256：`01e68bd9f77465ccd6fde0fb9f41fe44286623ecbc0ed7377ecf77f44891f6f8`。

## 实现与叙事

`src/codex_index_v6.tsx`为唯一影片入口，横竖构图分别排布。开场改为声音、感受和封面留白；记录段给实际输入、保存和评分更多阅读时间；先展示评分、情绪、曲风、六项评分，再进入主题操作；重听增加6秒呼吸段，年度海报形成高潮，最后3.6秒收束品牌。

| 时段 | 画面 |
|---|---|
| 0–4.8秒 | 「声音，会过去。感受，值得留下。」与唱片环、封面 |
| 4.8–16.8秒 | 第一次听见、档案卡、实际速记输入及保存 |
| 16.8–24秒 | 评分、情绪、曲风、全部六项评分 |
| 24–33.6秒 | 全局25.8／27.6秒、阅读30／31.8秒实际浅深切换 |
| 33.6–42秒 | 223天后先写此刻，39.6秒揭晓8→9.5 |
| 42–51.6秒 | 月份积累、年记及真实年度统计 |
| 51.6–56.4秒 | 15张原创封面，52.8秒进入三张真实海报 |
| 56.4–60秒 | 图标、品牌句与音乐淡出 |

沿用既有App 3.1.1真实快照，没有重新采集当前App。35张`public/codex_light/`和15张`public/codex_theme_v5/`PNG继续作为本版共享素材；后者必须保留，不能按名称含v5误删。演示时钟2026-09-29，16条虚构记录；按钮与海报来自实际App，阅读开关独立于全局主题。原始采集断言复制保留至`qa/v6/`，57个原始素材文件字节未变。

## 原创音乐与协作

`scripts/codex_synthesize_v6.py`重新编排60秒原创钢琴、低音、鼓组、弦乐及旋律，含空间残响和节拍延迟；33.6–39.6秒收低，39.6秒旋律回归，年度段抬升，56.4–60秒淡出。100 BPM、4/4拍，30fps下一拍18帧；35个命名声音事件与`public/codex_timing_v6.json`逐采样对齐。不是旧音轨拉伸或循环。

音频luna_worker仅写隔离`codex_v6_audio_work/`；主线程审查完整源码，在生产目录重新合成并逐项验证。生产WAV和MP3与隔离输出字节一致，隔离目录在最终验收后删除。共享`scripts/codex_synthesize.py`是实际PCM及FFmpeg helper，继续保留。

WAV：精确60秒、2,880,000采样帧、48kHz／16-bit双声道，−17.99 LUFS、−6.49 dBTP；SHA-256 `d26df6caebd6d6819d131c3dd33f58bc5adf596c9e228934360d8e70e57c8ebf`。重复合成／母带字节一致、首尾归零、无削波、单声道兼容和完整解码通过。最终AAC两版均−18.01 LUFS、−6.51 dBTP。

## 验收与清理

根typecheck、Node语法、Python AST、音频自检、stills、完整render和check均通过。主线程检查横竖各69张关键帧及各50张MP4抽帧的24张联系表，共238张图；十段时间线连续覆盖1800帧。编码、色彩、faststart、完整解码、响度和持续黑帧检查通过。Chrome静音全长播放两版各1800帧、零掉帧。

在上述验收之后，删除v5入口、时间表、WAV／MP3、两支成片、SHA摘要、计划、验收和QA，并清除重复音频工作目录、两支中间MP4和缓存，共342文件／159,163,934字节。清理严格限于视频工程，逐项核对绝对路径及SHA-256，无重解析点；删除后81个保护文件哈希一致，含全部57个原始素材。前四版已在此前清理，现仅保留v6交付。历史会话文档保留并更新顶部接续说明。

清理后根typecheck、4个Node语法、4个Python AST、所有保护哈希和旧目标缺失检查再次通过；视频项目内只剩两支最终MP4，输出目录只有本版四个交付文件。未增加新依赖；未改App/APK/Release/私人数据/其他助手状态或根依赖，未提交、推送、上传或发布。

关键证据：`codex_video/qa/v6/codex_video_checks.json`、`audio/codex_original_score_v6.qa.json`、`codex_audio_acceptance.json`、`codex_visual_keyframe_acceptance.json`、`codex_visual_final_acceptance.json`、`codex_source_baseline.json`、`codex_cleanup_plan.json`、`codex_cleanup_result.json`及`codex_post_cleanup_checks.json`。工程README、来源审计、`codex_video_review_v6.md`、`codex_v6_plan.md`和自己的`codex_status.txt`均更新。

## 接续方法与边界

先阅读`codex_video/README.md`和本交接。默认`studio`、`audio`、`stills`、`render`、`check`及`:v6`别名均使用第六版；旧版入口和参数已移除。无需重新capture即可离线重渲染，现有父项目依赖及视频依赖保留。只有需要更新真实App素材时才运行capture，它会替换现有快照。

当前没有待继续的实现工作。后续按Yves具体时间点反馈修改；可选择手机／平台播放验证，或将当前成片和必要工程打包。静音Chrome播放与信号检查不等于主观试听、实体手机或平台转码实测。
