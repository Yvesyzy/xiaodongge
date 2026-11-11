# 小懂哥全目录冗余与脚本精简审查

后续执行：Yves 已批准全部三项并要求只保留最新 3.2.0 APK。清理及脚本整合已完成，旧 APK 与本轮临时盘点文件已删除，构建基准改为 3.2.0；最新结果见 `docs/session-summaries/codex_session_summary_2026-10-10_cleanup_refactor.md`。下文保留审查时的库存、条件和审批状态，不作为执行后的现存文件清单。

审查对象：`D:\codex\workspaces\codex\小懂哥`。日期：2026-10-10（Asia/Shanghai）。本轮仅列候选，没有删除、移动原有项目文件，也没有修改业务代码、依赖、Git 历史或发布状态。

## 主要结论

1. 优先清理可再生的测试缓存与构建输出，候选合计 **1,031,489,401 字节，约 1.03 GB**，共 4,694 个普通文件。此数字不包含旧交付 APK、Git 内部文件、用户数据或依赖安装目录，也没有重复计入构建 APK。
2. Git 另外报告 **18 个垃圾对象临时文件，366,632,960 字节**。完整 `fsck` 发现历史 reflog 错误，这部分应单独维护，不与普通缓存一起删除。
3. 源码可优先精简：无调用的 `QuickMemoryCardPanel` / `buildQuickMemoryCard`、仅服务该旧组件的 Filesystem 依赖、未发现调用的 Three.js 依赖，以及两个 Android 默认示例测试。
4. 脚本可优先整合：浏览器/Vite 生命周期、Android ADB/CDP 连接、debug/release 环境准备；再迁移旧无障碍扫描的独有断言，退役历史专用脚本。
5. 3.1.3 APK 仍是构建脚本的强制验签基准；3.1.5 是现存的用户验收基线；3.2.0 是正式交付包。三个包及对应记录先保留。

以上是后续执行清单，不是删除结果。执行前仍需确认相关构建/测试已结束、关键成果完整，并按准确路径处理。

## 审查方法与范围

- 先读协作规则、现有状态与最近发布/清理交接；检查当前本地 Git 状态，保留既有未提交改动。
- 枚举了原有项目 **34,299 个普通文件，3,732,662,677 字节**；这是逻辑文件长度，不代表磁盘实际分配空间。原始扫描另包含本轮刚创建的一个 5,535 字节盘点脚本，已从上述项目基线扣除。
- 未跟随 4 个 junction；其目标均经 PowerShell 核实为现存的项目根 `node_modules`。未将目标目录重复统计。
- 对适合比较的同尺寸文件进行了 SHA-256 核对：读取 4,813 个文件、728,051,434 字节，发现 683 组相同内容。依赖内部、`.git`、`.gradle`、数据库、环境文件和签名密钥不参加这轮内容去重。内容相同不等于可以删除。
- 阅读项目脚本、生产入口、导入关系和文档引用；子审查结果由主审查复核后纳入本报告。依赖内部实现和独立 Windows 仓库没有作源码审查。
- 没有运行应用构建、功能测试、ADB、推送或发布脚本，没有访问远端仓库。本文引用的 GitHub 发布状态仅作为历史交接背景，未重新在线验证。
- 文件枚举没有读取错误；Git 完整性检查的实际失败见下文，不计作通过。

机器可读数据：[codex_workspace_audit_inventory_20261010.json](D:/codex/workspaces/codex/小懂哥/docs/codex_workspace_audit_inventory_20261010.json)。其中保存准确候选目录、逐项大小、APK 摘要、旧设计文件、Git 临时对象和检查结果。

