# 小懂哥 应用商店上架整改落地清单

编制日期：2026-10-08
依据：`docs/codex_android_store_gap_audit_20261008.md`、`docs/codex_android_store_personal_channels_20261008.md`、specs/plans 隐私文档
适用主体：Yves（个人）｜ 目标渠道：OPPO 个人 APK 首发，华为 Android APK 第二
版本基线：v3.1.1 (31)，包名 `com.yves.musicarchive`，签名证书 SHA-256 `6386734e…1022`

**本次为只读核查，未修改任何产品代码、未构建、未注册账号。**

---

## 0. 核查摘要：两处需修正的判断

| # | 审查报告说法 | 代码实际 | 影响 |
|---|---|---|---|
| 1 | 隐私同意流程"待实施" | **完全未实施，且工作量被严重低估**。`codex_PrivacyPlugin.java`、`codex_PrivacyGate.tsx`、`codex_privacy.ts` 在磁盘上均不存在；`main.tsx:18` 仍是 `<StorageGate><App/></StorageGate>`，无同意门 | A-1 不是"加弹窗"，是新建原生+前端双端通道 |
| 2 | 源 manifest 仅 2 项权限 | 属实。`AndroidManifest.xml:4-5` 仅 INTERNET/VIBRATE，但合并后 APK 实测 **6 项** | A-3 必须改依赖，只改 manifest 会被合并加回 |
| 3 | — | **新发现**：`docs/codex_privacy_policy.md` 实际不存在于磁盘 | 商店要求的公开政策 URL 当前**零产物** |
| 4 | OCR 是否调用 ML Kit | `ocr.ts` 全文 176 行**零 ML Kit**，是纯字符串解析器；真正调用在 `ScreenshotOcrPlugin.java:13-17, 93` | A-4 改动面小于预期 |

---

## 1. 权限逐条判定

| 权限 | 来源 | 需说明 | 判定 |
|---|---|---|---|
| `INTERNET` | 源码 `:4` | 是 | **保留**（确有 3 处真实出网） |
| `VIBRATE` | 源码 `:5` | 否 | 保留（`abu_haptics.ts`） |
| `USE_BIOMETRIC` | SQLite 插件合并 `node_modules/@capacitor-community/sqlite/android/build.gradle:68` | **是，必须解释** | **移除**：`capacitor.config.ts:9` 为 `androidIsEncryption: false`，`store.ts:155,877` 走 `no-encryption`，`CapacitorSQLite.java:80-86` 仅在 `isEncryption` 为真时初始化生物识别 → **应用侧零调用** |
| `USE_FINGERPRINT` | 同上 | 同上 | **移除** |
| `ACCESS_NETWORK_STATE` | DataTransport CCT 合并 | 是 | **待确认**，随 ML Kit 移除一并消失 |
| `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | androidx 内部 | 否 | 保留（自定义签名权限） |

**未发现相机、定位、存储、麦克风、通讯录权限** —— 这是本项目最有利的合规资产。

> `NowPlayingNotificationService.java:5` 是**空类**（5 行，无 `onNotificationPosted` 重写）→ **不读取任何通知正文**，可在审核问询时明确答复。

---

## 2. 数据流向实测（隐私政策的唯一事实来源）

### 2.1 离开设备的数据（3 条链路）

| 链路 | 位置 | 发送内容 | 触发 |
|---|---|---|---|
| Apple 目录补全 | `NowPlayingPlugin.java:110-112` | 歌曲名+歌手+专辑名，`country=CN`，失败回退 `US` | **半自动**：`App.tsx:828` 自动连发 CN→US 两次 |
| 城市搜索 | `shared/listeningContext.ts:129-131` | 城市名 + `countryCode=CN` | 用户手动 |
| 历史天气 | `shared/listeningContext.ts:151-160` | 粗化经纬度 + 日期 + 5 个天气字段 + `timezone` | **半自动**：`store.ts:951` 缓存缺失即批量补拉 |

**三处均无同意前置判断。**

### 2.2 SDK 启动（最高风险项）

- 合并清单 `codex_apk_manifest.txt:86-89`：`MlKitInitProvider` `initOrder=99` → **在 Activity 之前启动**
- `:73-83`：`MlKitComponentDiscoveryService` + 三个 Firebase Registrar
- `:133-143`：DataTransport `CctBackendFactory` / JobScheduler / AlarmManager

`build.gradle:65-72` 有 `google-services.json` 探测逻辑（文件不存在时跳过），当前无 Firebase 项目 → 诊断数据**大概率不发送**，但**未抓包，不得断言**。这是 A-4 必须实测的原因。

### 2.3 本地保存但不外传

`NowPlayingPlugin.java:149-153` 读播放器 `METADATA_KEY_ALBUM_ART_URI` → `types.ts:29` → 存库 → `QuickCapturePage.tsx:402,412` 直接 `<img src={artwork}>`。**HTTP(S) URI 在此产生真实网络请求，且不受同意门控制**；`content://`/`file://`/`data:` 则是本地解析 —— 政策中需**分类表述**，不能一概写成"网络请求"。

