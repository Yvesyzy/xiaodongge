# 2026-10-10 v3.2.0 发布与清理交接

Yves 已在 vivo X100 测试系统播放封面功能成功，明确授权将版本更新至 v3.2.0、提交本地源码、推送 GitHub、更新 README/Release 并上传新安装包，完成后执行 `codex-task-cleanup`。

## 发布内容

版本统一为 3.2.0，Android versionCode 36。包含已测试的系统播放封面读取、乐评/速记预览和本地保存、草稿来源及手动封面保护，以及此前尚未发布的首页优化与鸿蒙/卓易通兼容改动。构建脚本增加可选 `-OfficialRelease` 正式文件名；未传该开关时保留原测试命名。

提交范围为重建此版本必需的移动/原生源码、检查脚本和本次发布文档；既有其他会话的历史交接修改与共享状态不混入源码提交。APK/SHA 作为 GitHub Release 附件，不进入 Git 历史；密钥、个人数据、测试数据库及本机凭据不上传。

## 构建证据

- 本地安装包：`release/codex_v320_release_20261010/codex_xiaodongge-v3.2.0-36.apk`，75,796,464 字节。
- SHA-256：`6ba2da51083118f72d4d7c0d11831aaf2c405ba84c4368eface556bd8d98195f`；同目录 `.sha256.txt`。
- 证书：`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，原发布签名。
- 27 项工程检查、15 项 Android JUnit、assembleRelease/lintVitalRelease、20+3 资源一致性、签名/版本和 ZIP 16KB 对齐通过。权限与 3.1.5 相同，8 个原生库均与 3.1.5 逐字节一致。
- 另以实际 APK 核对 3.1.5 (35) → 3.2.0 (36) 的包名、签名和版本递增关系；构建脚本保留仍存在且受保护的 3.1.3 可信基准，不将其删除。ELF 静态检查退出 1，4 个 64 位库的 GNU_RELRO 末端对齐问题仍在，已在发布说明中披露，未计为通过。
- 构建时基线提交为 `f92f362` 加已核对工作区改动。发布前将核对构建源文件与正式源码提交一致，并记录标签、远端 main 和附件摘要。

原始核验位于同目录 `build_manifest.json`、`assets.json`、`codex_package_validation.json`、`codex_native_library_comparison.json`、`checks/codex_results.json` 与 `android-unit/codex_android_results.json`。

## 设备边界

vivo X100 是 Yves 的用户实测反馈，不是 Codex 连接设备复验。其他播放器/机型、鸿蒙/卓易通媒体互通、16KB 原生库运行兼容和 SDK 网络行为仍未全面验证。朋友的鸿蒙启动卡顿没有设备诊断，不宣称已修复；Yves 当前没有该设备，不要求其立即操作手机。

## 后续记录

GitHub 发布状态与清理结果在完成各步骤后补记。已知旧清理请求曾被自动执行审批审核拒绝；本轮按 Yves 新的显式清理授权核对范围，受阻时保留内容并记录，不更换工具或权限绕过。
