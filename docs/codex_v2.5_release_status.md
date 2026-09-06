# v2.5 构建交接

日期：2026-09-06。Yves 要求构建安装包、升级 v2.5 并同步 Git / GitHub。

## 最新状态：新签名安装包已验证

Yves 在恢复检查之后明确回复“按新签名做”。已生成新长期密钥并签署此前通过验证的 v2.5 未签名构建，APK Signature Scheme v2/v3、包名与版本检查全部通过。GitHub v2.5 已于 2026-09-06 正式公开发布（非草稿、非预发布），远端 APK 的大小与 SHA-256 已逐项核对一致。发布页：https://github.com/Yvesyzy/xiaodongge/releases/tag/v2.5 。发布标签指向 a2d7a52；安装步骤见 `docs/releases/v2.5.md`。以下“未签名产物”和“原签名恢复历史”保留为过程证据，不再表示当前阻塞。

- 安装包：`release/xiaodongge-v2.5.apk`，67,982,592 字节。
- APK SHA-256：`19955f8b1611fb98a514e89f47f2e6f8e88b533a66177e2702434380120a9030`。
- 新证书：`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`。
- 主密钥目录：`D:\codex\keys\xiaodongge`；备用：`C:\Users\lenovo\.xiaodongge-signing-backup`。
- 两处密钥、密码恢复文件、证书和恢复脚本逐文件哈希一致；备用 keystore 可打开；恢复脚本已执行验证；目录仅允许当前用户和 SYSTEM。旧用户变量先通过 DPAPI 加密存档，再切换至新密钥。
- 恢复说明：以上两个目录内的 `codex_SIGNING_RECOVERY.md`。这些文件不在 Git 仓库或 GitHub 资产中。
- 新签名无法覆盖旧版；旧版先导出并核对 JSON，再卸载、安装 v2.5、导入。未做手机安装或迁移操作。

## 已完成

- 应用标题、package.json、锁文件根版本和 Android versionName 统一为 2.5；versionCode 从 14 增至 15。
- 包含已定稿的简约年度音乐杂志、分页 PNG、报告日期与漏记修复、草稿保存与续写、首页文字可读性调整。
- 发布脚本更新输出为 `release/xiaodongge-v2.5.apk`，并校验原正式签名证书、包名与版本后才复制产物。
- typecheck、30 项单元测试、前端生产构建、Capacitor 资源复制和 Gradle assembleRelease / lintVitalRelease 全部通过。前一实施阶段的新旧浏览器回归已通过，均使用 Yves 授权的模拟数据。
- APK 元数据实际核对为 `com.yves.musicarchive / 2.5 (15)`；只有四个当前 Web 资源文件，无原型或模拟夹具。
- 清理生成资源时保留旧产物于 Git 忽略的 `release/codex_web_assets_before_v2.5/`，未删除用户文件。

## 未签名产物

文件：`release/xiaodongge-v2.5-unsigned.apk`。

SHA-256：`0ad3a8ee220b9001b43e1c9e06cb8fe890dfc1f23e676f1402d0541604fd1f56`。

此文件不可安装，不是已发布的正式升级包，不应上传到正式下载入口。

## 原签名恢复历史

2026-09-06 归档核查纠正：沙箱检查误报用户变量缺失。在真实 `YVES\lenovo` 权限下，四项 `XIAODONGGE_KEYSTORE_FILE`、`XIAODONGGE_KEYSTORE_PASSWORD`、`XIAODONGGE_KEY_ALIAS`、`XIAODONGGE_KEY_PASSWORD` 仍存在于 Windows 用户作用域，当前进程未继承它们。密码未输出，无需 Yves 重新提供密码。

归档任务「v2.1.8」（019fbb89-9990-76d3-9f80-992811083a26）确认当时创建并保存了 `D:\xiaodongge-signing\xiaodongge-release.jks`，密码保存为用户环境变量；一次性创建脚本随后清理，聊天建议另行备份，但未找到已执行额外备份的证据。归档任务「release-v2-2-merge」确认后续正式发布曾复用这些变量。

目前变量仍指向上述路径，但真实用户权限下 Get-Item 确认目录及文件不存在。C/D 盘可读取目录中检索隐藏及被忽略的 `.jks` / `.keystore` 未找到原文件，回收站也无匹配项目；其他应用密钥不用于替代。当前阻塞是原密钥文件未找到，不是密码或配置丢失。

已实际核对 v2.3 APK 的原证书 SHA-256：`71bd27895f232e546509adb7f82a7f42e4a4f8a53dfd34de4d305a56aed29d20`。

找回原文件后，将四项用户变量加载到构建进程，再运行 `npm.cmd run android:build:release`，通过原证书校验后发布 v2.5 标签与 GitHub Release 安装包。当前不创建正式发布标签，不以新签名或调试签名替代。未进行手机安装和微信接收验收。

## Git 范围

同步功能源码、模拟原型、回归脚本、设计稿与交接文档。APK 与旧生成资源受 `release/` 忽略规则保护；`.claude/` 和 `claude_status.txt` 不修改、不暂存。两个 Capacitor Gradle 文件只有换行状态差异，不作为功能修改提交。

功能提交 `a1b5941a4e02ef145f37c5b46ab9922cbbce5a56` 已推送至 `origin/main`（https://github.com/Yvesyzy/xiaodongge）。首次上传遇到 HTTP 408；使用仅本次命令生效的 HTTP/1.1 和 32 MiB 请求缓冲重试成功，没有修改全局 Git 配置。
