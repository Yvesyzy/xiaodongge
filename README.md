# 小懂哥 v2.2

一个在安卓手机本地运行、以专辑为中心的私人音乐感受记录 APK。它只保存你手动输入或确认过的信息，不自动编造歌曲、专辑、歌手或感受。v2.2 修复备份页导出无反应的问题，改用 Android 系统原生保存、分享与剪贴板，并换上贴合应用主题的新启动图标。

## 功能

- 新建、查看、编辑、删除音乐感受记录
- 识别当前播放后默认建立专辑记录，并把触发记录的歌曲保留为来源曲目
- 一屏完成一句话专辑速记，评分、情绪和音乐身份按需展开
- 从 Android 其他音乐应用的系统分享菜单直接进入速记
- 按年份和月份查看时间轴
- 查看专辑聚合和歌曲聚合
- 给专辑或歌曲保存封面
- 从音乐截图中识别歌曲、专辑、艺术家等信息
- 从安卓媒体通知读取当前播放信息，并可手动补充 Apple Music 目录元数据
- 新建和编辑乐评时自动保存草稿
- 搜索标题、正文、歌曲、专辑、艺术家、标签、情绪关键词
- 查看年度统计
- 在乐评正文后查看“当日听感注记”
- 生成十二套独立美术主题的月度听感作品
- 生成包含用词、证据原句、月度轨迹和审美迁徙的年度私人听感标本册
- 按工作日、普通假日、调休工作日和节假日补充日期背景
- 手动选择城市后，按乐评日期缓存历史天气；天气只作背景关系，不推断情绪原因
- 对本地语义误识别进行排除或分类校正
- 查看抽象听歌地图：按 `moods` 和 `tags` 把记录归入情绪大陆
- 导出、导入备份，并支持撤销最近一次导入；导出提供「保存到文件夹」「系统分享」「复制内容」三个入口，全部使用 Android 原生能力并实时反馈处理状态
- 检查 SQLite v5 备份的记录数量和 SHA-256，区分最近验证与最近成功保存；只有系统确认写入成功后才会更新备份健康状态

## 技术栈

- React
- Vite
- TypeScript
- Capacitor
- Android
- Capacitor SQLite

## 下载 APK

最新安装包下载：

```text
https://github.com/Yvesyzy/xiaodongge/releases/download/v2.2/xiaodongge-v2.2.apk
```

发布页：

```text
https://github.com/Yvesyzy/xiaodongge/releases/tag/v2.2
```

公开下载文件 `xiaodongge-v2.2.apk` 已使用长期发布密钥正式签名。证书 SHA-256 指纹为 `71:BD:27:89:5F:23:2E:54:65:09:AD:B7:F8:2A:7F:42:E4:A4:F8:A5:3D:FD:34:DE:4D:30:5A:56:AE:D2:9D:20`；后续 Android 版本必须继续使用同一份密钥，才能覆盖安装升级。

如果手机已安装旧的 debug 签名版本，正式 APK 不能直接覆盖安装。请先在应用的备份页导出 JSON，再卸载旧版、安装正式 APK并导入备份；从本次正式版开始，后续版本可以正常覆盖升级。

## 构建 APK

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

脚本会重新构建 Web 资源并同步 Android，随后执行 `assembleRelease`。只有 APK 签名、包名 `com.yves.musicarchive`、版本 `2.2 (13)` 全部验证通过，才会输出 `release/xiaodongge-v2.2.apk` 和 SHA-256；缺少任一签名变量时会在构建前失败。

## 本地数据

安卓真机运行时，数据保存在手机本地 SQLite。主要表：

```text
ReviewEntry      音乐感受记录
MonthlySummary   月度听感作品及结构化分析快照
YearlySummary    年度标本册及结构化分析快照
CoverImage       专辑和歌曲封面
AppData          今日重逢状态、天气城市、天气缓存、代表原句和本地语义校正
```

第一版手机端从空库开始，不导入电脑上的 `prisma/dev.db`。

## 私人听感标本册

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

JSON 备份格式为 v5，包含追加听感、今日重逢状态、月度作品、结构化年度结果、天气设置/缓存、代表原句和语义校正，并继续接受 v1 至 v4 备份。Android 系统云备份已关闭，避免私人乐评被系统自动复制；卸载前应从备份页保存 JSON。

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
mobile/                           安卓 APK 的前端界面和本地存储逻辑
mobile/src/ListeningYearbookView.tsx 每日注记、月度作品和年度标本册界面
mobile/src/listeningYearbook.ts   日/月/年结构化结果与防重复汇总
android/                          Capacitor 生成的 Android 工程
shared/listeningAnalysis.ts       本地语义词典、规则、证据和校正
shared/listeningContext.ts        日期分类、节假日、城市与历史天气
shared/visualizations.ts          v2 可视化归类、筛选和抽象地图规则
scripts/build-android-debug.ps1   debug APK 构建脚本
prisma/schema.prisma              电脑端网页的数据模型
src/app                           电脑端 Next.js 页面和 API
docs/superpowers/specs            设计说明
```

## 本地 APK 备份

构建后的安装包可以复制到本地 `release/` 目录备份。该目录不提交到 Git。

## License

MIT
