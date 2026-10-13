# 小懂哥好友圈服务端

这是随v3.4.1源码提供的独立好友圈测试服务。先在项目根目录运行 `npm.cmd run social:preview`，打开 `http://127.0.0.1:5173/#/social`，填写服务地址 `http://127.0.0.1:8787`。使用两个独立浏览器或无痕窗口注册账号，按“邀请码 → 申请 → 接受”建立好友后即可互相发动态、点赞评论。[完整测试说明](../docs/codex_social_test_guide_20261010.md)。

服务尚未部署公网。手机必须填写部署后的 HTTPS 根地址，手机上的 localhost 不是电脑。本机私人档案、旧 Prisma 库、草稿与备份不由这个服务读取或同步。

`codex_server.mjs` is a separate Node 24 service for private accounts, invite-confirmed friendships, private posts, likes, and comments. It uses only Node's built-in HTTP, crypto, and SQLite APIs. It does not read or modify the existing music archive or Prisma database.

The default listener is loopback only. The service reflects an exact configured `Origin`; it never enables wildcard CORS. Bearer sessions are random 32-byte base64url tokens, stored server-side only as SHA-256 digests, and expire after 30 days. Passwords use asynchronous scrypt. Invite codes expire after seven days and are consumed transactionally once.

## Local run

From the project root:

```powershell
node --test social/codex_server.test.mjs
node social/codex_server.mjs
```

The CLI defaults to `127.0.0.1:8787` and `social/data/social.sqlite`. The test creates only synthetic users and content in a temporary database below the test directory and removes it after the run.

The module API used by integration tests is:

```js
import { createSocialServer } from './social/codex_server.mjs';

const { server, close } = createSocialServer({
  dbPath: 'social/data/social.sqlite',
  allowedOrigins: ['http://127.0.0.1:5173'],
});
server.listen(8787, '127.0.0.1');
// await close() during shutdown
```

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `CODEX_SOCIAL_HOST` | `127.0.0.1` | Bind address. Keep loopback for local use. |
| `CODEX_SOCIAL_PORT` | `8787` | TCP port from 1 through 65535. |
| `CODEX_SOCIAL_DB` | `social/data/social.sqlite` | Independent persistent SQLite file. |
| `CODEX_SOCIAL_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173,https://localhost` | Comma-separated exact origins. Wildcard `*`, paths, query strings, credentials, and other URL forms are rejected. |

Example:

```powershell
$env:CODEX_SOCIAL_HOST = '127.0.0.1'
$env:CODEX_SOCIAL_PORT = '8787'
$env:CODEX_SOCIAL_DB = 'social\data\social.sqlite'
$env:CODEX_SOCIAL_ORIGINS = 'https://localhost,https://music.example.com'
node social\codex_server.mjs
```

The JSON request limit is 512 KiB. Dynamic text is limited to 20,000 JavaScript string length units and comments to 2,000, matching the client validators. A review snapshot has the exact contract fields from the specification; its title and music-name fields are limited to 300 string length units, and `listenedAt` is a parsed date string of at most 40 units. Inline covers must be JPEG or PNG data URLs, have valid magic bytes and readable dimensions, be no larger than 256 KiB after base64 decoding, no wider or taller than 8192 pixels, and no larger than 40 million pixels. The service never fetches a remote cover URL.

## HTTPS reverse proxy deployment

Run the Node process on a private loopback address and terminate TLS at a maintained reverse proxy such as Nginx or Caddy. Set `CODEX_SOCIAL_ORIGINS` to `https://localhost` for the packaged Android WebView, plus the exact HTTPS origin of an H5 client when one is hosted. Do not publish the Node port directly, do not use `Access-Control-Allow-Origin: *`, and do not pass `X-Forwarded-For` as an authentication signal; the service rate-limits the actual TCP peer address.

### 部署步骤（尚未在公网执行）

