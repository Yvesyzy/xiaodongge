# 2026-09-22 播放读取修补与第一批独立复查

## 授权与现场事实

Yves 要求继续 v2.9 第一批修补，并确认 NP1 的现场为“网易云音乐正在播放，点击识别无提示”；此前音乐和 B 站视频均曾能读取。Yves 明确不连接手机，要求自行测试。后续不再以连接其手机作为继续开发的前提。

继续使用 `codex/v29-p1`，基线 `b563e32` 和既有未提交修改。未提交、推送、发布或修改个人档案；正式 v2.9 APK 保留。测试使用新浏览器上下文、合成档案及项目内新建 AVD `codex_np1_api36`（`emulator-5562`）；另在该模拟器安装官方网易云，以游客模式测试实际在线播放，没有登录 Yves 的账号，也没有启动或改写原 `Pixel_8a` 的数据盘。

## 已复现并修补

1. 完整乐评页原生读取异常原先只出现在长表单底部，按钮旁恢复默认说明。390×844 下提示还会被固定保存栏遮挡。现在读取开始、失败和系统设置错误均在当前播放面板显示；显式点击读取使面板居中，自动读取不滚动页面；状态有 `aria-live`。
2. Android 通知使用权撤回时，包级授权检查与系统实际权限存在不同步的窗口。旧插件在 `getActiveSessions` 抛出 `SecurityException` 后拒绝调用，前端保留旧授权状态。现返回新的 `{ accessEnabled: false }`，让既有解析和界面进入授权路径，不返回曲目字段。
3. 独立复查确认完整乐评页在等待目录补全时修改作品身份，旧元数据仍会写回。请求序号、表单修订号及 effect 清理现阻止过期响应；手动编辑、OCR 应用、放弃草稿会使旧请求失效，结束提示不再停留在“补全中”。
4. 两个封面入口处理期间禁止重复选图，完成或失败后复位。文件转换、OCR 和聚合封面保存完成后先检查原输入仍在页面，避免离开页面后更新界面。
5. 旧网页保存拒绝空白记录 ID；年度总结拒绝空白正文。已有断网、HTTP、异常 JSON 与重试检查中补充这些输入。
6. 本地完整性扫描现在逐个检查六类集合，收集全部失败后统一阻止写入和导出，避免首个异常掩盖后续损坏。回归覆盖六类同时损坏、两类同时无效 JSON、坏封面行的原文保全，以及 SQLite UPSERT 失败后立即使用旧快照实际撤销。
7. 统一检查入口显式列出与 `npm test` 一致的三个必需测试文件，缺失文件会失败，不再因目录扫描漏掉被删除的测试。
8. 收尾发现 9 个已安装包与锁文件不一致（PostCSS 实际为 8.5.15，锁定为 8.5.28）。统一入口新增版本核对，旧环境已被明确拒绝；按原锁文件从官方 registry 执行 `npm ci`、重新生成 Prisma Client 后再跑整套回归。锁文件未变，未操作真实数据库。

## 当前证据

- 最终主目录集成回归：`release/codex_validation_locked_final_20260922/codex_results.json`，18 组全部通过，退出 0，版本差异为 0，含 32 项基础测试、两套类型、质量入口、移动构建及全部浏览器回归/反向故障注入。同目录 `codex_source_manifest.json` 记录 33 个修改或新增代码/检查文件的 SHA-256，基线仍为 `b563e3249424cb72ff08846ce3c9698c20fc0d98` 加工作区修改。
- 版本不一致的失败证据与安装日志在 `release/codex_dependency_drift_before_20260922/`。`codex_validation_final_20260922/` 是重建依赖前的通过结果，不能代表锁定版本环境；`codex_validation_locked_20260922/` 保留重建后尚未生成 Prisma Client 时的类型失败。当前以 `codex_validation_locked_final_20260922/` 为准。
- 提示位置、遮挡、目录竞态、封面并发均先取得失败断言，再修补。测试误拦截 `FileReader` 的一次超时被保留且不算产品失败：封面实际使用 `Image.src`，校正检查后才取得重复操作失败证据。
- `release/codex_capture_review_fixed_20260922/codex_capture_regressions.json`：速记恢复、竞态、显式切换、完整乐评失败重试/可见性/旧元数据保护、三种文件入口及封面重复操作通过。
- `release/codex_validation_np1_20260922/codex_results.json`：32 基础测试、两套类型、质量入口、构建及 capture/storage/native/sqlite/legacy/covers 通过。该快照早于后续独立审查返工，不能当作最终集成结果。
- `release/codex_validation_review_web_20260922/codex_results.json`：基础检查和旧网页隔离 dev/build/start、实际 localhost 监听、CRUD、失败及空白响应后重试通过。
- `release/codex_np1_android_20260922/codex_instrumentation.log` 与 `codex_plugin_errors.log`：旧原生逻辑在撤权后失败，日志为 `Missing permission to control media`。
- 同目录 `codex_instrumentation_fixed.log`：原生修补后通过；`codex_instrumentation_button.log`：新增真实 WebView 按钮与授权界面断言后仍为 `OK (1 test)`。`codex_build_button.log` 对应主 APK 与测试 APK 的成功编译。
- Android 合成会话检查实际启动 MainActivity，经 Capacitor 桥接读取 Android MediaSession，覆盖歌曲标题/歌手/专辑、视频式 DISPLAY_TITLE、多会话跳过暂停、恢复、撤权和重新授权、自动填入、点击填入、撤权后显示设置入口。最终依赖环境重建调试 APK 后，`release/codex_netease_playback_20260922/codex_instrumentation_clean.log` 再次为 `OK (1 test)`。重复执行的旧合成草稿曾占满 5 份上限，失败在同目录 `codex_instrumentation_final.log`；精确核对自建 AVD 后重置该应用的测试数据，未将测试残留误记为产品缺陷。