| 原有范围 | 普通文件数 | 字节数 | 判断 |
| --- | ---: | ---: | --- |
| `node_modules` | 27,417 | 1,319,554,533 | 当前依赖；按清单卸载冗余依赖，不直接删整个目录 |
| `release` | 3,068 | 1,085,103,043 | 同时含交付物、独有证据、重复构建与测试缓存，不能整目录删除 |
| `.git` | 331 | 688,699,203 | 其中有 366.63 MB 临时垃圾；仓库本体保留 |
| `android` | 2,801 | 447,209,366 | 大部分是生成目录，原生源码/配置/资源保留 |
| `codex_video` | 153 | 72,701,319 | 最终影片、素材、源码与必要验收仍有用途 |
| 根目录视频 ZIP | 1 | 60,670,232 | 最终完整交付包，保留 |
| `mobile` | 93 | 28,630,107 | 源码/字体/原型与 `dist` 应分别判断 |
| `docs` | 159 | 20,782,158 | 主要体积在设计图和截图；会话摘要本身仅约 0.30 MB |
| `.firecrawl` | 130 | 7,920,583 | 已抓取资料；先保留独有来源和证据 |
| `scripts` | 60 | 575,206 | 体积小，精简重点是减少重复维护 |

## A. 优先清理的可再生产物

| 编号 | 候选范围 | 字节数 | 核实依据及保留要求 |
| --- | --- | ---: | --- |
| A1 | `release` 中已核实的 51 个缓存/构建目录 | **575,937,030** | 包括 4 个隔离 Next `.next`（381,063,730 字节）、6 个 `mobile-dist`（51,944,026 字节）及 Vite/guard cache（142,929,274 字节）。准确目录见 JSON 的 `release_cache_directories`；保留结果 JSON、关键截图与签名交付物 |
| A2 | `android/app/build` | **423,795,141** | Gradle 中间产物、测试包、编译结果和重复原生库；正式 APK 已复制到受保护交付目录。构建目录内的 `app-release.apk` 与正式 3.2.0 包 SHA-256 相同 |
| A3 | `android/.gradle`、`android/capacitor-cordova-android-plugins/build`、`android/build` | **14,287,633** | 分别 9,949,634 / 4,204,714 / 133,285 字节；清理生成子目录，保留 Gradle wrapper、插件源码/配置和 SDK 本机配置 |
| A4 | `mobile/dist`、`android/app/src/main/assets/public` | **17,319,718** | 各 8,659,859 字节；现行 release 脚本先清理，再 `mobile:build`、`android:sync` 重建。清理后若直接运行 Gradle，须先重新构建/同步网页资源 |
| A5 | `tsconfig.tsbuildinfo` | **149,879** | `tsconfig.json` 启用增量编译，且该文件已忽略；可重新生成 |
| 合计 | 不重叠的上述候选 | **1,031,489,401** | 尚未实际释放空间 |

几个准确示例：

- `release/codex_v320_release_20261010/checks/legacy-web/app/.next`
- `release/codex_cover_signed_20261010/checks/legacy-web/app/.next`
- `release/codex_zhuoyitong_delivery_20261009/checks/legacy-web/app/.next`
- `release/codex_zhuoyitong_signed_final_20261009/checks/legacy-web/app/.next`
- `release/codex_capture_vite_cache`

`scripts/codex_check_legacy_web.mjs:15-37` 明确复制普通源码、链接共享依赖并生成合成数据库；`scripts/codex_verify_project.mjs:78-101` 创建 Vite cache 与隔离 `mobile-dist`；`scripts/codex_check_regression_guards.mjs:24` 创建 guard cache。这些路径的用途已从生成代码核实，未仅凭目录名认定。

`scripts/build-android-release.ps1:124-147` 明确执行网页重建、Capacitor 同步和 APK 资源验证，因此 A4 有现成重建路径。删除前应确认相关进程已退出；本轮没有检查进程占用，也未执行清理。

可随后进一步精简隔离测试目录中的源码副本、合成 `codex_legacy_fixture.db` 和重复日志；先集中必要结果，再删除副本。四个 `legacy-web/app/node_modules` 是 junction，不是四份依赖副本；处理整个隔离 app 目录时不能沿链接删除根依赖。

