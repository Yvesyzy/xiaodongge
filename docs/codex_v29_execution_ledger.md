# v2.9 执行台账

开始日期：2026-09-17。授权：Yves 选择“按推荐顺序启动测试入口与 P1 修补”，随后持续要求完成原全量计划。基线 `b563e32`，集成分支 `codex/v29-p1`。

最后更新：2026-09-25。T00–T17 代码已实现并完成相应受控测试；T18 最终包、项目模拟器覆盖升级/恢复和诊断页面检查完成。最终签名测试包对应 26/26 组完整检查、Android JUnit 8/8 与资源/证书校验。T12 冷启 P90 与首次榜单预览仍超过计划的 ≤10% 不恶化门槛；真实手机、B 站、跨 App 接收和 TalkBack 等现场证据未取得。Yves 明确要求自行测试，不再要求其连接手机。没有提交、推送或公开发布。最终逐项判断见 `codex_v29_upgrade_acceptance.md`。

| 工作包 | 执行责任 | 当前状态 | 证据 / 待完成 |
|---|---|---|---|
| T00 基线与隔离 | 主代理 | 基线已核对，工作区已建立 | 主工作区审查文档保留；三个独立 worktree 位于 release/codex_worktrees_20260917/ |
| T05 E4/E5 | 主代理 | 实现、复查、自动回归通过 | 32 基础测试、两套类型、构建、月报/年记及三项反向故障注入通过；必需测试文件缺失会失败；完整入口 18 组通过 |
| T01/T02 D1/D2/D3 | 主代理集成数据工作副本 | 实现、复查、自动回归通过 | 六集合损坏及双无效 JSON 一次检出、坏封面原文保全、写失败原文保留及抢救 UI；SQLite UPSERT 失败后旧快照实际撤销通过 |
| T03 M1/M2 | 主代理集成速记工作副本 | 实现、复查、自动回归通过 | 草稿恢复、快慢响应、编辑/切换保护；完整乐评过期补全拒绝；三文件入口成功/失败/重选及封面并发锁通过 |
| T04 E1/E2/E3/E7 | 主代理 | 实现、复查、自动回归通过 | 隔离 dev/build/start、localhost 实际监听、CRUD、断网/HTTP/异常及空白响应重试；残留 Prisma 链有适用范围记录 |
| T09 A1/M4 | 主代理集成原生工作副本 | 实现、复查、自动回归通过；系统提供器待验证 | 原生编译、6 项 JUnit、模拟桥接取消/失败/重试/健康不推进、不同听感文件名与分享通过 |
| NP1 手机播放识别（新增） | 主代理 | 已复现路径修补、网易云实际 App 模拟器实测通过 | Android36 合成音乐/视频、暂停恢复、撤权重授权通过；官方网易云9.5.95游客在线播放《罗生门（Follow）》经真实桥接读取、自动填入和实际按钮通过；B站/OEM未验证 |
| T06 D4/D5 草稿与备份 | 主代理集成隔离工作副本 | 实现、独立复查与最终自动/原生测试通过 | v6 草稿备份、损坏原文抢救、导入/撤销、Web 多窗口互斥、重启统一回滚；20 组全量检查、31 个草稿场景、31 个故障点、真实 Android SQLite 提交后中断并强制重启通过 |
| T07 D6 作品统计 | 主代理 | 实现、独立复查与全量回归通过 | 首页、聚合、年记统一作品身份；21 组全量检查与 23 条合成记录对照通过 |
| T08 M3/M5 榜单与评分 | 主代理 | 实现、独立复查与全量回归通过 | 空年榜单可管理；移除、排序、键盘/焦点、评分持久化；22 组全量检查通过，TalkBack 留 T18 |
| T10 A2 OCR 保护 | 主代理 | 代码、独立复查、自动边界与项目 AVD 实测通过；手机体验留 T18 | 12 MiB / 600 万像素预算，普通/长/高分图字段保留、异常图拒绝、20 次连续识别稳定；22 组全量检查、8 项 Android JUnit 通过 |
| T11 A3/A4 发布质量入口 | 主代理 | 实现、独立复查、全量闸门与签名测试包验证通过 | 27 号本地签名测试包；22 组全量、8 项 JUnit、39 个 APK 资产清单与 `lintVitalRelease` 通过；错误注入拒绝；junction 实测被自动审批拦截 |
| T12 E6 加载与字体 | 主代理 | 初始体积、离线字体、功能回归通过；冷启/首次导出门槛待复测 | 初始 JS 649,281→528,505 B（−18.60%）；Noto WOFF2 30,890 字符映射不变且体积 −31.09%；同机 10+10 次与三轮榜单预览有原始数据，WebView P90/首次导出波动超阈值，宿主内存最低约 611 MiB |
| T13 I1 专辑盲重听 | 主代理 | 实现、完整回归通过 | 专辑详情/聚合入口、每日稳定筛选、盲听遮蔽、重复提交、备份/撤销、来源删除与歌曲回归；23 组全量检查通过，浏览器合成数据验证，Android 专项留集成验收 |
| T14 I2 恢复差异与预演 | 主代理 | 实现、24 组全量与 Android 隔离 SQLite 成功/失败路径通过 | 七类数据四向差异、输入/本机摘要过期保护、Web 隔离写入回读、Android36 真实插件临时库写入回读；正式库/草稿/撤销/健康前后无变化，临时库保留 |
| T15 I3 跨年专辑轨迹 | 主代理 | 实现、定向/全量及独立复查通过 | 当前正文与重听数据完整，同名不同目录 ID 在详情区分；榜单缺 ID 时明确标注归属不明确 |
| T16 I4 导出预检与附页 | 主代理 | 实现、定向/全量及独立复查通过 | 15 张、长文、隐私组合、缺封面、完整理由附页与复制预检通过；跨 App 接收未验 |
| T17 I5 本机诊断 | 主代理 | 实现、Web/Android 签名包 UI 与独立复查通过 | 版本、草稿、备份、权限、存储状态及脱敏复制通过；数据库完整性未检查且页面明示 |
| T18 集成与验收 | 主代理 | 本地测试包与模拟器升级/恢复完成；全量技术/体验验收未完成 | 26/26 完整检查、8/8 Android JUnit、签名及资源一致；T12 性能门槛未过，真实手机/跨 App/TalkBack 未验。逐项见 `codex_v29_upgrade_acceptance.md` |

