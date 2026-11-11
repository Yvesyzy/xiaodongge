# Android 自动封面清晰度交接

Yves要求按最大能力保留原图清晰度并继续实施。本轮在并行会话已完成的3.4.0公众号出稿与好友圈功能上增量修改；未提交、推送、发布、部署或操作个人手机。Windows原字节版3.2.1的既有交付保留。

## 安装包

原签名3.4.1(39)：`release/codex_android_quality_signed_20261012/codex_xiaodongge-v3.4.1-39-test.apk`，75,761,447字节。

SHA-256：`41bdab470b40ff8ec63054d97f5b08ed6c77fdc645883016c74abdd99b7ae81a`；同目录附`SHA256SUMS.txt`与`build_manifest.json`。包名`com.yves.musicarchive`，签名摘要`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与正式3.2.0基线一致，可覆盖同签名较低版本。

## 行为和边界

- `CodexNowPlayingArtwork.java`比较同一会话的三个Bitmap及三个可访问URI，优先较大有效候选；同尺寸或方向交换时优先原文件字节。取消512像素缩小及JPEG90编码。URI验证后原字节输出；临时采样解码只验证可用性。Bitmap原尺寸PNG，不主动将F16/P3降为ARGB8888；仅回收自己创建的临时对象。
- 输入／输出限4MiB、20MP；Bitmap分配限80,000,000字节。超限或坏图跳过，保留同次调用可用Bitmap回退，不自动缩图。仍只接受content和受限HTTPS，保留隐私同意、通知使用权复查、地址边界与4.5秒等候上限。
- 连续读取测试复现原SynchronousQueue的交接窗口：Future已完成、线程仍收尾时下一次提交被拒绝，第7次快速读取返回空图。改为单线程加一个有界等待位置；超时取消并清理排队任务。96次连续读取及阻塞提供者后续调用通过，没有全局跨作品图片缓存。
- `NowPlayingPlugin.java`在等候图片后复查播放状态和title/artist/album/mediaId，变化时不返回旧图或旧封面URI。前端`codex_playbackCover.ts`接受4MiB／20MP原尺寸图片，保留既有手动封面、身份及异步请求保护；SQLite和JSON v6结构不变，旧封面不自动覆盖。
- 隐私文案和生成HTML已同步；本轮不增加数据处理种类，沿用政策版本`2026-10-10-social-1`。README开发说明更新为3.4.1，公开下载仍指正式3.2.0。

## 验证

- 原签名构建脚本退出0：31/31完整工程检查、30/30 Android JUnit、assembleRelease（含lintVital），25个public与3个平台资源、版本、包名、签名和复制后APK摘要通过。证据在签名交付目录的`checks`、`android-unit`、`assets.json`和构建日志。
- 最终签名APK在本任务新建API36模拟器上执行15/15原生图像测试通过，测试APK也使用同一证书；`release/codex_android_quality_20261012/runtime-signed/codex_android_image_results.json`记录实际APK摘要、签名与各步退出码。另保留`runtime-final`的15/15 Debug执行记录。
- 覆盖1200×600 Bitmap尺寸／ARGB像素／透明度／来源对象、PNG/JPEG/WebP原字节、内容地址候选大小与同尺寸优先、损坏／截断／超限、RGB565／ALPHA8／硬件Bitmap／F16 P3，以及慢FIFO提供者、同次回退和排队超时取消。
- 浏览器真实SQLite链路：960×640 PNG、1,902,968字节，输入、草稿恢复、正式封面与完整备份SHA-256均为`255b2afb934aa2f0e5ec2960c3a909d3291aa6d446653de8a8125ee6d08e2050`；手动优先、无图备份、身份变化和切歌竞态检查通过。已查看快速记录封面截图，布局正常。
- 独立框架探针在API36得到RGBA_F16→16位PNG→RGBA_F16，Display P3保留，最大分量误差0.00048828125；记录`codex_platform_precision.log`。这是该运行时的精度验证，不代表所有OEM、HDR／gainmap均逐位无损。未验证实体手机及各播放器的实际供图尺寸；播放器只提供缩略图时不能恢复未提供的高清源。

复现：先运行`scripts/codex_start_artwork_test_avd.ps1`创建本项目独立AVD，等待启动完成；再运行`scripts/codex_check_artwork_android.ps1 -SignedReleaseApk release/codex_android_quality_signed_20261012/codex_xiaodongge-v3.4.1-39-test.apk -Output <新的release证据目录>`。原签名重建使用`scripts/build-android-release.ps1 -OutputDirectory <新的release交付目录>`；凭据由既有脚本从环境读取，不输出。

## 清理与接续

最终图像验证后已核对AVD名称`codex_artwork_quality_20261012`／serial`emulator-5580`并正常关闭，adb断开且剩余本任务模拟器进程为0，记录`codex_avd_shutdown.json`。个人Pixel_8a只读过硬件配置模板，未使用其磁盘；未停止个人应用、其他预览服务或共享Gradle进程。

清理完成，命令退出0；签名交付目录`codex_cleanup_checks.json`记录21个已核对目标，实际删除557普通文件／10,437,041,080逻辑字节，解除1个测试junction，共享依赖保留，34个保护文件摘要均不变。数字包含稀疏AVD磁盘的逻辑长度，不代表实测物理释放空间。本阶段核实生成量下限10,526,044,871字节，与本聊天前阶段1,909,516,982字节相加，累计下限12,435,561,853字节，历史已删量未扣回。

仅处理本任务独立AVD、已集成worker副本、被新验收替代的临时输出、合成数据库及重复构建资源；一次性清理脚本和已执行的测试APK也已移除。最终APK／SHA、必要源码／构建检查、实际验收JSON／截图／日志及独特失败证据保留，未清理混合来源Android／Gradle缓存。其他会话已被自动审批拒绝的清理目标和`tmp/codex_social_cleanup_20261011.ps1`不属于本轮，未重试。

下一步可在实体手机覆盖安装，分别用网易云、QQ音乐、酷狗检查实际供图；旧低清封面仍按既有优先级保留，需要用户主动换图才能更新。推送或公开发布仍需新的明确授权。