1. 准备持续运行的服务器、持久磁盘和指向该服务器的域名，安装 Node 24.13.0 或经本项目测试的兼容 Node 24 版本。复制 `social/codex_server.mjs` 及必要部署文件；无需部署旧 Next.js/Prisma，也无需复制个人档案、签名密钥或手机备份。
2. 设置上表环境变量：Node 保持监听 `127.0.0.1:8787`；数据库放持久目录；Android 至少允许 `https://localhost`。H5 的 origin 是网页所在地址，API 域名本身不一定是 H5 origin。
3. 使用系统进程管理器以非管理员账号运行 `node social/codex_server.mjs`，限制数据库文件访问。配置重启策略，确认 `GET /health` 返回 `{"status":"ok"}`。
4. 安装 Caddy，将同目录 `codex_Caddyfile` 中的 `social.example.com` 改为实际域名，按官方方式运行反向代理。域名指向正确、证书签发条件及 HTTP/HTTPS 端口满足后，Caddy 可负责 HTTPS。仅向公网开放代理入口，不开放 Node 8787 端口。[Caddy 官方反向代理说明](https://caddyserver.com/docs/quick-starts/reverse-proxy)。示例配置未在本机安装 Caddy 或执行证书签发。
5. 从外部网络核对 HTTPS `/health`、证书、Origin 预检和访问控制，再在两台手机填写同一 HTTPS 根地址测试注册、邀请、发布、评论和退出重开。使用前公布实际运营者、服务位置及数据保留方式，不能把这个本机测试结果当作部署验收。

首版是单进程、小范围好友测试服务，认证30次/15分钟、写入180次/分钟均按实际TCP对端限流。反向代理后的用户通常共享代理IP和这些额度；扩大用户量前，应按实际代理信任边界调整并验证限流，不直接信任任意客户端发送的转发头。没有密码找回、公开广场或后台消息推送。

The SQLite parent directory must be on persistent storage. Keep the database and its permissions outside the web root, protect it with an OS service account, and preserve the database file together with any `-wal` and `-shm` files while the service is stopped. A simple stop-copy-start backup is:

```powershell
# stop the service first
New-Item -ItemType Directory -Force -Path 'social\backups' | Out-Null
Copy-Item -LiteralPath 'social\data\social.sqlite' -Destination 'social\backups\social-2026-10-10.sqlite'
# start the service again
```

Restore is the reverse operation: stop the service, replace the configured SQLite file with a known-good backup, remove stale sidecar files only after checking their names and location, open the restored database while the service is still stopped, and revoke all sessions with `DELETE FROM sessions;`. Only then start the service and run the health check; otherwise a backup can resurrect sessions that were revoked after the backup was taken. Keep encrypted, access-controlled backup copies and test a restore before relying on them.

To revoke every active session after suspected credential exposure, stop the service, open only this social database with an approved SQLite administration tool, and run `DELETE FROM sessions;`, then restart the service. This affects only social sessions in this independent database. To revoke one session, use `POST /v1/auth/logout` with that session's bearer token.

## Verification and scope

The integration test covers the three-user invitation and friendship flow, wrong-recipient acceptance, stranger and former-friend authorization, inline cover validation, post/comment idempotency, keyset pagination, account deletion, session revocation, size and field checks, expired and used invites, and CORS.

This local delivery does not verify a cloud host, public DNS, production TLS configuration, operational monitoring, backups on a real host, or public internet abuse resistance. Android Keystore persistence and cross-device HTTPS behavior still require the phone-side integration and a real device. The existing system image/text share path remains in place; receipt by a particular WeChat version or its friends-circle target has not been verified, and this service does not add a WeChat SDK or synchronization.

技术依据：按实际 Node 24.13.0 的 [SQLite 文档](https://nodejs.org/download/release/v24.13.0/docs/api/sqlite.html)使用 `DatabaseSync`；该版本接口仍属实验性。现有 Android 分享使用标准 `ACTION_SEND`/系统选择器，未接入需要平台配置的 [微信 OpenSDK](https://developers.weixin.qq.com/doc/oplatform/Mobile_App/Share_and_Favorites/OpenSDK_Signature.html)。官方资料检索与抓取记录保存在本项目 `.firecrawl/codex_social_*_20261010.*`，不提交 Git。