检查入口：`npm.cmd run verify` / `npm.cmd run verify:full`，PowerShell 包装为 `scripts/codex_verify_project.ps1`；原生编译与 JUnit 为 `npm.cmd run verify:android`。必需测试文件缺失或断言失败会返回非零退出，不能跳过后宣称通过。

证据目录按每次运行新建 `release/codex_validation_*`。失败记录保留；检查只在合成数据、新浏览器上下文与项目内新建模拟器执行。原发布 APK、个人数据库与草稿均未操作，未推送或发布。

## 执行中复查记录

- 首批 p1_data/p1_capture/p1_native 及接手的 finish_data/finish_capture/finish_native 均因额度错误中断，没有完整交付或独立审核结论。主代理逐项检查遗留差异，补齐缺口、集成并完成自测；独立复查不能因此记为通过。
- 年记“128 条却展开 71 条”的原测试混入前一 fixture 的 sessionStorage 展开状态；改为每份合成档案隔离会话状态，仍严格断言首次 5 条、展开后 25 条，以及返回后保留展开状态。异步筛选等待完成后再核对精确数量。
- T05 反向验证已在隔离 Vite 输出中分别破坏月报按钮、月份分页和 PNG 宽度，真实回归脚本均以非零退出并命中相应断言。源文件没有为故障注入而改写。
- 根/mobile 类型入口的内存注入错误、无效检查参数、PowerShell 包装器非零退出传播已验证。
- 旧网页端 Next 16.3.5 隔离 dev/build/start、操作系统 localhost 监听、合成数据 CRUD 与三按钮网络/HTTP/异常 200 响应后重试已通过。修正了集成测试继承 Vite NODE_ENV 的问题，生产构建/启动显式使用 production。
- 2026-09-22 新建 Android36 隔离模拟器执行系统媒体会话测试并通过，结束后已停止。Android 个人真机验收未执行。原 v2.9 APK SHA-256 实测仍为 `f8923da74bb59af85bf5c86fee582e6890f4327f8091ce28c5154247fa0968c0`。
- 2026-09-22 独立复查新增的过期目录响应、封面重复操作、空白 API 响应、完整性扫描提前退出和测试文件遗漏问题均已修补；返工隔离集成后完成最终整套回归。

## 2026-09-21 历史检查快照

下表为后续返工前的历史结果，不代表当前工作区；最新结果见下一节。

