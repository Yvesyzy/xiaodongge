# 小懂哥 v2.9 团队审查

审查日期：2026-09-16。基线：`b563e32`，实现提交 `66bf196`；`package.json` 为 2.9.0，Android 为 2.9 / 26。审查开始时工作区干净。

本次按 Yves 要求启动团队审查，没有修改产品源码、用户数据库或发布 APK。三个独立只读子代理分别获派数据层、移动端和 Android，但全部因额度限制中断，没有交回可验收报告。Yves 要求继续后，主代理接手补查；本报告仅收录主代理亲自读取、复现或核实的证据，不声称完成了三份独立交叉审查。

优先级：P1 = 优先修补；P2 = 后续版本修复或改进；P3 = 产品探索。证据分为运行复现、代码确认、外部公告确认、待真机验证。对特定异常条件的代码确认不等于用户已发生该故障。

## 覆盖范围与验证边界

| 范围 | 审查内容 | 验证方式 |
|---|---|---|
| 移动端 | 首页、完整记录、速记、草稿、重听、搜索、聚合、阅读、年记/月报、榜单、PNG、主题与无障碍 | 调用链审查；隔离 Chrome；合成数据 |
| 数据 | SQLite / localStorage、备份、撤销、封面、AppData、日期归档、语义统计、天气 | 静态审查；32 项基础测试；内存 SQLite 故障注入 |
| Android | Intent 分享、通知读取、OCR、文件保存分享、导航与生命周期、Manifest | 原生代码审查；前端桥接模拟；不等同真机测试 |
| 旧网页端 | `src/` Next.js 页面/API、Prisma、输入校验、统计及生成总结 | 静态调用链与本地 CLI 配置核查；未启动连接真实数据库的服务 |
| 工程发布 | npm 依赖、TS 配置、回归脚本、Gradle/签名、APK 资源与版本、文档交接 | 类型检查、新目录构建、官方 npm audit、APK 哈希与资源比对 |

没有读取个人 `.data` 数据、签名密码或其他助手的私人配置。没有执行漏洞利用、覆盖安装、远程发布或自动依赖升级。Android 真机兼容性、外部音乐应用实际分享格式和 OEM 行为仍需手机证据。

## 本轮实际执行结果

| 检查 | 结果 |
|---|---|
| `npm test` | 32/32 通过 |
| 根项目 `tsc --noEmit --incremental false` | 通过 |
| `tsc --noEmit -p mobile/tsconfig.json` | 失败：共享测试缺少 Node 类型 |
| 上项补充 `--types vite/client,node --incremental false` | 通过；证明问题来自配置，不是缺少已安装依赖 |
| Vite 新目录生产构建 | 通过；主 JS 623.88 kB，gzip 185.63 kB；中文字体 11,294.72 kB；有超过 500 kB 的 chunk 提示 |
| SQLite 备份 / 失败回滚 / 无封面往返 / 撤销 | 通过；内存 SQLite 模拟 Android executeSet 合约 |
| 旧备份、损坏字段、导入确认 | 通过 |
| 封面 SQLite 归属、艺人隔离、回退、写入失败 | 通过 |
| v2.9 榜单 1–15 张，共 30 页 | 通过；含字体、真实/缺失/更换封面、长文本、emoji、隐私、三视口与 PNG |
| 四类记录分享 | 通过；连续原文、完整分页、复制、隐私、取消后保留 |
| 年度/月度标签、滑动、横向溢出 | 通过 |
| 原生导出前端桥接 | 通过；取消、部分保存、重试、9+5 多图批次；未操作 Android 系统文件选择器 |
| 浅/深各十页面文本对比度 | 脚本均报告零失败；各报告一处 checkbox 的有效区域尺寸边界，未据此声称完整 WCAG 合规 |
| 月报回归脚本 | 原脚本因旧按钮文案失败；只在审查副本将“重新生成”替换成“更新月度报告”后全套通过 |
| 年记回归脚本 | 原脚本因旧“下一篇 →”失败；副本修正文案后又因期望展开 5 篇、实际 71 篇失败；未把该脚本整体列为通过 |
| 当前正式 APK | SHA-256 与发布记录一致；本轮新构建的全部 8 个输出文件与 APK 中对应文件逐字节一致 |
| npm 生产依赖审计 | 官方 registry 返回 10 个受影响包节点：1 critical、8 high、1 moderate；不是 10 个已证实可利用漏洞 |