三个残留的一次性清理脚本可列为低收益退役候选，合计 23,609 字节：

- `release/codex_harmony_signed_final_20261009/codex_cleanup.ps1`：8,786 字节。
- `release/codex_privacy_signed_20261008/codex_cleanup_20261009.ps1`：9,905 字节。
- `release/codex_windows_album_acceptance_20261007/codex_cleanup_execute.ps1`：4,918 字节。

它们是旧清理动作的脚本残留，不建议重新运行；当前构建基准与成果路径已变化。相关历史审批拒绝/清理结果记录保留。本轮没有重试历史被拒绝的删除。

## B. 需要条件判断的删除/归档候选

### B1. Git 内部临时对象：366.63 MB，单独处理

`git count-objects -v` 返回 `garbage: 18`、`size-garbage: 358040`（KiB），与文件枚举的 **366,632,960 字节**一致。对象位于 `.git/objects/04/` 和 `.git/objects/93/`，文件名为已列明的 `tmp_obj_*`。完整准确清单在 JSON 的 `git_temporary_objects`。

只读检查结果：

- `git fsck --full --no-dangling`：退出 1，报告 10 条无效 reflog 引用，涉及 3 个历史对象 ID；不能说完整检查通过。
- `git fsck --full --no-reflogs --no-dangling`：退出 0；该次检查没有报告当前引用/对象完整性错误，未覆盖 reflog 的恢复价值。

建议后续先保留恢复所需引用信息、确认没有 Git 写入操作，再制定单独的临时对象/reflog 维护方案。原因尚未定位；本轮没有运行 `gc`、`prune`、reflog expire 或改动 `.git`。这 366.63 MB 不计入 A 类的 1.03 GB。

### B2. 旧测试 APK：约 227.37 MB，先确认回滚需求

| 文件 | 字节数 | 建议 |
| --- | ---: | --- |
| `release/codex_privacy_signed_20261008/codex_xiaodongge-v3.1.2-32-test.apk` | 75,783,913 | 当前构建脚本未使用，可在不再需要该版回滚/复核时删除；保留独有隐私整改证据 |
| `release/codex_zhuoyitong_signed_final_20261009/codex_xiaodongge-v3.1.4-34-test.apk` | 75,794,780 | 较早候选包，优先考虑退役 |
| `release/codex_zhuoyitong_delivery_20261009/codex_xiaodongge-v3.1.4-34-test.apk` | 75,794,788 | 后续实际交付版本；是否保留取决于回滚/兼容比较需求 |

两份 3.1.4 APK **大小和摘要不同**，不能作为“完全相同的副本”直接择一删除。单独删除旧包时对应旧 SHA 文件可一起退役；整个版本目录中的独有报告不能顺带删除。

继续保留以下三份：

| 用途 | 文件 | 当前核实 SHA-256 |
| --- | --- | --- |
| 现行发布脚本强制基准 | `release/codex_harmony_signed_final_20261009/codex_xiaodongge-v3.1.3-33-test.apk` | `009201a437e47cd92da580c369911bf896fba7c0818f61d40fa875394db99fc1` |
| 系统播放封面用户验收基线 | `release/codex_cover_signed_20261010/codex_xiaodongge-v3.1.5-35-test.apk` | `261a0106565dbd83c1d177667694f01fd4fb5de00eb7c11197ee25a28a650302` |
| 当前正式交付包 | `release/codex_v320_release_20261010/codex_xiaodongge-v3.2.0-36.apk` | `6ba2da51083118f72d4d7c0d11831aaf2c405ba84c4368eface556bd8d98195f` |

3.1.3 的路径与固定摘要直接出现在 `scripts/build-android-release.ps1:11-16`；删除会让后续 release 构建在预检查阶段失败。

### B3. 旧视觉材料与抓取资料：归档收益有限

