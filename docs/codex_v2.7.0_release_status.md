# v2.7.0 签名构建交接

发布后补齐 README：版本 2.7.0（19）、回顾／阅读／统一分享功能、APK 与校验文件链接、SHA256、覆盖升级范围、构建输出和真机验收状态均与本次发布对齐。

Yves 已批准签名打包、检查并提交源码，以及连接手机后的原生保存和分享验收。

- 版本：2.7.0，versionCode 19；包名 `com.yves.musicarchive`。
- 安装包：[xiaodongge-v2.7.0.apk](../release/xiaodongge-v2.7.0.apk)。大小 68,516,839 字节。
- SHA256：`2b278b2b9b66e1f96c9bcd9e88ef6be37a78860c752b0a5e2aeeb7dd899a6de3`。
- 签名证书 SHA256：`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`。与 v2.5、v2.6、v2.6.1、v2.6.2 正式签名一致，支持覆盖这些正式版本。
- SHA256 校验文件：`release/xiaodongge-v2.7.0.sha256.txt`；包内 Web 资源逐文件核对结果：`release/codex_v270_verification.json`。

本版包含年度／月度回顾整合、精选排序与来源证据、阅读设置与续读／返回位置记忆、四类乐评统一分享及完整分页。具体实现及四套浏览器回归见 [本轮交接](session_summary_2026-09-10_codex.md)。

TypeScript、31 项单测、Web 构建、Capacitor 同步、Android assembleRelease/lintVitalRelease、APK v2 签名、包名、版本和包内 Web 资源 SHA256 核对均通过。旧版 v2.6.2 APK 哈希未变。构建仍有 JS 分块大于 500 kB、Gradle 旧接口和 flatDir 提示，不影响本次构建。

源码提交 `4c552a3ba42184eafcf7469e5490a9f5fc019dcf` 和 `v2.7.0` 标签已于 2026-09-10 推送 GitHub。经 Yves 授权，[小懂哥 v2.7.0](https://github.com/Yvesyzy/xiaodongge/releases/tag/v2.7.0) 已公开并设为最新版本，包含签名 APK 和 SHA256 文件。远端 APK 大小 68,516,839 字节、SHA256 与本地一致；校验文件 SHA256 为 `120ad6c3c6b6ec0be6c03270fbaa848e38e048fa4b6cac2d1252a1e5833ec4c9`，远端与本地一致。私人数据和签名材料未上传。用户原有 `.claude/`、三个换行状态及已删除的历史文档保持原状，未纳入提交。

ADB 设备列表为空，尚未安装到手机，也未验证原生文件选择器／微信接收。等待 Yves 连接手机并允许 USB 调试后，先核对已安装版本及证书，再进行覆盖安装；不卸载、不清空应用数据。发送给微信联系人的测试需要明确接收对象，本轮未发送任何消息。