测试仅在 `release/codex_audit_v29_20260916/` 的隔离副本调整 localhost 端口、fixture 相对路径和输出目录；产品与原回归脚本没有改动。构建产物位于 `release/codex_audit_v29_build_20260916/`。

## 数据保护发现

| 编号 | 优先级 / 状态 | 触发、影响 | 依据与最小修补 |
|---|---|---|---|
| D1 | P1；运行复现 | Web 存储连续有两份无效 JSON：读取第一份后删除原键并隔离，读取第二份时覆盖同一个隔离槽，再删除第二个原键；第一份可抢救原文彻底失去。 | `mobile/src/storageSafety.ts:25`。保留按原键区分的隔离记录，或者隔离槽已有内容时停止继续迁走原始数据。不能仅提示“已隔离”后覆盖先前副本。 |
| D2 | P2；故障注入复现 | Android 保存导入前快照先 DELETE 再单独 INSERT；后者因磁盘写失败时，当前导入中止、主数据没有被导入替换，但之前的撤销快照已经丢失。 | `mobile/src/store.ts:684`。使用单条原子 upsert/replace 或事务更新 UndoBackup；对“已有撤销点 + 新快照写失败”加保护检查。 |
| D3 | P1；运行复现 | Web 端单条记录字段损坏时，读取会跳过并仅 console.warn；随后新建正常记录会用过滤后的数组重写存储，损坏条目的原文也随之消失，没有隔离副本。 | `mobile/src/store.ts:194,1234,1242`。将原始坏行隔离后再允许写入，或者保留原始数组中的坏行并阻止破坏性重写；备份界面明确提示存在未纳入导出的记录。复现为初始 2 行，读取 1 行，新建后 2 行，但原坏行已经不存在。 |
| D4 | P2；运行复现 | 5 个损坏的新建草稿占满配额，列表却显示 0 份；用户无法通过草稿箱删除这些占位，无法继续新建。 | `mobile/src/entryDraft.ts:87,116`。列表展示可导出原文/删除的损坏草稿，计数和可操作列表使用一致口径。不要静默自动删除草稿。 |
| D5 | P2；运行复现 / 备份范围缺口 | 有效草稿只保存在 localStorage，不进入 JSON 备份；`allowBackup=false`，系统自动备份也不能被当作草稿迁移方案。换机或卸载重装后，导入当前 JSON 无法恢复草稿。 | `mobile/src/store.ts:633`、`mobile/src/entryDraft.ts:59`、Manifest。为草稿增加版本化导出/导入，处理编辑草稿关联冲突；完成前在备份说明中明确标出“草稿不包含”。 |
| D6 | P2；运行复现 | 首页统计按专辑名去重，专辑列表和年记按作品身份区分；两位艺人的同名专辑，在首页计 1 张、专辑列表计 2 张。 | `mobile/src/store.ts:881`、`mobile/src/App.tsx:269`，对照 `mobile/src/codex_YearbookPage.tsx:281`。复用现有作品身份规则，统一专辑/歌曲数量口径。 |

复现脚本 `release/codex_audit_v29_20260916/codex_reproduce_storage.mjs`；输出 `codex_storage_reproductions.json`。脚本断言当前错误行为，以证明问题存在；不是修复后的回归测试。隔离场景使用内存 Map；撤销场景使用内存 SQLite。

D3–D6 的复现见 `release/codex_audit_v29_20260916/codex_reproduce_ui.mjs` 与 `codex_ui_reproductions.json`，均为新建浏览器上下文中的合成数据。

## 移动端功能与体验发现

