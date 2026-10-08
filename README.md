# 小懂哥 v3.0.1

一个在安卓手机本地运行、以专辑为中心的私人音乐感受记录 APK。它只保存你手动输入或确认过的信息，不自动编造歌曲、专辑、歌手或感受。v3.0.1 改善当前播放的歌曲、专辑、歌手读取反馈，恢复完整乐评的情绪、评分、曲风入口，将新建草稿上限扩至 10 份，并修复深色乐评表单的浅底浅字；保留 v3.0 的专辑盲重听、跨年轨迹、备份恢复预演、榜单导出预检与本机诊断。

## 功能

- 新建、查看、编辑、删除音乐感受记录
- 识别当前播放后默认建立专辑记录，并把触发记录的歌曲保留为来源曲目
- 一屏完成一句话专辑速记，评分、情绪和音乐身份按需展开
- 从 Android 其他音乐应用的系统分享菜单直接进入速记
- 按年份和月份查看时间轴
- 查看专辑聚合和歌曲聚合
- 给专辑或歌曲保存封面
- 从音乐截图中识别歌曲、专辑、艺术家等信息
- 从 Android 系统媒体会话读取当前播放信息，并可补充 Apple Music 目录元数据
- 新建和编辑乐评时自动保存草稿；正文未填写时也可独立保存草稿，新建菜单提供完整、速记和草稿三个入口
- 搜索标题、正文、歌曲、专辑、艺术家、标签、情绪关键词
- 查看年度统计
- 在统一入口切换年度／月度回顾，分别查看音乐乐评、自述和草稿数量；少量记录突出作品，记录充足时展示带来源证据的变化
- 编辑年度封面、寄语、最多三篇精选作品及原句，并调整精选顺序
- 创建年度专辑榜单：从当年专辑乐评里按评分推荐或手动挑选最多 15 张，排定名次并为每张写下入选理由；榜单保存本机并随备份导出，可另存为 1080×1680 PNG
- 年度音乐杂志：封面、十二月总览、作品全文与来源索引；支持零记录、大量记录、搜索和月份筛选
- 年度封面、总览、索引、年度专辑榜单及作品正文按 1080×1680 PNG 分页预览、逐页保存或系统分享
- 年度专辑榜单导出为青绿渐变与金色年份的拼贴海报：完整15张分为11–15、6–10、1–5三页；冠军封面460px，其他组为两大三小封面；长理由最多展示两行并以省略号收尾，完整文字保留在榜单页。字体离线随包，封面按专辑与艺人复用，原记录删除后已保存的专辑封面仍可显示
- 年记页「年度回顾 / 月度回顾」标签支持点击与左右滑动切换，下划线跟随手指移动，面板按行进方向滑入
- 阅读页支持字号、浅深背景、继续阅读，以及返回目录时恢复筛选和滚动位置
- 歌曲、专辑、月度自述和年度自述统一分享：连续原文摘录、完整分页图片、全文复制，可隐藏评分、日期和应用名称
- 在乐评正文后查看“当日听感注记”
- 从专辑详情或每日重逢进入盲重听；提交前隐藏旧评分和正文，提交后查看前后对照
- 查看同一专辑跨年的榜单名次、正式乐评和重听轨迹；同名不同目录来源在详情中区分
- 导入备份前查看新增、更新、移除差异，并在隔离数据库中预演写入和回读
- 榜单导出前查看文字截断与缺封面提示，可定位编辑并附上完整入选理由分页
- 在“更多 → 本机诊断”查看版本、备份、草稿、存储和权限状态，复制脱敏摘要
- 生成十二套独立美术主题的月度听感作品
- 月报区分未生成、已生成和待更新状态，更新失败保留已有报告；生成报告也可通过统一面板分享
- 生成包含用词、证据原句、月度轨迹和审美迁徙的年度私人听感标本册
- 按工作日、普通假日、调休工作日和节假日补充日期背景
- 手动选择城市后，按乐评日期缓存历史天气；天气只作背景关系，不推断情绪原因
- 对本地语义误识别进行排除或分类校正
- 查看抽象听歌地图：按 `moods` 和 `tags` 把记录归入情绪大陆
- 导出、导入备份，并支持撤销最近一次导入；导出提供「保存到文件夹」「系统分享」「复制内容」三个入口，全部使用 Android 原生能力并实时反馈处理状态
- 检查 JSON 备份的记录数量和 SHA-256，区分最近验证与最近成功保存；只有系统确认写入成功后才会更新备份健康状态
- 全局深色模式：跟随系统、浅色、深色三档切换，入口在「更多」页；深色界面按亮度阶梯分层设计，阅读页保留独立深浅开关
- 触觉反馈：按钮和主要控件按下时轻微振动（可在系统层关闭振动时静默降级）
- 专辑／歌曲列表采用放大居中的 110px 封面，信息行精简为名称、艺术家、最近记录日期和最新评分
- 「更多」页集中低频入口，新增外观设置区块
- 无障碍：十页面文本对比度达 WCAG AA，交互目标不低于 24×24（主要控件 44px），支持系统"减少动态效果"设置