### 2.4 数据库

`androidIsEncryption: false` + `no-encryption` → **明文存储**。政策与商店表单**均不得宣称"数据加密存储"**。`allowBackup="false"` 与"系统云备份已关闭"（`App.tsx:3052`）一致 ✓。

---

## A 档：上架前必须完成

### A-1 首次隐私同意/拒绝流程（全新实现）
- **改什么**：新建原生 `codex_PrivacyPlugin.java`（SharedPreferences 存 `{status, policyVersion}`，版本不符/读失败 fail-closed）→ 新建 `mobile/src/codex_privacy.ts` + `codex_PrivacyGate.tsx` → 在 `main.tsx:18` 的 `StorageGate` **之前**挂载同意页 → 4 个敏感入口加闸：`nativeNowPlaying.ts`、`shared/listeningContext.ts:126,147`（含撤回时 abort）、`ScreenshotOcrPlugin.java` 原生侧二次校验、`App.tsx:238` 首页自动读
- **量**：**3–5 天**。拒绝路径须保留本地手动记录可用
- **验收**：① 全新安装首启出现同意页；② 选"仅本地"后手动记一笔成功保存，但 OCR/Apple/天气三链路**抓包零请求**；③ 同意后功能恢复；④ 杀进程重开状态保持；⑤ 改 `policyVersion` 后重新询问；⑥ 桥接抛错不静默放行

### A-2 公开隐私政策 URL（零产物）
- **改什么**：新建 `docs/codex_privacy_policy.md`；内容与 `App.tsx:3033-3056` 的 `PrivacyPage` 同源。必含：主体身份+联系方式、适用版本/更新日期、3 条出网链路+接收方+发送字段、ML Kit 本机识别与 SDK 诊断**分开陈述**、URI 保存规则、明文数据库、导出与删除方式
- **两处文案缺陷必须修**：`App.tsx:3042` 的 OCR 段落被 `{desktop ? ... : null}` 包裹 → **Android 用户完全看不到截图识别说明**；`App.tsx:3039` "不会主动上传"承诺范围过宽，与 §2.2 冲突
- **量**：**1–2 天**（起草 0.5 + 托管 0.5）。**托管需稳定公开 URL —— 无既有域名/服务器，需 Yves 决策，费用待确认**
- **验收**：公网 URL 无需登录可访问；与应用内逐条一致；商店"隐私政策链接"与"隐私权利 URL"两栏均填此 URL

### A-3 移除生物识别权限
- **改什么**：从**依赖**移除。`tools:node="remove"` 会被合并加回。路径：确认 SQLCipher 在 `androidIsEncryption:false` 下能否彻底不引 biometric（`CapacitorSQLite.java:80-86` 已有条件分支，**待实测**），否则走 manifest remove + 合并清单复核
- **量**：**0.5–1 天**
- **验收**：新构建 `aapt dump permissions` 中**不再出现** `USE_BIOMETRIC`/`USE_FINGERPRINT`；`npm test` 32/32；备份恢复无回归。**须以新构建的合并清单为准**

