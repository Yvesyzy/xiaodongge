# VIDEO_SOURCE_AUDIT

更新：2026-10-07。范围为第六版60秒品牌宣传片的中段音频连续性修复。原有50张App 3.1.1截图及2026-10-03补拍的4张真实曲风控件保持不变，本轮仅修改配乐增益并替换AAC。证据来自实际素材基线、冻结的采集报告、音频前后回归及当前成片检查；H.264视频流和时间字段均与原验收版一致。

## 真实界面与来源

采集由`mobile/src/main.tsx`启动手机H5，使用`mobile/vite.config.ts`的本地Vite服务。`public/codex_light/`保留35张PNG，`public/codex_theme_v5/`保留15张主题操作PNG，`public/codex_genre/`新增4张曲风PNG；目录后缀记录素材来源。各目录的`codex_assets.json`记录实际路由及布局，`codex_sizes.json`记录像素尺寸。

| 画面 | 实际采集方式 |
|---|---|
| 阅读与档案卡 | `/entries/`下真实详情与`.codex-reader` |
| 一句话输入与保存 | `/capture`真实速记表单，实际执行保存 |
| 综合评分、情绪、曲风、六项评分 | 真实编辑表单及控件局部，记录DOM位置和尺寸 |
| 曲风大类、电子分支、House细类及选中态 | `/entries/codex-film-album-0/edit`实际点击`GenrePicker`，读取`.genre-tree`与隐藏`genreTags`值 |
| 盲重听及评分对照 | `/relisten/`真实表单提交后读取结果 |
| 月份与年记 | `/summary?year=2026&view=months`及`view=cover` |
| 年度Top15海报 | 采集时的`planJournalPages`及`renderJournalPage`生成三张1080×1680 PNG |
| 全局浅深切换 | `/more`的`.theme-choice`真实按钮，再返回同一份首页 |
| 阅读浅深切换 | `.codex-reader-menu`内`.codex-reader-settings`真实按钮 |

全局开关验证`abu-theme-choice-v1`、`document.documentElement.dataset.theme`和`aria-pressed`；阅读开关验证`codex-reading-preferences-v1`的`dark`、阅读容器类名及纸面／文字颜色。阅读切换期间全局保持浅色。完整entries/appData快照在每次全局切换后核对字节一致；同一份演示数据有16条记录，新增记录由真实速记保存产生。

曲风层级来自`shared/genres.ts`的`GENRE_TREE`，交互来自`mobile/src/App.tsx`的`GenrePicker`。实际有16个大类，画面取前8个；展开电子后取House、Techno、Trance、Drum and Bass、Dubstep；House实际17个细类，画面取前6个。实际点击「电子 → House → Deep House」，最终`genreTags`为`电子, House, Deep House`。三次点击坐标由对应DOM边界测得；编辑期间存储中的原始15条演示记录字节不变，未执行保存。证据为`scripts/codex_capture_genre.mjs`及`qa/v6/codex_capture_genre.json`。

采集视口390×844、像素密度3。完整截图保留实际导航；DOM局部截图只在拍摄时隐藏会遮挡控件的固定导航或工具条，未重绘控件。影片点击反馈、特写和圆形转场使用实际坐标及对应截图。原始浅色、主题采集断言分别保留在`qa/v6/codex_capture_light.json`和`codex_capture_theme.json`；它们是旧快照证据的副本。新增曲风采集使用独立Vite、隔离浏览器及原演示数据，阻断外部请求，页面错误为空，服务已关闭。

浅色实测`--paper-soft=#f3f6f0`、`--paper=#fffdf8`、`--ink=#161712`；全局深色为`#0b0f0d`、`#222924`、`#e9e7de`；阅读深色独立纸面为`#17211e`，正文`#e9e9dd`。字幕与片脚分别适配浅深背景。电影段落的背景检查不能替代真实UI状态断言。

## 演示数据与资源

演示时钟固定2026-09-29 12:00（Asia/Shanghai）。`public/codex_light/codex_demo_data.json`标记作品、音乐人、正文和榜单为虚构数据。15张几何封面由`codex_capture_light.mjs`程序生成，再通过真实`store.setCover`写入隔离存储；App实际计算223天间隔，盲重听提交后显示8→9.5。Top15是个人选编。

