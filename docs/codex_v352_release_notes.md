# 小懂哥 v3.5.2：跨端合并导入与备份恢复修复

发布日期：2026-11-12。版本 `3.5.2 (45)`，包名 `com.yves.musicarchive`，Android API 24+，目标 SDK 36。

## 本次改动

- **修复备份恢复失败的缺陷**：`store.ts` 恢复预演的 `INSERT INTO ReviewEntry` 仍是 26 列，而新增 `releaseDate` 后 `entryValues()` 返回 27 个绑定值，导致导入任何非空 JSON 备份时报 `column index out of range`。现补齐 `releaseDate` 列与占位符，**电脑 → 手机**方向的备份导入恢复可用。此前手机 → 电脑方向正常（Windows 端已单独修复）。
- **合并导入**：备份与恢复页新增「合并导入（跨端迁移建议勾选）」。勾选后以两端并集为目标：正式记录、重听、封面按 id 合并，同 id 取 `updatedAt` 较新的一方；年度总结按年份、月度作品按 `年-月` 合并；本机未保存草稿优先保留。不勾选仍是整库覆盖。差异报告、隔离预演、恢复日志与撤销沿用原实现。
- **固定同步文件名**：导出 JSON 可勾选「跨端同步：使用固定文件名」，固定为 `xiaodongge-from-android.json`（电脑端为 `xiaodongge-from-windows.json`），放进云盘或文件传输助手时始终覆盖同一文件。
- **推文草稿明确提示**：公众号出稿页的推文草稿仍不在 JSON v6 备份内，备份页现在明确提示迁移前需单独导出 Markdown 稿。

合并逻辑在共享纯模块 `shared/backupMerge.ts`，与 Windows 端复用；`shared/backupMerge.test.ts` 覆盖两端各自新增、同 id 取新、年度/月度唯一键、草稿与封面规则。

## 下载与校验

- [v3.5.2 (45) APK](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.2/codex_xiaodongge-v3.5.2-45.apk) — 75,774,662 字节
- [SHA-256 校验文件](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.5.2/codex_xiaodongge-v3.5.2-45.apk.sha256.txt)

```
09a9c8b3b32d6b6612e49b5df48e4155aa3432cbfeb257e7486d87778913185b  codex_xiaodongge-v3.5.2-45.apk
```

## 覆盖安装

`aapt2` 实测 `versionCode='45' versionName='3.5.2' targetSdkVersion='36'`，包名 `com.yves.musicarchive` 未变。签名证书 SHA-256 为 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与 v3.4.1、v3.5.0、v3.5.1 及官方批准的发布签名一致；versionCode 由 44 递增至 45，**可直接覆盖安装，无需卸载**。

数据库初始化只使用 `CREATE TABLE IF NOT EXISTS` 与 `ALTER TABLE ADD COLUMN`，JSON v6 备份格式不变，既有档案、封面、乐评草稿与分析结果保留。仍建议升级前导出完整 JSON 备份；推文草稿不在 JSON 备份内，迁移时需另导出 Markdown 稿。

## 验证范围

- `typecheck:mobile` 通过；共享与模型单测 **37/37**；Vite 生产构建通过。
- `cap sync android` 完整通过；`assembleRelease` BUILD SUCCESSFUL（2m11s），`lintVitalRelease` 通过。
- `aapt2` 元数据与 v2 签名块证书摘要复核通过；`codex_verify_apk_assets.mjs` 校验包内 **28 个 public 资源 + 3 个平台资源**与全新构建逐字节一致。
- 正文排版、时间轴、日期滚轮、归档／月报双口径、年度报告与公众号 Markdown 出稿沿用 v3.5.1，未改动。

## 已知限制

- 未实现后台自动检测同步目录：Android 后台文件访问受限，需新增权限与原生通道；当前路径仍需手动导出／导入一次。
- 推文草稿未纳入 JSON 备份，本次选择明确提示而非扩展备份格式。
- 构建机与浏览器合成数据验证不能代替真机验收：Android 系统剪贴板、系统文件提供器、微信实际粘贴与公众号后台导入样式仍需设备确认；16KB 原生库对齐与 SDK 网络行为沿用 v3.4.1 的待验证范围。

历史版本：[v3.5.1](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.1)、[v3.5.0](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.5.0)、[v3.4.1](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.4.1)。
