# Android 隐私整改设计

Yves 于2026-10-08选择上一轮“按报告整改安卓隐私、SDK和权限流程”。个人主体，无软著/APP备案/商店账号；本轮实施该选择，不重新申请相同授权。

目标：首次告知、明确同意/拒绝、拒绝可继续本地手动记录；敏感功能在前端共享入口与Android原生入口均检查同意；政策披露与实际处理一致。Windows沿用既有行为，不改数据结构、包名、长期签名及已有记录。

## 方案

采用版本化原生同意状态与现有React界面配合。单纯界面弹窗不能覆盖ML Kit provider和原生桥接；单独增加OCR进程/IPC扩大了本次范围，因此用原生持久化、延迟SDK初始化和后台调度开关实现当前需要。

- `CodexPrivacy`原生插件：`getState()`返回`{status: "pending" | "accepted" | "declined", policyVersion: "2026-10-08"}`；`setConsent({accepted: boolean})`返回相同状态。状态独立于记录数据库和JSON备份；版本不符或读取失败不得授权。
- Android首次启动先读取状态，再挂载StorageGate及App。无决定时显示政策摘要、完整说明、同意/仅本地两项。拒绝不强制退出；以后在隐私页可同意。
- 共享NowPlaying桥接入口检查；天气三处通过受同意限制的fetch并在撤回时取消；OCR读图前及原生调用前检查；拒绝时不展示远程播放器封面。首页自动媒体读取也被覆盖。
- 移除ML Kit自动初始化provider，实际OCR调用且原生确认同意后才调用官方`MlKit.initialize(Context)`。DataTransport调度组件默认禁用，按同意控制，撤回取消对应后台任务并禁用组件。
- 政策页提供明确“撤回同意并退出”操作，先阻止新请求并保存拒绝状态，再终止本应用SDK所在进程；再次打开保留本地数据。恢复/写入被阻塞时不可执行退出。仅首次拒绝不退出。
- 移除未使用的生物识别权限；保留网络状态等实际SDK依赖需要的权限，准确说明来源与用途。
- 使用Yves提供的公开身份/联系信息，补充Android OCR/MLKit诊断、媒体元数据及URI保存/备份、Apple/天气联网、权利和保存规则；保留独立政策页面产物供后续托管。没有域名或发布授权时不擅自部署。

## 验收

自动验证：首次/拒绝/同意/重启/撤回、错误与旧版本fail closed、本地记录保留、拒绝下媒体/OCR/Apple/天气调用被拦截、联网封面不加载、非Android行为保留；既有32单测、移动类型检查、相关捕获/存储回归、Android编译和最终manifest检查。

运行时设备若可用则补启动与OCR；实际第三方遥测内容必须通过设备网络捕获验证，浏览器桥接模拟和manifest检查不能替代。16KB库兼容与外部资质办理仍按原审查独立记录，不能因本轮隐私修改就宣称已经可上架。

官方API依据：https://developers.google.com/android/reference/com/google/mlkit/common/MlKit ，本轮全文证据`.firecrawl/codex_android_privacy_20261008_mlkit_init.md`。