- `docs/designs` 中 collector / edition / lapis / jade / letterpress 五组，共 **21 文件、6,659,015 字节**，可在不再重跑旧设计时与对应检查一起归档。机器清单保存全部准确文件名。保留已选 B 版的 duo 预览、必要样张和选择依据。历史文档明确“之前所有预览保留”，故本轮不据替代关系自行删除。
- `docs/shots`：14 张旧验收截图、3,863,483 字节。保留能说明独有验收结论的最小集合后，才考虑删除过程截图；未证明全部截图没有用途。
- `.firecrawl`：130 文件、7,920,583 字节。部分是上架/隐私/兼容性来源，先保留准确引用与独有证据，再处理重复抓取和原始页面。不是整目录无条件删除项。
- `docs/session-summaries`：67 文件合计仅 295,800 字节。主要问题是当前状态难查，不是磁盘占用；建议做索引/归档标记，保留历史结论，不为当前删文件而改写过去的验收数字。
- `codex_status.txt` 已达 119,774 字节，可后续改为简短当前状态并将历史流水集中到会话摘要。须先保留全部独有交接内容。本轮只追加自己的审查交接，不替换既有历史。

### B4. 视频交付 ZIP 与松散工程：有重复，但均有用途

最终 ZIP 为 60,670,232 字节，SHA-256 与既有校验文件一致：`fb6b68808bfc0f3d04e2bc3c4ac41968508298d05d677f2f8220a3e0980c5756`。

本轮直接读取 ZIP、未解压：包内 116 个文件，其中 111 个 `codex_video` 文件与当前松散文件 SHA-256 相同，合计 63,504,256 字节；另外两份本地清理结果 JSON 与冻结包不同。因此不能宣称 ZIP 和当前工程完全相同。ZIP 用于完整交付，松散源码/素材用于维护，两支 MP4/MP3 用于直接播放；继续保留。`codex_video/qa` 的 9.60 MB 主要是已缩减保留的联系表与验收记录，也不列为整目录删除项。

## C. 源码与依赖的具体精简候选

| 优先级 | 候选 | 已核实证据 | 精简方式与验证要求 |
| --- | --- | --- | --- |
| 高 | `three`、`@types/three` | `package.json:33,41`；生产源码、检查脚本和视频代码中未发现导入/动态加载，匹配项主要为清单或自然语言 | 按依赖清单卸载并同步锁文件，运行既有根/mobile 类型检查和受影响构建。当前安装目录合计 25,003,682 字节，不等于可承诺的 APK 缩减量 |
| 高 | `mobile/src/QuickMemoryCardPanel.tsx` 与 `shareCard.ts` 的 `buildQuickMemoryCard` | 全仓检查未发现组件调用；`buildQuickMemoryCard` 仅由该组件调用。旧团队审计 `docs/codex_v2.9_team_audit_2026-09-16.md:67` 也记录无调用方 | 删除旧组件及专用构造函数，保留 `shareCard.ts` 中重听卡、Blob 转换、下载和公共渲染函数 |
| 高 | `@capacitor/filesystem` | 唯一源码导入/调用位于旧组件 `QuickMemoryCardPanel.tsx:3,26`，但当前原生注册仍包含该插件 | 在旧组件删除后移除依赖，重新 Capacitor sync；保留新 `NativeExport` 路径。当前安装目录 9,011,133 字节，包含安装后的构建内容；需用重建后的 APK 复核实际注册、权限与隐私声明 |
| 高 | 两个 Android 默认 Example 测试 | `ExampleUnitTest.java:16` 仅检查 `2 + 2`；`ExampleInstrumentedTest.java:24` 断言 `com.getcapacitor.app`，与实际包名 `com.yves.musicarchive` 不同 | 删除模板测试；若仍需包名 smoke 检查，可改为有效检查。保留所有项目原生功能测试，重跑 JUnit/受影响 instrumentation；当前统计随实际结果更新，历史报告保持当时事实 |
| 低 | `mobile/src/exportFormats.ts:139-145` 日期拼接 | 与 `mobile/src/format.ts:33-38` 的 `localDateOf` 重复 | 复用本地日期 helper，同时保留导出函数的空值返回空串、非法日期返回原值的行为；不要改成 UTC 截断 |
| 低 | 三处图片导出传输分支 | `codex_ReviewShare.tsx:113-155`、`codex_YearbookExport.tsx:57-107`、`codex_JournalExport.tsx:120-187` | 只抽取重复的传输部分；保留分页/部分成功、相册回执、取消重试、Web Share 用户激活与 32 MB 上限，不合并业务状态机 |

