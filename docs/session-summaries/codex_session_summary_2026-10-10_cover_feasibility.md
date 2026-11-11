# 2026-10-10 当前播放封面自动提取可行性

作者：Codex。Yves 希望沿用手机系统当前播放信息的读取通道，自动提取专辑或歌曲封面。本轮完成源码与官方接口核对，未实施功能、构建 APK 或验证手机。

## 已核实

- 工作区版本为 3.1.4，存在此前鸿蒙/卓易通适配等未提交修改。本轮不覆盖这些修改；读取了现有状态文件及 2026-10-09 卓易通交接。
- `android/app/src/main/java/com/yves/musicarchive/NowPlayingPlugin.java` 的 `getCurrentTrack` 通过启用的通知监听组件取得 Android 媒体会话，目前仅选择正在播放且有标题的会话。`readMusicMetadata` 只读取 `METADATA_KEY_ALBUM_ART_URI`、`METADATA_KEY_ART_URI`、`METADATA_KEY_DISPLAY_ICON_URI` 到 `artworkUri`，没有调用 `getBitmap` 读取封面图片。
- `mobile/src/QuickCapturePage.tsx` 可用 `musicMetadata.artworkUri` 显示预览，保存速记的路径未把该预览转换、写入共用封面存储。
- `mobile/src/App.tsx` 的当前播放读取更新音乐身份和元数据，没有将其自动填入封面状态；已有手动封面通过 `store.setCover` 保存。`mobile/src/store.ts` 已有本地封面存储和更新通知，可供后续实现复用。
- Android 官方文档明确区分封面 Bitmap 和 URI，支持通过 `getBitmap` 读取专辑图、媒体图及显示缩略图；不存在时返回空。系统可能缩小 Bitmap，因此无法保证取得原始高清封面。现有启用的通知监听通道符合 `getActiveSessions` 的公开授权方式。

## 建议方案，尚未实施

在现有“读取当前播放”过程中取得系统提供的封面图片，兼容可访问的封面 URI，并随用户保存记录写入本地封面存储。已有手动封面优先保留；所有异步结果绑定当前作品身份，避免切歌或修改表单后配错图。图片读取需限制体积、解码内存和等待时间，封面不可用时明确反馈并保留记录能力。

首版建议在进入新建/速记或主动读取时补齐封面。后台持续收集切歌封面属于另一个行为范围，本轮没有将它视为已确认需求。

## 验证与边界

本轮验证为静态调用链检查及 Firecrawl 获取 Android 官方文档，没有运行产品测试，没有连接设备。播放器提供可读取的封面才具备提取条件；播放器界面存在图片不代表媒体会话必定包含它。URI 的访问权限、实际分辨率、具体播放器及鸿蒙/卓易通跨环境互通尚未验证。

官方来源（2026-10-10，Asia/Shanghai）：

- [MediaMetadata](https://developer.android.com/reference/android/media/MediaMetadata)：本地证据 `.firecrawl/codex_cover_android_media_metadata_20261010.md`，专辑 Bitmap 与缩小限制在 209–225 行，`getBitmap` 在 826–841 行。
- [MediaSessionManager](https://developer.android.com/reference/android/media/session/MediaSessionManager)：本地证据 `.firecrawl/codex_cover_android_media_permission_20261010.md`，会话及授权说明在 313–329 行。
- 检索与抓取清单：`.firecrawl/codex_cover_sources_20261010.json`。首次权限精确检索没有结果且未产生输出文件，随后放宽检索词定位官方页面；未将无结果算作接口核实成功。

收尾只保留本轮官方资料与交接。新增产物远低于 200,000,000 字节；既有其他聊天的大型构建与受阻清理记录不计入本聊天，也不重试其删除。

下一步：确认首版触发行为后实现并测试 Bitmap、URI、无封面、已有手动封面及切歌竞态；随后验证目标手机/播放器，不能把模拟通过视为鸿蒙真机通过。