| 检查 | 结果 | 证据 |
|---|---|---|
| 完整入口 | 18 组全部通过，退出 0 | `release/codex_validation_2026-09-21T14-50-48-153Z/codex_results.json`，同目录各脚本日志、截图、结果 JSON |
| 反向验证 | 月报动作/年记分页/PNG 宽度破坏均被真实脚本拒绝 | 上述目录 `guards/codex_guard_results.json` |
| 源码快照 | 31 个修改/新增代码及检查文件的 SHA-256 | 上述目录 `codex_source_manifest.json`；对应基线 HEAD 加未提交工作区 |
| Android 编译与 JUnit | 编译退出 0；6 项通过 | `release/codex_android_unit_20260921_144240/` |
| 依赖审计 | 生产/全部各 3 high，0 critical；退出 1 | `release/codex_p1_security_20260917/codex_npm_audit_installed_prod.json` 与 `codex_npm_audit_installed_all.json`；解释见安全记录 |
| 差异检查 | `git diff --check` 通过 | 主工作区；只有 Git 换行转换提示 |
| 独立复查 | 未完成 | 代理额度中断，不能把主代理自测替代独立审查 |
| 真机/体验验收 | 未执行 | 当前无 ADB 设备；NP1 仍需现场证据 |

环境更正：旧快照实际安装的 PostCSS 为 8.5.15，与锁文件 8.5.28 不符，另有 8 个包错版。2026-09-22 按锁文件 `npm ci` 并生成 Prisma Client 后重新验证，当前 PostCSS 8.5.28，检查入口新增已安装包版本门槛。Windows、Node 24.13.0、npm 11.6.2、JDK 21.0.11、Next 16.3.5、React Router 7.18.4 保持；实际版本及锁文件哈希以最新结果 JSON 为准。

返工记录：捕获脚本原先用固定 25ms 触发竞态，改为等待桥接实际启动/完成；年记等待异步更新后核对精确数量；Vite 把 port 0 转成 5173 导致嵌套反向测试冲突，现由系统分配空闲端口再严格绑定。失败目录全部保留。没有通过删除断言或宽泛接受失败获得通过。

## 2026-09-22 最终集成证据

| 检查 | 结果 | 证据 |
|---|---|---|
| 完整入口 | 18 组全部通过，退出 0，含 32 项基础测试；版本差异为 0 | `release/codex_validation_locked_final_20260922/codex_results.json` 及同目录日志/截图/结果 JSON |
| 反向故障注入 | 月报动作、年记分页、PNG 宽度破坏均被拒绝 | 上述目录 `guards/codex_guard_results.json` |
| 当前源码快照 | 33 个修改/新增代码及检查文件 SHA-256 | 上述目录 `codex_source_manifest.json`；基线 HEAD 加未提交工作区 |
| 独立复查 | 数据、采集、原生/旧网页初审完成；确认问题已闭合，播放链路与检查入口复核完成 | `docs/session-summaries/codex_session_summary_2026-09-22_playback_review.md`；隔离数据返工经过主代理差异检查及最终主目录回归 |
| Android 系统播放链路 | 最终代码/依赖编译通过，instrumentation `OK (1 test)` | `release/codex_netease_playback_20260922/codex_android_build.log`、`codex_instrumentation_clean.log`；音乐/视频/暂停恢复/撤权重授权/实际按钮 |
| 网易云实际 App | 官方9.5.95在Android36模拟器读取、填入与按钮提示通过 | 上述目录 `codex_netease_result.json`、`codex_media_session_online.txt`、`codex_netease_form.png`；21个APK资源匹配见 `codex_package_evidence.json` |
| 依赖审计 | 重建后全依赖/生产均3 high、0 critical，退出1 | `release/codex_validation_locked_final_20260922/codex_npm_audit_all.json`、`codex_npm_audit_prod.json`；Prisma配置链适用范围见安全记录 |
| 剩余兼容与系统存储 | 尚未验证 | 实际B站App、其他网易云版本/OEM、系统文件提供器写入/关闭失败、真实Capacitor SQLite撤销失败路径 |
| 差异检查 | `git diff --check` 通过 | 只有 Git 换行转换提示 |

放行决定：本批代码修补、独立复查及自动回归完成，可交接代码和测试证据。NP1 的已复现路径和实际网易云9.5.95已通过Android36模拟器验证，不能扩展为Yves手机、实际B站或全部OEM通过。最终调试APK已保存，正式签名安装包尚未更新，没有本批发布验收结论。下一步可制作正式证书签名测试版，或补B站/系统存储验证，不要求Yves连接个人手机。

