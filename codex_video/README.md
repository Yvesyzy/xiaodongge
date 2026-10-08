# 小懂哥｜一分钟品牌宣传片

第六版主题为「把听过，变成记得」。保留真实曲风层级、多个大类及「电子 → House → Deep House」展开与选择，一分钟叙事、横竖构图、真实浅深切换及38个音乐重音。2026-10-07修复中段伴奏过度衰减：盲重听保留柔和钢琴，持续可听；原视频流及画面时间完全不变。

Yves已选定此版。更新后的定稿ZIP位于项目根目录：`codex_xiaodongge_video_final_2026-10-07.zip`，外部校验文件为同名`.sha256.txt`。包内含当前横竖成片、MP3、WAV、完整素材／字体、影片源码与脚本、锁文件、JSON验收和音频修复交接；逐文件大小及SHA-256见包内清单，打包后的实际校验结果见本机`qa/v6/codex_package_checks.json`。使用方法见`codex_交付说明.md`，最新交接见`../docs/session-summaries/codex_session_summary_2026-10-07_video_audio_fix.md`。

工程：`D:\codex\workspaces\codex\小懂哥\codex_video`。

## 交付文件

| 文件（相对视频工程） | 规格 |
|---|---|
| `output/codex_xiaodongge_portrait_v6_1080p.mp4` | 1080×1920，60秒，30fps，1800帧 |
| `output/codex_xiaodongge_landscape_v6_1080p.mp4` | 1920×1080，60秒，30fps，1800帧 |
| `output/codex_original_score_v6.mp3` | 一分钟原创音乐独立试听 |
| `output/codex_xiaodongge_v6_sha256.txt` | 两支成片的SHA-256摘要 |

MP4使用H.264 High Level4.1、yuv420p、limited BT.709、AAC 48kHz双声道及faststart。最终`output/`保留以上四个文件，中间MP4可按需重新生成。

## 画面与音乐

| 时间 | 内容 |
|---|---|
| 0–4.8秒 | 「声音，会过去。感受，值得留下。」与封面、唱片环 |
| 4.8–16.8秒 | 第一次听见，进入档案，实际输入与保存速记 |
| 16.8–19.2秒 | 阅读、评分与情绪 |
| 19.2–24秒 | 8个曲风大类 → 电子的多个分支 → House的6个细类 → Deep House选中 |
| 24–25.2秒 | 制作／词／曲／人声／原创性／共鸣六项评分 |
| 25.2–33.6秒 | 全局浅深切换，阅读页独立浅深切换 |
| 33.6–42秒 | 223天后盲重听，先写此刻，再揭晓8→9.5 |
| 42–51.6秒 | 月份累积、年记封面与年度统计 |
| 51.6–56.4秒 | 15张原创封面汇入三张真实年度海报 |
| 56.4–60秒 | 图标、品牌与「记录的不只是音乐，也是当时的你。」 |

原有50张PNG沿用App 3.1.1已验收快照：`public/codex_light/`35张、`public/codex_theme_v5/`15张；后者名称保留素材来源版本。当前修订单独采集App 3.1.1的真实曲风选择控件，新增`public/codex_genre/`4张PNG和实测坐标清单，没有重绘控件。演示时钟固定在2026-09-29，作品、正文及几何封面均为虚构数据。原主题操作针对同一份16条记录，阅读开关独立于全局主题；曲风采集复用15条原始演示记录，仅在隔离编辑表单中点击，未保存改动。

全局26.4秒切深色、28.2秒回浅色；阅读30秒切深色、31.8秒回浅色。点击反馈及圆形转场使用真实按钮坐标和对应截图。海报保持App真实导出的深绿模板，Top15是个人选编。

`public/codex_original_score_v6.wav`是60秒原创配乐，由本地NumPy和FFmpeg生成全部声部及空间效果。钢琴开场，逐步加入低音和鼓组，33.6–39.6秒用持续可听的柔和钢琴保留呼吸感，年度段加入弦乐与高音旋律，56.4–60秒自然淡出。100 BPM、4/4拍，30fps下一拍18帧；38个事件与`public/codex_timing_v6.json`共用整数帧时间表，20.4／21.6／22.8秒增加曲风操作重音。WAV精确2,880,000采样帧，48kHz／16-bit双声道，实测−18.00 LUFS、−6.28 dBTP；两次合成及响度处理字节一致。回听比前段低8.19dB，0.5秒滑动窗口最低RMS为−37.80dBFS；旧音轨会被新增检查拒绝。

