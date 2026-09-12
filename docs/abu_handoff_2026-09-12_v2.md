# 小懂哥 · wb 交接文档（v2）

日期：2026-09-12（第二班，接 abu 早班）
作者：wb（WorkBuddy）
接手对象：Codex / cc / Yves
前序文档：`docs/abu_handoff_2026-09-12.md`（早班，深色主题 + 无障碍 + test.3，背景与旧坑都在那边，本文不重复）

---

## 0. 一句话现状

真机反馈的两处 P0 UI 问题已修复并迭代两轮，**v2.7.5（versionCode 24）已打包、真机验收通过（Yves 确认）**。
分支 `abu-neumorphism-v2`，HEAD `d261cb8`；main `a4d505f` 全程未动、未 push。`release/` 已清理至 40MB（仅当前产物）。

---

## 1. 产物

| 项 | 值 |
|---|---|
| APK | `release/abu_xiaodongge-v2.7.5.apk`（67,954,713 bytes） |
| 校验 | `release/abu_xiaodongge-v2.7.5.sha256.txt` |
| 版本 | versionCode 24 / versionName 2.7.5 |
| 证书 SHA256 | `6386734e…488f1022`（与历史一致，覆盖安装 23→24 数据不丢） |
| 包内验证 | versionName/Code 已核；JS 含 `2.7.5` + `latestRating`；CSS 含 110px 封面列；4 个资源与 `mobile/dist` 逐文件 SHA256 一致 |
| 构建日志 | `release/abu_gradle_v275_log.txt`、`release/abu_cap_sync_test4.log` |

GitHub Release（`v2.7.5`）附件沿用历史命名：`xiaodongge-v2.7.5.apk` / `xiaodongge-v2.7.5.sha256.txt`，与 `release/` 本地文件的 `abu_` 前缀名内容相同。

---

## 2. wb 班提交清单（全部在 abu-neumorphism-v2）

| 提交 | 内容 |
|---|---|
| `706a16c` | 封面 82→110px（scoped 到 `.cover-row`，全局 `.cover-art` 未动）；「外观」区块移进 `.card-list` |
| `68ffe71` | test.4 打包：版本 bump + **`android/abu_init_mirror.gradle` 镜像注入脚本（新坑修复，见 §4.1）** |
| `3c31752` | 交接文档更新（标记两处 P0 完成） |
| `dfb7c7d` | 第二轮真机反馈：封面在卡片内垂直居中（`align-items: center`）；列表信息精简为四行，新增聚合字段 `averageRating` |
| `6b48051` | 评分按 Yves 要求改为**最新一次评分**：字段改名 `latestRating`，直接取 `latest.rating`，平均分 helper 删除 |
| `d261cb8` | **v2.7.5 正式版打包**（版本号脱离 test 系列，按 Yves 指示定 2.7.5） |

---

## 3. UI 现状（专辑/歌曲列表页，`.cover-row`）

```
┌─ 卡片（padding 18px, radius 18px）──────────┐
│ ┌────────┐  标题（专辑名/歌曲名）          │
│ │ 封面    │  歌手（无则"未填写艺术家"）      │
│ │ 110×110 │  记录于 YYYY-MM-DD（最近一条）   │
│ │ 垂直居中 │  我的评分：7.5（最新一条，无则"未评分"）│
│ └────────┘                                  │
└─────────────────────────────────────────────┘
```

- 网格：`grid-template-columns: 110px minmax(0,1fr); align-items: center`（封面 110px 列，两列垂直居中）
- 封面规则是 **`.cover-row .cover-art { width:100%; border-radius:12px }` 作用域内**的——首页缩略图（56px）、详情页、阅读页各自的全局 `.cover-art` 尺寸未受影响
- 已删字段：`aggregate.summary`（摘要）连同 `excerpt` import 一起移除；`所属专辑`、`年份/记录数` 两行不再渲染（`years`/`recordCount` 字段还在类型里，未删）
- **注意**：`YearStats.averageRating`（types.ts:137 / store.ts:885）是年度统计的既有字段，与本轮聚合无关，未动

---

## 4. 构建必读（新坑，下次打包直接照抄）

### 4.1 Gradle 必须带镜像 init 脚本

```bash
cd android && JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot" \
  ./gradlew -I abu_init_mirror.gradle assembleRelease --console=plain
```

**根因**：capacitor 各插件模块（`@capacitor/android`、`capacitor-cordova-android-plugins`、`@capacitor-community/sqlite`…）各自 buildscript 声明 `google()` 优先的仓库，**不继承** `android/build.gradle` 里的 aliyun 镜像；本机直连 dl.google.com 超时（每次白等 5 分钟 socket timeout 才失败）。
`abu_init_mirror.gradle` 给所有模块的 buildscript + project 仓库注入 aliyun 优先镜像。另需 `android/local.properties`（`sdk.dir=C:/Users/lenovo/AppData/Local/Android/Sdk`，已建好，gitignored）。

### 4.2 cap sync 必须分步

```bash
node_modules/@capacitor/cli/bin/capacitor copy android     # ~0.6s
node_modules/@capacitor/cli/bin/capacitor update android   # 可能 60s+
```

一条龙 `cap sync android` 在本环境会被 SIGTERM 掐死在 update 阶段，留下半成品（缺 `capacitor-cordova-android-plugins/cordova.variables.gradle`）导致 Gradle 配置失败。分步跑完用 assets 哈希比对确认同步完整。

### 4.3 其余环境坑（继承早班，仍有效）

