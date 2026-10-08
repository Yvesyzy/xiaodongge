# Windows 安装器交接入口

Windows 后续开发根：`D:\codex\workspaces\xiaodongge-windows`。

已增加每用户安装器、快捷方式、系统卸载入口、默认要求证书的签名构建入口及独立身份安装验收；源码、README 和 Release 已同步至 <https://github.com/Yvesyzy/xiaodongge-windows>，main 提交 `ce08a32c1b6dfa18054624fd565eef88c0aeddf6`。原 `v3.1.1` 标签与便携 ZIP 保留；同一 Release 已补充未签名安装 EXE 与 SHA-256。

安装器 `codex_xiaodongge_windows_3.1.1_x64_setup_unsigned_20261007_045728_426.exe`，122518681 字节，SHA-256 `791ca124ff0abad85683c869610240aefced56d7c39ebc01ab7777f0fc1124fc`。安装、真实启动、覆盖升级、全部程序文件卸载，以及 SQLite/Chromium 存储与用户自建文件保留通过；生产/测试 98 项 payload 大小和哈希一致，GitHub 资产/README/Release 说明核对一致。

**实际签名尚未完成**：本机没有 Windows 代码签名证书，已向 Yves 询问信息。需要证书本机位置、已安装证书指纹或云签名配置；密码不要写入聊天或 Git。未创建自签名证书或安装根证书。

本轮自动清理 460 个任务临时文件、1682433932 字节，220 保护文件哈希不变；正式成果及验收记录保留。完整交接：`D:\codex\workspaces\xiaodongge-windows\docs\session-summaries\codex_session_summary_2026-10-07_windows_installer.md`。手机端本轮未提交或推送，HEAD 仍为 `9ae4e01a037690e59aed1e9ac71091baa0e27acc`，原业务改动及其他助手产物不动。