## 技术栈

- React
- Vite
- TypeScript
- Capacitor
- Android
- Capacitor SQLite

## 下载 APK

最新安装包下载：

当前安卓版本为 `3.0.1 (29)`（npm 包版本 `3.0.1`），沿用 v2.5 至 v3.0 的长期发布签名，可直接覆盖这些正式版本，无需卸载。更早旧签名版本和 debug 版本请先保存并回读备份，再按签名兼容情况迁移。

- [下载 v3.0.1 APK](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.0.1/codex_xiaodongge-v3.0.1.apk)
- [下载 SHA256 校验文件](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.0.1/codex_xiaodongge-v3.0.1.sha256.txt)

发布页：[小懂哥 v3.0.1](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.0.1)。

v3.0.1 APK 包含 v3.0 发布后的当前播放信息显示、10 份新建草稿上限和深色乐评表单修补；原 v3.0 Release 与附件保持不变。

签名证书 SHA-256：`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`。

APK SHA-256：`83e623d3092c3a2f84e463c4ecea4a5550c214795c4a10792d9a3da631870525`；大小 75,773,270 字节。

本版通过 26 组完整检查、8 项 Android JUnit、正式签名构建与包内 17 个网页文件及 3 个平台文件逐字节核对。项目 Android16 模拟器从 v3.0 覆盖升级至 v3.0.1，首装时间、合成乐评与草稿保留；实体手机、实际 B 站、系统分享接收应用和 TalkBack 尚未完成本版验收。冷启动及首次榜单预览的既定性能门槛尚未通过，详见[发布说明与验收边界](docs/codex_v301_release_notes.md)。

榜单字体采用 Noto Sans SC 和 Montserrat 900 数字子集，OFL授权随包提供于 `mobile/public/codex_font_licenses.txt`；未使用 Spotify 专有字体。中文保留完整字库，支持离线导出。

JSON v6 默认包含封面与有效草稿；取消「JSON 包含封面」可生成无封面文件。导入时勾选「跳过备份封面，保留当前封面」，其他内容照常恢复；导入前可查看差异并在隔离数据库预演，正式导入保存可撤销快照。v1–v5 旧备份仍可读取，因旧格式没有草稿字段，导入时保留本机草稿；旧版 APK 不能读取 v6 备份。

## 构建 APK

### 开发入口与数据范围

`npm.cmd run mobile:dev` 是当前移动端的 H5 开发入口；Android 使用本机 SQLite，H5 使用该浏览器地址的 localStorage，二者不会自动同步。

`npm.cmd run dev` / `npm.cmd run start` 是保留的 Next.js/Prisma 旧网页端，仅绑定 `127.0.0.1`，不提供远程登录和授权。它使用独立的 Prisma 数据库，仍采用整数评分及手动年份/月份归档，不具备手机端全部草稿、半分评分和备份能力。不要把网页端数据库或导出文件当成手机备份直接覆盖导入。该入口保留安全维护，不作为 v3.0.1 手机界面的预览。

### 可重复检查

```cmd
npm.cmd run typecheck:mobile
npm.cmd run verify
npm.cmd run verify:full
npm.cmd run verify:android
```

检查使用独立浏览器上下文和合成数据，日志与构建结果保存在新的 `release/codex_validation_*` 目录。已安装包与锁文件版本不一致、必需测试文件缺失或任一必检失败都会返回非零退出码；`verify:full` 增加榜单、原文分享、年度/月度标签与旧网页端隔离构建和故障重试回归。年记原型检查需要专用本机端口 5174，已被占用时会明确失败，不接管已有服务。这些检查不代替 Android 真机升级、系统文件提供器和 TalkBack 验收。

PowerShell 定向复查示例：`pwsh -NoProfile -File scripts/codex_verify_project.ps1 -Scope affected -Checks reports,yearbook`。