两个默认测试的准确路径：

- `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`
- `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java`

Windows 相关依赖另列为条件项：README 已说明后续维护迁入 `D:\codex\workspaces\xiaodongge-windows`，但根 `package.json:5` 仍以 `desktop/codex_main.cjs` 为 `main`，且仍有 Electron。当前 `node_modules/electron` 占 388,832,478 字节；只有确认本仓库不再需要运行首版、独立仓库已完整承接后，才可一起退役 `desktop`、`main`、Electron 与旧 Windows 构建工具。本轮未审查独立仓库，不能安全判定这部分已无用途。

## D. 脚本整合与退役清单

### D1. 优先整合，保留全部有效断言

| 项目 | 涉及脚本 | 重复内容与建议 | 必须保留 |
| --- | --- | --- | --- |
| 浏览器/Vite 生命周期 | `codex_check_album_relisten.mjs`、`codex_check_album_timeline.mjs`、`codex_check_draft_records.mjs`、`codex_check_interaction_accessibility.mjs`、`codex_check_restore_preview.mjs` 等 | 已有 `codex_qa_options.mjs` 统一参数，再统一 Vite/Chrome 创建、隔离输出与关闭流程。14 个脚本含实际 Vite harness；22 个文件使用同一 Chrome headless 启动表达式 | 精确 loopback origin 校验、调用方 origin 覆盖、独立 cache/输出、外部请求拦截和 `finally` 释放。各脚本的业务断言继续独立 |
| Android ADB/CDP | `codex_check_diagnostics_android.mjs`、`codex_check_draft_backup_android.mjs`、`codex_check_restore_preview_android.mjs`、`codex_profile_ocr_android.mjs`、`codex_check_performance.mjs` | 重复 SDK 路径、serial、命令包装、WebView socket 等待和 CDP 连接；抽取小型公共连接层，参数化路径/serial/输出 | 项目专用 AVD `codex_np1_api36` 身份校验、用户数据隔离、forward 解除、浏览器关闭；不能放宽到任意设备 |
| Android 构建公共部分 | `build-android-debug.ps1` 与 `build-android-release.ps1` | 重复 SDK/JDK/PATH 准备和生成目录清理；提取共用环境/路径检查 helper，保留两个清晰入口 | release 输出目录非链接检查、路径边界、可信 APK/hash、原签名、包名、版本递增、全量门禁和 APK 资源核验 |
| 无障碍专项 | `abu_a11y_check.mjs` → `codex_check_interaction_accessibility.mjs` | 前者仍有文字对比度和触控尺寸扫描，后者已在 full gate；先迁移独有扫描再退役前者 | 深色主题、文字对比度、44px 触控目标，以及现有键盘焦点/滑块/响应式/触屏覆盖；不能直接删旧脚本 |

核实位置：`codex_qa_options.mjs:4-33`、`codex_check_album_relisten.mjs:15`、`codex_check_draft_records.mjs:17`、`codex_check_diagnostics_android.mjs:7-30`、`codex_check_draft_backup_android.mjs:8-42`、`build-android-debug.ps1:3-40`、`build-android-release.ps1:67-113`、`abu_a11y_check.mjs:17-31,100-154`、`codex_check_interaction_accessibility.mjs:80-130,236-250`。