| 编号 | 优先级 / 状态 | 触发、影响 | 依据与最小修补 |
|---|---|---|---|
| M1 | P1；模拟原生桥接运行复现 | 打开已有速记草稿，同时手机正在播放另一首作品：旧正文、旧评分仍在，专辑名/艺人却被新播放信息替换，并在 300ms 自动保存后写回同一草稿，形成内容与作品错配。 | `mobile/src/QuickCapturePage.tsx:84,88,182,207`。恢复草稿后不要执行无保护的 `refreshNowPlaying(false)`；使用现有 dirty/切换确认机制，并在异步目录补全完成时再次核对当前表单身份。复现结果：旧正文仍为“只属于旧专辑的草稿正文”，albumName 已变为“新播放专辑”。 |
| M2 | P2；运行复现 | 上传封面后出现 `Cannot set properties of null (setting 'value')`；图片可以已处理成功，但文件输入未清空，重复选同一图片无法可靠触发处理。OCR 原生异步路径和专辑聚合页存在同一写法。 | `mobile/src/App.tsx:828,853,1635`。在 await 前缓存输入元素，finally 使用缓存值。浏览器复现验证了封面入口；OCR 的同源写法为代码确认。 |
| M3 | P2；运行复现 | 已删除原乐评的榜单专辑仍保留，但编辑器没有单独移除按钮，且该专辑不再出现在复选框列表；当年度正式记录全删光时，年记的提前返回还会屏蔽已存榜单的查看/编辑/导出入口。 | `mobile/src/codex_TopAlbumsEditor.tsx:60`、`mobile/src/codex_YearbookPage.tsx:177`。给已选列表独立“移除”；空年也允许读取、管理已保存榜单。保留记录删除后仍可导出的设计，不应通过自动清空榜单解决。 |
| M4 | P2；代码确认 | Android 同一天保存多张重听对比卡时都写入 `xiaodongge-relisten-YYYYMMDD.png`，使用 Filesystem WRITE 模式，存在同路径覆盖；没有系统选择位置/分享闭环。 | `mobile/src/RelistenPage.tsx:143` 与已安装 Filesystem 的 `FilesystemMethodOptions.kt:95`。复用 `NativeExport`，文件名含记录/重听 ID 或时间，保留用户已导出的不同卡片。`QuickMemoryCardPanel.tsx` 有相同旧实现，但当前无调用方，不能把它算作活跃功能故障。 |
| M5 | P2；代码确认 / 无障碍缺口 | 评分滑块是自定义 div，只有鼠标和触摸事件；没有 tabIndex/键盘处理，键盘用户无法焦点进入并调整分数。 | `mobile/src/RatingSlider.tsx:117`。优先评估原生 range；保留现有样式时补方向键、Home/End、焦点和空评分语义。现有对比度脚本没有覆盖键盘操作，零对比度失败不代表交互无障碍完整。 |

M1–M3 已由 `codex_reproduce_ui.mjs` 复现。M4 的真实文件管理器表现、M5 的 TalkBack 行为仍需真机验证；代码本身的固定文件名和缺失键盘处理已经确认。

## Android 原生与发布发现

| 编号 | 优先级 / 状态 | 触发、影响 | 依据与最小修补 |
|---|---|---|---|
| A1 | P1；代码确认，特定存储提供器异常需真机故障验证 | 单文件保存方法在 try-with-resources 内先 `call.resolve(saved)`，随后才执行输出流 close。如果 close 最终失败，前端已经收到成功；JSON 备份健康状态会被标成已保存。多图保存反而正确地在流关闭后记录成功。 | `NativeExportPlugin.java:182–190`、`mobile/src/App.tsx:1981`；Capacitor `PluginCall.resolve` 立即发送成功响应。把成功响应移到资源完全关闭后；模拟 close 抛 IOException 时前端必须收到失败且不得更新健康状态。 |
| A2 | P2；代码确认 / 容量防护改进 | OCR 将任意选图完整转 Base64，再在原生层完整解码为 bitmap，没有文件字节、像素或边长上限。长截图/高分辨率图片会放大内存占用；本轮没有制造 OOM。 | `mobile/src/App.tsx:841,2962`、`ScreenshotOcrPlugin.java:30–34`。先读尺寸、限制像素预算并采样缩小，在桥接前处理超限反馈；真机测量识别率和峰值内存。 |
| A3 | P2；APK 实测 / 发布改进 | 本轮新构建 8 个输出均与 v2.9 APK 对应文件一致，但 APK 另外带有 3 个历史 JS 文件，合计 640,925 字节（未压缩）；当前入口正确，不是“v2.9 打进了错误入口”。 | 多余文件为 `assets/index-tJ5Rt2t5.js`、`assets/web-BA3E61gy.js`、`assets/web-BkKSO1mA.js`。发布检查应同时比较内容和文件集合，允许 cordova 占位文件；在受控构建目录处理遗留资源，不盲目全仓清理。 |
| A4 | P2；代码确认 / 发布改进 | 正式构建脚本检查签名、包名、版本，但不自动执行类型/UI 回归，也不做 APK 与本次构建资源集合比对；版本号和输出名硬编码在多个文件。另有旧验证脚本仍限定 2.1.9。 | `scripts/build-android-release.ps1`、`scripts/codex_verify_android_release.ps1:48`。将本轮有效检查接入单一发布入口；从已核实版本源读取元数据，把旧脚本明确归档说明。无需每次重做全套视觉预览。 |

