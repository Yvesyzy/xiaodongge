# v3.4.1 GitHub发布交接

Yves于2026-10-13明确授权提交、推送、直接发布v3.4.1，并更新README和Release。本次授权覆盖此前保持本地的封面清晰度、公众号出稿、可选自部署好友圈及其构建／检查维护；没有部署好友圈服务或操作个人手机。

## 发布结果

- 源码提交`891beafcc781799a3e311620ca7f931458d665e0`，121个相关文件，普通推送至main；注释标签`v3.4.1`指向同一源码提交。
- [GitHub Release](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.4.1)已正式发布并设为Latest，Release ID `411203292`，`draft=false`、`prerelease=false`，发布时刻`2026-10-13T02:56:28Z`。
- APK：`codex_xiaodongge-v3.4.1-39.apk`，75,761,447字节，服务端SHA-256 `41bdab470b40ff8ec63054d97f5b08ed6c77fdc645883016c74abdd99b7ae81a`，Asset ID `635677134`。
- SHA文件：`codex_xiaodongge-v3.4.1-39.sha256.txt`，98字节，自身SHA-256 `2798d8bdd623a7f06b0f814f9d177dbe0ebf8e7899a86e5fdd884d6d878f0c3e`，Asset ID `635677135`。两个附件均为uploaded，服务端摘要与本地一致。
- 本地正式文件位于`release/codex_v341_release_20261013/`，与10月12日最终图像验收包逐字节相同。版本3.4.1(39)，包名`com.yves.musicarchive`，证书`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，可覆盖同签名较低版本。
- README首页、下载／校验链接、发布说明、公众号与好友圈使用文档已更新。公众号工具为本地出稿，好友圈需自行部署HTTPS服务；推文草稿不属于乐评JSON备份，已写明。
- 原v3.2.0 Release ID `408598114`及原APK摘要核对不变。附件和密钥／数据库／临时目录未加入Git；视频工程、历史设计删除及其他会话交接修改留在原工作区，未混入本次源码提交。

## 核验与处理

31项完整工程检查、30项Android JUnit、最终签名APK的15项API36图像测试沿用已完成验收；本次发布重新核对原签名、实际版本、附件摘要及当前源码与包的对应关系。

Vite诊断字段嵌入构建时间，普通重建会改变资源哈希；逐块对比定位为时间字段及其依赖文件名。使用APK原构建标识`web-2026-10-12T15:21:08.456Z`重现后，25份public和3份平台资源完全一致，保留最小复现`codex_reproduce_web.mjs`。原生assembleRelease也与验收APK保持相同SHA。没有以仅修改文件名替代实际摘要核对。

第一次Git推送TLS握手EOF失败，远端分支／标签未变；改用本次命令的Windows Schannel与GitHub CLI凭据helper后，分支和标签原子推送退出0。没有更改全局Git设置或关闭证书验证。

Release先作为草稿上传并核对两个服务端摘要，再按ID发布。草稿按tag查询曾返回404，使用release列表与ID读取确认唯一草稿，未重复创建。公开页面检查发现Release对相对文档链接按仓库根目录解析，三个说明链接为404；已改为明确的`blob/v3.4.1/docs/`及`blob/v3.4.1/social/`链接，正文同步更新，标签和附件不变。

现有4个64位ML Kit／SQLCipher库的GNU_RELRO末端16KB对齐静态检查仍失败，退出1已如实记录；不算作通过项。不同实体机／播放器、HDR／OEM精度、微信实际粘贴和文件提供器仍需设备验收。Release与README保留相关范围说明。

发布证据：同交付目录`codex_github_publish_verification.json`、`codex_github_final_release.json`、`codex_source_assets.json`、`codex_native_source_match.json`、`codex_native_elf.json`和各步日志。发布说明后续仅修正文档链接，并以独立文档提交保存本交接，不移动v3.4.1标签。

## 清理

本聊天200MB阈值早已触发，继续继承原累计台账，历史已删量不扣回。两个新建的重复前端构建目录共46个普通文件／17,517,112字节，已确认来源、路径和7个保护摘要：

- `release/codex_v341_release_20261013/source-web-check`
- `release/codex_v341_release_20261013/source-web-reproduced`

删除命令在创建进程前被自动审批拒绝，仅`blocked by policy`、没有具体原因。实际删除0文件／0字节，两个目录保留，保护摘要不变；没有重试、换工具／shell／提权或从父目录绕过。台账`codex_publish_cleanup.json`状态为blocked；最终APK／SHA、源代码和验收记录保留。没有触碰其他会话先前已受阻的清理目标。

发布已完成，清理受阻。下一步可从Release覆盖安装验证实际播放器封面，或在个人公众号后台验收排版复制／配图导出。
