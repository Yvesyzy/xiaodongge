# 小懂哥四项体验调整与测试 APK

## 最新交付：轻新拟物测试 APK 2.7.1-test.2

Yves 已明确要求生成新测试 APK，本轮已完成打包。

- 安装包：`release/codex_xiaodongge-v2.7.1-test.2.apk`，69,105,725 字节；包名 `com.yves.musicarchive`，versionCode `21`，versionName `2.7.1-test.2`。
- SHA256：`f14c26e56bd6c5dd3174c3f3a47be38984eb9c804aa62239b54d87f354dd2458`；校验文件 `release/codex_xiaodongge-v2.7.1-test.2.sha256.txt`。
- 签名证书 SHA256：`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，沿用当前正式签名，版本号高于 test.1，可覆盖同签名旧版。
- 包含本次阅读留白与轻新拟物 UI，以及此前 test.1 的封面、阅读菜单和返回修复。
- package.json、package-lock.json、App.tsx、Android build.gradle 与构建脚本的版本同步到 test.2 / 21。
- 本轮 typecheck、Web 生产构建、Capacitor sync、assembleRelease、lintVitalRelease、签名和版本核验通过。构建日志：`release/codex_neumorphism_qa/codex_test2_build.log`。
- `release/codex_verify_neumorphism_test.ps1` 校验 APK 内 27 份网页资源与 mobile/dist 逐文件 SHA256 一致；index.html 实际引用的 JS 包含 test.2 版本，实际引用的 CSS 包含新拟物样式。报告：`release/codex_neumorphism_qa/codex_test2_verification.json`。
- 原 test.1 与 v2.7.0 APK 的哈希保持不变。旧构建目录保留部分未引用的历史哈希资源，本次入口明确指向新构建；没有做额外清理。
- 未安装或操作 Yves 手机，未提交、推送或公开发布。下一步覆盖安装 test.2，核对已有记录、正文边距、深浅阅读与底部安全区；体验确认后再决定正式发布。

## 后续：阅读排版与轻新拟物 UI 改造（同日）

Yves 要求基于 v2.7.1 改善正文贴边，并把 Neumorphism 系统性融入 App。本轮改造已完成源码与网页验收；下文 APK 仍指前一轮构建，不包含本节改动。

- 阅读：实际旧版 390px 视口左右各 14px，现统一为 clamp(26px, 7vw, 40px)，390px 下各 27.296875px；最小视口 320px 下各 26px，最大阅读外框 700px、正文行宽最多 620px。普通乐评和年记原文共用留白，月报也经过原有阅读回归。保留 15/17/21px 三档、1.95 行高、原文与换行。
- 封面信息区改为顶对齐、较小封面与舒展行距；评分强调色在深浅模式分别处理。正文维持平面，无卡片投影。
- 统一轻新拟物样式：暖纸底色、左上光源、凸起主要控件、凹入输入与选中导航。应用到首页、列表、搜索、编辑/速记、回顾、阅读、分享对话框外壳及新建弹层。首页保留黑胶、草稿和最近三条；日期避开更多菜单；新建底栏按钮回到栏内，保留原点击功能。
- 产品文件仅本轮修改 mobile/src/codex_reading.css、mobile/src/main.tsx，新增 mobile/src/codex_neumorphism.css。没有修改业务逻辑、存储、原生代码、导出图片排版、版本号或现有 APK。
- 设计/执行范围：docs/superpowers/plans/codex_2026-09-11_neumorphism.md。效果预览：docs/designs/codex_neumorphism_2026-09-11.html。截图与读数：release/codex_neumorphism_qa/；均为隔离浏览器内的合成记录。
- 新检查 scripts/codex_check_neumorphism.mjs 通过：九个页面，320/390/430/768/1280px 无横向溢出；正文左右留白、三档字号、深浅模式、原文不变；年记阅读留白、日期/菜单不重叠、新建弹层、键盘焦点、按压反馈、减少动态效果、深色按钮无白色光晕。
- npm.cmd run typecheck 与 npm.cmd run mobile:build 通过；既有 reading、home_fusion、recap、review_share、mobile_experience 五套浏览器检查通过。最后调整列表/弹层后重跑首页和移动体验检查通过。Vite 仍有既有大包提示，未新增依赖。
- 验证边界：本轮为 Web UI 改造，不重复宣称前一轮 Android 测试覆盖新样式；没有操作 Yves 手机，没有重新生成 APK，没有提交/推送/发布。先前未提交改动与 cc 的文件保留。
- 下一步：Yves 查看效果后，可生成沿用现有签名的新测试 APK，在手机上确认正文密度、阴影强度与底部安全区。

---

日期：2026-09-11。按 Yves 后续授权实施 2026-09-10 四图反馈计划，并生成测试安装包。

## 交付

- 安装包：`release/codex_xiaodongge-v2.7.1-test.1.apk`，版本 `2.7.1-test.1`，versionCode `20`，包名 `com.yves.musicarchive`。
- 大小：68,719,188 字节。
- SHA256：`aeaf9727fcfa44d4a9c457c5482b96176f797ddd12663caf5456ea2214c8cacb`。
- 校验文件：`release/codex_xiaodongge-v2.7.1-test.1.sha256.txt`。
- 使用既有正式签名，证书 SHA256：`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`。
- 未提交、推送或发布 GitHub Release。原 `release/xiaodongge-v2.7.0.apk` 哈希仍为 `2b278b2b9b66e1f96c9bcd9e88ef6be37a78860c752b0a5e2aeeb7dd899a6de3`。

## 已实现

1. 时间轴恢复封面区域，点击直接打开系统图片选择界面；空封面提供添加入口，已有封面可直接更换，保存反馈就地显示。
2. 阅读页顶部保留无边框返回，删除重复标题；字号、浅深主题合入右上角更多菜单。移除底部重复目录和设置栏，保留年记上一篇/下一篇及分享、编辑、删除确认。
3. 按记录类型统一封面目标。专辑乐评即使填写歌曲字段也使用专辑封面；歌曲独立封面保留。历史歌曲位置的专辑封面按专辑和艺人兼容读取，有冲突时不擅自选图；不迁移、不删除旧封面行。
4. Android 返回经原生插件进入统一导航：键盘、浮层优先；子页回来源/所属目录；顶层栏目回首页；首页首次提示，2 秒内再次返回移到后台。路由切换、超时、前后台切换重置退出计时。完整编辑和速记保存草稿失败时留在原页，复听、追加听感及年度精选保留未保存保护。

## 验证证据

- `npm.cmd run typecheck`、`npm.cmd test`：通过，31 项单元测试。
- 浏览器回归：`scripts/codex_check_reading.mjs`、`scripts/codex_check_recap.mjs`、`scripts/codex_check_home_fusion.mjs`、`scripts/codex_check_review_share.mjs`、`scripts/codex_check_mobile_experience.mjs` 均通过。
- `scripts/codex_check_cover_sqlite.mjs`：通过真实 Node SQLite 下的原生存储分支检查，覆盖历史归属、专辑优先、同名不同艺人、冲突保留、独立歌曲封面，以及保存失败保留旧图且不发刷新事件。
- Web 生产构建、Android Java 编译、`lintDebug`、`assembleRelease` / `lintVitalRelease` 通过。保留既有非阻断告警：Vite 大包、Gradle 弃用提示及已有 lint 告警。
- `release/codex_verify_mobile_test.ps1`：20 份 APK 内网页资源逐文件 SHA256 与 `mobile/dist` 一致；签名、版本、原正式包未变均已核验。
- Android 使用本项目独立 Android 36 / Pixel 8a 模拟器 `emulator-5580`，手势导航开启，全部记录均为合成数据。先安装 2.7.0 并通过 `seedBeforeUpgrade` 写入记录，再 `adb install -r` 覆盖测试 APK；`verifyAfterUpgrade` 验证记录保留。
- 实际 release APK 上，系统返回键优先收起软键盘、左右边缘返回、取消手势、时间轴原生图片选择器打开及取消保留页面/封面均已通过。测试通过 Android 输入注入执行，不以网页自定义事件替代原生手势。
- `nativeBackNavigationAndExitProtection` 已通过：首次返回提示/再次移到后台、重新前台后重置、2 秒超时、栏目返回不计入退出次数、浮层/阅读菜单先关闭、保存并恢复草稿、故障注入存储满时禁止离开、恢复写入后可正常返回。
- 原生驱动：`android/app/src/androidTest/java/com/yves/musicarchive/codex_NavigationInstrumentedTest.java`；构建辅助：`release/codex_build_native_test.ps1` 和 `release/codex_release_test.init.gradle`。这些辅助文件不会开启产品 release WebView 调试。
- 截图、APK 资源清单和测试日志：`release/codex_mobile_experience_qa/`。最终汇总日志 `codex_native_acceptance.log`：32.786 秒，`OK (5 tests)`，全部通过、没有跳过项。此前失败日志属于测试驱动调整过程，已由该汇总运行覆盖验收。

## 验证边界与接手方式

- 未连接或操作 Yves 的手机；厂商相册选图后保存、实际手机左右返回及接收端分享，仍需真机体验确认。
- 本次确认封面逻辑能复现并修复模拟数据的归属差异；未读取手机原始数据库，不能断言原截图中每条异常记录的具体数据状态。
- APK 是测试版，正式发布需 Yves 后续授权。后续正式包 versionCode 必须高于或兼容本次 `20` 的升级顺序。
- 主工作区是最终实现；`release/codex_*_work` 与独立模拟器目录仅为执行中间产物，不可拿来覆盖主工作区。
- 保留原 `.gitignore`、Android 自动生成 Gradle 文件、被删除的旧交接文档及 `.claude/` 状态；未修改 cc / 阿布的配置或记忆。
- 下一步：Yves 覆盖安装测试包，重点体验选图后各页面封面一致性、阅读菜单、返回层级和首页退出提示；确认后再处理正式发布。
