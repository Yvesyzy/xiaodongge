# 小懂哥一分钟品牌片第六版曲风与音频连续性验收

日期：2026-10-07。结论：修复37.14–39.18秒近乎无声的音乐；横竖成片、原创配乐连续性、完整解码及60秒本机播放均通过。曲风大类与子类、品牌主线、浅深切换、重听和年记画面沿用2026-10-03验收版本。替换音轨前后H.264流SHA及时间字段完全一致。

## 成片

| 项目 | 竖版 | 横版 |
|---|---|---|
| 文件 | `output/codex_xiaodongge_portrait_v6_1080p.mp4` | `output/codex_xiaodongge_landscape_v6_1080p.mp4` |
| 画幅 | 1080×1920 | 1920×1080 |
| 时长／帧率／帧数 | 60秒／30fps／1800帧 | 60秒／30fps／1800帧 |
| 文件字节数 | 11,590,493 | 9,930,943 |
| Chrome完整播放 | 1800帧，零掉帧 | 1800帧，零掉帧 |
| AAC响度／真峰值 | −18.02 LUFS／−6.32 dBTP | −18.02 LUFS／−6.32 dBTP |

两版均为H.264 High Level4.1、yuv420p、limited BT.709（色彩空间、传递函数、原色均标记）、AAC 48kHz双声道及faststart。FFmpeg完整解码无错误，未检测到持续黑帧。音轨使用生产WAV重新编码；完整参数、哈希及逐项检查在`qa/v6/codex_video_checks.json`。

```text
72476fd1a8c5f9a9153d995044dc123e4fc5b08c2d7004f1187f113e0b20a0b0  codex_xiaodongge_portrait_v6_1080p.mp4
23b57b21e315a7b11d586a2192b641775c78bcdef80ec049b5a5a64d3e45bd0e  codex_xiaodongge_landscape_v6_1080p.mp4
```

## 画面与来源

横竖各80张Remotion关键帧、各58张实际MP4抽帧，共276张；主线程已逐一查看16张关键帧联系表和12张成片联系表。开场、记录、曲风三级操作、六项评分、全局和阅读按钮、盲重听、月份、年度统计、Top15及三张海报在两种构图中均完成复核，标题、UI、字幕和片脚没有重叠。

曲风段19.2–24秒：8个大类、电子的5个分支、House的6个细类、Deep House选中态，各1.2秒。三个点击位置由实际DOM测量，实际`genreTags`选中值为`电子, House, Deep House`；没有重绘控件。24–25.2秒呈现全部六项评分。

全局26.4→28.2秒深浅切换，阅读30→31.8秒独立深浅切换。按钮位置来自实际DOM，圆形转场使用真实浅深截图。转场初始帧会先出现新背景，再由圆形扩展覆盖UI；对应状态在后续抽帧确认。影片背景检查与真实开关状态断言分别保留。

原35张基础浅色PNG和15张主题操作PNG沿用App 3.1.1既有快照；本次补拍当前App 3.1.1的4张曲风PNG。演示数据固定2026-09-29，虚构作品、听感与几何封面；原速记实际保存后共16条记录，本次曲风采集复用15条原始记录且未保存编辑。三次曲风点击验证真实展开和选中，原记录字节不变、页面无错误。六项评分、223天与8→9.5继续用原真实截图；Top15是个人选编，海报保持真实导出模板。

视觉证据：`qa/v6/codex_visual_keyframe_acceptance.json`、`codex_visual_final_acceptance.json`、`codex_theme_keyframes_checks.json`、`codex_theme_final_checks.json`，以及`codex_capture_genre.json`、`codex_capture_light.json`与`codex_capture_theme.json`。

## 音乐与卡点

60秒原创钢琴、低音、鼓组、弦乐音色、高音旋律、立体声残响及节拍延迟。33.6–39.6秒保留持续可听的柔和钢琴，39.6秒揭晓恢复，年度段推向海报高潮，56.4秒开始收束与淡出。38个音效事件共用100 BPM／18帧一拍的时间表，20.4／21.6／22.8秒的曲风点击、保存13.8秒、揭晓39.6秒、海报52.8秒和品牌56.4秒均保持原采样位置。