## 2026-09-23 T06 接续验收

T06 按 `docs/codex_draft_backup_contract.md` 实施。外部 JSON 升为 v6，严格校验草稿键和值；v1–v5 导入保留本机草稿，v6 空数组明确清空。损坏草稿在草稿箱可见，可复制、导出原文或确认删除；不能被静默忽略。导入/撤销使用预写日志、启动屏障和精确快照，失败后统一恢复操作前的正式数据、草稿原文、AppData 与撤销槽。Web 多窗口使用共享/独占 Web Locks；页面旧异步操作随恢复代次失效，恢复后重新挂载页面。拒绝、成功和撤销的反馈均经过真实按钮路径检查。

| 检查 | 结果 | 证据 |
|---|---|---|
| 主目录完整入口 | 20 组全部通过，退出 0；含基础单测、根/mobile 类型、质量门槛、构建及全部浏览器/故障注入脚本 | `release/codex_t06_full_acceptance_20260923/codex_results.json`；同目录源码哈希与日志 |
| 草稿/备份矩阵 | Web 和 Node SQLite 模拟桥均通过；31 个场景、31 个故障点，含 Web 16 个真实持久写入边界强制中断、重启恢复 | `release/codex_t06_full_acceptance_20260923/draft-backup/codex_draft_backup_results.json` |
| 真实 Android SQLite | v6 导入、清空草稿、撤销；实际 SQLite COMMIT 后阻断后续写入并强制结束进程，重启后主表、Undo、草稿原文及日志屏障均恢复/清除 | `release/codex_t06_native_acceptance_20260923/codex_native_draft_backup_results.json`、同目录截图 |
| 最终调试 APK | Android `assembleDebug` 成功，安装到项目专用 `codex_np1_api36` 验证；82,563,081 字节，SHA-256 `485FD6349A5529E02218F6146BCDA3C31F48811C96F8CFBAF325DB23F494CE05` | `release/codex_t06_native_acceptance_20260923/codex_t06_debug.apk` |
| 独立复查 | 先发现 1 个 P1、3 个 P2；封面代次、页面重挂载、多窗口竞态及拒绝反馈均修补，最终只读复核确认关闭 | `docs/session-summaries/codex_session_summary_2026-09-23_t06.md` |
| 差异检查 | `git diff --check` 退出 0；只有 Git LF/CRLF 换行提示 | 主工作区 |

两名隔离执行者因代理额度错误中断；主代理检查其遗留代码后选择性集成并完成验证，未把执行者中断记为独立通过。最终复查由 `review_data` 只读完成。旧 APK 不能读取 v6 备份，当前没有自动降级工具，不能通过卸载应用回退。正式签名测试版、发布和 Yves 手机数据均未操作。项目专用模拟器已停止、转发已清理。后续仍是 S2 T07/T08/T10，之后继续 S3–S5；T06 完成不代表全部 28 项完成。

## 2026-09-23 T07 作品统计统一

首页、聚合列表/详情、年记年度事实共用既有身份谓词下的作品分组。目录 ID 相同优先认同，不同 ID 不由缺 ID 记录桥接；缺艺人且无 ID 保守分组；同名异人和同歌异专辑保留为不同作品。作品数、正式音乐记录数、有评分记录数及其平均评分分别计算。聚合链接带记录 ID/目录 ID，删除代表记录后仍可按目录 ID 或规范化文本找到存活组并显示对应封面。旧文本链接在原始名称仍可定位时继续工作。

| 检查 | 结果 | 证据 |
|---|---|---|
| 主目录完整入口 | 最终代码 21 组全部通过，退出 0；含根/mobile 类型、质量门槛、构建、全部页面与故障矩阵 | `release/codex_t07_full_acceptance_final_20260923/codex_results.json` |
| 身份对照 | 23 条合成记录，12 张专辑、7 首歌曲，6 条评分记录平均 7.5；列表/详情、首页/年记一致，覆盖链接失效回退及封面 | 同目录 `identity/codex_music_identity_results.json` |
| 独立复查 | 两轮只读反馈中的旧文本链接、代表记录删除后链接失效已修补，最终无新 P1/P2 | `docs/session-summaries/codex_session_summary_2026-09-23_t07.md` |
| 差异检查 | `git diff --check` 退出 0；只有 Git 换行转换提示 | 主工作区 |

