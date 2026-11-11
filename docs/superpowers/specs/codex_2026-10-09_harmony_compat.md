# 鸿蒙 APK 兼容与启动性能

Yves 报告：朋友使用 Mate 60，完整鸿蒙版本未知，小懂哥 v3.1.2，进入应用即卡顿。本轮直接实施安全、可回退的兼容优化并构建原签名测试 APK；不把桌面模拟当作 Mate 60 实测。

## 已核实的调用链

- Capacitor 8.4.1 / Android API 24+；框架默认普通 WebView 60+、Huawei WebView 10+。Vite 8.1.0 默认产物却面向 Chrome 111，应用直接使用 `.at`、`Object.hasOwn`、`crypto.randomUUID`、`replaceAll`、`AbortSignal.any`。
- 首页分别调用 `recentEntries`、`getYearStats`、`listEntries`，前三者累计三次读取全部 ReviewEntry；逐个封面读取还扫描全部 CoverImage，并可能重复读取 ReviewEntry。
- 首页直到今日重逢状态写入及 `NowPlaying.getCurrentTrack` 完成才提交最近记录和统计。
- `groupMusicEntries` 为每条记录遍历已有分组，反复规范化字符串。既有 23 条身份用例明确约束目录 ID、别名、缺艺术家和缺专辑的合并规则。

## 实施决定

1. 明确网页语法编译目标为 Chrome 74；保留 Safari 16.4 的既有目标。选择依据是应用已经使用的 `flatMap`、`Object.fromEntries`、`matchAll`、`ResizeObserver` 等运行能力；该语法目标并非真机认证，Huawei WebView 版本与 Chromium 的对应关系不作推断。通过实际能力检测补齐应用已使用的新标准 API；UUID 始终使用 `crypto.getRandomValues`，不得使用弱随机数。
2. 隐私请求兼容没有 `AbortSignal.any` 的环境，同时保留外部取消、撤回取消及完成后的监听清理。
3. 首页复用单次记录快照；批量读取封面；统计复用同一记录集；首屏展示不等待原生媒体读取与每日状态写入。恢复日志、写入屏障和 generation 检查保留。
4. 用目录 ID 与规范化名称索引缩小分组搜索，并保留原规则最终校验及分组顺序。通过既有身份测试和旧算法对照验证。
5. 不依赖 `:has` 隐藏阅读页导航；旧 CSS 引擎自动降低阴影与模糊效果，保留功能、配色与可访问操作。
6. 在现有脱敏诊断中显示运行环境和 WebView 信息；不得读取设备唯一 ID、乐评原文或文件路径。

## 验收与交付

- 先保留 3.1.2 的生产 Web 基线与失败复现，再运行相同检查；记录实际耗时和读取次数，不设置虚构的提速结论。
- 缺少新 API 时能进入首页、手动保存和阅读；延迟媒体返回时首页已有内容；备份/恢复和隐私取消行为保持正确。
- 全量项目门禁、独立兼容检查、Android JUnit、Release 构建、签名/版本/资源哈希核对通过后交付测试 APK 和 SHA-256。
- Android 兼容鸿蒙可覆盖安装；HarmonyOS 5 及以上 APK 安装须以卓易通实际支持为准，不能承诺单一 APK 覆盖所有鸿蒙。原生鸿蒙应用是独立平台工程，不在本轮伪造 HAP。

## 官方依据

- https://consumer.huawei.com/cn/support/content/zh-cn16061787/ ：HarmonyOS 5 及以上下载 APK 时，以卓易通实际支持为准。2026-10-09 查询。
- https://capacitorjs.com/docs/android ：API 24+、Chromium WebView 60+；具体本地框架值以已安装源码核对。
- https://vite.dev/config/build-options ：构建目标仅处理语法，标准 API 需要单独处理；本地 Vite 默认目标由 logger.js 核对。
