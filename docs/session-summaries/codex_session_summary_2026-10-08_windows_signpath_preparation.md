# 小懂哥 Windows SignPath 申请准备交接

- 日期：2026-10-08；作者：Codex。
- Windows 独立仓库：D:\codex\workspaces\xiaodongge-windows；https://github.com/Yvesyzy/xiaodongge-windows 。
- main：2d1f9b3975dd80cc9b1dbfe25b86d88e9e4f44ed；新增 GitHub 托管手动构建、公开 Code signing policy 与真实隐私说明，Release 说明同步。
- 云端验证：https://github.com/Yvesyzy/xiaodongge-windows/actions/runs/37717317048 全部成功；48 项测试、98 项 ZIP 清单校验、安装器生成与白名单产物上传通过。Artifact ID 11523819444，293220205 字节，摘要 sha256:73cfb6e0c711c61d8097a0fd2c95f5624d21736f1f68b2f4ac7238cfdcb14c9f，保留 7 天供来源核对，未重新发布。
- 修复云构建发现的问题：锁文件补齐两项可选 peer，既有 184 项版本/摘要不变；classifyDay 按日历日期取 UTC 星期，修复非东八区周末误判，UTC/洛杉矶/上海各 11 项回归通过。业务修复已记入 CHANGELOG 未发布；旧 v3.1.1 标签和四项发行文件保持原样。
- 官方申请表已核实；Yves 明确授权使用已有 Git 提交邮箱并提供账号姓名、同意行为准则/个人资料处理。实际联系人只在本地被忽略且 ACL 限制的 release/codex_signpath_application_20261008/codex_application_fields.json 中保存，不写进此交接或公开源码。没有读取、导出或上传 Android 私钥/签名密码。
- 实际自动提交：HubSpot 校验 200、提交 401，页面 Failed to validate Captcha. Please try again.；尚未提交成功、未获批、没有签名证书。没有绕过 CAPTCHA。
- 当前人工接手：本机 Chrome 窗口 SignPath Foundation - Google Chrome，独立 session codex_xiaodongge_signpath_20261008。14 个文本字段比对通过、3 个下拉正确，两个必需同意项已勾选，营销未勾选，Submit 可用。Yves 本人点击并完成人机验证后，读取实际成功回执再更新状态；不能把点过按钮或 HTTP 200 校验当作申请成功。
- 必要本地资料：release/codex_signpath_application_20261008/codex_APPLICATION_LOCAL_LOG.md、codex_submission_checks.json、codex_signpath_checks.json、codex_source_manifest.json。保留活跃 profile、浏览器交接快照与 release/codex_prefill_browser_application.ps1，供待提交阶段恢复；确认成功后关闭本任务专用浏览器并清理 profile/快照/一次性 refill helper，不碰日常 Chrome profile。
- 免费路线的限制：SignPath Foundation 是证书发布者，HSM 保管私钥、每次签名须人工批准；新项目声誉由服务判断。已如实披露当前联网行为、缺少安装时隐私披露/联网禁用选项、MFA 未核实。正式签名前必须解决；现有本机证书模式不是 SignPath 集成，不重签 Electron 上游二进制。组织 ID/项目/策略/API token 必须来自实际获批账户，不能预造。
- 安全检查：tracked 私钥/token/联系人特定字符串检查无匹配；两次 SkillSpector 静态扫描 SAFE，未使用外部 LLM 扫描。未购买收费服务、未安装新的技能/插件/MCP。
- 清理：本轮实际删除 2123 个任务临时文件、46649538 字节；16 个保护文件哈希不变。删除 npm 辅助缓存、锁文件试验副本、过期远端浏览器记录与一次性脚本；保留最终安装器/ZIP、原加密签名恢复、源码/依赖、申请资料、活跃人工接手表单及必要证据。未关闭用户浏览器或删除个人档案。

下一步：Yves 完成官网人工提交后核对成功回执；等待 Foundation 资格审核及实际开通配置，再完成安装隐私选项、Inno 卸载器/安装器独立签名、可信链和时间戳验签、隔离安装/升级/卸载及新版本发布。不能声称签名交付已经完成。

2026-10-08 CAPTCHA 人工失败补充：Yves 手动点 Submit 后仍出现 Failed to validate Captcha；只读确认申请 POST 401、reCAPTCHA 资源 200，14 文本框原值保留。具体拒绝原因不明，尚未提交成功/获批。未再次自动重试、绕过验证或改动日常浏览器。已在 ACL 限制且 Git 忽略的 release/codex_signpath_application_20261008/ 新增 codex_MANUAL_SUBMISSION.md（17 项原始字段）、codex_SUPPORT_EMAIL_DRAFT.txt（官方 support@signpath.io 求助草稿，未发送）、codex_captcha_diagnosis.json（只含请求方法/路径/状态，不含请求头或载荷）和 codex_manual_submission_checks.json。优先由本人在日常浏览器正常填写；若仍失败，再经官方 https://signpath.io/support 求助。独立 Chrome/profile、原填表恢复 helper 继续保留，不能把当前错误现场当作已完成申请。联系人、密钥、密码均不新增到公开仓库；公开代码和发行文件本轮未改动。

2026-10-08 CAPTCHA 交接验收与清理：17 个字段和值完整；申请目录及所有顶层文件 ACL 仅当前用户/SYSTEM，目录关闭继承，均 Git 忽略且未跟踪。删除本轮 12 个一次性诊断/生成/清理脚本及原始官网抓取文件，共 50964 字节；官方邮箱/隐私链接及页面摘要已提取到 codex_captcha_sources.json，8 个保护文件哈希不变。保留人工填写清单、未发送邮件草稿、只读诊断证据和活跃专用表单/profile/恢复 helper；用户截图未触碰。申请仍未成功提交，公开包仍未签名。

2026-10-08 Yves 明确要求‘先不搞了’：签名申请暂停，停止后续提交、重试、求助邮件发送、签名配置及发布变更，等待 Yves 明确恢复。GitHub 源码/README/Release 已完成；SignPath 申请仍因 CAPTCHA 失败未提交成功，安装包仍未签名。申请资料、未发送邮件草稿、本地加密恢复资料、现有专用表单/profile/恢复 helper 保留供继续，不触碰日常浏览器、用户数据和原密钥。暂停收尾检查：本轮仅更新必要交接记录，无新增待清理临时文件；上一轮临时排查文件已清理。