T07 未构建或安装新的 Android APK；T06 调试包不包含 T07。没有触及 Yves 手机、正式签名包、提交或发布。接续 S2 T08/T10，之后 S3–S5；28 项总计划尚未完成。

## 2026-09-23 T08 榜单管理与评分可访问性

已选年度专辑可直接移除、调整名次；空年仍显示已保存榜单并可编辑/导出，损坏榜单不再误导用户创建。评分滑块增加键盘、焦点和合法的 ARIA 值语义；四维 0.5 分输入得到一位小数的综合均值，手动锁定与改维解锁保留。原生 range 的交互/样式替换成本较高，本轮沿用现有手势实现。

| 检查 | 结果 | 证据 |
|---|---|---|
| 主目录完整入口 | 最终代码 22 组全部通过，退出 0；含构建、榜单海报、备份、T07 身份与 T08 新交互检查 | `release/codex_t08_full_acceptance_reviewed_20260923/codex_results.json` |
| 交互与数据 | 六项通过：移除/排序、备份与空年、键盘和鼠标/触控、四维均值及正式保存/重载、损坏榜单 | 同目录 `accessibility/codex_interaction_accessibility_results.json` 与浅/深焦点截图 |
| 独立复查 | 两个 P2（损坏榜单误显创建、默认 affected 漏检查）均修补并复核关闭；无新 P1/P2 | `docs/session-summaries/codex_session_summary_2026-09-23_t08.md` |
| 差异检查 | `git diff --check` 退出 0；只有 Git LF/CRLF 换行提示 | 主工作区 |

T08 的读屏真机体验留在 T18；本次浏览器触控模拟不代表 Android TalkBack 通过。T07/T08 尚未打入新 APK，未触及 Yves 手机、提交或发布。接续 S2 T10，再进入 S3–S5。

## 2026-09-24 T10 OCR 输入与内存保护

前端在读取文件及桥接前限制图片为 12 MiB；原生以同一字节预算和 600 万解码像素预算执行 bounds decode、采样与最终像素检查，并在识别结束或异常时关闭识别器、释放 bitmap。失败保留表单和先前 OCR 文本。阈值来自项目 Android36 AVD 的普通图、长图、高分图基线，完整表见 `docs/session-summaries/codex_session_summary_2026-09-24_t10.md`。

| 检查 | 结果 | 证据 |
|---|---|---|
| 主目录完整入口 | 初次 22 组全部通过；独立复查后补充字段保持断言，最终结果见右列 | `release/codex_t10_full_acceptance_reviewed_20260924/codex_results.json` |
| Android JUnit | 8 项通过，含字节/像素三边界与极端尺寸 | `release/codex_t10_android_unit_final_20260924/` |
| 项目 AVD 真实桥接 | 普通/长/高分图识别专辑与艺人；高分图 24 MP 解码为 6 MP，峰值 PSS 429,787→331,065 KiB；损坏图与巨大声明尺寸拒绝；12 MiB−1/等于接受，+1 拒绝 | `release/codex_t10_native_initial_20260923/codex_profile_*.json` |
| 连续识别 | 同图 20 次成功且字段 20/20 保留；每次结束 PSS 170,842–173,679 KiB，未见持续增长 | `release/codex_t10_native_initial_20260923/codex_profile_repeat20.json` |
| 独立复查 | 无确认的资源泄漏；字段保持断言和内存采样有效性两项证据反馈已修补并复核关闭；ML Kit task 失败注入未直接测试 | `docs/session-summaries/codex_session_summary_2026-09-24_t10.md`、`release/codex_t10_capture_reviewed_20260924/codex_capture_regressions.json`、`release/codex_t10_native_initial_20260923/codex_profile_over_limit_reviewed.json` |
| 调试 APK | 81,180,420 字节，SHA-256 `B6D5B36F9EABA3E23ACB3733FA654CD4B689023CB80B5B95CC73A6F7B8B7F234`，与构建输出相同 | `release/codex_t10_native_initial_20260923/codex_t10_debug.apk` |
| 差异检查 | `git diff --check` 退出 0；只有 Git 换行转换提示 | 主工作区 |