### A-4 移除 ML Kit 自动初始化 + DataTransport
- **改什么**：manifest 加 `tools:node="remove"` 移除 `MlKitInitProvider`（merged `:86-89`）与 `TransportBackendDiscovery`/调度组件（merged `:133-143`）；`ScreenshotOcrPlugin.java:93` 改为**同意校验通过后**才显式 `MlKit.initialize(Context)`
- **量**：**1–2 天**（含抓包）
- **验收**：**这是唯一能证明"未违规上传"的验收** —— 全新安装 → 触发首页重逢、截图 OCR → 抓包确认**零 ML Kit/DataTransport 域名请求**；同意后 OCR 仍可用。**未抓包前不得对外声称合规**

### A-5 名称统一（材料前置条件）
- **改什么**：三处仍是"私人音乐档案" —— `capacitor.config.ts:5`、`res/values/strings.xml:3,4`。统一为"小懂哥"。**包名与长期签名不变**
- **量**：**0.5 天 + 备案/版权周期**
- **顺序约束**：**必须早于版权/备案办理**，否则材料与包内标签不一致

### A-6 主体材料：APP 备案 + 版权证明
- 因存在 3 条出网链路，**不能按"纯单机"处理备案豁免**
- **可确认**：国家软著登记 **¥0**（停征）、非经营性 APP 备案 **¥0**
- **待确认**：OPPO 要求的"电子版权证书"是独立于国家软著的材料，官方报价未公开

### A-7 隐私/权限/SDK 披露的表单一致性
- 把 §1 权限表、§2.1 三条链路、§2.2 SDK 清单整理为商店填报内容，与 A-2 逐字对齐
- **量**：**0.5 天**｜**验收**：表单声明 ⊆ APK 实测权限；**不得申报或宣称数据库加密**

### A-8 16 KB 兼容性与真机验收
- 4 个 64 位 `.so` 的 RELRO 余数不满足：arm64 `libmlkit_google_ocr_pipeline.so` 12288、`libsqlcipher.so` 4096。**A-4 移除 ML Kit 后前者不再打包 → 自动减少一项**
- **量**：**2–3 天**｜**验收**：`getconf PAGE_SIZE` = 16384；真机验证全链路。**当前无设备连接，未完成**

---

## B 档：建议完成

| # | 项 | 依据 | 量 |
|---|---|---|---|
| B-1 | HTTP 与本地 URI 边界 | `QuickCapturePage.tsx:412` 直接 `<img src={artworkUri}>`，不区分 HTTP(S)（真实请求）与 `content://`/`file://`（本地） | 0.5 天 |
| B-2 | 通知使用权用途告知独立化 | `App.tsx:3040-3041` 嵌在通用页面内；需补 UI 状态同步（`NowPlayingPlugin.java:55-61` 已有 `accessEnabled` 短路） | 0.5 天 |
| B-3 | 自动联网改用户触发 | `App.tsx:828-837` 点一次即发 2 次 Apple 请求；`store.ts:951` 缓存缺失即批量拉天气 | 1 天 |
| B-4 | Open-Meteo 与 Apple 署名 | Open-Meteo 有 CC BY 4.0 署名要求 + 调用限额。无广告/订阅 → 上商店不等于商业使用，**加收费功能须重评** | 0.5 天 |
| B-5 | 商店素材 | 字体 OFL 已随包 → **无需另购许可**。截图**不得含私人记录** | 1–2 天 |
| B-6 | npm 依赖告警评估 | 6 项（5 high、1 critical）涉及 `next`/`prisma`/`sharp` 等，**移动端未直接导入**，APK 是 Vite/Capacitor WebView，不能据此判定 APK 可被远程执行代码。**禁止直接跑大范围 `npm audit fix`** | 0.5 天 |

