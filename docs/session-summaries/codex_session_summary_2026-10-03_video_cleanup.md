# 小懂哥宣传片旧版与冗余文件清理交接

> 2026-10-07接续：保留Yves选定的v6曲风层级版，已修复中段配乐过度衰减；当前两版成片通过连续性、完整解码及60秒播放检查。下文是制作历史，旧包由新版交付替代；当前状态见[音频修复交接](codex_session_summary_2026-10-07_video_audio_fix.md)及[工程说明](../../codex_video/README.md)。

日期：2026-10-03。执行者：Codex。项目：`D:\codex\workspaces\codex\小懂哥`。

## 授权与当前状态

Yves在第五版制作完成后明确要求：「做完之后，将前面版本的视频都删了，包括冗余脚本和文件」。本次已执行清理并完成复测，当前只保留第五版40秒横竖成片、可重渲染工程及有效验收证据。

最初制作第五版时，按当时范围保护了779个旧版文件；后续清理要求取代该保留策略。前四版成片、旧入口与旧QA已删除，没有另建重复备份。项目会话总结作为交接记录保留，已在顶部标记旧文件删除与最新接续位置。

## 已删除范围

删除清单内共1463个文件、719,097,891字节（约685.79 MiB）：

- 第一至第四版8支横竖成片、全部10支Remotion中间MP4（包括第五版中间文件），以及旧版MP3和SHA摘要。
- 4个旧时间线入口、旧采集脚本、旧配乐生成脚本、旧版保留基线检查脚本与旧视频计划／验收文档。
- 旧版public根素材、字体副本、音轨、时间表，以及QA根目录中的第一版证据和`qa/v2/`、`qa/v3/`、`qa/v4/`等旧验收产物。
- 第五版未使用的11张截图、失效主题采集错误证据和旧版保护基线。
- 原缓存、Python字节码及两个重复音频工作目录。

复测另外产生109个缓存文件（62,410,885字节）；验证结束后已再次删除。一次性清理脚本（7,391字节）也已删除，保留清单与结果报告供审计。最后确认所有原计划路径均不存在。

## 保留交付与工程

| 相对`codex_video/`的路径 | 规格／用途 |
|---|---|
| `output/codex_xiaodongge_portrait_v5_1080p.mp4` | 1080×1920，40秒，30fps，1200帧 |
| `output/codex_xiaodongge_landscape_v5_1080p.mp4` | 1920×1080，40秒，30fps，1200帧 |
| `output/codex_original_score_v5.mp3` | 原创配乐独立试听 |
| `output/codex_xiaodongge_v5_sha256.txt` | 两支成片的SHA-256摘要 |

`output/`严格仅包含以上四个文件。`src/`只保留`codex_index_v5.tsx`；保留35张浅色PNG与15张主题操作PNG、虚构数据、字体／授权说明、40秒WAV和第五版时间表。`qa/v5/`保留最终有效采集、音频、100关键帧、68最终抽帧与对应联系表和检查报告。

共享`codex_synthesize.py`是第五版的实际导入依赖，保留10个PCM／FFmpeg helper，删除其旧声音生成逻辑。已安装依赖与锁文件保留，不新增依赖。真实App、APK、Release、私人数据、其他助手状态及其他会话修改不在清理范围。

## 默认命令与实际验证

在`D:\codex\workspaces\codex\小懂哥\codex_video`执行，默认命令全部使用第五版；`:v5`别名仍有效，旧版分支及命令已移除。

```powershell
npm.cmd run studio
npm.cmd run audio
npm.cmd run stills
python -B scripts/codex_review_sheet.py
npm.cmd run render
npm.cmd run check
```

`render:portrait`及`render:landscape`可单独渲染。`capture`依次执行真实浅色和主题采集，更新保留素材；本次未重拍已验收的截图，保留其原始字节。已有素材可离线重渲染。

清理后实际通过：

- 根项目`npm.cmd run typecheck -- --incremental false`；修改的4个JavaScript和4个Python脚本语法检查。
- 默认`npm.cmd run audio`重复合成与完整音频自检，WAV、MP3哈希与已验收版本完全一致。
- 默认`npm.cmd run stills`重新打包后生成100张关键帧；默认review_sheet通过浅深背景检查，主线程复看横竖主题联系表。
- 默认`npm.cmd run check`完整解码、40秒／1200帧、色彩、faststart、响度、25个事件、十段连续时间线、68张最终抽帧及Chrome全长播放通过。
- 两支均正常播放结束于40秒，152次时间更新、1200帧；本次竖屏掉帧2、横屏4，均低于3%门槛。
- 两份素材清单、尺寸清单与实际PNG严格一致（35+15）；57个保留媒体SHA-256在删除前后、音频再生成后均一致。

没有为清理重新编码成片，两支MP4保持原字节：

```text
13882de7f6501736d4f928c03695ee9fcca1ee0d2b89f7f568273097ba6ebfa2  portrait
41da16aa1413f72b87edc24b0ef4423662d55aa312ab46f4928214a3713cefed  landscape
```

证据：`codex_video/qa/v5/codex_cleanup_plan.json`、`codex_cleanup_result.json`、`codex_video_checks.json`、`codex_typecheck.log`、`codex_cleanup_audio.log`、`codex_cleanup_stills.log`、`codex_cleanup_review.log`。工程说明与素材审计已改为第五版当前状态，自己的`codex_status.txt`已更新。

## 接续

当前没有待完成的删除、渲染或编码。若Yves要求继续，可按观看反馈的具体时间点调整第五版，或打包当前交付与重渲染工程。实体手机及目标平台转码尚未实测。未提交、推送、上传或发布；不要依据旧会话恢复已删除版本。
