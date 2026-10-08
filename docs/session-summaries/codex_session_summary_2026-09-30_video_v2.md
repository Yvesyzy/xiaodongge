# 小懂哥宣传片第二版交接

> 2026-10-07接续：保留Yves选定的v6曲风层级版，已修复中段配乐过度衰减；当前两版成片通过连续性、完整解码及60秒播放检查。下文是制作历史，旧包由新版交付替代；当前状态见[音频修复交接](codex_session_summary_2026-10-07_video_audio_fix.md)及[工程说明](../../codex_video/README.md)。

日期：2026-09-30。项目：`D:\codex\workspaces\codex\小懂哥`。作者：Codex。

## 完成内容与当前状态

Yves 要求阅读 `codex_session_summary_2026-09-30_video_handoff.md` 后继续宣传片制作。已沿用上一轮案例研究及素材完成第二版重剪，实际渲染独立横竖 MP4，机器验收和最终逐镜头抽帧检查通过；等待 Yves 观看并评价剪辑吸引力。

1. 开场以唱片纹理和 223 天问题进入，封面缩回真实档案卡。
2. 速记从真实空白截图到填写揭示、保存节拍和真实保存结果；阅读/评分/情绪/曲风连续横移，四维控件展开。
3. 14.5 秒转为米白画面并收低配乐，17 秒揭晓 223 天、8→9.5 和新听感。
4. 月份记录逐张积累成年记，24 秒的 15 张原创封面聚合成真实三页海报；27.5 秒收束，品牌句只出现一次。
5. 配乐仍为原创程序合成，独立 `codex_original_score_v2.wav`；保存、重听和海报均有同步节拍。

## 可直接交付的文件

- `codex_video/output/codex_xiaodongge_portrait_v2_1080p.mp4`：1080×1920，8,498,036 字节，SHA-256 `05eb2e19f7da4b6a351625c79287488b362584ab2537a48627d977ef1ebcdcce`。
- `codex_video/output/codex_xiaodongge_landscape_v2_1080p.mp4`：1920×1080，7,278,798 字节，SHA-256 `1e946a9dcf541efe9c3bc126c416818ac3049842d9b75bc0558d2c557943a6fe`。
- `codex_video/output/codex_xiaodongge_v2_sha256.txt`。
- 工程步骤：`codex_video/README.md`；实现入口：`codex_video/src/codex_index_v2.tsx`；验收：`codex_video/codex_video_review_v2.md`；计划：`codex_video/codex_v2_plan.md`。

## 验证结果

- 两版 30.000 秒、30fps、900 帧、H.264 High / Level 4.1、yuv420p、limited range、完整 BT.709、AAC 48kHz 双声道、faststart。
- 全片解码无错误，无持续空白帧；Chrome 均完整播放到 30 秒，900 帧、0 掉帧、115 次 timeupdate。
- 实际 AAC 配乐 −22.18 LUFS、真峰值 −10.07 dBFS，无削波；WAV 首尾归零，停顿相对 RMS −43.24 dB。
- `qa/v2/codex_video_checks.json` 为最终通过报告；`qa/v2/final_frames/` 每版 22 张最终抽帧；四张 `qa/v2/codex_final_*` 联系表均已目检。
- 根 `npm.cmd run typecheck`、修改 JS 脚本语法检查及音轨合成 QA 均通过。
- 开始记录的第一版 269 个原有文件全部通过最终 SHA-256 复核；原版成片和证据不变。
- 验收中修复了切镜暗帧、横版保存按钮裁切、盲重听顶栏/控件裁切和色彩标签不完整；最终成片已经重新编码、重新检查。

## 修改范围与边界

新增独立第二版入口、合成音频脚本、保留基线脚本、计划和验收文件；修改现有视频渲染/检查/联系表脚本以支持 `--version=v2`，增加 package 脚本和 README。原第一版入口、音轨与 QA 未改。

没有重新采集 UI、访问私人数据库、引入案例视频或商业音乐；没有修改 App 业务源码、正式 APK、GitHub Release，也未提交、推送或上传。本轮期间工作区出现其他会话对 `mobile/src/codex_JournalExport.tsx`、`mobile/src/codex_reviewShare.css` 和 `scripts/codex_check_review_share.mjs` 的修改，已保留，不要用 reset/checkout/clean 覆盖它们或既有文档整理。

Windows 沙箱 helper 存在 `helper_sandbox_lock_failed`，本轮本地命令通过审查后的 `require_escalated` 执行，仅操作已授权的项目文件。普通工具进程恢复前需注意这个环境问题。

## 接续方式

目前无需再渲染。先看第二版成片；若 Yves 要调整，直接在独立第二版入口修改，按时间点处理反馈。验收命令：

```powershell
Set-Location -LiteralPath 'D:\codex\workspaces\codex\小懂哥\codex_video'
npm.cmd run studio:v2
npm.cmd run render:v2
npm.cmd run check:v2
python scripts/codex_review_sheet.py --version=v2 --final
node scripts/codex_preserve_v1.mjs --verify
```

手机/微信实际播放及上传转码未实测；吸引力仍需 Yves 的观看反馈。可选后续为按反馈重剪、手机播放验证、成片与可重渲染工程打包。不要在没有指示时自动发布或删除第一版。
