# 小懂哥好友圈首版设计

Yves 于 2026-10-10 选择：账号、邀请加好友、乐评动态、点赞评论，并保留微信等平台的现有分享。本文件定义新功能的实现契约；部署平台尚待 Yves 提供，不把本机联调当作公网可用。

## 已核实的项目现状

- Android / H5 使用 `mobile/src/App.tsx`、HashRouter、Capacitor 与本地存储；`store.listEntries()`、`store.getEntry(id)`、`store.getEntryCover(entry)` 可读本地档案。
- `mobile/src/codex_ReviewShare.tsx` 经 `nativeExport.ts` 和 Android `NativeExportPlugin.java` 打开系统图片分享。此入口保留；不依赖微信 AppID，不承诺接收平台一定显示朋友圈目标。
- Next.js / Prisma 是独立的旧本机网页端，接口没有多用户授权。不能把它直接部署为社交服务。
- Android 隐私拒绝仍可本地记录；网络必须遵循 `codex_privacy.ts`，撤回应取消在途网络操作。
- Node 本机为 24.13.0，PowerShell 为 7.6.5。当前有其他会话未提交改动，不能覆盖或纳入本次修改。

## 范围与数据边界

新增懒加载“好友圈”页面，含登录/注册、动态、朋友、账号。用户可以独立发文字，或从已有乐评复制内容到发布预览。只有按下发布的文字和预览中选中的音乐摘要上传；不上传数据库、草稿、备份、系统媒体身份、天气、标签或情绪。评分、日期和本地封面均可选择不分享。发布的是独立快照，后续修改/删除本地原文不会暗中修改已发布动态。

好友必须通过邀请与接收方确认建立双向关系。所有动态仅作者及当前好友可见；列表、详情、评论、点赞及封面均复查授权。解除好友后立即失去相关访问权限。首版不做公开广场、通讯录抓取、微信好友同步、私聊、后台推送和微信 SDK。

Android 登录凭据使用 Android Keystore 加密存储；浏览器仅内存登录，刷新后需要重新登录。不保存密码。不把 token 放进 localStorage、JSON 备份、日志或 URL。Android 只连接 HTTPS；H5 测试可连接明确的 HTTP loopback 地址。服务端地址是显式配置，换服务端先退出旧账号，不把旧 token 发给新地址。

## 独立服务端

`social/codex_server.mjs` 是单独的 Node 24 服务，使用内置 HTTP、crypto、SQLite；数据库独立于 Prisma 与手机数据库。默认仅监听 `127.0.0.1:8787`。部署通过 HTTPS 反向代理与持久磁盘；不自动部署、付款或创建云账号。

新增环境变量：`CODEX_SOCIAL_HOST`、`CODEX_SOCIAL_PORT`、`CODEX_SOCIAL_DB`、`CODEX_SOCIAL_ORIGINS`。默认允许本机 H5 的 `http://127.0.0.1:5173`、`http://localhost:5173` 和 Android `https://localhost`。公网不允许通配 CORS，Origin 和 Bearer token 分别检查。服务端用异步 scrypt 保存密码摘要，随机 token 仅存 SHA-256 摘要，固定期限 session，可退出/注销。请求体、字段、分页、认证尝试与写操作有边界；所有 SQL 使用参数绑定。

### API 新契约

这些是本次新增的标识符。所有成功 JSON 对象如下，错误为 `{ error: string }` 并使用相应 HTTP 状态。认证后的 API 使用 `Authorization: Bearer <token>`。`User = { id, username, displayName }`，时间为 ISO 8601 字符串，`clientId` 为 UUID。