---

## C 档：可延后

C-1 Windows 同步整改（政策页已按 `desktop` 分支区分）｜C-2 华为/其他渠道（首发 OPPO）｜C-3 代码签名策略与 CI（已有可用 v2 签名）｜C-4 x86_64 对齐（64 位门槛只算 arm64）｜C-5 Google Play（US$25 + 12 名测试者 14 天封闭测试）｜C-6 SQLCipher 加密（**须如实披露明文，不得宣称加密**）｜C-7 商业化许可

---

## 3. OPPO / 华为上架准备清单

**未注册、未认证、未提交、未付款。** 费用栏"未公布"= 公开证据不足，**不得承诺 ¥0**。

### 3.1 材料

| 类别 | 材料 | 状态 |
|---|---|---|
| 主体 | 身份证正反面 + 手持照 + 实名手机号 + 银行卡 | Yves 本人办理，**证件只在官方页面提交，不发到聊天** |
| 版权 | 国家软著 | 可作长期准备，官方登记费 ¥0 |
| 版权 | **电子版权证书** | OPPO 个人发布页明确要求"官方申请通道颁发的电子版权证书"，**未写国家软著可替代** → 必办，报价待确认 |
| 备案 | APP 核准/备案号 | 必填。接入路径（分发平台受理 or 接入商）**待确认**，**不得把第三方 API 域名当自有域名填报** |
| 政策 | 隐私政策 URL + 隐私权利 URL | 依赖 A-2（同一 URL） |
| 素材 | APK + 图标 + ≥3 张 1080×1920 截图 + 简介/权限说明/年龄分级/SDK 清单 | 依赖 A-3/A-4/A-8 后重新构建 |

### 3.2 时间顺序（依赖驱动）

```
阶段 0（代码，1–2 周）
  A-5 名称统一 → A-1 同意流程 → A-4 SDK 移除+抓包
  → A-3 权限移除 → A-2 政策+托管 → A-8 16KB+真机
  → A-7 表单一致性 → B 档 → 重新构建签名 APK
阶段 1（主体，Yves 本人）OPPO 注册 → 个人实名认证 → 确认电子版权入口
阶段 2（材料，可并行）国家软著 + 电子版权证书 + APP 备案接入
阶段 3（提交）填表 → 上传 APK → 提交审核 → 补正
阶段 4（第二渠道）华为通道复核提交字段后重复阶段 2–3
```

**关键约束**：① A-5 必须最早；② 阶段 0 与 1/2 可并行，但阶段 3 强依赖两者；③ **提审前必须已完成 A-4 抓包**。

### 3.3 类目

产品是**本地音乐日记工具**，无在线播放、无音乐作品分发。OPPO/华为"音乐类"有额外资质要求 —— **按实际功能如实填写，不为减少材料而选不真实类目**；同时不能仅因名字涉及音乐就认定必须办理网络音乐经营许可。

---

## 4. 待确认清单（不得猜测）

1. **电子版权证书**的官方入口、周期、报价（OPPO 个人通道）
2. **APP 备案**实际受理路径，是否需自有域名/服务器
3. 隐私政策**托管方式与域名**（无既有站点，需 Yves 决策；费用未知）
4. 最终**登记全称**（受平台命名规则约束）
5. A-3 **技术路径**（SQLCipher 在无加密模式下能否彻底不引 biometric，需实测）
6. **A-4 抓包结果**（当前无设备）
7. A-8 **16 KB 运行时结果**（当前无设备）
8. OPPO/华为实际提交页的截图规格与最终类目

**成本总结（仅可确认部分）**：国家软著登记 **¥0**、非经营性 APP 备案 **¥0**、签名证书 **无需另购**（已有长期签名）。**整个上线总成本不可写为 ¥0** —— 电子版权证书、政策托管、备案接入方式三项均未定。