`verify:android` 使用本机 JDK/Android SDK 编译原生测试，然后直接把 Gradle 提供的运行类路径传给 JUnit，绕过本机 Java 启动器读取 Gradle 参数文件中中文路径失败的问题。它验证写入、刷新、关闭失败和空输出流，不启动系统文件选择器；真机验收另行记录。

v3.0.1 的当前播放读取会在按钮附近显示结果，并在成功时列出歌曲、专辑、歌手；通知访问被撤销时提供设置入口，过期的目录补全不会覆盖正在编辑的作品。读取依赖播放器提供处于播放状态的系统媒体会话，暂停内容不会被当作当前播放。Android36 模拟器已通过系统会话检查；官方网易云 9.5.95 的实播读取记录来自先前测试，本版未重新完成在线实播。实际 B 站和其他手机系统未验，详见[播放回归交接](docs/session-summaries/codex_session_summary_2026-09-26_playback_review_regression.md)。

首次安装依赖：

```cmd
npm.cmd install
```

本地预览移动端 H5：

```cmd
npm.cmd run mobile:dev
```

然后在电脑浏览器打开终端显示的 Vite 地址。手机预览时，让手机和电脑处于同一网络，并把 Vite host 改成电脑局域网 IP 后访问对应地址；构建 APK 后也可以直接在安卓手机安装预览。

构建 debug APK：

```cmd
powershell -ExecutionPolicy Bypass -File scripts/build-android-debug.ps1
```

APK 输出路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

如果手机已开启 USB 调试，可以安装：

```cmd
C:\Users\lenovo\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## 正式签名 APK

仓库不会提交 keystore 或签名密码。正式发布脚本从以下环境变量读取长期签名身份：

```text
XIAODONGGE_KEYSTORE_FILE
XIAODONGGE_KEYSTORE_PASSWORD
XIAODONGGE_KEY_ALIAS
XIAODONGGE_KEY_PASSWORD
```

这些信息必须长期保存，不能提交到 Git。安卓应用升级时需要继续使用同一个 keystore，否则用户无法直接覆盖安装新版。

四项变量全部存在后执行：

```cmd
npm.cmd run android:build:release
```

脚本会在当前进程变量缺失时加载 Windows 用户签名变量，重新构建 Web 资源并同步 Android，随后执行 `assembleRelease`。只有正式发布证书、包名 `com.yves.musicarchive`、版本验证全部通过，才会输出 release APK 和 SHA-256；缺少任一签名变量时会在构建前失败。

在本机直连 `dl.google.com` 超时的网络环境下，正式构建脚本会注入 `scripts/gradle-mirrors.init.gradle`。`cap sync` 在部分环境会在 update 阶段被中断，建议分步执行 `capacitor copy android` 与 `capacitor update android`，并用 `mobile/dist` 与 `android/app/src/main/assets/public` 的资源哈希比对确认同步完整。

## 本地数据

阅读字号、主题和阅读位置仅保存在当前设备，不进入音乐备份。

安卓真机运行时，数据保存在手机本地 SQLite。主要表：

```text
ReviewEntry      音乐感受记录
MonthlySummary   月度听感作品及结构化分析快照
YearlySummary    年度标本册及结构化分析快照
CoverImage       专辑和歌曲封面
AppData          今日重逢状态、天气城市、天气缓存、代表原句、本地语义校正和年度专辑榜单
```

第一版手机端从空库开始，不导入电脑上的 `prisma/dev.db`。

## 私人听感标本册

月度和年度归档统一依据乐评创建时的本地日期 `createdAt`，即记录感受的时间，不依据专辑发布时间或首次收听时间。草稿不计入正式记录；编辑旧乐评不会改变其归档月份。年度默认展示简约音乐杂志，原有语义分析可从独立入口查看。

每日、月度和年度总结只分析 `song` 与 `album` 乐评；人工填写的“本月自述”单独展示，不会混入自动统计，也不会把月度总结文案再次分析进年度结果。

```text
主要音乐感受：温柔、克制、明亮、粗粝等
关注对象：人声、旋律、节奏、歌词、编曲、音色、制作、空间层次等
表达方式：画面、空间、身体感受、回忆、技术描述和场景描写
对象 × 描述词：同一分句内距离最近的配对
证据：出现次数、涉及乐评数和可返回原记录的代表原句
背景：工作日/假日、节日与按日期缓存的天气
```

本地分析使用确定性词典与规则，包含分句、最长词优先、否定词、程度词和转折后分句加权。所有结构化结果保存来源指纹；乐评、自述、天气城市或校正规则变化后，旧作品保留并标记为待更新，不会静默删除。

每个月拥有独立主题：霜刻唱片封套、漆红方印、植物标本页、雨线蓝图、日光剪纸、水纹乐谱、热浪胶片、夜航星图、标本抽屉、旅行票据、布面档案册和年末封缄信件。数据不足时降级为记忆卡或精简年鉴，不制造趋势。

应用不读取系统日历或个人日程，也不申请日历、定位权限。中国大陆 2025、2026 法定节假日与调休日期内置在本地；其他年份按普通工作日/周末分类。情人节、圣诞节等固定节日作为独立标签。天气查询只发送手动选择城市的粗略坐标、日期和时区，不发送乐评正文、情绪、标签或评分；断网或接口失败不会阻止总结生成。

内置节假日数据来自[国务院办公厅 2025 年部分节假日安排](https://www.gov.cn/zhengce/zhengceku/202411/content_6986383.htm)和[国务院办公厅 2026 年部分节假日安排](https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm)。城市搜索与历史天气使用 [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) 和 [Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)。

JSON 备份格式为 v6，包含有效草稿、追加听感、今日重逢状态、月度作品、结构化年度结果、天气设置/缓存、代表原句、语义校正和年度专辑榜单，并继续接受 v1 至 v5 备份。Android 系统云备份已关闭，避免私人乐评被系统自动复制；卸载前应从备份页保存并回读 JSON。

## v2 可视化

移动端“可视化记忆”卡片提供抽象地图入口，把记录按情绪和标签归入情绪大陆。

抽象地图使用现有字段：

```text
moods       情绪关键词，用于优先归类
tags        标签，在 moods 没有命中时参与归类
artistName  艺术家筛选
albumName   专辑筛选
year/month  年份和月份筛选
```

当前数据库没有 `play_count` 或 `album_id` 字段。v2 不新增播放统计表或修改记录表，专辑筛选使用真实字段 `albumName`。

电脑端 Next.js 也提供调试接口：

```text
GET /api/visualizations/abstract-map
```

支持的查询参数：

```text
abstract-map: year, month, artist, artistName, albumName, album_id, mood
```

移动端构建前检查：

```cmd
npm.cmd run typecheck
npm.cmd run mobile:build
```

## 电脑端网页

项目仍保留电脑端 Next.js + Prisma 网页代码，主要用于本地开发和历史版本参考。

运行电脑端网页：

```cmd
npx.cmd prisma generate
npx.cmd prisma migrate dev --name init
npm.cmd run dev
```

然后打开终端显示的本地地址，通常是 `http://localhost:3000`。

