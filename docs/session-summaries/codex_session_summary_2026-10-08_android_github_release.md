# Android 3.1.2 GitHub推送与测试版发布

日期：2026-10-08。Yves明确回复“推吧”，授权推送3.1.2源码并上传已构建的APK/SHA。源码提交`7c41eaf42fe5a87f9d293df1c88f1153e98449b0`已推送main，31个本轮文件单独提交；共享`codex_status.txt`和其他会话的local_commits交接未混入提交。

## 发布结果

- 测试预发布：[小懂哥 v3.1.2（32）](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.1.2)。
- 已公开，`isDraft=false`、`isPrerelease=true`；稳定版Latest继续为v3.0.1，旧Release未删除。
- 注释标签v3.1.2指向源码提交`7c41eaf42fe5a87f9d293df1c88f1153e98449b0`，未强推或改写提交ID。
- [APK](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.1.2/codex_xiaodongge-v3.1.2-32-test.apk)：75,783,913字节；GitHub返回SHA-256 `d8a38af20902d204016737667792164fdeac71739635239f1b4dd739adc5af5d`，与本地一致。
- [校验文件](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.1.2/codex_xiaodongge-v3.1.2-32-test.sha256.txt)：103字节；GitHub返回该文本文件SHA-256 `413b1d615628aa82bfa815cf60931b6d8a81380e35f9f4966606e0fcd981e567`，与本地一致。

先创建草稿并上传两个明确指定的文件，核对服务端摘要与大小后再发布；README下载链接已改为公开Release资源。APK二进制未加入Git历史，release目录仍被忽略。未上传密钥、密码、本机恢复资料、测试数据库或其他任务产物。

## 复核与边界

本轮暂存31个文件的内容与路径检查未发现私钥/令牌或受保护文件，关键源码与原构建保护哈希一致；复用已通过的27项发布门禁、10个Android JUnit和5组隐私回归，未为纯文档发布重复整套测试。

发布前对实际签名APK再做ELF检查，确认4个64位MLKit/SQLCipher库的RELRO静态问题仍在；发布说明已明确手机/OEM/OCR/网络抓包和16KB兼容限制，因此按测试预发布交付，没有替换稳定版或声称通过应用商店审核。

默认Git Credential Manager推送出现挂起，已确认并只停止本任务的Git进程树。随后对单次Git命令使用已有GitHub CLI凭据及HTTP/1.1完成普通推送，全局Git配置未改，没有使用Git Data API重建提交。相同方式推送v3.1.2标签。

本机验收记录在`release/codex_privacy_signed_20261008/`的`codex_github_release.json`、`codex_github_draft_assets.json`及发布核验JSON。保留最终APK/SHA与必要记录；没有下载额外APK副本或新建测试profile。

此前旧版本清理与9456字节辅助脚本删除仍受自动审核阻断，本轮没有重试或绕过。本聊天已核实累计生成量下限468,090,754字节的自动清理触发状态继续有效；新增文件仅为必要发布说明和核验记录。

后续：手机验收增强功能及撤回；处理16KB原生库问题；正式商店上架前补实名政策、公网URL、版权和APP备案材料。
