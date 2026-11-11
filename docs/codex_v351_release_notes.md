# 小懂哥 v3.5.1 发布说明

发布日期：2026-11-11。版本 `3.5.1 (44)`，包名 `com.yves.musicarchive`，Android API 24+，目标 SDK 36。

## 本次改动

导出与分享的 Markdown 文件名不再固定为 `codex_publication_article.md`，改为按稿件主体命名，便于在下载目录和文件传输助手中辨认。

| 场景 | 文件名 |
| --- | --- |
| 单篇乐评，填了专辑名 | `专辑名.md` |
| 单篇乐评，专辑名为空、填了歌曲名 | `歌曲名.md` |
| 两者都为空，但有章节标题 | `章节标题.md` |
| 多篇合辑、年度榜单 | `推文标题.md`，例如 `2026 年度专辑榜单.md` |
| 所有候选都为空 | `公众号稿.md` |

- 「导出 Markdown 稿」与「分享 MD 文件」共用同一个命名函数，行为一致；「复制 Markdown 全文」与页面内全文折叠框没有文件名，不受影响。
- 文件名统一清洗 `\ / : * ? " < > |`、控制字符与首尾点号／空白，按码点截断至 60 字符，避免 Android 系统文件提供器拒绝保存或截断名称；同名字符清洗后不会生成空文件名。
- 命名取自稿件章节里的「专辑」「歌曲」元信息，与用户在出稿页修改的推文标题、章节标题相互独立；隐私开关不影响文件名。
- 正文排版沿用 v3.5.0：元信息逐项独立成段，六个评分维度每三项一行、行内用「 · 」分隔，三项日期（专辑/歌曲发行时间、首次收听时间、乐评记录时间）全部统计，缺失显示「未填写」。时间轴、日期滚轮、归档／月报双口径与年度报告不变。

## 下载与校验

- [v3.5.1 (44) APK](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.1/codex_xiaodongge-v3.5.1-44.apk) — 75,773,914 字节
- [SHA-256 校验文件](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.1/codex_xiaodongge-v3.5.1-44.sha256.txt)

```
acf4e3be626bd6ccf8a5f7c3511ecda358bb08fe67a33e886ed5db46d572e5a6  codex_xiaodongge-v3.5.1-44.apk
```

## 覆盖安装

签名证书 SHA-256 为 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与 v3.4.1、v3.5.0 及官方批准的发布签名一致；versionCode 由 43 递增至 44，属正常升级而非降级。**可直接覆盖安装，无需卸载**，既有档案、封面、乐评草稿与分析结果保留，JSON v6 备份格式不变。

数据库初始化只使用 `CREATE TABLE IF NOT EXISTS` 与 `ALTER TABLE ADD COLUMN`；`DELETE` 仅存在于用户主动删除条目或导入备份的业务路径，升级过程不执行。覆盖安装不清除 `/data/data/com.yves.musicarchive` 下的数据。仍建议升级前导出完整 JSON 备份；推文草稿不在 JSON 备份内，迁移时需另导出 Markdown 稿。

## 验证范围

- `typecheck:mobile` PASS；共享单测 32/32；公众号模型单测 13/13（新增 2 个命名用例，覆盖专辑优先、歌曲回退、多节回退、非法字符清洗、长度截断与空值兜底）。
- `publication:check` PASS：除正文内容外，还断言真实下载的 `suggestedFilename()` 与系统分享的文件名均为「恶意专辑.md」。
- 工程检查集 12/12 PASS（`unit`、`unit-social`、`unit-publication`、`types-root`、`types-mobile`、`quality-gate`、`build-mobile`、`publication`、`native`、`storage`、`capture`）；时间轴与日期滚轮自检 PASS。
- 干净重建：清空 `mobile/dist` 与 Android `assets/public` 后重新构建并同步；dist 与 staged 26/26 文件哈希一致，Gradle `assembleRelease` BUILD SUCCESSFUL。
- 包内 28 个 public 资源与 3 个平台资源与全新构建逐字节一致；`aapt2` 实测 `versionCode='44' versionName='3.5.1' targetSdkVersion='36'`。

## 已知限制

`cap sync` 尾部的插件临时目录清理在本机构建环境被安全删除组件拦截（copy 阶段成功，Gradle 插件配置未变），逐文件比对已确认等价，非代码错误。

构建机与浏览器合成数据的验证不能代替真机验收：Android 系统剪贴板接收、系统文件提供器、微信实际粘贴与图片上传、公众号后台导入后的最终样式，仍需用户在设备上确认；16KB 原生库对齐与 SDK 网络行为沿用 v3.4.1 的待验证范围。

历史版本：[v3.5.0](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.0)、[v3.4.1](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.4.1)、[v3.2.0](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.2.0)。
