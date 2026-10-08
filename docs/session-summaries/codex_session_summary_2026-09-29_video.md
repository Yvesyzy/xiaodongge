# 2026-09-29｜小懂哥产品宣传片交接

> 2026-10-07接续：保留Yves选定的v6曲风层级版，已修复中段配乐过度衰减；当前两版成片通过连续性、完整解码及60秒播放检查。下文是制作历史，旧包由新版交付替代；当前状态见[音频修复交接](codex_session_summary_2026-10-07_video_audio_fix.md)及[工程说明](../../codex_video/README.md)。

## 用户目标与完成状态

Yves 提供制作约束和导演分镜两份提示词，要求自主完成真实可播放 MP4，强调当前 v3.0.1 UI、私人音乐档案叙事和克制的视觉。已交付双画幅 30 秒成片、原创声音、素材、可重渲染工程及来源/验收文档。

工程：`D:\codex\workspaces\codex\小懂哥\codex_video`。

- 竖版：`codex_video/output/codex_xiaodongge_portrait_1080p.mp4`，1080×1920，7,447,267 字节。
- 横版：`codex_video/output/codex_xiaodongge_landscape_1080p.mp4`，1920×1080，6,542,238 字节。
- 两版均为 30 秒、30fps、900 帧、H.264/yuv420p/BT.709、AAC 48kHz 双声道，faststart。
- 文件哈希、精确检查数据和八项导演自评见 `codex_video/codex_video_review.md`。

## 实现与素材边界

当前移动端 Vite/React 页面运行在独立 Chrome 上下文，只有虚构演示记录和原创几何封面。采集真实速记、乐评、评分/情绪/曲风/多维评分、盲重听、月份和年记；三页 Top 15 直接由应用原有 Canvas 导出器生成。原有正式图标、真实 CSS 色彩与项目已有 OFL 字体用于视频。

Remotion 4.0.529 / React 19.2.7 仅安装于视频目录。原创 NumPy/Python 合成 30 秒声音，无下载歌曲或录音采样。最终 FFmpeg 单独规范颜色、像素格式、音频和容器时长。源码基线：`9ae4e01a037690e59aed1e9ac71091baa0e27acc`。

本任务未修改应用业务源码、根依赖或发布信息；未读取私人数据库。开始前已有 README、文档搬移和状态改动全部保留。没有 Git 提交/推送、tag、Release、正式 APK 变更或外部视频上传。

## 验证证据

- `codex_video/qa/codex_video_checks.json`：最终文件编码/元数据、全片解码、faststart、响度、无持续空帧、每版 22 帧。Chrome 每版完整播放 30 秒，900 帧，0 掉帧。
- 主线程目检两版共 44 个实际 MP4 关键帧；修正首帧空白、导航/片脚遮挡、全范围 YUV、时长及重听文字截断，修复后重渲染复验。
- `codex_video/qa/codex_project_regression/codex_results.json`：verify affected 20/20，包含 32/32 基础单元测试、根/移动端类型检查、移动端构建及功能回归。
- `codex_video/qa/codex_android_regression/codex_android_results.json` 和 junit.log：原生编译、JUnit 8/8。
- 最终根 typecheck 和 git diff --check 通过。生成物忽略规则已核验。
- 实体设备、微信客户端与平台上传转码未验证；没有将技术播放检查说成受众审美验收。

## 接手入口

1. 先读 `codex_video/README.md`、`VIDEO_SOURCE_AUDIT.md`、`codex_video_review.md`。
2. 在视频目录执行 `npm.cmd run studio` 预览；修改 `src/codex_index.tsx` 后 `npm.cmd run render`。
3. `npm.cmd run check` 检查成片，`python scripts/codex_review_sheet.py --final` 重建联系表；从实际 MP4 目检。
4. 重采素材执行 `npm.cmd run capture`，重生成音频执行 `npm.cmd run audio`。素材已落盘，常规重渲染无需重新采集。
5. 建议提交源码、素材和文档；不提交 node_modules、output、qa、.cache。提交及发布仍由 Yves 决定。

本次工作已完成。后续可依据 Yves 的观看反馈调整指定镜头，或整理去除依赖/缓存的工程交付包；不要擅自上传视频或覆盖正式发布信息。

补充：最终独立只读交付复核已完成。主线程关闭依赖安装说明、初始评分来源表述、截图隐藏项说明、封面/图标清单遗漏；现有45个图像素材逐一验证存在。最后只调整文档及元数据，MP4哈希与最终QA报告一致。