## 网易云实际 App 验证

从 [网易云官方下载页](https://music.163.com/st/download) 的 Android 按钮取得 9.5.95（9005095）APK，包名由 Android 工具实读为 `com.netease.cloudmusic`。官方文件 SHA-256 为 `83a4934a64dd4d075ab31bd131ecddd7d2b2279d0d543a8d731d822b3c074ad7`，来源请求保存在 `.firecrawl/codex_netease_android_download_20260922.json` 和测试目录 `codex_download_chrome.log`。

游客进入后网易云实际在线播放《罗生门（Follow）》，系统媒体会话为 `PLAYING(3)`，艺人为“梨冻紧/Wiz_H张子豪”。最终调试版经真实 Capacitor 桥返回相同曲名、艺人、专辑及 `sourcePackage=com.netease.cloudmusic`；新表单自动填入和实际“读取当前播放”按钮均通过。目录补全未找到可确认匹配，界面保留原生信息并显示具体结果。准备的合成 MP3 没有作为这次通过结果的音源。

证据位于 `release/codex_netease_playback_20260922/`：`codex_media_session_online.txt`、`codex_netease_result.json`、`codex_netease_check_pass.log`、`codex_netease_form.png`。已目检截图，提示完整显示在按钮下方。辅助脚本首次使用不支持的 CDP 默认选项、首次断言误写“已识别”的失败记录均保留；改用已安装 Playwright 的 `noDefaults` 选项和源码中的确切“识别为歌曲”文案后通过，未修改产品来迎合测试。

## 独立复查与验收边界

`review_data`、`review_capture`、`review_native_web` 已完成第一轮只读复查。原生导出/重听卡没有新的 P1；旧网页空白响应问题已修补。NP1 原生最小修补经 `review_native_web` 复核，认可系统链路证据及其边界。

数据返工在隔离副本 `release/codex_review_data_20260922/` 完成，主代理检查差异后仅集成 `mobile/src/store.ts`、`scripts/codex_check_storage_integrity.mjs`、`scripts/codex_check_sqlite_backup.mjs`，并在主目录最终回归通过。完整乐评/播放链路与检查入口的最终独立复查完成，确认问题已修补；没有把未复现的防御性建议记作产品缺陷或额外扩展实现。

最终差异检查通过，只有 Git 换行转换提示。此次创建的无窗口模拟器已通过精确 AVD 名称核对后停止；统一回归入口已退出并关闭其服务器。

真实系统文件提供器的写入/关闭失败、真实 Capacitor SQLite 撤销失败路径、OEM、其他网易云版本及实际 B 站 App 仍是技术验收边界；网易云 9.5.95 在 Android36 模拟器上的实际播放读取已通过。不能将这些结果扩展为 Yves 手机已通过。可交接本批代码、复查结论及自动测试证据，没有本批发布验收结论。

最终调试 APK 已包含全部当前修改与重建依赖，留存在测试目录 `codex_xiaodongge_playback_debug.apk`；21 个网页资源逐个匹配打包输入，哈希为 `2c0411953dca6b9cbdf5137e8f3f59aeca65c2a4ebdd1ff7fe2bea42ccc37376`，详见 `codex_package_evidence.json`。该文件仅为调试验证产物，不作为正式版覆盖安装包。发布版 `release/codex_xiaodongge-v2.9.apk` 仍为原文件，SHA-256 为 `f8923da74bb59af85bf5c86fee582e6890f4327f8091ce28c5154247fa0968c0`。下一步可制作使用正式证书的签名测试版，或补 B 站/系统存储兼容验证；不要求 Yves 连接个人手机。
