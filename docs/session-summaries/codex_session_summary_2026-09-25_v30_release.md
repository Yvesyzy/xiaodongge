# v3.0 发布交接（2026-09-25）

Yves 明确要求提交、更新本地与 GitHub、将版本号设为 v3.0，并同步 Release 与 README。源码提交 `c57face1a155254b6967632f646db364b274db79` 将 npm/锁文件升至 `3.0.0`、Android 升至 `3.0 (28)`，并集成 T00–T18 的实现与检查；发布文档提交 `27fcee006e57266a811f5102e5779f2814368150` 更新 README 与 `docs/codex_v30_release_notes.md`。本地 `main` 与 GitHub `main` 已快进，`v3.0` 标签指向 `27fcee0`，无强推。

正式签名本地包 `release/codex_xiaodongge-v3.0.apk`，75,772,930 字节，SHA-256 `2c095e43341bddb7833321a23b504d93fb43cacef860c2aae416d0fff3984f92`；同目录有 `codex_xiaodongge-v3.0.sha256.txt`，旧 v2.9 APK 保留。包名 `com.yves.musicarchive`，发布证书 SHA-256 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022` 与旧版一致。构建证据 `release/codex_v30_release_20260925/build_manifest.json` 记录源码提交；完整检查 26/26、Android JUnit 8/8、`lintVitalRelease`、17 个网页及 3 个平台资源逐字节匹配。

项目自建 Android16 模拟器从已装的 `2.9 (27)` 正常 `adb install -r` 到 `3.0 (28)`，首装时间未变化。系统界面保留原合成乐评与草稿；升级前后导出的 v6 备份逐字段核对正式记录、总结、封面、重听、草稿和稳定 AppData 相同。每日重逢 `daily-resurfacing` 因日期从 9 月 24 日到 25 日而变化，未计作数据丢失。证据 `release/codex_v30_release_20260925/codex_upgrade_result.json`；模拟器已停止、ADB 转发为空。

GitHub [小懂哥 v3.0 Release](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.0) 已公开发布，非草稿、非预发布，标记 Latest。服务端 APK 附件为 `uploaded`，75,772,930 字节，`digest` 与本地 SHA-256 完全相同；SHA 文件也为 `uploaded`。`main`、`v3.0` 标签及远端 README 已核对。发布说明准确列出冷启动 P90/首次榜单预览未达原性能门槛，以及实体手机、实际 B 站、跨应用接收、TalkBack/OEM 未验。Yves 明确不会连接个人手机，本轮使用项目设备，不将模拟器结果冒充个人手机体验。