个人手机未连接，低内存 OEM 及系统文件选择器体验留待 T18；T10 项目模拟器结果不能替代手机验收。当前调试 APK 包含 T07/T08/T10 源码变更，未签名为正式交付包，也未提交、推送或发布。接续 S3 T11/T12。

## 2026-09-24 T11 发布质量入口

入口从 Gradle、npm、Capacitor 配置读取并核对真实版本和包名；Android versionCode 从 26 增至 27。先全量检查、再清理已核实的生成目录、同步/签名构建，最后核对包内网页文件集合与 SHA-256、平台桥接脚本、配置、证书及升级版本；只复制到新证据目录。旧 2.1.9 验证脚本标记为历史用途。

| 检查 | 结果 | 证据 |
|---|---|---|
| 最终签名测试包 | `2.9(27)`、79,270,327 字节、SHA-256 `961fffb76bd280ab9b677cf1db86a0872f2d69eb988c6f376edef6f9cd5c9bc6`；证书与原 v2.9 相同 | `release/codex_t11_signed_test_delivered_20260924/build_manifest.json` 与同目录 APK |
| 发布前质量门槛 | 22/22 全量检查、8/8 Android JUnit、Gradle `assembleRelease`/`lintVitalRelease` 通过 | 同目录 `checks/codex_results.json`、`android-unit/`、五份分步日志 |
| APK 资源 | 9 个 public、3 个平台受控文件逐字节匹配；39 个资产逐项列哈希，无旧 JS | 同目录 `assets.json` |
| 负向注入 | 旧 JS、篡改文件、类型失败、版本 26、伪造签名预期、越界输出与报告覆盖均被拒绝 | `release/codex_t11_negative_assets_20260924/` 与 `release/codex_t11_negative_type_20260924/` |
| 独立复查 | 祖先 junction 与 `release` 自身链接风险修补后复核关闭；实际 junction 注入被自动审批拒绝 | `docs/session-summaries/codex_session_summary_2026-09-24_t11.md` |
| 差异与原发布包 | `git diff --check` 退出 0；原发布 v2.9 APK 哈希未改变 | 主工作区和发布原包 |

草稿回归固定 9 月 23 日导致跨日误报，改用浏览器本地今日后定向及最终全量通过。未安装 Yves 手机、未提交/推送/公开发布。接续 T12 性能与字体评估，再按计划进入 S4–S5。

## 2026-09-24 T12 按需加载与字体

按实际导入图把年度年记、听感页、分享与洞察延后加载；完整 Noto/Montserrat 字库无损转换为 WOFF2，旧 WOFF 与 OFL 原文保留。项目专用 Android36 AVD 离线、15 条合成记录/15 张榜单、每版冷暖启动各 10 次和三轮榜单三页预览。首页初始 JS 减少 18.60%，仅请求 JS/CSS；30,890 字符映射、字形顺序、字重、可变轴均与原字体一致。22/22 全量检查通过，最终源码针对年记/榜单/分享/无障碍再次定向检查。当时生成的调试 APK 大小 88,531,483 字节，SHA-256 `E6580F615D924A3355375923BC0115F1031CA524756659D94187551BB173E642`；本地 APK 已在后续旧测试包清理中移除。

三轮 WOFF2 对照中，暖启 P90 和导出峰值 PSS 均未恶化；冷启 WebView 就绪 P90 为 6,176 / 6,120 / 3,788 ms，对比基线 3,485 ms，首次 15 张三页预览为 4,078 / 3,388 / 3,980 ms，对比 3,395 ms。无法证明两项均满足 ≤10% 不恶化目标。一次额外重启复测时宿主可用物理内存约 611 MiB，测量中止并清理转发；未以此轮放行。详情与原始 JSON 见 `docs/session-summaries/codex_session_summary_2026-09-24_t12.md` 和 `release/codex_t12_performance_20260924/`。项目 AVD 网络状态已恢复并停止；没有触及 Yves 手机、提交、推送或公开发布。继续 T13，T12 两项门槛保留到低干扰集成验收。

## 2026-09-24 T13–T15 创新功能

