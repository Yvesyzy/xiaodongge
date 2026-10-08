# 2026-09-28 release 目录清理交接

## 结果

- 按 Yves 列出的清单删除 release 下全部 62 个目录；清理前共 6,110 个普通文件、13,708,131,358 字节，不含共享 Junction 指向的数据。
- release 根目录仍有原来的 28 个文件，逐个核对大小和 SHA-256 未变化；正式 `codex_xiaodongge-v3.0.1.apk` 与校验文件保留。签名恢复说明、签名快照和备份文件也未动。
- 删除 28 个目录内 Junction 链接项，没有删除链接指向的主项目 `node_modules` 和 Cordova 插件；主 `node_modules` 仍有 226 个顶层项目。
- 唯一的 NP1 模拟器、网易云播放测试材料、历史 APK、截图和其他验收目录都在已授权清理范围内，现已删除。需要再跑模拟器测试时，需重新创建模拟器。

## Git 工作树

- 清理前 5 个非 main 工作树都有未提交改动，虽然各自 HEAD 提交均已在 main 历史中。为避免丢掉目录内的改动，先分别存入 Git stash，再移除工作树；这些改动没有合并进 main。
- stash 对应关系：
  - `codex_t06_backup_tests_20260923`：`2514a0781676c2e0c07cac3e6d712926172e12e9`
  - `codex_t06_drafts_20260923`：`4b57524f56d3802d5593b6189a83a23fca266549`
  - `capture`：`1f8c15d0fdf4940ec5736c47f2218ecf8d05ff73`
  - `data`：`2e6a7617f29a9502c94f0326499dce271ff105ee`
  - `native`：`e4c1c5be6bf0b98986b1b75140b067e3e4180dbe`
- 4 个已合并的本地 `codex/v29-p1*` 分支已删除；本地只剩 `main` 分支和 main 工作树。GitHub 远端分支未修改。

## 验证

- 62/62 指定目录均不存在，release 下目录数为 0。
- 28/28 release 根文件仍存在且 SHA-256 未变。
- Git 工作树只有 main；本地分支只有 main。
- 主项目 node_modules 和 Cordova 插件目标仍存在。
- 未修改 main 应用源码。
