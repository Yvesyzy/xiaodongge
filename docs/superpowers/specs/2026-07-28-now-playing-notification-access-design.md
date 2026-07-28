# 当前播放自动填表设计

## 目标

Android 用户授予通知使用权后，打开“新建记录”页面时自动读取当前正在播放歌曲的标准媒体元数据，并填入标题、歌曲、艺术家和专辑字段。系统不自动保存记录。

## 数据来源

应用声明一个最小 `NotificationListenerService`，供用户在 Android 系统设置中授权。Capacitor 原生插件使用该已授权组件调用 `MediaSessionManager.getActiveSessions(...)`，只接受播放状态为正在播放的会话，并从 `MediaMetadata` 读取：

- `METADATA_KEY_TITLE`
- `METADATA_KEY_ARTIST`
- `METADATA_KEY_ALBUM`

首版不依赖网易云音乐包名，也不解析 `Notification.EXTRA_TITLE` 或 `Notification.EXTRA_TEXT`，避免把播放器自定义通知布局误判为歌曲字段。

## 用户流程

1. 用户首次打开新建页时，应用检查通知使用权。
2. 未授权时显示说明和“打开系统设置”按钮；不自动跳出应用。
3. 已授权时自动读取当前播放歌曲并只填充空字段。
4. 用户从系统设置返回后，可点击“读取当前播放”立即重试。
5. 没有正在播放的媒体或元数据缺少标题时显示明确状态，原有手工输入与截图识别继续可用。

## 组件

- `NowPlayingNotificationService`：仅作为系统通知监听授权组件，不保存通知正文。
- `NowPlayingPlugin`：检查授权、打开系统设置、查询当前活动媒体会话。
- `mobile/src/nowPlaying.ts`：验证原生返回值并转换为现有 `MusicInfoFields`。
- `EntryFormPage`：创建模式首次加载时自动读取；编辑模式不读取，避免覆盖已有记录。

## 安全与边界

- 不上传、不持久化其他应用通知内容。
- 不自动创建草稿或记录。
- 不读取暂停会话。
- 不新增播放器专用字段映射；网易云音乐 `9.5.60` 的实际兼容性通过 APK 实机验证确认。

## 验证

- Node 检查覆盖原生结果校验与字段转换。
- 静态检查固定 Manifest 服务声明、插件注册和 Android 官方元数据键。
- 运行 TypeScript、现有 mobile 检查、mobile 构建、Next.js 构建和 Android debug 构建。
