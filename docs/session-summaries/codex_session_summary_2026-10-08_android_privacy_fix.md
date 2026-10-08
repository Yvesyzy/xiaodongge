# Android 隐私、SDK与权限整改交接

日期：2026-10-08。Yves选择上一轮Next steps第1项并要求继续。工程`D:\codex\workspaces\codex\小懂哥`，个人发布，无软著/APP备案/商店账号。本次完成源码整改与构建验证，没有注册、付款、发布、推送或安装到用户手机。

## 已完成

- Android启动先读取原生版本化隐私选择，再挂载StorageGate/App；首次明确同意或仅本地，拒绝仍可手动保存记录，选择能跨重启保留。
- 同意保存在独立SharedPreferences，不进JSON备份；旧版本、非法值、读取/保存失败不会授权敏感功能。前端状态严格检查字符串类型。
- 当前播放、Apple目录、通知设置、OCR都有原生入口检查；共享NowPlaying包装覆盖首页/表单/快速记录。天气三处调用传入隐私fetch，撤回取消在途请求，拒绝不展示远程播放器封面。拒绝时增强功能按钮/文件选择入口禁用，本地保存不受影响。
- 移除MlKitInitProvider；确认同意且实际识别时才显式初始化ML Kit，保留原有图像大小限制、错误处理与资源释放。
- DataTransport JobInfoSchedulerService/Alarm receiver和NowPlayingNotificationService默认禁用；按同意状态启禁，拒绝取消该DataTransport服务对应jobs，不取消应用其他jobs。
- “撤回同意并退出”会先保存拒绝、停止后台入口，再finishAndRemoveTask并终止本应用进程，清除SDK会话；首次拒绝不退出。新增会话标记，处理SharedPreferences提交失败改变内存状态后再重试撤回的情况。
- 合并权限中移除USE_BIOMETRIC/USE_FINGERPRINT，保留实际SDK所需ACCESS_NETWORK_STATE。包名、数据库结构、长期签名与版本号未改；显示名统一“小懂哥”。
- 补充Android OCR、ML Kit诊断、媒体URI保存/展示/备份、Apple和天气接收方、境外处理、数据保留、导出删除和撤回方式。
- 独立HTML与应用内政策共用`mobile/src/codex_privacy_policy.json`；`premobile:build`自动生成`mobile/public/codex_privacy_policy.html`，`scripts/codex_build_privacy_policy.mjs --check`检查一致性。

Yves提供了公开联系邮箱，已用于政策；没有提供实名名称，不将“Yves”推断成法定姓名。政策目前写个人开发者主体类型，正式提审前仍需补齐与商店实名对应的姓名及公开政策URL。没有擅自部署网页。

## 主要源码

`mobile/src/codex_privacy.ts`、`codex_PrivacyGate.tsx`、`codex_privacy_policy.json`、`codex_privacy.css`；现有main/App/QuickCapture/nativeNowPlaying/store接入。

`android/app/src/main/java/com/yves/musicarchive/codex_PrivacyPlugin.java`及MainActivity/NowPlaying/ScreenshotOcr；AndroidManifest和strings；新增`android/app/src/test/java/com/yves/musicarchive/codex_PrivacyPluginTest.java`。

设计与实施计划位于`docs/superpowers/specs/codex_2026-10-08_android_privacy.md`、`docs/superpowers/plans/codex_2026-10-08_android_privacy.md`。隔离worker副本只用于开发与审查，主工程源码是最终版本；主线程进一步修复了撤回重试并纳入通知监听组件。

## 验证

- `npm test`32/32；`npm run typecheck:mobile`通过。
- `node scripts/codex_check_privacy.mjs`通过：首次屏、拒绝保存与重启、敏感调用/远程封面限制、OCR入口、重新同意、撤回和在途天气取消、无效/旧状态与持久化失败、非Android门槛。采用合成桥接和浏览器存储，不冒充Android设备测试。
- `node scripts/codex_check_capture_regressions.mjs --output release/codex_privacy_capture_20261008`通过，含草稿/用户编辑/慢请求/封面/OCR边界等既有回归。
- 现有Android unit脚本最终10/10；清理后保留历史摘要`release/codex_privacy_android_build_final_20261008/codex_android_unit_prior.json`及`codex_android_junit_prior.log`。
- 移动端生产构建、`cap copy android`、最终`:app:assembleDebug`通过。
- APK验签、badging、ZIP16KB检查通过；实际APK内没有自动MLKit provider和生物识别权限；3个同意控制组件均enabled=false；包内HTML与源码一致、原生与前端政策版本一致。
- Debug构建验收包：`android/app/build/outputs/apk/debug/app-debug.apk`，78,370,697字节，SHA-256 `1e8d82223aacfbb4c7b2dfb152f2a539159afc2a5a48c50cab07d0f1f2b15ea0`。这是内部Debug验证产物，不是长期发布签名的升级交付包。
- 原长期签名测试APK SHA仍为`9ae4a23fe36b5724b8d89c15a775cbbdada8808dde3fb5cc36923d815a0fbf02`；原包与密钥未动。

最终APK/manifest/签名/构建原始证据：`release/codex_privacy_android_build_final_20261008/`。浏览器最终结果路径在该目录交付验证JSON中记录。所有检查使用合成数据；没有读正式私人档案。

## 真实设备与上架待办

当前`adb devices -l`为空，没有安装、真机OCR、OEM通知重新绑定或网络抓包结果。应验证首次/拒绝/同意/撤回/后台重启、系统通知授权记录与服务启停，以及真实SDK网络请求。Java单测、浏览器模拟和静态manifest不能替代这些结论。

后续进展：Yves已要求直接构建原签名APK，3.1.2(32)交付完成，详见[原签名APK交接](codex_session_summary_2026-10-08_android_privacy_apk.md)。本页记录的旧Debug包、隔离副本和重复缓存已在授权清理中移除；必要验收JSON/日志和浏览器截图已集中保留，当前应使用3.1.2原签名包。

政策实名、公开URL、电子版权/软著及APP备案仍待办理；16KB ELF RELRO问题沿用整改前审查结果，本轮未升级原生库，不把ZIP对齐通过说成运行时兼容通过。项目原有Node工程依赖告警也未被本轮隐私修改消除。

下一步：保持原长期签名构建递增版本的手机测试包并验收；补实名/托管地址和个人上架材料。当前源码整改已完成，商店提审条件尚未齐备。
