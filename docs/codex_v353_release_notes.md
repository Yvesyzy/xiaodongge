# 小懂哥 v3.5.3：公众号稿评分结构统一、移除配图提醒

发布日期：2026-11-13。版本 `3.5.3 (46)`，包名 `com.yves.musicarchive`，Android API 24+，目标 SDK 36。

## 本次改动

- **六项评分固定输出**：公众号稿的评分段落不再取决于这条记录填了几项。制作、词、曲、人声、原创性、共鸣六项始终输出，未填写的维度写「未填写」，与三项日期的处理方式一致。此前记录缺项时该行会整体消失，导致不同记录的稿件结构不一致。
- **删除旧版词曲评分**：`ratingSongwriting` 是早期版本的兼容字段，之前被当成第七个维度导出，把六项挤成「3 + 3 + 1」三行，共鸣单独占一行。现在它不进入稿件，六项稳定排成两行三项。
- **删除「附上这一节的封面配图」**：出稿页不再有配图勾选，Markdown 不再生成 `> 【配图位置】…` 提醒块，纯文本与 HTML 输出也不再带配图占位；随之一并移除封面读取、PNG 转码与「横版封面与配图预览」。公众号编辑器里那个删不掉的提示框不会再出现。
- **旧草稿元信息重建**：恢复本机推文草稿时，专辑/歌曲/艺术家、评分、日期按当前乐评重新生成，只保留用户编辑过的章节标题与正文。旧版本保存的草稿缺少结构化元信息时，不会再退回「音乐 / 评分 / 日期」三行旧格式。
- **旧草稿兼容**：`coverDataUrl` 与 `includeImage` 仍被解析器接受，避免升级后草稿校验失败，但会在读取时丢弃，不参与任何输出。

导出后的评分段落形如：

```markdown
评分：8.5+ / 10

制作：9/10 · 词：8/10 · 曲：8.5/10

人声：9/10 · 原创性：8/10 · 共鸣：7.5/10

专辑/歌曲发行时间：2026.01.15

首次收听时间：2026.05.20

乐评记录时间：2026.06.02
```

## 下载与校验

- [v3.5.3 (46) APK](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.3/codex_xiaodongge-v3.5.3-46.apk) — 75,771,294 字节
- [SHA-256 校验文件](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.3/codex_xiaodongge-v3.5.3-46.apk.sha256.txt)

```
6c4120a3a27df4ccf2463c1d7ef6af2e3241d39a010b4bde9ea896ffceaddcbc  codex_xiaodongge-v3.5.3-46.apk
```

## 覆盖安装

`aapt2` 实测 `versionCode='46' versionName='3.5.3' targetSdkVersion='36'`，包名 `com.yves.musicarchive` 未变。签名证书 SHA-256 为 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与 v3.4.1、v3.5.0、v3.5.1、v3.5.2 一致；versionCode 由 45 递增至 46，**可直接覆盖安装，无需卸载**。

数据库初始化仍只使用 `CREATE TABLE IF NOT EXISTS` 与 `ALTER TABLE ADD COLUMN`，JSON v6 备份格式不变，既有档案、封面、乐评草稿与分析结果保留。仍建议升级前导出完整 JSON 备份；推文草稿不在 JSON 备份内，迁移时需另导出 Markdown 稿。

## 验证范围

- `typecheck:mobile` 通过；共享单测 **37/37**、公众号模型与打包单测 **13/13**；Vite 生产构建通过。
- `cap sync android` 完整通过（exit 0）；`assembleRelease` BUILD SUCCESSFUL（2m8s）。
- `codex_verify_apk_assets.mjs` 校验包内 **28 个 public 资源 + 3 个平台资源**与全新构建逐字节一致；`aapt2` 元数据与 v2 签名块证书摘要复核通过。
- 公众号浏览器 QA 覆盖：两行六项评分、无「旧版词曲」、无「配图位置」、无维度评分记录仍输出六个「未填写」槽位、旧草稿恢复后元信息重建、隐私开关、真实下载文件名与分享文件名。
- 工程检查集 11/11 通过（unit、unit-social、unit-publication、types-root、types-mobile、quality-gate、build-mobile、publication、native、storage、capture）。

## 已知限制

- 构建机与浏览器合成数据验证不能代替真机验收：Android 系统文件提供器、微信实际粘贴与公众号后台导入样式仍需设备确认。
- 公众号导入器对空段落与行内「 · 」的处理以实际后台为准；若某些版本把六项折行显示，属于编辑器样式差异，不影响文字内容。
- 16KB 原生库对齐与 SDK 网络行为沿用 v3.4.1 的待验证范围。

历史版本：[v3.5.2](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.2)、[v3.5.1](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.1)、[v3.5.0](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.0)、[v3.4.1](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.4.1)。
