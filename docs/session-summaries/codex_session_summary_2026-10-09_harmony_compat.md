# 鸿蒙兼容与启动优化 APK 交接

日期：2026-10-09。Yves 报告朋友的 Mate 60 进入小懂哥即卡顿，认为安装的是 v3.1.2；完整鸿蒙版本与机上实际包版本尚未读取。已完成有代码证据的兼容和首页性能修复，并构建原签名 v3.1.3 测试 APK。没有连接或安装手机，也没有提交、推送或公开发布。

## 交付

- APK：`release/codex_harmony_signed_final_20261009/codex_xiaodongge-v3.1.3-33-test.apk`。
- 版本：3.1.3 (33)，包名 `com.yves.musicarchive`，75,789,421 字节。
- SHA-256：`009201a437e47cd92da580c369911bf896fba7c0818f61d40fa875394db99fc1`；同目录有 `.sha256.txt`。
- 证书 SHA-256：`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与已发布的 3.1.2 (32) 一致，满足覆盖升级条件。旧 3.1.2 APK 原哈希 `d8a38af20902d204016737667792164fdeac71739635239f1b4dd739adc5af5d` 未变。

## 修改与证据

1. 首页复用一次完整记录快照，批量读取一次封面，统计复用已读记录；最近记录、统计和今日重逢内容不等待当前播放返回。保留恢复 generation 检查、写入屏障及活动标志。
2. 作品分组按目录 ID 与规范化名称缩小匹配范围，保留原 matcher、首个匹配分组顺序、目录冲突与缺失专辑等语义。同名/艺术家歧义桶仍可能有二次扫描，未承诺所有数据规模都线性。
3. 网页语法目标由 Vite 默认 Chrome 111 改为 Chrome 74，保留 Safari 16.4；入口仅补齐缺少的 `.at`、`Object.hasOwn`、`replaceAll` 和安全 UUID。UUID 使用 `crypto.getRandomValues`。
4. 无 `AbortSignal.any` 时，隐私取消与外部取消仍有效，包含响应体读取；天气既有 8/10 秒超时清理合成信号监听，未来增加无时限调用前必须调整其生命周期。
5. 阅读页导航隐藏增加显式状态类，旧 `:has` 不可用时仍能阅读；旧 CSS 引擎自动减少阴影和模糊。现有主题与操作保留。
6. 原生隐私同步先检查组件状态，避免重复写相同 PackageManager 状态；拒绝时的禁用、任务取消和失败保护保留。
7. 脱敏诊断增加非唯一机型、厂商、Android API、WebView 包与版本、渲染方式。未读取设备唯一 ID；没有把 Android API 当成鸿蒙版本。

## 验收

- 原有全量项目门禁 27 项通过，含 32 个共享单测、根/移动类型检查、备份/恢复/草稿/评分/身份/封面/阅读/诊断/无障碍等。
- Android 编译和 JUnit 10/10、assembleRelease 与 lintVitalRelease 通过。
- 独立兼容检查 4 组通过：生产网页缺新 API 后保存和阅读；丢弃 `:has` 后导航正确；延迟原生媒体时首页已显示；外部取消、撤回、预取消与响应体取消；40 组旧算法差分与 1000 个不同作品。
- 本次同一 Chrome 会话中的 1000 作品对照：旧参考分组 17,286.4 ms，优化分组 31.1 ms，完整有序成员关系一致。并行 Android 构建会影响耗时，不据此换算 Mate 60 启动提速。
- 另有原隐私回归 5 组通过；诊断测试验证未请求的合成设备 ID 不进入复制内容。
- 17 份 public 资源与 3 份平台资源匹配新构建；包名、版本递增、原签名、交付副本 SHA-256 和 ZIP 16 KiB 对齐通过。ZIP 对齐不等于所有 ELF/系统运行认证。
- 首次全量门禁停在旧测试的 `Promise.all` 五项暂停点；首页现为三项读取，已将注入点改为匹配实际返回结构。保留旧页面恢复后不得写入的断言，Web 与模拟 SQLite 的中断/回滚/重启用例重新通过，再运行全部门禁。

证据集中在 `release/codex_harmony_signed_final_20261009/`：`build_manifest.json`、`codex_delivery_validation.json`、`codex_delivery_assets.json`、`checks/codex_results.json`、`android-unit/` 与 `compatibility/codex_results.json`。先前失败和隐私回归的小型记录保存在 `earlier-evidence/`。

## 支持范围与待实测项

Android minSdk 24 和 Capacitor 默认阈值保持不变；Chrome 74 是本轮语法编译目标，不是旧引擎、某个 Huawei WebView 厂商版本或全部鸿蒙的真机认证。华为说明 HarmonyOS 5 及以上的 APK 安装以卓易通实际支持为准：[官方安装说明](https://consumer.huawei.com/cn/support/content/zh-cn16061787/)。一个 APK 不能据此保证覆盖所有鸿蒙；原生鸿蒙包属于另一平台工程。

Mate 60 的实际启动/交互效果、旧 WebView 二进制、OCR、通知绑定、原生保存/分享及卓易通环境仍未实测。时间轴逐行封面的既有全量扫描、Capacitor 系统栏监听等也未在本轮修改，不能把静态发现当作该手机卡顿根因。

建议先备份再覆盖安装同签名旧包，检查记录、启动和前后台返回。若仍卡顿，复制“更多 → 本机诊断”，并提供系统设置中的完整鸿蒙版本。真机结果通过后再决定发布和原生鸿蒙适配。

## 任务文件清理

本轮已核实生成量下限 486,875,519 字节，超过 200 MB 自动清理阈值。已删除 1,295 个普通文件、410,731,478 字节，移除 416 个目录并解除 2 个本轮测试 node_modules junction；共享依赖目标保留，29 个受保护文件哈希不变。保留最终 APK/SHA、源码、检查脚本、验收 JSON/日志和关键截图，清理本轮的 Vite/Next 测试缓存、合成旧 Web 应用、重复网页构建与 APK 副本。历史混合构建缓存、旧正式包与其他助手产物未动。

最后一份 `release/codex_harmony_signed_final_20261009/codex_cleanup.ps1`（8,786 字节）的直接删除被自动执行审批审核拒绝，仅返回 `blocked by policy`，没有具体原因。该命令未执行，没有重复或更换方式绕过；文件保留，清理状态为 partial。准确删除清单、保护哈希和未处理项见同目录 `codex_cleanup.json`。APK 构建及核验已完成。
