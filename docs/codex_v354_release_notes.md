# 小懂哥 v3.5.4：公众号稿单篇标题去重

发布日期：2026-11-13。版本 `3.5.4 (47)`，包名 `com.yves.musicarchive`，Android API 24+，目标 SDK 36。

## 本次改动

- **单篇稿件不再出现两遍标题**：单篇乐评的章节标题默认与推文标题相同，此前导出会同时生成 `# 推文标题` 和 `## 同名章节标题`，导入公众号后顶部居中标题下面又出现一次同名小标题。现在两处名称相同时省略章节标题，只保留顶部 H1；改了章节标题、或一篇里排了多节时，章节标题照常保留。
- 该规则同时作用于导出的 Markdown、纯文本与页面内预览，三者保持一致。
- 其余结构沿用 v3.5.3：六项评分固定输出（缺项写「未填写」）、不含旧版词曲、不含配图位置提醒块。

导出后的结构形如：

```markdown
# 商业与玩法

专辑：商业与玩法

歌曲：cut：我真的还想再活500年/高雅且隐晦/太古飞/机会到了我门出/活在阳光下

艺术家：卡力老虎/周乘羽

评分：8.3 / 10

制作：9/10 · 词：9/10 · 曲：7.5/10

人声：7.5/10 · 原创性：8/10 · 共鸣：8.5/10

专辑/歌曲发行时间：2026.09.26

首次收听时间：2026.09.26

乐评记录时间：2026.09.30
```

## 下载与校验

- [v3.5.4 (47) APK](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.4/codex_xiaodongge-v3.5.4-47.apk) — 75,771,306 字节
- [SHA-256 校验文件](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.4/codex_xiaodongge-v3.5.4-47.apk.sha256.txt)

```
b784937e7aebb4a08cce39bebffb153e7d83ebb0db2d8165dd54d083c45a7f3b  codex_xiaodongge-v3.5.4-47.apk
```

## 覆盖安装

`aapt2` 实测 `versionCode='47' versionName='3.5.4' targetSdkVersion='36'`，包名 `com.yves.musicarchive` 未变。签名证书 SHA-256 为 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与 v3.4.1、v3.5.0 至 v3.5.3 一致；versionCode 由 46 递增至 47，**可直接覆盖安装，无需卸载**。

数据库初始化仍只使用 `CREATE TABLE IF NOT EXISTS` 与 `ALTER TABLE ADD COLUMN`，JSON v6 备份格式不变，既有档案、封面、乐评草稿与分析结果保留。仍建议升级前导出完整 JSON 备份；推文草稿不在 JSON 备份内，迁移时需另导出 Markdown 稿。

## 验证范围

- `typecheck:mobile` 通过；公众号模型与打包单测 **14/14**（新增标题去重用例）；Vite 生产构建通过。
- `cap sync android` 完整通过（exit 0）；`assembleRelease` BUILD SUCCESSFUL（1m38s）。
- `codex_verify_apk_assets.mjs` 校验包内 **28 个 public 资源 + 3 个平台资源**与全新构建逐字节一致；`aapt2` 元数据与 v2 签名块证书摘要复核通过。
- 公众号浏览器 QA 新增断言：单篇默认状态预览只有一个标题；标题与章节名不同时章节标题照常输出。

## 已知限制

- 构建机与浏览器合成数据验证不能代替真机验收：Android 系统文件提供器、微信实际粘贴与公众号后台导入样式仍需设备确认。
- 公众号导入器对空段落与行内「 · 」的处理以实际后台为准。
- 16KB 原生库对齐与 SDK 网络行为沿用 v3.4.1 的待验证范围。

历史版本：[v3.5.3](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.3)、[v3.5.2](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.2)、[v3.5.1](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.1)、[v3.5.0](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.0)、[v3.4.1](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.4.1)。
