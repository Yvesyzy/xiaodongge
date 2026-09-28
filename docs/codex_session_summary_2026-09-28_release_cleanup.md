# release 目录旧版本与缓存清理（2026-09-28）

Yves 选择清理旧 APK 和可重建测试输出，同时保留模拟器、五个有未提交修改的注册 Git worktree、签名与个人备份。实际删除范围记录在 release/codex_release_cleanup_manifest_20260928.json（SHA-256 25ac43ac1df913284bddac87f12ee8d93fd5a56acec6184df1b18aff7277a1f3）。

清单包含 24 个旧 APK/校验文件和 322 个旧验证目录中的 .next、mobile-dist、Vite/guard 缓存，共 346 个精确路径、6,809,934,198 字节。逐项检查绝对路径属于本项目 release、无重解析链接且大小与盘点一致后删除；复核 346 项均不存在。

v2.8.0、v2.9、v3.0 正式包在删除本地副本前与 GitHub Release 资产摘要逐一吻合，远端附件未修改。release 顶层现只保留 v3.0.1 正式 APK 和 SHA 文件；其 APK SHA-256 仍为 83e623d3092c3a2f84e463c4ecea4a5550c214795c4a10792d9a3da631870525。保留 v3.0.1 构建清单、升级截图与日志，以及网易云和播放回归诊断包。

两套项目 AVD、五个注册 Git worktree、签名材料、个人备份、历史测试结果 JSON 与截图均保留。历史文档若引用已清理的本地旧 APK/缓存，应从相应 GitHub Release 取得正式包或重新运行旧检查；清理没有改变应用源码、版本号、标签或任何 GitHub Release。

验证：npm.cmd run typecheck:mobile 通过，Git 工作区在记录前干净，五个注册 worktree 均仍存在。