WAV精确2,880,000采样帧／60秒／48kHz／16-bit双声道，实测−18.00 LUFS、−6.28 dBTP。首尾归零、无削波、WAV与MP3完整解码通过；重复合成及重复母带字节一致。重听段伴奏相对前段降低8.19dB，单声道损失0.31dB。全部音色和声音效果在本地程序生成，没有外部歌曲或录音样本。

旧版稀疏编曲叠加0.070总线增益，回听平均降低32.86dB，最弱半秒RMS为−61.80dBFS，37.14–39.18秒连续约2.04秒低于−45dB。修复将盲重听钢琴增益由0.032调至0.048、总线由0.070调至0.90，保留现有平滑过渡。新版最低滑动半秒RMS为−37.80dBFS，两支实际AAC最低半秒为−37.83dBFS。旧母带被新回归检查拒绝，新WAV、MP3和两支AAC均通过；中段没有持续0.5秒低于−45dB的空档，末尾自然淡出继续保留。

原编排由音频worker隔离制作，主线程审查后集成；本次主线程修改点击事件并按新时间表重复合成，当前音频区别于修订前worker输出。证据在`qa/v6/audio/codex_original_score_v6.qa.json`、`codex_audio_acceptance.json`、`codex_timeline_checks.json`和`codex_audio_notes_v6.md`。共享PCM helper仍被本版导入，予以保留。

## 工程与历史清理（2026-10-03）

根`npm.cmd run typecheck -- --incremental false`、5个Node脚本语法、4个Python AST、真实曲风采集、音频自检、`npm.cmd run stills`、`npm.cmd run render`及`npm.cmd run check`均以零退出码完成。新增`capture:genre`，默认`capture`按浅色、主题、曲风顺序执行；默认入口和`:v6`别名只使用本版，无新增依赖。

按Yves原先要求，新版直接替换原v6成片；验收后删除两支中间MP4和缓存，共138文件／91,621,456字节。所有目标先核对视频工程内绝对路径、递归清单和SHA-256，未发现重解析点。删除后82个保护文件哈希一致，包含57个原始素材和6个新增曲风文件；`output/`只剩当前两支MP4、MP3和成片SHA摘要。前五版已删除，先前v6制作的342文件清理报告保留为历史证据。

清理后再次执行根typecheck、Node语法、Python AST、保护文件哈希及已删路径缺失检查，通过；项目内只剩两支最终MP4。当前证据为`qa/v6/codex_genre_cleanup_plan.json`、`codex_genre_cleanup_result.json`和`codex_post_cleanup_checks.json`。既有依赖、共享真实素材及历史会话交接保留。

## 范围与后续

本轮只修改视频工程及自己的交接文件，未修改App业务源码、正式APK、Release、私人数据、根依赖或其他助手状态。没有安装、提交、推送、上传或发布。静音Chrome全长播放及信号检查不代表主观试听、实体手机或平台转码实测。

## 2026-10-07验证与交付

修改两个现有脚本，无新增依赖。音频双次合成／双次母带、Node语法、Python AST、WAV／MP3及实际AAC连续性、完整MP4检查通过；两版Chrome60秒播放均为1800帧、零掉帧。63个素材文件、影片入口及时间表哈希不变，画面沿用已接受版本；当前抽帧背景检查通过。保留28张联系表和JSON结论，294个重复抽帧／日志／播放快照／替换副本／一次性脚本删除47,962,192字节；删除前后82个保护哈希一致。

诊断及前后回归在`qa/v6/codex_audio_gap_before.json`和`codex_audio_gap_after.json`，无损复制画面证据在`codex_audio_remux_checks.json`，实际临时文件清理在`codex_audio_cleanup_result.json`。新包为项目根`codex_xiaodongge_video_final_2026-10-07.zip`，外部SHA及打包后`codex_package_checks.json`记录最终摘要与旧包／暂存清理。手机或平台试听仍由Yves按需要进行。