| 方法与路径 | 请求 | 返回 |
| --- | --- | --- |
| GET `/health` | 无 | `{ status: "ok" }` |
| POST `/v1/auth/register` | `{ username, displayName, password }` | `{ token, expiresAt, user: User }` |
| POST `/v1/auth/login` | `{ username, password }` | 同注册 |
| POST `/v1/auth/logout` | `{}` | `{ ok: true }` |
| GET `/v1/me` | 无 | `{ user: User }` |
| DELETE `/v1/me` | `{ password }` | `{ ok: true }`，只删除社交账号和关联数据 |
| POST `/v1/invites` | `{}` | `{ code, expiresAt }`，随机、限期、一次性邀请码 |
| GET `/v1/friends` | 无 | `{ friends: User[], incoming: FriendRequest[], outgoing: FriendRequest[] }` |
| POST `/v1/friend-requests` | `{ inviteCode }` | `{ ok: true }` |
| POST `/v1/friend-requests/:id/accept` | `{}` | `{ ok: true }` |
| DELETE `/v1/friend-requests/:id` | 无 | `{ ok: true }`，收件人拒绝或发件人取消 |
| DELETE `/v1/friends/:id` | 无 | `{ ok: true }` |
| GET `/v1/feed?cursor=...` | 无 | `{ posts: Post[], nextCursor: string \| null }` |
| POST `/v1/posts` | `{ clientId, text, review: ReviewSnapshot \| null }` | `{ post: Post }`，同用户/clientId 幂等 |
| GET `/v1/posts/:id` | 无 | `{ post: Post }` |
| DELETE `/v1/posts/:id` | 无 | `{ ok: true }`，仅作者 |
| PUT / DELETE `/v1/posts/:id/like` | 无或 `{}` | `{ ok: true }`，幂等 |
| GET `/v1/posts/:id/comments?cursor=...` | 无 | `{ comments: Comment[], nextCursor: string \| null }` |
| POST `/v1/posts/:id/comments` | `{ clientId, text }` | `{ comment: Comment }`，同用户/clientId 幂等 |
| DELETE `/v1/comments/:id` | 无 | `{ ok: true }`，评论作者或动态作者 |

`FriendRequest = { id, from: User, to: User, createdAt }`。

`ReviewSnapshot = { type: "album" | "song" | "month" | "year", title: string, albumName: string | null, songName: string | null, artistName: string | null, rating: number | null, listenedAt: string | null, coverDataUrl: string | null }`。封面只能是受限体积的本地 JPEG/PNG data URL，不接受远程地址，服务端不抓取外部图片。

`Post = { id, author: User, text, review: ReviewSnapshot | null, createdAt, likeCount: number, likedByMe: boolean, commentCount: number }`。

`Comment = { id, postId, author: User, text, createdAt }`。

用户名为小写 ASCII 字母数字下划线，3–32 字符；昵称1–40字符；密码12–128字符；动态1–20000字符；评论1–2000字符。封面解码后至多256 KiB，JSON体至多512 KiB。动态及评论每页20项，以服务端游标分页。

## Android 安全存储新契约

注册插件 `CodexSocialSession`。`readSession(): Promise<{ session: { endpoint: string, token: string, expiresAt: string } | null }>`；`writeSession({ endpoint, token, expiresAt }): Promise<{ ok: true }>`；`clearSession(): Promise<{ ok: true }>`。Keystore 密钥加密 app-private、禁止备份的持久数据。格式不合法、解密失败或落盘失败返回明确失败，不误报成功；读取损坏时告知需要重新登录。退出先清除本机凭据，再尝试撤销远端 token；两者状态准确报告。

## 验收

1. 服务端集成测试：两个账号邀请/申请/确认，第三账号无法读取/评论/点赞私人动态；解除关系立即撤销权限；退出 token 无效；删除账号不影响其他账号内容；SQL/体积/分页/幂等/CORS/错误字段验证。
2. 手机端类型检查、生产构建与现有相关隐私/分享回归通过。Playwright 用隔离浏览器上下文和合成数据跑注册→加好友→发布→点赞评论→解除好友，不读取个人档案。
3. Android 插件编译和现有单测；无目标手机或公网部署时，Keystore 真机持久化、跨公网双设备及微信接收的实测范围明确标注。
4. 交付可运行源码、部署说明、必要证据和交接；不凭本机通过宣称已经公网可用，不自动发布 APK/推送代码/部署云平台。
