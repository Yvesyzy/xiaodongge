# 小懂哥40秒浅深切换宣传片第五版交接

> 2026-10-07接续：保留Yves选定的v6曲风层级版，已修复中段配乐过度衰减；当前两版成片通过连续性、完整解码及60秒播放检查。下文是制作历史，旧包由新版交付替代；当前状态见[音频修复交接](codex_session_summary_2026-10-07_video_audio_fix.md)及[工程说明](../../codex_video/README.md)。

日期：2026-10-03。执行者：Codex。项目：`D:\codex\workspaces\codex\小懂哥`。

## Yves 的要求与当前状态

此前已根据2026-09-30视频交接完成第二版重剪、第三版原创音乐和卡点、第四版真实浅色界面。Yves本轮要求「将浅色深色的可以切换的也做进去，可以做到40秒」。第五版横竖成片已完成并通过本机验收，等待Yves观看反馈；没有待继续的渲染或编码。

## 交付位置

视频工程：`D:\codex\workspaces\codex\小懂哥\codex_video`。

| 文件（相对视频工程） | 规格 | 字节数 | SHA-256 |
|---|---|---:|---|
| `output/codex_xiaodongge_portrait_v5_1080p.mp4` | 1080×1920，40秒，30fps，1200帧 | 9,545,174 | `13882de7f6501736d4f928c03695ee9fcca1ee0d2b89f7f568273097ba6ebfa2` |
| `output/codex_xiaodongge_landscape_v5_1080p.mp4` | 1920×1080，40秒，30fps，1200帧 | 8,310,778 | `41da16aa1413f72b87edc24b0ef4423662d55aa312ab46f4928214a3713cefed` |

独立音乐试听：`output/codex_original_score_v5.mp3`。SHA清单：`output/codex_xiaodongge_v5_sha256.txt`。交付使用包含 `xiaodongge` 和 `1080p` 的两支MP4；Remotion中间文件已按后续清理要求删除。

## 实现与精确接续点

- 独立 `src/codex_index_v5.tsx` 和 `public/codex_timing_v5.json`。沿用第四版浅色叙事，7.2–16.8秒增加9.6秒／16拍主题段，后续整体顺延9.6秒；结尾增加0.4秒，总长1200帧／40秒。
- 新增 `scripts/codex_capture_theme.mjs` 和 `public/codex_theme_v5/`。真实操作 `/more` 的 `.theme-choice` 深色→浅色，以及阅读页 `.codex-reader-menu` 中的独立深浅按钮；全局与阅读开关在当前App中彼此独立，未改App实现。
- 采集快照版本3.1.1，原16项新素材中删除未用的一项后保留15项，同一份16条虚构记录。先实际保存速记「风停以后」，与前一镜头衔接，再验证切换前后全部entries/appData一致。首页正常初始化会写入日常回顾状态，因此基线快照必须在首次首页初始化后建立；已修正初次失败，最终 `codex_capture_theme.json` 为passed；失效错误证据在后续清理中删除。
- 全局切换8.4／10.2秒、阅读切换12.6／15秒，15.6秒关闭阅读菜单；26.4秒评分揭晓、28.8秒月份、33.6秒Top15、34.2秒海报、37.2秒品牌。字幕、背景与真实UI同步切换，点击环与扩散起点由DOM实测坐标计算。阅读控件截图使用纸面底板作为放大特写，避免底层正文透入。
- 六项评分「制作、词、曲、人声、原创性、共鸣」、盲重听、223天和8→9.5揭晓、年度海报保留。海报仍为App实际导出的深绿模板。
- 新增 `scripts/codex_synthesize_v5.py` 和40秒原创WAV，100BPM、一拍18帧、25个精确事件；四小节主题旋律／和声、24–26.4秒收低伴奏、37.2–40秒淡出。worker只写 `codex_v5_audio_work/`；主线程审查后在生产目录重新合成并核验哈希一致。没有外部音源或新依赖。
- 共享 `codex_render.mjs`、`codex_check.mjs`、`codex_review_sheet.py` 和package默认使用v5；旧版分支和命令已清除。v5音频事件名直接使用时间表名称。1200帧联系表按数值帧号排序；不要将大于999的帧名按字符串排序。

## 验证结果

- 根类型检查、JavaScript语法、Python语法通过；主题采集错误零，全局和阅读按钮状态与16条数据保留通过。
- 40秒WAV为48kHz／16-bit／双声道／1,920,000采样帧，SHA `4c97048fb081caa5fde9f2f855797ac18e20c62c3a50c740d1429f4fb5d7fa82`。重复合成原始数组、重复WAV主处理、worker与生产WAV均一致。25个事件与时间表逐采样对齐；WAV／MP3完整解码、无削波、首尾归零、单声道兼容通过。
- 母带实测−18.00LUFS／−7.93dBTP；最终两支AAC均−18.01LUFS／−7.87dBTP／LRA3.80。
- 两支均H.264 High Level4.1／yuv420p／limited／完整BT.709／AAC48kHz双声道／faststart。40秒、1200帧、完整解码、无持续黑帧通过。
- 100张关键帧、10张联系表，以及68张实际MP4抽帧、8张最终联系表已目检。浅色背景亮度242.43–253.21、深色15.01–31.59；背景像素验证与真实UI主题采集各自独立。
- Chrome静音播放两支均结束于40秒，152次时间更新、totalVideoFrames=1200；竖屏掉帧7（0.58%）、横屏10（0.83%），低于3%门槛。静音浏览器检查不等同于主观试听、实体手机或平台转码实测。
- 制作阶段第一至第四版779个受保护文件哈希未变；Yves后续明确要求清理，这些旧版文件及原保留基线已删除。最终报告 `qa/v5/codex_video_checks.json` 为 `passed:true`。

证据还包括 `qa/v5/codex_capture_theme.json`、`qa/v5/audio/codex_original_score_v5.qa.json`、`qa/v5/codex_audio_acceptance.json`、`qa/v5/codex_theme_keyframes_checks.json`、`qa/v5/codex_theme_final_checks.json`、`qa/v5/codex_visual_acceptance.json`、`qa/v5/codex_typecheck.log`。详细验收 `codex_video_review_v5.md`，计划 `codex_v5_plan.md`。

## 重渲染与范围

在视频工程目录运行 `npm.cmd run studio:v5`、`stills:v5`、`render:v5`、`check:v5`；`audio:v5` 可重新合成音轨，`capture:theme` 可重新操作主题采集。单独渲染使用 `npm.cmd run render:portrait -- --version=v5` 或横屏对应命令。字体、图片、音轨均在本地，已有素材可离线重渲染。

按Yves后续要求删除前四版和重复文件；第五版媒体、实际调用脚本、50张保留截图及验收证据保留。未由本任务修改App业务代码、Android、正式APK、Release、根依赖或其他助手状态，未读取私人数据，无安装、提交、推送、上传或发布。工作区原有其他会话变更继续保留，重复音频工作目录已删除。

## 下一步

按Yves反馈的具体时间点调整切换节奏或音乐，再在实际手机／目标平台验证播放。若要求交付工程，可打包必要源文件、真实素材和音乐，不包含node_modules、缓存和独立音频重复工作目录。清理已经明确授权并执行；没有授权发布或提交。