上述 harness 数量为对 `scripts` 的静态表达式统计，用于评估重复维护；没有把 `codex_qa_options.mjs` 内 `node:net` 的同名 `createServer` 计入 Vite。

### D2. 可退役或归档的历史工具

| 优先级 | 准确文件 | 现状与建议 |
| --- | --- | --- |
| 高 | `scripts/codex_verify_android_release.ps1` | 首行明确 Historical v2.1.9；默认基准/输出路径和版本断言固定为 2.1.9（code 12），当前发布已用 `build-android-release.ps1`。可退役，保留历史说明 |
| 中 | `scripts/codex_check_rank_preview.mjs`、`codex_check_rank_collector_preview.mjs`、`codex_check_rank_edition_preview.mjs`、`codex_check_rank_duo_preview.mjs` | 当前门禁不调用，引用主要在 2026-09 设计交接；各自仍含独有旧方案断言。随设计稿一起归档，或合并为一个带明确方案参数的人工设计检查；没有直接删除全部的充分证据 |
| 中 | `scripts/codex_check_ux.mjs`、`codex_check_home_fusion.mjs`、`codex_check_mobile_experience.mjs`、`codex_check_neumorphism.mjs`、`codex_check_recap.mjs` | 不在当前主门禁；先对照独有断言并迁入现行检查，再退役旧入口。没有 package 命令不等于没有人工用途 |
| 中 | `scripts/codex_generate_ocr_fixtures.py`、`codex_profile_ocr_android.mjs`、`codex_start_six_rating_avd.ps1`、`codex_check_performance.mjs` | 固定历史输出、AVD 或 before/after 基线；适合独立 benchmark/manual 区，不必与每次构建入口混放。性能/OCR 复现能力仍有价值 |
| 中 | `scripts/codex_push_missing_unicode.py` | 针对一次中文路径补推，未找到当前调用方；可归档为历史操作工具 |
| 低 | `scripts/codex_push_via_api.py`、`codex_check_push_channel.sh` | 人工 API 推送/写通道诊断工具；可集中到手动运维目录并明确远程写入行为。凭据来源与用途不同，不强行合并 |
| 条件项 | `scripts/codex_build_windows.mjs`、`codex_check_windows.mjs` | 根 README 说 Windows 命令已迁出，desktop README/旧计划仍有引用；与首版 desktop 的所有权一起处理，当前保留 |

对退役候选的引用搜索覆盖 package、README、项目源码、scripts、docs 和状态文件；排除依赖、Git 内部、release 生成副本与本次盘点清单。无法排除用户在仓库外手工调用，所以人工工具列为候选，不宣称所有外部使用已终止。

注意：`docs/codex_v2.9_release.md` 中“旧美术断言已替代”的文字实际针对 `abu_check_rank_poster.mjs`，不能拿它证明四个 `codex_check_rank_*_preview.mjs` 全部已退役。

### D3. 视频工程的精简

- `codex_video/package.json:18-22` 的 `studio:v6`、`audio:v6`、`stills:v6`、`render:v6`、`check:v6` 与默认入口一致，README 也明确别名等价；可移除重复别名并同步使用说明。收益主要是命令清晰，磁盘收益很小。
- `codex_video/scripts/codex_capture_light.mjs`、`codex_capture_theme.mjs`、`codex_capture_genre.mjs` 重复创建 Vite/Chrome、固定时钟、模拟数据、网络阻断和错误收集；可在视频工程内部抽取采集基础层，保留三套实际拍摄流程。
- 视频 helper 应留在可随最终包携带的工程内，避免使既有完整交付 ZIP 新增未携带的依赖。现行 README 已区分“重渲染现有素材”与“重新采集父项目 App”。
- **保留** `codex_synthesize.py`：`codex_synthesize_v6.py:19,28-32,481-533` 实际导入并使用其 PCM/FFmpeg helper，不能仅凭文件名没有 `_v6` 就删除。
- **保留** `codex_contact.py` 与 `codex_review_sheet.py`：前者用于源素材联系表，后者用于成片抽帧/背景检查；capture 与 check 分别直接调用，不是同一用途的两个副本。

