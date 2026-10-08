# 小懂哥宣传片第三版：音乐与卡点交接

> 2026-10-07接续：保留Yves选定的v6曲风层级版，已修复中段配乐过度衰减；当前两版成片通过连续性、完整解码及60秒播放检查。下文是制作历史，旧包由新版交付替代；当前状态见[音频修复交接](codex_session_summary_2026-10-07_video_audio_fix.md)及[工程说明](../../codex_video/README.md)。

日期：2026-10-02。项目：`D:\codex\workspaces\codex\小懂哥`。作者：Codex。

## 用户要求与当前状态

Yves 在第二版成片后要求“配上听起来更高级更昂贵的音乐，加上一些卡点”。已重新创作配乐、调整关键镜头时点并实际输出第三版横竖 MP4；音频、成片与旧版保留检查全部通过，最终画面抽帧已目检。独立 MP3 已提供试听；当前等待 Yves 观看和评价风格，无需自行继续重渲染。

## 完成内容

1. 100 BPM、4/4 拍，一拍精确 18 帧。钢琴旋律／九和弦、低音、底鼓／军鼓／镲／沙锤、弦乐合成音色、立体声残响和节拍延迟分层编排，过渡音效按音乐落点触发。
2. 共用 `codex_video/public/codex_timing_v3.json` 的整数帧时间表：保存 6 秒，评分揭晓 16.8 秒，月份 19.2 秒，Top 15 24 秒，海报聚合 24.6 秒，品牌 27.6 秒。14.4–16.8 秒收低全部伴奏，30 秒首尾归零。
3. 新增独立 `src/codex_index_v3.tsx`、`scripts/codex_synthesize_v3.py` 和音轨。共享渲染／检查／联系表脚本及 package 命令新增 v3 支持，v1/v2 默认行为保留。
4. 补齐 `codex_video/README.md`、`codex_video/codex_v3_plan.md`、`codex_video/codex_video_review_v3.md`、音频／成片／哈希／联系表证据。

## 交付文件

- 竖版：`codex_video/output/codex_xiaodongge_portrait_v3_1080p.mp4`，1080×1920，8,123,633 字节，SHA-256 `914cf4514494046623ac6a820b49dbb5e369d16479746f7b59409d941b190a63`。
- 横版：`codex_video/output/codex_xiaodongge_landscape_v3_1080p.mp4`，1920×1080，7,060,040 字节，SHA-256 `98b40b8f5ae8fc1e10f09bd67ddd40da42c9ea0a90a980844d161f959887caab`。
- 校验文件：`codex_video/output/codex_xiaodongge_v3_sha256.txt`。
- 配乐试听：`codex_video/output/codex_original_score_v3.mp3`，256kbps，961,581 字节。
- 原始 WAV：`codex_video/public/codex_original_score_v3.wav`，5,760,044 字节，SHA-256 `51afdd5778089519b1f24143b5161ae31f512dce3d072e40f7d0f56e6b1efac0`。

## 验证结果

- 两版均 30.000 秒／30fps／900 帧，H.264 High／Level 4.1、yuv420p、limited range、完整 BT.709、AAC 48kHz 双声道、faststart。
- 实际 AAC 均 −18.02 LUFS、真峰值 −7.41 dBTP，LRA 4.30。WAV −18.00 LUFS；首尾归零，无削波；重听停顿相对 RMS −33.58 dB，单声道折叠损失 −0.36 dB；重复合成逐字节一致。
- 根 `npm.cmd run typecheck`、JS 语法检查、合成脚本内置验证通过。17 个音效事件在整数帧上触发，九段画面连续覆盖全部 900 帧，已验收主音轨哈希与成片使用文件一致。
- 完整解码及无持续黑帧检查通过，Chrome 两版均完整播放到 30 秒，900 帧／0 掉帧／114 次 timeupdate。
- 60 张关键帧、六张联系表和最终 44 张抽帧、四张联系表已目检，保存按钮／评分／重听内容／年记事实与海报正文保持完整。
- 第一版 269 个文件及第二版 173 个文件的 SHA-256 保留检查通过。`qa/v3/codex_v2_baseline.json` 为第二版起始基线；不要运行会覆盖旧 QA 的 v2 检查后再声称基线不变。
- 最终报告：`codex_video/qa/v3/codex_video_checks.json`；音轨报告：`codex_video/qa/v3/audio/codex_original_score_v3.qa.json`。

## 范围与边界

UI 素材沿用 v3.0.1 拍摄快照与虚构演示数据。当前 App 的 v3.1.1、六项评分、阅读字数／间距等其他会话修改继续保留；本轮没有重新采集或将旧镜头写成当前界面，没有修改 App 业务代码、APK、根依赖、私人数据库或其他助手状态。音乐全部本地原创程序合成，无第三方采样或商业录音；没有新增依赖、消费生成服务积分、上传、发布、提交、推送或删除旧版本。

本机沙箱辅助程序仍无法正常启动：`helper_sandbox_lock_failed`／`SetNamedSecurityInfoW ... failed: 5`。本轮本地命令通过审查后的 `require_escalated` 执行，操作范围为已授权项目内视频文件与自己的交接。

## 复现与后续

在 `D:\codex\workspaces\codex\小懂哥\codex_video` 中：

```powershell
npm.cmd run studio:v3
npm.cmd run audio:v3
npm.cmd run render:v3
npm.cmd run check:v3
python scripts/codex_review_sheet.py --version=v3 --final
node scripts/codex_preserve_v1.mjs --verify
```

手机外放／耳机、微信或视频平台转码未实测，音乐质感待 Yves 实际试听反馈。若要改音乐力度或具体镜头，只改独立 v3 音轨／入口，并使用已有命令验证；若更新为当前 v3.1.1 镜头，应另行隔离采集真实新界面。不要在未获得指示时发布、删除旧版或重写其他会话的状态。
