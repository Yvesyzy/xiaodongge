# 小懂哥一分钟宣传片定稿交付

当前保留版本：v6曲风层级版，2026-10-07修复中段音乐过度衰减。两支视频均60秒、30fps、1080p；画面与38个卡点沿用已选定版本，回听段保留连续可听的柔和钢琴。

直接播放：

- 竖版：`codex_video/output/codex_xiaodongge_portrait_v6_1080p.mp4`
- 横版：`codex_video/output/codex_xiaodongge_landscape_v6_1080p.mp4`
- 原创配乐：`codex_video/output/codex_original_score_v6.mp3`
- 成片SHA-256：`codex_video/output/codex_xiaodongge_v6_sha256.txt`

工程包含影片入口、本地素材／字体／授权、时间表、修复后的WAV母带、合成和渲染脚本、依赖清单与锁文件、JSON验收及音频修复交接。所有文件的大小与SHA-256见包内`codex_package_manifest.json`，清单自身不参与摘要；ZIP摘要保存在压缩包旁的`.sha256.txt`。

## 继续修改与导出

在Windows上准备Node.js、Chrome、FFmpeg及ffprobe。在解压后的`codex_video`文件夹打开PowerShell：

```powershell
npm.cmd ci
npm.cmd run studio
npm.cmd run render
```

截图、字体、时间表及WAV已完整携带，重新导出不必采集App或重新合成音乐。修改音乐需要Python及NumPy；生成联系表需要Pillow，入口为`npm.cmd run audio`及`python -B scripts/codex_review_sheet.py`。

完整成片检查需要Python、NumPy、Pillow和Playwright，原工程使用Playwright 1.62.0。解压环境未安装时，可在`npm.cmd ci`之后执行：

```powershell
npm.cmd install --no-save --package-lock=false playwright@1.62.0
npm.cmd run check
```

`check`核对成片编码、完整解码、60秒播放、画面背景以及WAV／MP3／实际AAC的音乐连续性。28张联系表和验收报告保留在原工作区，ZIP携带JSON结论；单张测试抽帧已清理，可通过`stills`或`check`重新生成。包内报告与交接在打包前冻结，打包后ZIP校验及暂存／旧包清理结果保留在原工作区，不递归打入本包。

`capture`脚本仅用于更新真实App截图，需要完整小懂哥App源码及其Vite／Playwright依赖。此包携带完整视频工程；重新拍摄时将`codex_video`放回完整App项目。`public/codex_theme_v5`是当前影片正在使用的真实浅深切换素材，须保留。

文档及验收报告记录原工作区位置，运行以实际解压目录为准。修复后的两版本机完整解码和Chrome60秒播放均通过、1800帧零掉帧；音频信号检查通过。实体手机或平台转码试听尚未进行。
