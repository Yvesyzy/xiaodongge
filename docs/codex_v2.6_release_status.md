# v2.6 发布交接

Yves 已授权构建新版签名安装包并提交推送，版本 v2.6。

## 构建完成

- package.json、package-lock.json、应用标题和 Android versionName 为 2.6，versionCode 为16。
- 沿用 v2.5 正式密钥；已验证签名证书 SHA-256 为 6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022，可覆盖该签名的 v2.5。
- 安装包 release/xiaodongge-v2.6.apk，67,935,885字节。
- SHA-256：d9b0e78934c2e566f9acdebaeb917d81b50fb8d85445b7b362938a80cf84e8e3。
- typecheck、31单测、mobile:build、Capacitor sync、assembleRelease、lintVitalRelease、apksigner v2 和 aapt2 版本校验通过。
- APK 中四个Web资源与本次 dist 逐文件哈希一致，无模拟原型、夹具或签名文件。
- 实施阶段四套浏览器回归已通过，详见 codex_2026-09-06_ux_delivery.md；尚未进行真机覆盖安装、系统文件夹及微信接收验证。

## 文件与发布

正式包、构建记录和旧生成资源在忽略的 release/ 下；保留旧生成资源以避免破坏已有产物。新版本发布脚本指向v2.6且校验16/2.6，证书保持v2.5。

源码、测试和发布文档已提交推送，发布提交与标签 v2.6 均指向 a60f89330f9df931d636b789e7f7f530f753d538。GitHub Release 已公开发布，非草稿、非预发布：https://github.com/Yvesyzy/xiaodongge/releases/tag/v2.6 。

远端 APK 状态 uploaded，大小67,935,885字节、SHA-256与本地一致；附带校验文件也已上传并核对。发布说明 docs/releases/v2.6.md。APK通过 GitHub Release分发，不进入Git文件历史。已发布的v2.5包和标签未覆盖。未修改或暂存 .claude/、claude_status.txt。
