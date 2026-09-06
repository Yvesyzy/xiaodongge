# v2.5 构建交接

日期：2026-09-06。Yves 要求构建安装包、升级 v2.5 并同步 Git / GitHub。

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

## 待恢复签名

四项 `XIAODONGGE_KEYSTORE_FILE`、`XIAODONGGE_KEYSTORE_PASSWORD`、`XIAODONGGE_KEY_ALIAS`、`XIAODONGGE_KEY_PASSWORD` 在当前进程、用户和机器作用域均缺失，旧路径 `D:\xiaodongge-signing` 不存在。已向 Yves 请求原 keystore / 签名配置脚本路径，不在聊天或仓库中收集密码。

已实际核对 v2.3 APK 的原证书 SHA-256：`71bd27895f232e546509adb7f82a7f42e4a4f8a53dfd34de4d305a56aed29d20`。

恢复配置后运行 `npm.cmd run android:build:release`，通过原证书校验，再发布 v2.5 标签与 GitHub Release 安装包。当前不创建正式发布标签，不以新签名或调试签名替代。未进行手机安装和微信接收验收。

## Git 范围

同步功能源码、模拟原型、回归脚本、设计稿与交接文档。APK 与旧生成资源受 `release/` 忽略规则保护；`.claude/` 和 `claude_status.txt` 不修改、不暂存。两个 Capacitor Gradle 文件只有换行状态差异，不作为功能修改提交。