- bash 先 `export PATH="/usr/bin:/bin:$PATH"`；bash 里不要调 powershell；reg.exe 被黑名单
- 本应用是 **HashRouter**：Playwright 直达页面用 `/#/albums` 而非 `/albums`，否则静默渲染首页
- curl `-w` 写 /dev/null 在此环境 exit 23，别放在 `&&` 链里当连通性检查
- QA 截图脚本：`node scripts/abu_screenshot_fixes.mjs http://127.0.0.1:5184`（两主题、带尺寸断言）
- dev server：`node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5184 --strictPort --config mobile/vite.config.ts`

---

## 5. 验证记录（v2.7.5 打包前全绿）

- `tsc --noEmit` 通过
- `scripts/codex_check_neumorphism.mjs` PASS（结构回归含专辑卡 padding 断言）
- `scripts/abu_a11y_check.mjs` 浅色 + 深色各十页面 0 contrast failures
- 双主题截图目检（封面居中、四行信息、无正文摘要）

---

## 6. release/ 清理记录（Yves 两轮确认后执行，均走回收站）

- 删除：v2.6.1 / v2.6.2 / v2.7.0 / test.1 / test.2 / test.3 / test.4 七个旧 APK 及校验文件；`codex_archive_2026-09-08`（334MB）；`codex_android_test_avd`（3.5GB 模拟器）；19 个 QA/工作目录 + ~35 个旧脚本日志
- **保留**（有意为之，别当垃圾清）：`codex_worktrees/`（git worktree，删会坏 git 状态）；`codex_recovered_*.json`、`codex_JournalExport.txt`（09-06 数据恢复产物，可能唯一副本）；`codex_SIGNING_RECOVERY.md` + 2 个签名 json（签名链救命文档）；v2.7.5 产物及其日志

---

## 7. 未决事项（按优先级）

1. **底栏悬浮遮挡列表最后一条**（早班遗留，未动，需定方向）
2. `scripts/build-android-release.ps1` 仍未修（stderr 中断问题）；修时记得把 `-I abu_init_mirror.gradle` 写进去，或直接废弃改 bash 脚本
3. `codex_worktrees/` + `.git/packed-refs` 旧值：git 异常根因待 Codex 复核（见早班文档 §6.4）
4. `index-*.js` 606KB 超 Vite 500KB 阈值（既有提示，未处理）
5. 签名仅 v2，不支持密钥轮换（当前无影响）
6. QA 截图目录已清空，`release/abu_ui_fix_qa/` 等由脚本按需再生

---

## 8. 下一步建议

1. v2.7.5 已真机验收，可考虑合回 main（需 Yves 决定时机与方式）
2. 若继续调 UI：先跑 `abu_a11y_check.mjs` 拿数据，改完**务必自己截图看一眼**（早班教训：数字全绿但观感是错的）
3. 构建脚本二选一：修 ps1 或换成 bash 版，别让下次打包再踩 §4 的坑

---

## 9. 事故记录：.git 对象被环境清扫 + 回收站全量恢复（2026-09-12 晚，wb）

**现象**：合并回 main 时进程被 SIGTERM，随后发现 `.git/refs/heads/` 整目录消失、当天全部 loose objects（abu 后半班 5c520b6..0601578 + wb 全部 706a16c..8a1e9ad）不存在——对象库只剩 00:15 的旧 pack（f24a47a，1121 对象）。工作区停在 main + 半截合并（143 个删除已应用、内容更新未应用）。

**根因判断**：与早班 §6.4 的「.git 内新建文件/目录被回收」同源，但波及面大得多——今天所有新建 loose objects 与 loose refs 被一次性清扫。非 git gc（无新 pack 产生，仅删除）。清扫者在会话期间仍活跃（objects/8a/ 目录 mtime 在恢复过程中仍在更新）。**根因未明，建议 Codex 重点复核**（怀疑方向：环境的安全沙箱对"未登记进程写入"的回滚/清理）。

**恢复过程**（供复现）：
1. 被清扫文件**全部进了 D 盘回收站**（解析 `$RECYCLE.BIN\S-1-...\$I*` 索引可按原始路径定位，`$I`→`$R` 同后缀配对）。
2. 关键发现：回收站里有 `pack-9a0da9a01b421160f8d44ad021c7ee5d88c992a1.pack`（含全部丢失对象，连带 idx/rev/mtimes）——清扫前有过一次打包。
3. Python 脚本遍历 `$I` 文件还原原始路径下的对象/refs/logs（跳过 `*.lock` 与 `multi-pack-index`），删除过期的 multi-pack-index 后 `git fsck --full` 通过。
4. `git update-ref` 重建 main/abu-neumorphism-v2 → reset --hard → 重做 `--no-ff` 合并（7c2261e）→ 推送。

**环境教训（重要）**：
- 本环境 bash 工具会把脚本源码里的反斜杠改写成 `//`（`D://codex` 进到 python 后变 `D://codex`）——路径字面量必须用 `chr(92)` 运行时拼接，否则静默匹配失败。
- python 的 `os.path.join` 产物在该沙箱同样可能被改写成混合斜杠，路径比较一律运行时构造。
- git 全局代理指向 127.0.0.1:7993（已失效），推送需 `-c http.proxy=<环境变量里的可用代理>`。
- 防复发建议：重要班次结束时 `git bundle create` 一份离线备份；本仓库的 .git 可疑清扫机制在根因查明前，每次打包/合并后校验 `git cat-file -e <HEAD>`。