其余已检查的防护：通知监听服务要求系统绑定权限；FileProvider 不对外导出；PNG 桥接有大小/签名校验和目录边界检查；批量保存有部分成功及重试映射；目录联网补全限制 CN/US、设置超时与最大响应大小。以上是局部防护核查，不是全面安全认证。

还需真机证据：覆盖升级后数据/草稿保留、系统选择器取消与磁盘满、多图接收应用延迟读取、通知权限撤回/音乐暂停、多应用媒体会话、OCR 长截图、后台回收后的分享 Intent、TalkBack 与旧 WebView。没有把这些未知边界写成已发生的故障。

## 工程与旧网页端发现

| 编号 | 优先级 / 状态 | 问题及影响 | 依据与建议 |
|---|---|---|---|
| E1 | P1；版本与公告确认；启用旧网页服务时适用 | Next.js 16.2.9 落在 Windows 服务器远程执行漏洞影响范围。该漏洞不对应 Android 静态 APK。 | `package.json`、`next.config.ts`；维护者公告 GHSA-p293-qw3h-jr36。若保留网页端，升级受支持修复版本并回归；若不用，应明确标为旧实验入口并收紧启动方式。不要自动执行 `npm audit fix --force`，审计中 Prisma 建议涉及版本倒退。 |
| E2 | P1；配置及代码确认；仅旧网页端 | `npm run dev/start` 没有指定 localhost，而本机 Next CLI 默认监听 0.0.0.0；记录 CRUD API 没有身份认证。其他可访问该端口的设备可直接访问档案 API。 | `package.json:6`、`src/app/api/entries/route.ts:7`、`src/app/api/entries/[id]/route.ts`。本地档案工具先绑定 127.0.0.1；如需远程使用，再设计认证与授权。网络/防火墙是否允许访问未经本轮探测。 |
| E3 | P2；代码确认；仅旧网页端 | 保存、删除、生成总结三个按钮未捕获 fetch 网络异常；网络拒绝后 loading 无法复位，用户只能刷新页面。 | `src/components/EntryForm.tsx:40`、`DeleteEntryButton.tsx:20`、`GenerateSummaryButton.tsx:19`。统一采用既有移动端的 try/catch/finally 模式并显示可重试错误。 |
| E4 | P2；运行复现 | mobile 独立类型检查默认失败；发布记录用命令行临时补类型，但配置未落地。 | `mobile/tsconfig.json:4` 包含 shared 测试却只声明 vite/client。分离应用与测试检查或加入 Node 类型，并提供固定 npm 检查命令。 |
| E5 | P2；运行复现 | 两套关键回归脚本失修；旧按钮/分页假设使后续导出断言不再执行。`npm test` 也没有涵盖这些 UI 回归。 | `scripts/codex_check_reports.mjs:56`、`scripts/codex_check_simple_yearbook.mjs:49,89`。按当前交互语义修脚本，统一 origin 与输出参数，建立一条会传播失败退出码的发布检查命令。 |
| E6 | P2；构建实测 / 改进 | 初始主脚本约 624 kB；榜单中文字库约 11.3 MB。对低端手机和 H5 网络预览的具体耗时尚未测量。 | `mobile/src/App.tsx` 静态导入多个低频页面；`mobile/src/codex_yearbookPages.ts:5`。优先按需加载年记导出/分析页；评估保留完整中文覆盖的 WOFF2 压缩，不能为了缩包导致中文缺字。 |
| E7 | P2；架构改进 | Next/Prisma 网页端仍用整数评分、手动 year/month，与 Android 的半分评分、草稿和 createdAt 归档不一致，维护与安全负担重复。 | `prisma/schema.prisma:23`、`src/lib/entry.ts:78`、`src/lib/stats.ts:35` 对照移动端模型。建议明确支持边界；保留旧版需单独说明功能与数据不互通，不能让 `npm run dev` 被误认成 v2.9 手机产品。 |

