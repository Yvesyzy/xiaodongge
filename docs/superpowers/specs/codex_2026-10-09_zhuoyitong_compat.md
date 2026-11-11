# 卓易通与鸿蒙兼容环境适配

Yves 要求仔细阅读官方要求，在已有 3.1.3 APK 基础上尽可能适配。直接执行公开要求能够支持、风险可控的兼容改动；不猜测私有系统属性、包名、SDK 或容器跨应用能力。Mate 60 完整系统版本与实际运行环境仍未知。

## 官方资料与应用决策

官网首次抓取只得到页面外壳，随后通过真实浏览器观察网站使用的公开 GET 请求，读取 `https://web-api.droiyou.com/questions/list?current=1&pageSize=1000`，确认 code=200、total=30；字段为 id/title/content/status/release_time。去除 HTML 和图片后的原文保留在 `.firecrawl/codex_zhuoyitong_faq_live_20261009.json`，不把空白外壳当成已读完整文档。

| 官方公开行为 | 小懂哥适配 |
|---|---|
| 鸿蒙 5/5.1 可通过文件互传导入系统文件；6 及以上的访问方式不同 | 备份页提供对应指引；选择文件允许不准确的 MIME 分类，但内容仍严格解析与预演 |
| 兼容环境图片可能须经文件互传进入系统图库 | 增加用户主动点击的“保存到相册”入口；使用标准 MediaStore 保存本应用生成的 PNG；不声称一定直达宿主系统图库 |
| 部分通知受环境与权限管理约束 | 通知设置无法打开、媒体服务缺失时返回可见失败；保留粘贴、截图与手动记录 |
| 兼容环境有独立数据范围，系统文件管理位置可能不同 | 更多页加入离线使用说明和官方来源，明确查看兼容应用数据及文件互传 |
| 没有在公开页面中找到可接入的兼容 SDK/API | 使用标准 Android API 与运行能力回退；不引入同厂商的无关广告/支付 SDK |

来源：
- https://www.droitong.com/CommonQues.html （30 条实时公开问答，具体发布时间保留在摘录中）
- https://consumer.huawei.com/cn/support/content/zh-cn16048495/ （文件选择与“我的设备(鸿蒙)”）
- https://consumer.huawei.com/cn/support/content/zh-cn16071232/ （兼容应用下载文件位置）
- https://consumer.huawei.com/cn/support/content/zh-cn16034344/ （图库中查找兼容应用图片）
- https://developer.android.com/training/data-storage/shared/media （应用自有媒体、pending 写入与发布）
- https://developer.android.com/reference/android/content/Intent#normalizeMimeType(java.lang.String) （系统 Intent 的 MIME 标准化）
- https://developer.chrome.com/blog/new-in-chrome-108 （动态视口单位的版本边界）

## 已证实的代码缺口

- `NativeExportPlugin.saveFile`、单文件分享、剪贴板写入和 `NowPlaying.openNotificationSettings` 有未捕获的 RuntimeException 路径。Capacitor 桥接线程会把插件异常重新抛出，因此不能只依赖桥接层兜底。
- 单文件保存回调直接解码和写入最多 8 MiB PNG，缺少批量路径已有的 null-call 与后台写入保护。
- `getCurrentTrack` 在媒体服务为空时解引用空对象。
- 原生复制失败后没有复用既有 DOM 回退；诊断和榜单预检也直接依赖 Clipboard API。
- 无 Web Locks 时，用户到正式恢复才失败；安全边界应保留，但应在预演前说明限制。
- JSON/TXT/CSV 导出带 charset 参数，传给系统 Intent 前需要按 Android 官方 API 标准化 MIME，避免文件处理器匹配差异。
- 阅读与导出对话框使用 dvh；为旧引擎保留 vh/宽度回退，现代样式仍按支持能力覆盖。

## 行为和安全边界

- MediaStore 保存仅面向 Android API 29+；只写本应用生成的有效 PNG，不申请广泛存储权限，不读取其他媒体。先 pending，再完整写入/关闭，发布成功后才返回 saved；失败只清理本次创建的 URI。
- 图库入口是明确的新按钮，不擅自把用户选择的文件夹保存重定向到别处。兼容环境成功保存不等于宿主图库已完成同步。
- 复制按原生、Clipboard API、既有 DOM 方法依次尝试；失败保留原文，临时文本框在 finally 移除，恢复焦点，模态框内使用同一顶层对话框。
- 所有普通文件保存调用经共享回执校验，只有 saved 且非空 URI 才标记成功或更新备份健康；诊断区分通知状态未知与未授予。
- 文件选择失败不丢弃备份文本，不用未经验证的浏览器下载伪装保存成功。无恢复锁时保留导出/查看，预演/导入/撤销提前禁用并说明，原独占锁、日志、事务和 generation 全部保留。
- 更新导出与相册用途的隐私说明，原生政策版本与 JSON 同步为 2026-10-09；本地模式仍可使用导出。
- 更新版本至 3.1.4 (34)，保留原签名与 3.1.3，构建新的本地测试 APK；不提交、推送、发布或安装手机。

## 验收

新的能力退化检查覆盖原生复制失败、API 拒绝、DOM 最终失败、模态框焦点、保存/分享错误后原文保留、相册保存成功/失败、缺恢复锁与非法导入不改数据。复用原流写入/关闭失败 JUnit，增加图库文件名安全检查；全量项目门禁与 Android 编译/单测、签名/资源/版本核验后交付。

真实卓易通文件互通、相册可见性、通知/媒体与旧 WebView 二进制需要设备测试。公开文档不能替代平台认证。

构建基准：开始本阶段打包时，旧 3.0.1 根目录基准包已缺失。现将发布脚本更新为已核对哈希与原证书的 3.1.3 (33)，继续保留全部基准哈希、签名和版本递增检查。
