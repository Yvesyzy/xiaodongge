# Codex v2.9 榜单拼贴与发布计划

已获 Yves 授权：采用 docs/designs/codex_rank_duo_preview.html 的 B 版，冠军460px；打包v2.9并提交本地Git、推送GitHub。

1. mobile/src/codex_yearbookPages.ts：复用 planJournalPages → planRankPages / renderJournalPage → drawRankPage。五张一组后倒序输出；青绿渐变、金色年份、白色粗体标题、五封面拼贴；冠军460px，右侧四张224px。其他组344/344/224/224/224；不足五张居中适配。
2. 字体随包离线提供：Noto Sans SC中文可变字体、Montserrat 900数字；附OFL授权和来源。planJournalPages及rank渲染等待字体加载，确保分页和绘制一致。继续保留正文完整数据，长理由在规划阶段限两行并明确加省略号；隐私四项不变。
3. 使用真实封面store.getCover，按原专辑与艺人匹配，不依赖仍有乐评；损坏或缺失图片画占位。scripts/codex_check_rank_poster.mjs验证1–15张、逆序分组、冠军大小、封面持久化及更换、缺失记录、隐私、长中英文/emoji、字体加载、边界、PNG和导出UI。旧abu榜单美术断言改为委托当前检查，避免遗留脚本持续断言旧版式。
4. 验证：TypeScript（根与mobile）、npm test、榜单检查、年度标签检查、分享回归；mobile构建与正式签名APK。版本字段以现有配置核对后同步，versionName 2.9、package 2.9.0，versionCode递增。包内资产与签名对照上一正式版。
5. docs/codex_v2.9_release.md、codex_status.txt记录结果；精确暂存任务文件，提交并推送main，v2.9标签及GitHub Release提供APK和SHA256。核实远端提交和发布附件。真实手机验收如无连接设备则如实标注。


## 已完成与验证证据

# 小懂哥 v2.9

## 本版变化

- 年度榜单采用确认的青绿鎏金 B 版拼贴，每页五张，15张依次展示11–15、6–10、1–5名。
- 第一名封面460px，右侧四张224px；其他完整分组两大三小。不足五张时自动适配。
- 粗重现代标题，开源字体离线随包，Android无需另装字体。
- 复用已保存的专辑封面；记录删除后仍读取已有封面，更换封面后重新导出会刷新。
- 长专辑名和理由有明确省略号，原始内容保留；四项隐私开关和PNG保存/分享继续可用。

## 安装与验证

- Android版本：2.9，versionCode 26，包名com.yves.musicarchive；沿用v2.8正式签名，可覆盖升级。
- 类型检查、32项基础测试、30页榜单边界场景、年度标签及分享回归通过。
- APK所有11个构建网页资源与当前mobile/dist逐字节一致，字体与授权文件随包。
- 尚未真机安装验收：当前ADB没有连接设备。
- APK：codex_xiaodongge-v2.9.apk，79,453,121字节。
- SHA-256：f8923da74bb59af85bf5c86fee582e6890f4327f8091ce28c5154247fa0968c0


## 实施说明与交接

- 正式实现：mobile/src/codex_yearbookPages.ts，导出提示mobile/src/codex_JournalExport.tsx；没有改动备份或数据库结构。
- 桌面预览的Arial Black以可分发的Montserrat 900数字子集替代，中文Noto Sans SC保持；两个字体在规划和绘制前显式加载。
- 字体来源和许可见mobile/public/codex_font_licenses.txt；Noto为本机开源原始字体转WOFF，Montserrat取自Google Fonts官方仓库，只有0–9数字子集。
- 回归脚本scripts/codex_check_rank_poster.mjs，原abu_check_rank_poster.mjs保留为入口转发，旧视觉断言已被新布局检查替代。
- npm test: 32/32。根tsc --noEmit通过；mobile独立检查补充--types vite/client,node（原配置包括shared测试但未声明node类型），通过。
- 构建脚本scripts/build-android-release.ps1版本守卫与输出名同步2.9；实际签名与release/xiaodongge-v2.8.0.apk对照相同。
- 包内验证：release/codex_v29_package_verification.json；构建日志release/codex_v29_build.log；样张release/codex_v29_rank_qa/。
- Git/发布：将代码、最终预览及本次设计过程提交main，推送origin；v2.9标签和Release使用同一提交。发布完成状态见codex_status.txt。
- 下一步：手机覆盖安装，检查现有专辑封面、三页榜单和系统保存/分享；当前未真机安装。