## 预览与重渲染

默认命令均使用第六版：

```powershell
Set-Location -LiteralPath 'D:\codex\workspaces\codex\小懂哥\codex_video'
npm.cmd run studio
npm.cmd run audio
npm.cmd run stills
python -B scripts/codex_review_sheet.py
npm.cmd run render
npm.cmd run check
```

Studio的Composition为`Xiaodongge-Portrait`和`Xiaodongge-Landscape`，横竖构图分别排布。单独渲染使用`npm.cmd run render:portrait`或`npm.cmd run render:landscape`。`:v6`别名与默认命令一致；旧版本参数和入口不再支持。

图片、字体及音频均在本地，可离线重渲染。`npm.cmd run capture`依次执行`capture:light`、`capture:theme`和`capture:genre`，仅在需要拍摄当前App时使用；它会更新现有素材。只更新曲风控件可执行`npm.cmd run capture:genre`。采集使用独立Vite服务与隔离浏览器，阻断外部请求并在结束时释放服务。

工具需能从PATH调用Node、Python（NumPy、Pillow）、FFmpeg及ffprobe，并安装Chrome。父项目的Vite和Playwright与视频工程依赖均需保留；只安装视频目录依赖不能替代父项目依赖。当前工程依赖为Remotion 4.0.529、React 19.2.7，没有新增依赖。

## 保留结构与验收

`src/codex_index_v6.tsx`为唯一影片入口；`scripts/codex_synthesize_v6.py`为音乐入口，实际调用共享`scripts/codex_synthesize.py`的PCM及FFmpeg helper。现有capture、render、check、contact及review脚本均使用本版路径。`public/`保存真实素材、字体、时间表及WAV，`qa/v6/`保存本版证据。`node_modules/`、`output/`、`qa/`、`.cache/`和日志不进入Git。

`stills`生成横竖各80张关键帧，16张联系表供逐项目检。`check`读取实际MP4，核对60秒／1800帧、编码、色彩、faststart、音轨、完整解码、响度、持续黑帧、横竖各58张最终抽帧和Chrome全长播放；同时校验38个音乐事件、十段连续时间线、真实主题开关、三级曲风操作及全部素材清单。新增音乐检查覆盖WAV、MP3和两版实际AAC：0.1–58.8秒内不允许持续0.5秒低于−45dB，回听段12个半秒窗口均需达到−38dBFS，合成时额外每0.1秒扫描一次。

2026-10-07两版Chrome完整播放均为1800帧、零掉帧；AAC实测−18.02 LUFS、−6.32 dBTP，中段连续性检查均通过。仅替换音轨，前后H.264流SHA及时间字段一致，沿用已复核的28张联系表；新的116张最终抽帧背景检查通过。验收后删除294个重复抽帧、日志、播放快照、音轨替换副本及一次性脚本，共47,962,192字节，82个保护哈希一致；28张联系表及JSON结论保留，原始抽帧可重新生成。旧包与本次打包暂存的清理由`codex_package_checks.json`记录。此前342文件及138文件清理报告均为历史证据；当前57个原始素材及6个曲风文件与基线一致。

详细记录：`codex_video_review_v6.md`、`VIDEO_SOURCE_AUDIT.md`、`qa/v6/codex_video_checks.json`、`codex_audio_gap_before.json`、`codex_audio_gap_after.json`、`codex_audio_remux_checks.json`及`codex_audio_cleanup_result.json`。最新交接：`../docs/session-summaries/codex_session_summary_2026-10-07_video_audio_fix.md`。历史会话文档保留，旧版状态以各文档顶部的后续说明为准。

视频未上传平台；静音浏览器全长播放与信号检查不代表主观试听、实体手机或平台转码实测。