电脑端网页使用 `.env`：

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.5"
```

`.env.example` 提供同样的配置模板。

如果 Prisma 在 Windows 本机返回空的 `Schema engine error`，先在当前终端设置：

```cmd
set RUST_LOG=info
```

然后重新执行 `npx.cmd prisma migrate dev --name init`。这个环境变量只用于让 Prisma schema engine 输出并稳定初始化，不会改变数据库内容。

## 电脑端 OpenAI API Key

安卓 APK 的 v2.1.0 私人听感标本册不使用 OpenAI API。以下设置只适用于仓库中保留的电脑端 Next.js 历史页面；电脑端年度总结默认使用本地基础总结，若要启用大模型总结：

1. 在 `.env` 填入 `OPENAI_API_KEY`。
2. 保留或调整 `OPENAI_MODEL`。
3. 重启 `npm run dev`。

OpenAI 调用失败时，系统会回退到本地基础总结，不影响记录、搜索、统计和本地总结。

## 项目结构

```text
src/app/                    电脑端 Next.js 页面与 API
mobile/                     移动端界面、本地存储与 Vite/Capacitor 构建
android/                    Capacitor Android 原生工程与插件
shared/                     跨端共用的分析、备份和领域逻辑
prisma/                     Prisma 数据模型
scripts/                    构建、检查和验证脚本（package.json 直接引用这些路径）
docs/                       项目说明、发布说明、审查记录和设计资料
  session-summaries/         历次会话交接总结
  designs/                   交互与视觉方案
  shots/                     本地截图资料（不提交 Git）
  superpowers/               计划与规格文档
release/                    本地 APK 与 SHA-256 文件（不提交 Git）
node_modules/                本机安装的依赖
codex_status.txt             Codex 工作记录与交接状态
claude_status.txt            Claude 工作记录与交接状态
zcode_status.txt             ZCode 工作记录与交接状态
```

## 本地 APK 备份

构建后的安装包可以复制到本地 `release/` 目录备份。该目录不提交到 Git。

## License

MIT
