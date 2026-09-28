# 项目清理交接（2026-09-28）

Yves 已确认精确清单的 41 项及清理后推送。执行前 mobile/release、mobile/dist、mobile/tsconfig.tsbuildinfo 已不存在；本轮删除其余 38 项。包括可重建构建缓存、过期 WB/Trae 项目会话、旧交接与 QA 产物，以及已核实发布摘要的 v2.7.5 本地重复 APK。清单 41 项最终均不存在。

保留了正在运行的 abu 主题/触觉源码和检查脚本、五个带未提交文件的注册 Git worktree、项目模拟器、签名密钥与备份、正式 v3.0/v3.0.1 APK。两个正式 APK SHA-256 分别为 2c095e43341bddb7833321a23b504d93fb43cacef860c2aae416d0fff3984f92 和 83e623d3092c3a2f84e463c4ecea4a5550c214795c4a10792d9a3da631870525。README 已改用现行镜像脚本说明，去除了指向已删旧交接的链接。

验证：全部 41 路径不存在；git diff --check 通过；用 HEAD 中的 mobile/tsconfig.json 内容创建同目录一次性配置后运行 TypeScript 类型检查通过，临时配置已删除。普通 npm typecheck:mobile 因 mobile/tsconfig.json 在本轮开始前已被删除而报 TS5058；该现有改动不属于清单，未恢复，也不纳入清理提交。

完整审计和清单位于 D:\codex\workspaces\总-项目总结\小懂哥。后续若需恢复旧会话，Git 跟踪文档可从历史取回；工具会话不可从 Git 恢复。手机当前播放与完整乐评的现场验收不属于本轮清理。