| 编号 | 已实现与验证 | 剩余边界 |
|---|---|---|
| T13 专辑盲重听 | 专辑详情和每日重逢入口使用现有重听记录；提交前隐藏旧评分、情绪与正文，提交后对照。23/23 全量通过：`release/codex_t13_full_20260924/codex_results.json`；交接 `docs/session-summaries/codex_session_summary_2026-09-24_t13.md` | Android 专项留 T18 |
| T14 恢复差异与预演 | 七类数据四向差异，SHA 与本机摘要绑定；Web 独立 Storage 和 Android36 隔离 SQLite 实写回读，正式数据前后一致。24/24 全量及原生插件成功/故障注入通过：`release/codex_t14_full_20260924/`、`release/codex_t14_android_final_20260924/`；交接 `docs/session-summaries/codex_session_summary_2026-09-24_t14.md` | 临时数据库保留；系统文件提供器留 T18 |
| T15 跨年专辑轨迹 | 保存名次与当前乐评/重听关联，缺年和孤立榜单如实展示；同名异人、编辑、备份往返定向通过：`release/codex_t15_final_20260924/`；交接 `docs/session-summaries/codex_session_summary_2026-09-24_t15.md` | 最终全量结果见 `release/codex_t15_full_retry_20260924/`；Android 导航留 T18 |

三项均在未提交工作区；未接触 Yves 手机、提交、推送或公开发布。T12 两项性能门槛仍未关闭，接续 T16。

## 2026-09-24 T16–T17 导出与诊断

| 编号 | 已实现与验证 | 剩余边界 |
|---|---|---|
| T16 导出预检/附页 | 同一规划报告名次、文字裁切和实际封面占位；可定位编辑；完整理由分页参与全选、页码、保存/分享。1–15 张、emoji、16 种隐私组合、明暗主题和脱敏复制通过。25/25 全量及最终受影响复测见 `release/codex_t16_full_20260924/`、`release/codex_t16_replan_final_20260924/`；交接 `docs/session-summaries/codex_session_summary_2026-09-24_t16.md` | Android 系统接收应用留 T18 |
| T17 本机诊断 | 版本/构建、备份时间、草稿计数、恢复只读屏障和通知授权只读展示；复制字段白名单。Web 离线/敏感标记与 Android36 实际 PackageManager、权限撤销/恢复通过。26/26 全量、定向、Android JUnit/插件证据见 `release/codex_t17_full_20260924/`、`release/codex_t17_final_targeted_20260924/`、`release/codex_t17_native_permission_20260924/`；交接 `docs/session-summaries/codex_session_summary_2026-09-24_t17.md` | 调试 APK 未同步最新 Web 页面；完整签名测试包留 T18 |

项目 AVD 已停止并恢复权限，ADB 转发为空；没有连接 Yves 手机、提交、推送或公开发布。T12 性能门槛仍未关闭，接续 T18 集成验收。

## 2026-09-25 T18 最终包与验收判断

T13/T14 原复查中指出的每日专辑标题错配、旧 v5 备份设备健康状态误计入差异已修补；T15–T17 的当前正文/同名目录身份、导出复制隐私、诊断读取失败提示已修补。两轮独立只读复查确认相应 P2 闭合。最终源码的 `release/codex_t18_final_signed_20260925/checks/codex_results.json` 26/26 组通过，Android JUnit 8/8，`lintVitalRelease` 与 APK 资源集合/哈希一致。最终签名测试 APK SHA-256 为 `6a5d927676627898e6e4686090cae0f9b042425e6539c4dce48cb28af2198ac1`；原 v2.9(26) APK 保持不变。

项目自建 Android16/API36 模拟器正常安装旧版并创建一条合成正式乐评和一份速记草稿，`adb install -r` 覆盖到最终签名包后两者保留；通过系统 DocumentsUI 导出/选入 v5 备份，实际隔离 SQLite 预演回读、正式导入及 v6 导出后逐字段对照通过。证据 `release/codex_t18_upgrade_20260924/codex_final_restore_result.json`。最终签名包的“更多 → 本机诊断”及脱敏复制到搜索框经 UI 验证通过，证据同目录 `codex_final_diagnostics_result.json`。模拟器已停止，ADB 转发已清理。

T12 同机固定 15 条数据复测见 `release/codex_t18_performance_20260925/codex_assessment.json`：初始 JS 减少 17.49%，暖启/峰值内存及 15 张总预览达标；冷启 P90 3,485→5,974 ms、首张预览 1,825→2,173 ms，超过 10% 门槛，验收未通过。测试宿主时序波动大，不能从这轮归因于单一代码变更，也不能据此宣称已达标。其他未取得的真实手机/系统接收应用/TalkBack 证据逐项写入 `docs/codex_v29_upgrade_acceptance.md`。本地测试包保留，不提交、推送或发布。
