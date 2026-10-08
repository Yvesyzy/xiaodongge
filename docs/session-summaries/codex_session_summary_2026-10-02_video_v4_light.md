# 小懂哥浅色宣传片第四版交接

> 2026-10-07接续：保留Yves选定的v6曲风层级版，已修复中段配乐过度衰减；当前两版成片通过连续性、完整解码及60秒播放检查。下文是制作历史，旧包由新版交付替代；当前状态见[音频修复交接](codex_session_summary_2026-10-07_video_audio_fix.md)及[工程说明](../../codex_video/README.md)。

日期：2026-10-02。执行者：Codex。项目：`D:\codex\workspaces\codex\小懂哥`。

## Yves 的要求与当前状态

此前要求继续制作宣传片，并提升配乐质感、增加卡点；第三版已完成原创 100 BPM 分层配乐。本轮 Yves 要求「现在我希望用浅色版的去做一版视频」。第四版横竖成片已完成并通过本机验收，沿用第三版音乐与时点，重新采集当前 v3.1.1 浅色界面。等待 Yves 观看反馈；无需继续未完成的渲染或编码。

## 成片位置

视频工程：`D:\codex\workspaces\codex\小懂哥\codex_video`。

| 文件（相对视频工程） | 规格 | 字节数 | SHA-256 |
|---|---|---:|---|
| `output/codex_xiaodongge_portrait_v4_1080p.mp4` | 1080×1920，30 秒，30fps，900 帧 | 7,941,497 | `b5ce5ec3f95c6d4a44e794bfc3fd98524bacf6c876091f4a31e75f1e990e8f07` |
| `output/codex_xiaodongge_landscape_v4_1080p.mp4` | 1920×1080，30 秒，30fps，900 帧 | 6,877,724 | `8fc180169821adf0dc3b459179826d5942861548bdecf6be5cef336dc5c35c14` |

实际播放使用上述 `xiaodongge` / `1080p` 文件；`codex_*_v4_render.mp4` 为中间文件。独立音乐试听仍使用 `output/codex_original_score_v3.mp3`。

## 已完成

- 隔离浏览器真实采集全局浅色与独立浅色阅读页；实际 App 版本 3.1.1，45 项图片素材，无页面错误。使用虚构演示数据与本地原创几何封面，固定演示日期 2026-09-29，间隔由实际 App 算出 223 天。
- 独立 `scripts/codex_capture_light.mjs`、`src/codex_index_v4.tsx`、`public/codex_light/`、`qa/v4/`，纸白/浅绿背景、深绿数字、深色文字与琥珀棕小字。六项评分为制作、词、曲、人声、原创性、共鸣。
- 真实 DOM 测量封面、保存按钮、阅读起点、六项评分行高、盲重听展开区域、月份。目检后修正横屏速记封面上缘和保存结果顶部文字裁切。
- 保留第三版母带和时间表：100 BPM、一拍 18 帧、17 个同步音效、九段画面；保存 6 秒、揭晓 16.8 秒、Top 15 24 秒、海报 24.6 秒、品牌 27.6 秒。WAV SHA-256 `51afdd5778089519b1f24143b5161ae31f512dce3d072e40f7d0f56e6b1efac0` 未变。
- 实际年度 Top 15 导出器固定为深绿模板，保持原始应用导出结果；外围视频、年度页面和封面素材为浅色。
- 共享 render/check/review_sheet/contact 脚本只增加 v4 或 light 分支，package 增加 capture:light、studio:v4、stills:v4、render:v4、check:v4。未增加依赖。
- 更新视频 README、`codex_v4_plan.md`、`codex_video_review_v4.md` 和自己的 `codex_status.txt`。

## 验证结果

最终 `qa/v4/codex_video_checks.json` 为 `passed:true`。两支 H.264 High Level 4.1 / yuv420p / limited range / BT.709 三项标记 / AAC 48k 双声道 / faststart，完整解码无错误，无持续黑帧。实际 AAC 均 −18.02 LUFS、−7.41 dBTP、LRA 4.30。

根类型检查、JS 和 Python 语法检查通过；最终 72 张关键帧、44 张真实成片抽帧及其联系表已复核。浅色背景像素检查通过，实际 UI/阅读主题和六项评分另外由采集断言核对。Chrome 静音全长播放两支均 30 秒正常结束、114 次时间更新、900 展示帧、0 掉帧。母带哈希、17 音效时点、九段连续覆盖通过。

`qa/v4/codex_previous_versions_baseline.json` 记录的第一至第三版 580 个旧文件哈希全部未变。旧版入口、public 素材、配乐、成片和 QA 完整保留。未运行会覆盖旧 QA 的旧版重渲染或检查命令。

## 下一次接手

已有素材可直接重渲染，不必重新采集：

```powershell
Set-Location -LiteralPath 'D:\codex\workspaces\codex\小懂哥\codex_video'
npm.cmd run studio:v4
npm.cmd run stills:v4
python scripts/codex_review_sheet.py --version=v4
npm.cmd run render:v4
npm.cmd run check:v4
```

需要重拍当前 App 时用 `npm.cmd run capture:light`；该命令只替换独立浅色素材和 v4 采集证据。继续改本版时，先读本交接与 `codex_video_review_v4.md`，按 Yves 明确反馈的时间点调整，再验收新的成片。手机和微信等平台转码尚未实测，可作为下一步。

本轮仅修改视频工程和自己的交接，保留其他会话的 App 改动。没有改 App 业务代码/正式 APK/Release、私人数据、其他助手状态或根依赖，未提交/推送/上传/发布/删除。当前工程和本交接仍为本地文件，未自动 Git 提交。

本机沙箱辅助程序报 `helper_sandbox_lock_failed` / `SetNamedSecurityInfoW ... failed:5`，本地执行使用自动审批的 `require_escalated` 完成；没有自动审批拒绝，也没有访问外部网络或申请用户额外批准。
