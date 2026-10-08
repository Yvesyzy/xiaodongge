# Windows 本机签名资料交接

Windows 工作根仍为 `D:\codex\workspaces\xiaodongge-windows`。2026-10-08 Yves 授权自行读取本机签名资料及本地保存密码，要求不泄露到 GitHub。

已检查 Windows 全部逻辑证书存储、可访问项目/用户/密钥目录和签名配置：只有现有 Android JKS/CER 与备份；没有可用的 Windows 私钥代码签名证书或项目云签名配置。现有 Android 证书链验证为 `UntrustedRoot`。已在本机验证现有密码可打开 Android JKS 并匹配公开证书，没有打印密码或导出私钥，6 个原签名文件哈希不变。

新增仅本机使用的 DPAPI 加密密码记录、恢复入口和日志，存放于新 Windows 工程的 `release/codex_local_signing_20261008/`，ACL 仅当前用户与 SYSTEM，全部 Git 忽略。恢复方法见 `D:\codex\workspaces\xiaodongge-windows\release\codex_local_signing_20261008\codex_SIGNING_LOCAL_LOG.md`；完整交接在该工程 `docs/session-summaries/codex_session_summary_2026-10-08_windows_signing_discovery.md`。

未修改手机端业务、原密钥/密码/备份、其他助手配置或证书存储；没有提交、推送、发布或重打包。Windows 安装包仍未签名，后续需要可信 Windows 代码签名证书或已开通云签名服务。一次性准备脚本验证后清理，本地加密记录和恢复方法保留。