## 依赖审计的适用性

本机默认 npmmirror 的安全审计 API 返回 404 / NOT_IMPLEMENTED；使用本次命令的 `--registry=https://registry.npmjs.org` 完成查询，没有改变 npm 全局配置。

- Next.js Windows RCE：维护者公告确认 16.0.0 至 16.3.3 之前的相关版本受影响；Windows 服务端符合需要优先处理的部署条件。没有进行攻击验证。[Next.js 维护者公告](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
- React Router：审计条目针对 unstable RSC APIs；本项目移动端入口使用 `HashRouter`，没有据此认定手机端存在该 CSRF 漏洞。[公告及适用条件](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)
- Prisma/deepmerge-ts、Next 间接依赖等其余条目保存在原始 JSON；需结合调用路径分批升级，不把审计包节点数等同于 APK 可利用漏洞数。

原始证据：`release/codex_audit_v29_20260916/codex_npm_audit_official.json`；APK 资源比对：同目录 `codex_apk_assets.json`。

## 可改进与创新方向（提案，不作为缺陷）

| 编号 | 方向 | 现有基础 / 具体增量 | 最小验收标准 |
|---|---|---|---|
| I1 | 专辑级盲重听 | 产品已以专辑为中心，但 `resurfacing.ts` 的重逢筛选仅处理 song，`App.tsx` 详情入口也限定 song。复用 ListeningMoment 与现有先写再揭晓流程，扩展专辑；不引入新的推荐服务。 | 专辑可以追加重听，旧评分在提交前不显示；原歌曲流程、备份和日期差计算仍通过。 |
| I2 | 备份恢复预演 | 现有导入预览主要给数量。增加将新增/覆盖/消失的记录数量、封面与草稿覆盖范围；提供在隔离内存库完成一次恢复验证的结果。 | 用户在确认前看清覆盖影响；恢复失败不改变当前数据；不因“文件校验通过”就声称全部恢复成功。 |
| I3 | 跨年专辑轨迹 | 已保存多个年份榜单、乐评评分和重听数据。增加同一专辑的入榜年份、名次变化、本人原句与重听变化；每一项可回到来源。 | 同名不同艺人隔离；无前一年榜单时显示“未记录”；不推测播放次数或情绪成因。 |
| I4 | 可定位的导出预检 | 现有榜单海报会压缩长专辑名和理由。导出前提示具体哪几项被截断、缺封面；点击回编辑，或切换完整文字附页。 | 预检和最终分页用同一份规划结果；隐私开关不泄露被隐藏正文；原文不改写。 |
| I5 | 本机诊断页 | 现有备份健康、版本与原生错误提示分散。汇总包版本、Web 资源版本、备份时间、草稿数量、数据库读取状态和通知权限；错误可复制为脱敏诊断。 | 默认不包含正文、封面、密钥或私人曲目清单；能让 Yves 直接定位权限、存储还是打包问题。 |

建议顺序：先处理可能影响数据保留与旧网页端暴露的 P1 项，再补齐测试与发布检查，最后优先探索 I1 和 I2。性能优化以低端 Android 真机测量为依据，不因单一 bundle 警告重构整个项目。
