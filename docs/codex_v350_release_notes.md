# 小懂哥 v3.5.0：公众号 Markdown 出稿与时间轴优化

本版把公众号出稿收敛为**可直接导入的 Markdown 单一通道**，修复此前旧导出按钮无法产出可用文件的问题，并优化稿件排版；同时收录三列滚轮日期录入、年份快捷跳转、归档／月报双口径切换与年度报告等时间轴改动。从 GitHub 的 v3.4.1 升级至 v3.5.0，包名与长期发布签名不变，可直接覆盖安装。

## 公众号出稿

- 删除全部无效旧导出：复制标题、复制排版正文、复制纯文字正文、导出稿件与配图包、导出 HTML 稿、导出横版封面、分享素材包。
- 只保留四条可用路径：「导出 Markdown 稿」（SAF 保存 `.md` 文件）、「分享 MD 文件」（系统分享，`text/plain`）、「复制 Markdown 全文」（剪贴板）、出稿页内「Markdown 全文」折叠框。后者不依赖任何系统组件，设备不支持文件选择器或分享时也能取到全文。
- 修复导出无文件的根因：原生导出插件此前只把 `text/html` 当 UTF-8 文本，其他文本 MIME 被误当 base64 处理并被 Android 拒绝；现改为按 `text/*` 判定，分享也支持自定义 MIME。
- 在公众号后台用「文档导入」上传 `.md`，或粘贴全文后点「转换格式」；标题栏需单独填写，可从全文第一行 H1 复制。配图位置在稿内以 `> 【配图位置】文件名` 标注，图片需在编辑器自行上传。

## 稿件排版

- 元信息按填写时逐项独立成段，段间用空行分隔，**不使用行尾双空格硬换行**（公众号导入器会吞掉硬换行）。
- 多维评分逐项列出：总评单独一行；制作、词、曲、人声、原创性、共鸣六个维度按每三项合成一行，行内用「 · 」分隔，例如 `制作：9/10 · 词：8/10 · 曲：8.5/10`。旧版词曲评分也一并导出。
- 三项日期全部统计并各自独立成段：专辑/歌曲发行时间、首次收听时间、乐评记录时间；格式统一 `YYYY.MM.DD`，未填显示「未填写」，与乐评详情页口径一致。
- 隐私开关「隐藏评分」会同时隐藏总评与所有维度；原「隐藏记录日期」改为「隐藏日期」，会同时隐藏三项日期。Markdown、纯文字与预览三种输出共用同一套元信息生成逻辑。
- 推文草稿仍只保存在本机，**不包含在乐评 JSON 备份中**，迁移时需另导出 Markdown 稿。详见[公众号出稿说明](https://github.com/Yvesyzy/xiaodongge/blob/v3.5.0/docs/codex_publication_guide_20261012.md)。

## 时间轴与日期录入

- 专辑/歌曲发行时间、首次收听时间、乐评记录时间改用年／月／日三列滚轮，弹层内输入四位年份可一步跳转，避免滚过上百个年份；保留「今天」「清除」「取消/确定」。
- 保留同名原生 `<input type="text">` 作为数据载体，FormData、命令式草稿恢复与既有自动化检查无需改动；完整乐评/追加记录用非受控值，速记/重听用受控值。
- 归档与月报支持切换日期口径，年度报告与前十五名统计沿用既有数据源。

## 安装与验证

版本 `3.5.0 (43)`，包名 `com.yves.musicarchive`，签名证书 SHA-256 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与 v3.4.1 及更早正式版相同。versionCode 由 42 递增至 43，属正常升级，可覆盖同签名较低版本，无需卸载。Android API 24+；直接保存相册使用 API 29+。

数据库初始化只使用 `CREATE TABLE IF NOT EXISTS` 与 `ALTER TABLE ADD COLUMN`；覆盖安装不清除既有档案、封面、草稿与分析结果，JSON v6 备份格式不变。仍建议升级前导出完整 JSON 备份。

- `typecheck:mobile`、共享单测 32/32、公众号模型 11/11、`publication:check`（14 项浏览器流程）、工程检查集 12/12、时间轴与日期滚轮自检全部通过。
- 干净重建：清空 `mobile/dist` 与 Android `assets/public` 后重新构建并同步；dist 与 staged 26/26 文件哈希一致，Gradle `assembleRelease` 通过。
- 包内 28 个 public 资源与 3 个平台资源与全新构建逐字节一致；`aapt2` 实测 `versionCode='43' versionName='3.5.0' targetSdkVersion='36'`。
- 导出样例由 `npm.cmd run publication:check` 生成到 `release/codex_publication_check_<时间戳>/`；发布目录不提交 Git，样例按需重新生成，不随安装包归档。

以上为构建机与浏览器合成数据验证；实体手机上的 Android 剪贴板接收、系统文件提供器、微信实际粘贴与图片上传，以及公众号后台导入后的最终样式，仍需用户在设备上验收。16KB 原生库对齐与 SDK 网络行为沿用 v3.4.1 的待验证范围。

## 下载与校验

[下载 APK](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.0/codex_xiaodongge-v3.5.0-43.apk) · [SHA-256 文件](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.0/codex_xiaodongge-v3.5.0-43.sha256.txt) · [GitHub Release](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.0)

APK 大小：75,773,694 字节。

APK SHA-256：`2c41eb4a461800983fd07a1dfc179f43c73844984ec60607d96319b89d5522e4`。
