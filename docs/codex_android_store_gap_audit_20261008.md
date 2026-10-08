# 小懂哥 Android 应用商店上架缺口审查

核查日期：2026-10-08。发布人：Yves，个人主体；Yves 已确认没有软著、APP 备案号或商店开发者账号。本次完成审查与渠道研究，没有修改产品代码、重建 APK、注册账号、购买服务或提交发布。

## 结论

现有 Android 版具备发布签名、64 位包、隐私说明页及本地数据功能，但还没有达到可直接提交的状态。优先处理主体与版权/备案材料、首次隐私同意、Android SDK 披露和应用名称一致性；完成目标手机与 16 KB 环境验证后，再制作正式提交包。

渠道和费用详见 [个人发布渠道与材料清单](codex_android_store_personal_channels_20261008.md)。下列优先级是本项目的发布建议，不代替商店审核决定。

## 核查对象与已经通过的检查

- 实际 APK：`release/codex_ui_polish_delivery_20261002/codex_xiaodongge-v3.1.1-31-test.apk`，75,773,668 字节。
- SHA-256：`9ae4a23fe36b5724b8d89c15a775cbbdada8808dde3fb5cc36923d815a0fbf02`。
- 包名 `com.yves.musicarchive`，版本 `3.1.1` / `31`，最低 API 24，目标 API 36，含 `arm64-v8a`。
- `apksigner verify --verbose --print-certs` 通过；v2 签名有效。签名证书 SHA-256：`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`。无需为 Android 另购 Windows 商业代码签名证书；后续包须保持升级签名连续性。[Android 签名说明](https://developer.android.com/studio/publish/app-signing)
- ZIP 中原生库的 16 KB 对齐检查通过；64 位库的 ELF LOAD 对齐通过。RELRO 另有静态问题，见下文。
- 当前源码的 `npm test`：32/32 通过；`npm run typecheck:mobile`：通过。这些检查不能证明商店隐私审核或真机兼容通过。
- APK 中包含隐私路由和字体许可文件；图标已有音乐主题设计。

原始结果位于 `release/codex_android_store_audit_20261008/`。本次读的是工作区源码和一个既有 APK，两者不是同一次构建。核查期间其他会话提交了分享样式修复；不能将当前源码检查结果直接等同于这个旧 APK 的运行行为。

## 按优先级处理的缺口

| 优先级 | 已确认事实 | 上架前工作与完成标准 |
| --- | --- | --- |
| P0 材料 | Yves 没有商店账号、软著、APP 备案 | 先选接受个人新 APK 的渠道；本人完成实名，按该渠道准备版权材料和备案。OPPO 个人流程单列电子版权证书，不能默认国家软著可直接替代。 |
| P1 隐私同意 | `mobile/src/main.tsx:12-20` 和 `mobile/src/codex_StorageGate.tsx:16-18` 直接进入应用；现有 `/privacy` 只是普通页面 | 增加首次告知与明确同意/拒绝流程，并按数据用途控制联网、媒体读取及 SDK 初始化。拒绝后不能执行需同意的数据处理；能保留的本地手动记录功能继续可用。新安装、拒绝、同意和重启均需验收。 |
| P1 政策内容 | `mobile/src/App.tsx:3033` 的 PrivacyPage 已说明本地保存、通知、Apple、天气和导出删除；Android OCR、ML Kit 等内容遗漏；`:3039` 的“除下述明确说明…外…不会主动上传”范围也需结合 SDK 核实 | 补上个人开发者身份、有效联系渠道、适用版本/更新日期、实际数据类型、目的、接收方、保存与删除方式、SDK 清单及政策链接；收窄未经证实的上传承诺；提供可公开访问的政策 URL，且与应用内版本一致。通知使用权需另有用途告知。 |
| P1 SDK 启动 | APK 合并清单含 `MlKitInitProvider`，`initOrder=99`，以及 Google DataTransport CCT 服务 | 核实并控制同意前 SDK 初始化和数据传输；用全新安装的网络捕获验收。只增加 React 弹窗不能控制 Activity 前启动的 provider。未抓包，不能声称当前 APK 已经发生违规上传。 |
| P1 名称一致 | `capacitor.config.ts:5`、`android/app/src/main/res/values/strings.xml:3` 及实际 APK 标签仍为“私人音乐档案” | 办理版权与备案前统一最终展示名称与材料；当前产品名是“小懂哥”，具体登记全称按平台命名规则确定。保持现有包名和长期签名，避免影响旧版升级。 |
| P1 兼容性 | 四个 64 位 `.so` 的 GNU_RELRO 末端不满足当前 Android 文档的 16 KB 静态公式 | 核实可用的 ML Kit / SQLCipher 预编译库版本，再在 16 KB 系统测试启动、建库、读写、恢复和 OCR。本次没有运行时结果，不应报作已经崩溃；也没有证明国内所有商店统一强制此项。 |
| P1 提交验收 | 本次没有连接 Android 设备；既有交接仍列出 OEM、分享接收端和 TalkBack 待验收 | 对选定商店对应的手机，验证首次安装、旧版升级、通知授权/撤销、当前播放、截图识别、离线记录、备份恢复与分享；验证数据不丢失。留下设备/系统/结果记录。 |
| P2 权限最小化 | 合并 APK 带 `USE_BIOMETRIC` / `USE_FINGERPRINT`，当前应用禁用 SQLite 加密且没有生物识别调用 | 从依赖和最终 manifest 核查是否可移除无用权限，再回归数据库流程。当前证据不支持“应用正在读取指纹/人脸”的说法。 |
| P2 素材与服务 | 字体 OFL 许可已随包提供；天气页面只有 Open-Meteo 名称，未见完整署名链接及许可说明 | 完善天气来源署名；商店截图使用自有或获授权封面、图片和示例内容，不公开私人记录。目录服务及商业化许可另行核对。 |

首次同意、独立隐私政策、开发者身份和联系方式等要求可参照 [小米上架要求](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1322)，目标渠道另须遵循其当前审核条款。小米规则用于核对常见缺口，并不表示个人现在可以新注册小米商店账号。

## 实际数据与 SDK 清单

| 功能 | 已验证调用与数据 | 政策和验收关注点 |
| --- | --- | --- |
| 当前播放 | `NowPlayingPlugin.java:53-88` 通过 MediaSessionManager 读取正在播放信息；`:148-157` 读取媒体 URI、封面 URI、来源包等元数据 | 用户通过系统设置授予通知使用权；无权时提前返回。首页有重逢记录时也自动读取（`App.tsx:218-253`，调用在`:238`），此路径不自动请求 Apple。监听服务本身为空，不据此宣称读取其他通知正文。说明读取、保存、封面展示范围，撤销后停止。 |
| Apple 目录补全 | `NowPlayingPlugin.java:110-113` 构造 `https://itunes.apple.com/search` 请求；发送歌曲名、歌手和已有专辑；先 CN 再 US 回退 | 表单进入和快速记录可自动触发。准确告知第三方接收歌曲元数据及网络请求信息；独立核对境外服务的数据处理安排。当前只取目录元数据，没有抓取 Apple artwork URL 或复制该图片；播放器自己的封面 URI 仍会保存，见下文。 |
| 城市搜索 | `shared/listeningContext.ts:129-131` 请求 `https://geocoding-api.open-meteo.com/v1/search`，发送手动输入的城市名 | 说明手动选择，不写成 GPS 持续定位。 |
| 历史天气 | 同文件 `151-160` 请求 `https://archive-api.open-meteo.com/v1/archive`；发送粗略城市坐标、日期范围、天气字段和时区 | `mobile/src/store.ts:939` 缓存缺失时查询。披露服务方、请求数据与保存策略；验证关闭/失败/离线时仍可记录。 |
| 截图 OCR | `ScreenshotOcrPlugin.java:90-95` 使用 `com.google.mlkit:text-recognition-chinese:16.0.1`；处理用户选择的图片 | Android 的 OCR 说明目前被 `desktop` 条件隐藏（`App.tsx:3042`）。应写明本机识别与 SDK 诊断数据的不同范围。 |
| 数据库 | SQLite 插件引入 SQLCipher 与 androidx.biometric；`capacitor.config.ts:9` 关闭 Android 加密，`store.ts:153-155` 使用 `no-encryption` | 不宣传已做数据库加密。备份文件的隐私提示、分享目的地和用户主动选择需验证。 |

Google 官方说明 ML Kit 输入图片/文字及识别输出在设备上处理，不发送给 Google；SDK 可发送性能与使用指标。数据披露文档列出设备/应用信息、安装标识及诊断指标，并说明清单对应最新版本。因此应结合本项目实际版本与抓包做最终清单，不能仅写“本机识别，因此 SDK 完全不联网”。[ML Kit 隐私条款](https://developers.google.com/ml-kit/terms)、[Android 数据披露](https://developers.google.com/ml-kit/android-data-disclosure)

静态审查未发现应用级广告、支付、Firebase Analytics、Crashlytics、Sentry、Mixpanel 或友盟接入；ML Kit 的诊断机制需单独审查。现有政策的上传承诺应结合官方 SDK 披露与抓包修订，不能从应用代码未主动调用遥测推断全部依赖都不传输。

播放器提供的 `artworkUri` 保存到 `musicMetadata`（`types.ts:28-33`、`store.ts:212-214,232-233`），快速记录页可直接作为图片源展示（`QuickCapturePage.tsx:402-412`）；完整 JSON 备份包含 entries，因而包含这些元数据（`store.ts:652-665`）。这不是 Apple 封面图片的复制。HTTP/HTTPS URI 在展示时可能产生网络请求；`content://`、`file://`、`data:` 等不应一概归为网络请求。隐私清单需要说明 URI 的保存、展示和备份范围。

实际合并权限见 `codex_apk_manifest.txt:14-27`：INTERNET、VIBRATE、ACCESS_NETWORK_STATE、USE_BIOMETRIC、USE_FINGERPRINT 及应用自定义 DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION。未发现相机、定位或广泛存储权限。通知监听服务有系统 `BIND_NOTIFICATION_LISTENER_SERVICE` 保护；其 exported 设置不单独构成缺陷。

生物识别权限来自 SQLite 插件的 `androidx.biometric:biometric:1.1.0` 依赖（`node_modules/@capacitor-community/sqlite/android/build.gradle:68`）；插件只在 `isEncryption` 为真时进入 biometric 初始化（`CapacitorSQLite.java:80-86`），当前未发现应用侧调用。现有构建的 manifest 合并来源记录将 ACCESS_NETWORK_STATE 指向 `com.google.android.datatransport:transport-backend-cct:2.3.3`；未发现应用代码直接调用，其 SDK 实际使用须运行时核实。

## 16 KB 原生库静态结果

Android 当前文档同时要求检查 LOAD、ZIP 与 GNU_RELRO。RELRO 判断公式为 `(VirtAddr + MemSiz) % 0x4000 == 0`。本 APK 前两项通过，后者的四个 64 位库未通过：[Android 16 KB 指南](https://developer.android.com/guide/practices/page-sizes)。

| APK 内路径 | 公式余数 |
| --- | ---: |
| `lib/arm64-v8a/libmlkit_google_ocr_pipeline.so` | 12288 |
| `lib/arm64-v8a/libsqlcipher.so` | 4096 |
| `lib/x86_64/libmlkit_google_ocr_pipeline.so` | 8192 |
| `lib/x86_64/libsqlcipher.so` | 4096 |

检查脚本 `release/codex_android_store_audit_20261008/codex_check_apk_elf.py` 只读 APK、使用 Python 标准库，不解压、不改包；结果 `codex_elf_16kb.json`，预期退出码 1。复核可运行 `python` 加脚本绝对路径及 `--apk` 参数，`--output` 指定一个不存在的新 JSON 路径。报告中的 32 位库不纳入 64 位门槛。

运行时验收先执行 `adb shell getconf PAGE_SIZE` 确认为 `16384`，再验证数据库与 OCR。当前没有连接设备，也没有下载新模拟器。不能通过改变 ZIP 对齐来修复已经编译好的 ELF RELRO 问题。

## 工程依赖告警，单独处理

默认 npm 镜像的审计端点返回 `404 NOT_IMPLEMENTED`，这不是“无漏洞”。临时指定官方 registry 后，`npm audit --omit=dev --registry=https://registry.npmjs.org --json` 返回 6 项依赖告警：5 high、1 critical；包含传递依赖链，不等于 6 个彼此独立的漏洞。

涉及 `next`、`prisma`、`@prisma/config`、`deepmerge-ts`、`sharp`、`source-map-js`。完整公告、范围与修复建议保存在 `codex_npm_audit_official.json`。移动端源码未发现直接导入这些包；APK 为 Vite/Capacitor WebView，不能把 Node 服务端 RCE 告警直接判定成 APK 可被远程执行代码。后续应按工程实际调用范围评估和升级，避免直接运行会改动依赖的大范围 `npm audit fix`。

## 授权与提交素材

- `mobile/public/codex_font_licenses.txt` 包含 Noto Sans SC、Montserrat 的 OFL，实际 APK 已打包该文件；无需为现有字体另购商业许可，但应继续保留授权声明。
- Open-Meteo 免费 API 仅供符合其条件的非商业用途，并有调用限额、CC BY 4.0 署名要求。当前未发现广告/订阅接入，上商店本身不自动等于商业使用；若加入广告、收费或订阅，应重新评估商业 API 许可。[Open-Meteo 条款](https://open-meteo.com/en/terms)
- Apple 搜索接口条款包含内容用途限制；当前代码不取 Apple artwork，不能据此认定违规使用 Apple 封面。若后续加入预览音频或宣传封面，需要重新核对授权。[Apple Search API](https://performance-partners.apple.com/search-api)
- 商店图标、截图、简介、年龄分级、隐私 URL、联系方式和版权/备案材料应作为一套正式发布资料。已有视频或历史截图不等于满足全部商店规格；正式截图按目标商店当前尺寸、数量和内容要求制作。

## 下一阶段的最小交付范围

1. 统一名称，完成首次隐私流程和 Android SDK/网络披露，提供公开政策页面。
2. 用本人账号确认首发平台入口与类目、电子版权办理方式；准备国家软著资料，按接入或分发平台流程办理 APP 备案。所有个人证件和密钥在官方页面由 Yves 提交。
3. 完成依赖兼容处理、真机隐私捕获与数据升级验收，再使用既有发布脚本生成新包；保留长期签名，按已安装版本递增版本号。
4. 制作商店素材和测试操作说明，再提交审核。本报告没有申请、支付、部署政策网页或发布应用。
