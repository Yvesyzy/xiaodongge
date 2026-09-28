# v3.0.1 发布交接（2026-09-28）

Yves 要求更新 Release。此前播放读取/完整乐评、草稿箱与深色模式修补已在 `main`；这次将 npm/锁文件升至 `3.0.1`，Android 升至 `3.0.1 (29)`，未改包名 `com.yves.musicarchive` 或发布签名。版本提交 `fd6460b`，发布文档提交 `7106e7a`；`v3.0.1` 注释标签指向 `7106e7a`。`main` 与标签已推送，不改写原 `v3.0` 标签和 Release。

正式安装包为 `release/codex_xiaodongge-v3.0.1.apk`，75,773,270 字节，SHA-256 `83e623d3092c3a2f84e463c4ecea4a5550c214795c4a10792d9a3da631870525`；同目录有无 BOM 的 `codex_xiaodongge-v3.0.1.sha256.txt`。发布证书 SHA-256 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与 v3.0 一致。新构建证据位于 `release/codex_v301_build_20260928/`：26/26 完整工程检查、Android JUnit 8/8、`lintVitalRelease`、17 个网页文件及 3 个平台文件逐字节核对通过。构建清单记录干净的版本提交 `fd6460b`。

项目 `codex_t18_upgrade_api36` Android16 模拟器从已装的 `3.0 (28)` 用 `adb install -r` 升至 `3.0.1 (29)`；`firstInstallTime` 均为 `2026-09-24 07:15:14`。升级前后首页截图中原合成正式乐评 `CodexT18Album` 与草稿 `SyntheticDraftBeforeUpgrade` 均在，草稿占位仍为 `1/10`；证据为同目录 `codex_before_upgrade.png`、`codex_after_upgrade.png` 和两份包信息。模拟器已停止，ADB 无设备。本轮只验证上述可见数据与安装保留，未重新逐字段导出比对备份。

GitHub [小懂哥 v3.0.1 Release](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.0.1) 已公开、非预发布并为 Latest。远端 APK 附件状态 `uploaded`，大小和服务端 SHA-256 与本地一致；SHA 文件服务端摘要 `aad2dd828d3d366d6587274540122a20e26bd87f12319f3168b9c3c4f7de1885` 也与本地一致。README 下载链接和 `docs/codex_v301_release_notes.md` 已同步；原 v3.0 APK 摘要仍为 `2c095e43341bddb7833321a23b504d93fb43cacef860c2aae416d0fff3984f92`。

实体手机、实际 B 站、其他 OEM、跨应用接收和 TalkBack 未由本轮验证；官方网易云在线实播证据来自先前模拟器，本版未重新在线实播。v3.0 冷启动 P90 和首次榜单预览未达原性能门槛，本版未复测。Yves 先前表示本地测试包安装正常，但此反馈不能代替对最终 `3.0.1 (29)` APK 的手机验收。若播放仍读不到，先核对小懂哥通知使用权与播放器的播放状态，再取本机诊断及按钮旁提示。
