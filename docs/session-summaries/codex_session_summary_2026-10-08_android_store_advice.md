# 安卓应用商店发布咨询

日期：2026-10-08（Asia/Shanghai）。用户：Yves。工作目录：`D:\codex\workspaces\codex\小懂哥`。

## 已完成与当前边界

- 阅读 README、各助手状态与 2026-10-02 安卓交接，核对现有安卓版本为本地测试版 v3.1.1 (31)，已有长期发布签名与历史构建验收记录。本轮没有重新构建或验签。
- README 明确包含本地音乐记录、系统播放信息、截图识别、Apple Music 目录元数据与天气联网查询。不能仅依据本地保存记录，把当前功能描述成完全离线应用。
- 使用已认证 Firecrawl 搜索、抓取官方规则，并用网页工具交叉核对发布协议、备案规则、收费依据与 Google Play 要求。`.firecrawl/` 已被现有 `.gitignore` 忽略。
- 国内准备工作：核对目标商店对主体及类目的要求；准备版权证明和 APP 备案材料；审查隐私政策、首次告知与权限流程；准备正式包、兼容与数据升级验收、图标截图及联系方式；核对封面、字体与目录服务使用授权。
- 小米公开发布协议约定免费提供发布平台服务；不能由此推定所有商店及所有认证、商业服务均免费。小米上架要求包含版权证明、备案及隐私规则。
- 非经营性备案官方不收费；计算机软件著作权登记费在财政部停征清单内。商业代办、电子版权证书、托管、收费接口及推广应分别报价，不属于统一官方上架费。
- 安卓签名可由开发者自行生成。项目已记录正式发布签名，上架准备不需要另购 Windows 类商业代码签名证书；最终发行时仍需验签并保持升级兼容。
- Google Play 注册费一次性 US$25；2023-11-13 后新建个人账号需至少 12 位测试者连续加入封闭测试 14 天，之后申请正式发布权限。正式提交还需完成 Play Console 资料、应用包及签名配置。
- 尚未逐项审查实现中的隐私流程、网络请求、权限及 SDK；未核实 Yves 是否已经持有软著、备案号或商店开发者账号。不能把“项目内未找到材料”当成“尚未办理”。
- 本轮属于咨询，没有注册、支付、上传安装包或发布应用。

## 来源清单与证据映射

以下来源均于 2026-10-08 检索。Firecrawl 输出位于项目 `.firecrawl/`；网页核对的摘录记录在本表中。

| 支持的结论 | 来源标题及精确网址 | 取回状态与输出 |
| --- | --- | --- |
| 已有安卓签名版本；联网功能 | 项目 `README.md`；`docs/session-summaries/codex_session_summary_2026-10-02_reading_spacing.md` | 本地文档已读；未重新运行历史检查 |
| 小米免费提供发布平台服务 | [小米开发者站应用发布协议](https://dev.mi.com/docs/appsmarket/distribution/agreements/) 第 3.1 条 | 搜索与网页全文核对成功；`.firecrawl/codex_android_store_20261008_domestic_fees.json` |
| 小米版权、备案、隐私、展示材料要求 | [应用商店上架要求](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1322) | Firecrawl 全文成功；`.firecrawl/codex_android_store_20261008_xiaomi_rules.md` |
| 大陆提供 APP 互联网信息服务的备案义务及办理渠道 | [工业和信息化部关于开展移动互联网应用程序备案工作的通知](https://www.hunan.gov.cn/zqt/zcsd/202308/t20230809_29456035.html)（政府转载） | 搜索正文与网页全文核对成功；`.firecrawl/codex_android_store_20261008_miit.json` |
| 非经营性备案不收费 | [非经营性互联网信息服务核准](https://ythzxfw.miit.gov.cn/bssx/alx/dxhhlw/art/2025/art_88c400fc83904008bcf5b11bc08ec18f.html)（工信部） | 官方网页及 Firecrawl 抓取成功；`.firecrawl/codex_android_store_20261008_filing_fee_policy.md`；网页搜索摘录明确“不收费” |
| 软件著作权登记费停征 | [关于清理规范一批行政事业性收费有关政策的通知](https://www.mof.gov.cn/gp/xxgkml/szs/201703/t20170323_2563593.htm)（财税[2017]20号） | 官方网页、附件正文及 Firecrawl 核对成功；`.firecrawl/codex_android_store_20261008_copyright_fee_policy.md` |
| 安卓开发者自行生成与使用发布签名 | [Sign your app](https://developer.android.com/studio/publish/app-signing) | Android Developers 官方网页核对成功；本表保留结论及来源，项目既有签名记录见 README |
| Google Play 注册费 US$25 | [Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en) | 搜索与网页全文核对成功；`.firecrawl/codex_android_store_20261008_google_play.json` |
| Google Play 新个人账号 12 人、连续 14 天封闭测试后申请正式发布 | [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en) | 搜索与网页全文核对成功；`.firecrawl/codex_android_store_20261008_google_play.json` |

补充搜索保留在同名前缀 JSON 中。华为费用检索没有得到足以确认费用的官方条款，不据此给出华为收费结论。软著费用的早期检索出现过时收费说法，最终以财政部停征清单为依据。项目资料只能证明文档所述功能与历史验收，不等同于本轮代码或商店合规审计。

## 验证与下一步

- 已确认正式结论对应上述官方条款或本地文档，咨询无需运行产品测试。
- 资料与交接规模远低于本聊天 200,000,000 字节自动清理阈值；其他聊天的历史生成量不计入本聊天。
- 待 Yves 选择后：逐项审查安卓上架缺口；核对首发商店的个人主体资格并编制材料与费用清单。
