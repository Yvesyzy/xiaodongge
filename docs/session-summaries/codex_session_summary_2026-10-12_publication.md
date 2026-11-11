# 公众号出稿交接

## 范围与授权

Yves选择可行性建议中的第2项：公众号稿预览、复制与配图导出。公众号为个人主体，继续遵守“先别推送”。本轮没有提交、推送、部署、登录公众号、上传草稿或发布文章；网易云／豆瓣作品跳转未纳入本轮。旧有其他会话及维护改动保留。

## 结果

本地测试版3.4.0(38)：`release/codex_publication_delivery_20261012_r2/codex_xiaodongge-v3.4.0-38-test.apk`，75,744,927字节，SHA-256 `17d8aafdb7baa02f164702f0eeacd66b3ec9ebce90246c7006f9641e5ddd5df2`。同目录附SHA文件、build_manifest.json、assets.json和完整门禁报告。包名com.yves.musicarchive，签名SHA-256 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与已发布3.2.0基线一致，可覆盖同签名较低版本。公开README下载仍指向正式3.2.0。

- 乐评和已生成月报／年报的分享面板新增“公众号稿”；“更多 → 公众号出稿”支持多篇正式记录筛选、选择和排序；年度榜单从已保存入选理由出稿。
- 标题、署名、导语及各节正文可编辑，本机自动存草稿；仅编辑推文副本。格式损坏不自动覆盖，保存失败保留输入并守住离开流程，明确重置才放弃旧推文稿。推文草稿不在既有乐评JSON备份里，不做数据库结构迁移。
- 隐藏评分／日期／应用名称／导语正文统一作用于复制、HTML、ZIP和生成封面。用户文字转义，不解释为可执行HTML，不联网改写或读取远程封面。
- Android新增安全HTML剪贴板及ZIP保存／分享校验；原有PNG相册和多图暂存边界保留。网页使用HTML+纯文字剪贴板及兼容复制路径；素材包分享先准备，再次点击打开系统分享，编辑会使已准备包失效。
- ZIP含标题、纯文字正文、独立嵌图HTML、说明、1200×510横版封面及所选PNG。图片最长边1024，文件／ZIP最大8MiB，排版剪贴板512KiB，文字总量2MiB；超限报错不截正文。

核心新增文件：mobile/src/codex_PublicationComposer.tsx、codex_PublicationPage.tsx、codex_publicationAssets.ts、codex_publicationDraft.ts、codex_publicationModel.ts、codex_publicationZip.ts和codex_publication.css；接入App、ReviewShare、JournalExport与nativeExport。原生新增NativeExportValidation及CodexPublicationNativeValidationTest，沿用NativeExportPlugin。package与Android版本已同步；新增publication:test和publication:check并纳入全量门禁。

## 验证

最终构建退出0：31/31工程检查，23/23 Android JUnit；新模型／ZIP7项测试包含16种隐私组合、转义、限额和Python标准ZIP读取。25个public和3个平台资源与新构建一致，版本、包名、官方长期签名及复制后的APK摘要通过。

`checks/publication/codex_check_publication.json`记录14组实际UI流程：单篇编辑，模拟HTML+plain剪贴板，实际ZIP/HTML/PNG下载及CRC/Pillow验证，分享准备／编辑失效／取消，隐私影响包内文字与封面绘字，多篇排序，关闭恢复，月报／年报和榜单入口，损坏／配额失败恢复，原记录与封面字节不变，320/390/1280浅深色和无pageerror。禁用Blob.text/arrayBuffer后导出仍通过。主代理审阅了手机与桌面截图。Playwright使用独立合成浏览器数据。

独立luna_worker在隔离目录产出纯模型／ZIP、原生校验与QA脚本；主代理整合、修正hideBrand、图片上限和rank来源身份，并执行最终验收。只读审查发现的来源切换旧状态／旧保存闭包问题通过按来源key重挂载及异步结果来源检查处理；ZIP说明已去掉固定应用名。原始ordinal榜单草稿只存在未交付开发阶段，不迁移到新身份。

第一轮完整构建中断于capture，没有生成最终通过报告或APK；最终另用r2目录重新完成全量验收。一次父代理UI检查因Windows Python输出GBK不能编码组合字符失败，改JSON ASCII输出后通过；这不是ZIP内容损坏。隔离QA曾修正折叠图片区的等待定位和实际报告路由，未放宽产品断言。

尚未验证：Android真实剪贴板接收、设备文件提供器、微信实际粘贴与图片上传、不同设备运行和公网好友圈。已有16KB原生库及鸿蒙设备边界不因这次本地排版功能而宣称解决。使用说明docs/codex_publication_guide_20261012.md。

## 收尾与接续

清理台账见最终交付目录codex_publication_cleanup_20261012.json。本轮生成核实下限358,182,321字节，连同先前好友圈阶段累计核实下限910,444,717字节，已触发持续清理。拟清理16个本轮目标、709普通文件257,685,357字节及1个测试junction；190保护文件含最终APK、正式3.2.0基线、此前3.3.0交付包、必要源码／检查和验收记录。初次删除命令在创建进程前被自动审批拒绝，仅返回blocked by policy、无具体理由，命令未启动，实际删除0文件／0字节／0链接。Yves于2026-10-13明确要求重试后，先后两次把操作缩到单个4文件隔离副本（35,739字节），均被自动审批以blocked by policy拒绝；两次命令都未启动，没有换工具／shell绕过，也没有删除文件。本次之后按Yves请求修订的技能明确了：只能通过平台仍受审批的正式重试流程，不得绕过拒绝。清理目标仍全部保留，初次操作记录的保护摘要未变。本功能交付完成，清理收尾受阻。

历史受阻文件tmp/codex_social_cleanup_20261011.ps1（10028字节）继续保留，未重试、未从父目录绕过。其他任务／工具配置、密钥、个人数据和既有混合来源编译缓存未清理。

下一步由Yves选择：手机覆盖安装后用个人公众号完成复制／图片上传验收；或另做网易云／豆瓣经用户确认作品链接跳转。推送或发布仍需Yves新的明确授权。
