# 小懂哥 v3.1.2（32）隐私整改测试版

这是 GitHub 测试预发布。包名 `com.yves.musicarchive`，沿用原发布签名，版本号32高于3.1.1的31，可覆盖同包名、同签名且版本号更低的旧版。数据库结构与已有评分规则沿用原版。

## 更新

- 首次打开可选择同意增强功能或仅使用本地功能；拒绝后仍可手动记录、保存、查看、分析、导出和删除。
- 当前播放、Apple目录补全、截图识别、天气及远程封面按同意状态控制，前端与原生入口均检查。ML Kit在实际使用截图识别时才初始化；通知监听和后台传输入口默认关闭。
- 隐私页可重新同意或撤回同意并退出；再次打开保留本地记录。撤回会取消在途天气请求和相关后台任务。
- 移除未使用的生物识别权限，手机显示名统一“小懂哥”；补充Android OCR、SDK诊断、第三方联网、媒体URI备份及数据保留/删除说明。

## 验证与已知限制

27项工程门禁通过（含32个共享单测）、10个Android JUnit通过，独立隐私回归5组通过；assembleRelease/lintVitalRelease、原签名及版本检查、17份public和3份平台资源核对通过。

尚未进行手机安装、OEM通知重新绑定、实际OCR或SDK网络捕获。ZIP16KB对齐通过，64位原生库的LOAD对齐通过，但以下ML Kit/SQLCipher库的GNU_RELRO末端16KB静态检查未通过：

- `lib/arm64-v8a/libmlkit_google_ocr_pipeline.so`
- `lib/arm64-v8a/libsqlcipher.so`
- `lib/x86_64/libmlkit_google_ocr_pipeline.so`
- `lib/x86_64/libsqlcipher.so`

16KB设备兼容需继续处理及实测。本版未完成应用商店所需的实名政策、公网政策地址、版权及APP备案材料，不代表已通过商店审核。

## 安装包校验

- 文件：`codex_xiaodongge-v3.1.2-32-test.apk`
- 大小：75,783,913字节
- SHA-256：`d8a38af20902d204016737667792164fdeac71739635239f1b4dd739adc5af5d`
- 签名证书SHA-256：`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`

发布页：https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.1.2