## E. 明确保留，避免误删

- `mobile/codex-prototype.html`：现行 `codex_check_simple_yearbook.mjs:171,199` 仍测试它。
- `mobile/codex_journal_fixtures.mjs`：存储、年记、草稿和原生检查直接导入。
- `src`、Prisma schema/migrations、Next 配置：根 `dev/build/start/prisma:studio` 仍使用，README 明确保留安全维护；不能因 Android 是当前主要交付就删除。
- `mobile/src/assets/fonts` 的 WOFF2、原始 WOFF、OFL 许可：原始 WOFF 被有意保留为源字体，见 2026-09-24 T12 交接；不是已证明无用的下载垃圾。
- 当前移动/原生源码、`shared` 测试、Capacitor 配置、隐私政策源与生成 HTML、备份/恢复/SQLite 安全检查。
- `.env`、`.env.example`、`prisma/dev.db`、`.data`、签名密钥与本机 SDK 配置；没有读取其敏感内容。
- `android/gradle/wrapper`、Gradle 脚本、原生 `res`：不能与 `build` 缓存一起删除。
- `.claude`、`.workbuddy`、`.zcode` 和其他助手状态/配置：不作为本轮删除对象。
- 现行 `codex_verify_project.mjs:16-30` 映射的 22 个专项检查，以及固定执行的 unit/types/quality/mobile build；`codex_verify_project.ps1` 也有 README 和 release 调用，保留。
- `codex_build_privacy_policy.mjs`（`premobile:build`）、`codex_verify_apk_assets.mjs`、`codex_check_android_unit.ps1`、`gradle-mirrors.init.gradle` 是实际构建链依赖。
- 隐私、鸿蒙、卓易通专项检查虽未全部加入主 gate，但当前计划仍使用，保留。

## 验证记录与建议执行顺序

已完成的检查：全目录文件/链接盘点、适用范围 SHA-256 比较、三个受保护 APK 的现存摘要、ZIP 内成员对照、脚本/源码引用复核、只读 Git 对象诊断。未重新运行应用功能测试，未把历史测试记录当成本轮测试。

建议分批执行，便于验证与回退：

1. 先处理 A 类可再生产物，保护正式包、基准包、必要结果/截图和根依赖；完成后验证保护摘要与候选实际消失。
2. 再删除已确认无调用的组件/依赖及默认模板，更新锁文件/Capacitor 注册，运行现有类型检查、项目 full gate、Android JUnit 和受影响隐私/导出检查；如果构建新 APK，再验证实际注册/资源/签名。
3. 分别整合浏览器、ADB/CDP、构建公共层，每批保留原有业务断言并运行受影响检查；最后归档历史设计/专项工具。
4. Git reflog 与垃圾对象、首版 Windows/Electron、旧 APK 回滚保留策略，单独作决定与维护，不混进缓存清理。

本轮新增审查记录与交接，不执行上述原有文件候选清理。收尾原计划只移除本轮自身的两个临时文件，但自动执行审批拒绝了该动作，仅返回 `blocked by policy`，未给出具体原因；命令未执行，实际删除 0 文件/0 字节，没有重试或更换方式绕过。保留以下两项，共 19,495 字节：

- `tmp/codex_workspace_audit_20261010.py`：18,957 字节，可复核最终机器清单；全量扫描/压缩模式会写自己的盘点文件，默认不运行。
- `tmp/codex_video_archive_audit_20261010.json`：538 字节，必要结果已集中到最终机器清单，属于重复临时记录。

报告与清单交付完成；本轮临时物收尾受阻。这两个文件是本轮新产物，不计入原有项目的清理收益。