图标来自`android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`，字幕字体来自既有`mobile/src/assets/fonts/codex_noto_sans_sc.woff2`。字体及`codex_font_licenses.txt`保留在`public/codex_light/`。没有下载第三方照片、唱片封面或商业歌曲。原50张PNG、字体、授权及清单合计57个文件的SHA-256基线在`qa/v6/codex_source_baseline.json`；新增曲风4张PNG和2份清单的基线在`codex_genre_source_baseline.json`。

## 原创声音与同步

`scripts/codex_synthesize_v6.py`使用已安装NumPy和FFmpeg，通过共享`scripts/codex_synthesize.py`处理PCM及响度。钢琴、低音、鼓组、弦乐、旋律、残响、节拍延迟和转场音效全部程序生成，没有第三方录音样本。音乐为新的60秒编排，未拉伸或拼接旧音轨。

100 BPM、4/4拍，30fps下一拍18帧。`public/codex_timing_v6.json`包含1800帧时间线及38个同步事件，声音与画面共用命名节拍。曲风段19.2–24秒，每个状态1.2秒，20.4／21.6／22.8秒增加三级操作重音。全局切换移至26.4／28.2秒，阅读保持30／31.8秒。33.6–39.6秒降低伴奏，39.6秒揭晓时恢复，42–56.4秒推进年度高潮，56.4–60秒淡出。

WAV精确60秒／2,880,000采样帧，48kHz／16-bit双声道；实测−18.00 LUFS、−6.28 dBTP，无削波、首尾归零。两次合成及母带字节一致，单声道相对损失−0.31dB，38个事件按原采样位置核对。证据为`qa/v6/audio/codex_original_score_v6.qa.json`与`qa/v6/codex_audio_acceptance.json`。原编排经隔离worker制作和主线程审查，2026-10-03增加曲风事件；本轮主线程减轻盲重听重复衰减并补足钢琴尾音，回听平均相对前段由−32.86dB变为−8.19dB。WAV、MP3和两支实际AAC均通过中段连续性与半秒RMS检查，前后诊断见`codex_audio_gap_before.json`、`codex_audio_gap_after.json`。

## 成片验证与清理

曲风修订时横竖各80张关键帧及16张联系表已检查，结果在`qa/v6/codex_visual_keyframe_acceptance.json`；12张成片联系表已接受，记录在`codex_visual_final_acceptance.json`。本轮无损复制已接受画面，视频流SHA与时间字段一致，证明在`codex_audio_remux_checks.json`。当前实际MP4重新检查编码、完整解码、响度、黑帧、各58张抽帧背景及Chrome全长播放，结果在`codex_video_checks.json`及`codex_theme_final_checks.json`。两版均60秒／1800帧，播放零掉帧，AAC均为−18.02 LUFS、−6.32dBTP，中段连续性通过。

2026-10-03按Yves授权替换修订前v6成片，删除两支中间MP4与`.cache`共138文件／91,621,456字节，证据为`qa/v6/codex_genre_cleanup_plan.json`与`codex_genre_cleanup_result.json`，属于历史记录。本轮音频替换后再次核对57个原始素材及6个曲风文件不变；删除294个已验收的重复抽帧、日志、播放快照、替换副本及一次性脚本，共47,962,192字节，82个保护哈希一致。保留28张独特联系表与JSON验收，原始抽帧可用现有脚本重新生成。证据为`codex_audio_cleanup_plan.json`与`codex_audio_cleanup_result.json`；最终包与其暂存／旧包清理见打包后的`codex_package_checks.json`。

前五版已在此前清理。原v6制作时删除342文件／159,163,934字节的`codex_cleanup_plan.json`与`codex_cleanup_result.json`保留为历史证据；不作为本次曲风修订的保护哈希报告。真实共享素材、依赖和历史会话交接继续保留。

本任务不修改App业务源码、APK或Release，不读取私人数据库。静音Chrome播放、信号检查与画面目检不代表主观试听、实体手机或平台转码实测。
