# 小懂哥一分钟宣传片曲风层级修订交接

> 2026-10-07接续：保留Yves选定的v6曲风层级版，已修复中段配乐过度衰减；当前两版成片通过连续性、完整解码及60秒播放检查。下文是制作历史，旧包由新版交付替代；当前状态见[音频修复交接](codex_session_summary_2026-10-07_video_audio_fix.md)及[工程说明](../../codex_video/README.md)。

日期：2026-10-03。执行者：Codex。项目：`D:\codex\workspaces\codex\小懂哥`。

## 要求与完成状态

Yves要求：「展示曲风的时候，可以展示多一点，而不是只是dreampop，可以展示一下大的分类，然后点击之后还有小的分类」。本轮补拍真实曲风控件，修改现有v6视频和配乐，完成60秒横竖成片、本机验收、清理与交接。新版直接替换原v6文件，当前没有运行中的采集、渲染或待完成清理。

## 当前交付

文件位于`codex_video/output/`，两支MP4均60秒／30fps／1800帧，H.264 High Level4.1、yuv420p、limited BT.709、AAC 48kHz双声道、faststart。

| 文件 | 规格／字节数 |
|---|---|
| `codex_xiaodongge_portrait_v6_1080p.mp4` | 1080×1920，11,602,820字节 |
| `codex_xiaodongge_landscape_v6_1080p.mp4` | 1920×1080，9,943,270字节 |
| `codex_original_score_v6.mp3` | 更新点击事件后的60秒原创配乐 |
| `codex_xiaodongge_v6_sha256.txt` | 当前两支MP4摘要 |

```text
2e20d4902beaa4a5a2017f94f415934fdba25e1ab41609f2d14d74bf58ab80f4  codex_xiaodongge_portrait_v6_1080p.mp4
da13898bad94be3a833765cf4fec50b68bb17143017632b7654fe0ccdd670d3f  codex_xiaodongge_landscape_v6_1080p.mp4
```

## 实现与真实来源

先读取`shared/genres.ts`的`GENRE_TREE`及`mobile/src/App.tsx`的`GenrePicker`。真实树有16个大类，House有17个细类。新增`scripts/codex_capture_genre.mjs`使用实际手机H5、独立Vite与隔离Chrome，复用15条虚构演示数据、固定2026-09-29时钟、阻断外部请求；实际点击「电子 → House → Deep House」。隐藏`genreTags`值为`电子, House, Deep House`，存储记录字节不变，没有保存编辑或页面错误。

`public/codex_genre/`保留4张真实DOM截图、尺寸和点击坐标清单：大类总览、电子分支、House细类、Deep House选中态。原35张浅色PNG和15张主题PNG沿用已验收的App 3.1.1快照，57个原始文件未变；新增曲风截图同样来自当前App 3.1.1。没有修改App业务源码或重绘控件。

曲风段19.2–24秒，共4.8秒，各状态1.2秒：8个大类 → 电子的5个分支 → House的6个细类 → Deep House选中。三个点击反馈使用实测坐标。六项评分移至24–25.2秒；全局26.4秒切深色、28.2秒回浅色，阅读30／31.8秒仍独立切换；重听、年记、Top15、真实海报及品牌结尾保持原叙事，整片仍60秒。

现有`src/codex_index_v6.tsx`、`public/codex_timing_v6.json`及`scripts/codex_synthesize_v6.py`就地修改，没有新版本入口或依赖。原配乐编排经隔离worker审查，本次由主线程添加20.4／21.6／22.8秒曲风重音并按新时间表重新合成，共38个事件。100 BPM、一拍18帧，WAV精确2,880,000采样帧、−18.00 LUFS／−6.51 dBTP；重复合成和母带一致，端点、单声道兼容及WAV／MP3解码通过。当前音频区别于修订前worker输出。

## 验证与清理

实际曲风采集、根typecheck、5个Node语法、4个Python AST、音频自检、stills、完整render和check全部通过。主线程查看160张关键帧及116张最终MP4抽帧的全部28张联系表；分类、点击、六项评分、主题和其余镜头在两种构图中均完成复核。十段时间线连续覆盖1800帧，38个声音事件按采样点核对。

两版编码、色彩、faststart、完整解码、持续黑帧和响度检查通过，AAC均−18.02 LUFS／−6.51 dBTP；Chrome完整播放均1800帧、零掉帧。

沿用Yves删除旧视频和冗余文件的授权，新版替换原v6；验收后删除两支中间MP4与`.cache`，共138文件／91,621,456字节。删除前核对视频工程内绝对路径、完整文件清单和SHA，无重解析点；删除后82个保护哈希一致，含原57个素材和新增6个曲风文件。清理后类型检查、脚本语法及哈希再次通过，视频工程仅剩两支最终MP4，输出目录四个交付文件。前五版已在先前清理；旧342文件清理报告保留为历史证据。

证据位于`codex_video/qa/v6/`：`codex_capture_genre.json`、`codex_genre_source_baseline.json`、`codex_video_checks.json`、两份`codex_visual_*_acceptance.json`、`codex_timeline_checks.json`、`audio/codex_original_score_v6.qa.json`、`codex_audio_acceptance.json`、`codex_genre_cleanup_plan.json`、`codex_genre_cleanup_result.json`及`codex_post_cleanup_checks.json`。README、来源审计、v6验收、计划和自己的status已更新。

## 接续方法

先阅读`codex_video/README.md`与本交接。默认`studio`、`audio`、`stills`、`render`、`check`仍使用v6；新增`npm.cmd run capture:genre`。默认`capture`依次拍浅色、主题、曲风；仅需改片时不必重新采集，可直接使用保留素材离线重渲染。

当前制作与清理均完成，后续按Yves具体时间点反馈修改，或执行手机／平台播放验证和当前工程打包。未修改App/APK/Release/私人数据/根依赖或其他助手状态，未安装、提交、推送、上传或发布。静音Chrome播放及信号检查不代表实体手机、平台转码或主观听感验收。
