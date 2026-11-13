# 小懂哥 v3.5.5：公众号稿元信息改为三段式

发布日期：2026-11-13。版本 `3.5.5 (48)`，包名 `com.yves.musicarchive`，Android API 24+，目标 SDK 36。

## 本次改动

- **元信息分三组**：基本信息（专辑／艺术家／歌曲）、评分（总分 + 两行维度）、日期（发行／首次收听／记录时间）。组内每行之间一个空行，组与组之间两个空行。
- **字段顺序调整**：基本信息固定按 专辑 → 艺术家 → 歌曲 排列，此前「歌曲」排在「艺术家」之前。
- Markdown、纯文本与页面内预览三处输出一致；HTML 片段按组包裹，粘贴后同样是组内一行、组间一段。空行是真实空行，不依赖公众号导入器不支持的行尾双空格。
- 本次不涉及数据库结构与 JSON v6 备份格式。

导出后的结构形如：

```markdown
# 南下南下

专辑：南下南下

艺术家：OuttaWave

歌曲：东北DNB/老马/一砖一瓦/Country Road


评分：7.1 / 10

制作：7.5/10 · 词：7.5/10 · 曲：7/10

人声：6/10 · 原创性：7/10 · 共鸣：7.5/10


专辑/歌曲发行时间：2026.03.28

首次收听时间：2026.03.31

乐评记录时间：2026.11.10
```

## 下载与校验

- [v3.5.5 (48) APK](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.5/codex_xiaodongge-v3.5.5-48.apk) — 75,771,394 字节
- [SHA-256 校验文件](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.5/codex_xiaodongge-v3.5.5-48.apk.sha256.txt)

```
88729a5b0ef10ffae19f9d4bdd69bc94668fbafa966bf92cae72c19f711a870e  codex_xiaodongge-v3.5.5-48.apk
```

## 覆盖安装

`aapt2` 实测 `versionCode='48' versionName='3.5.5' targetSdkVersion='36'`，包名 `com.yves.musicarchive` 未变。签名证书 SHA-256 为 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与 v3.4.1 至 v3.5.4 一致；versionCode 由 47 递增至 48，**可直接覆盖安装，无需卸载**。

数据库初始化仍只使用 `CREATE TABLE IF NOT EXISTS` 与 `ALTER TABLE ADD COLUMN`，JSON v6 备份格式不变，既有档案、封面、乐评草稿与分析结果保留。仍建议升级前导出完整 JSON 备份；推文草稿不在 JSON 备份内，迁移时需另导出 Markdown 稿。

## 验证范围

- 公众号模型单测 **11/11** 通过（含三段式分组与字段顺序断言）。
- `vite build` 与 `cap sync android` 通过；`assembleRelease` BUILD SUCCESSFUL。
- `codex_verify_apk_assets.mjs` 校验包内 **28 个 public 资源 + 3 个平台资源**与全新构建逐字节一致。
- 用 `apksig` 校验 APK 签名：`verified=true`，证书 SHA-256 与官方证书一致。
- 说明：本机缺少 PowerShell 7，发布脚本的门禁分支未执行；改用等价的手动链路（vite → cap sync → gradlew）+ 签名与资源双校验，结论以实测输出为准。

## 已知限制

- 构建机验证不能代替真机验收：Android 系统文件提供器、微信实际粘贴与公众号后台导入样式仍需设备确认。
- 公众号导入器对连续空段落的折叠行为以实际后台为准；若某次导入把两组间距压成一行，需要在后台微调段落样式。
- 16KB 原生库对齐与 SDK 网络行为沿用 v3.4.1 的待验证范围。

历史版本：[v3.5.4](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.4)、[v3.5.3](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.3)、[v3.5.2](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.2)、[v3.5.1](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.1)、[v3.5.0](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.0)。
