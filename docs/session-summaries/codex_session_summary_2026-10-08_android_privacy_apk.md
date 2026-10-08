# 小懂哥3.1.2原签名测试APK交接

日期：2026-10-08。Yves选择构建原签名测试包；随后明确“不用，你直接构建apk”，因此本轮只构建和核验安装包，不连接或安装手机。

## 最终安装包

- 路径：`release/codex_privacy_signed_20261008/codex_xiaodongge-v3.1.2-32-test.apk`。
- 版本：`3.1.2 (32)`；包名：`com.yves.musicarchive`；显示名：小懂哥。
- 大小：75,783,913字节。
- SHA-256：`d8a38af20902d204016737667792164fdeac71739635239f1b4dd739adc5af5d`。
- 校验文件：同目录`codex_xiaodongge-v3.1.2-32-test.sha256.txt`。
- 签名证书SHA-256：`6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，与保留的3.0.1、3.1.1原包一致；版本号32高于3.1.1的31。

沿用原有四项用户级签名配置，由既有`build-android-release.ps1`构建；没有打印密码、导出私钥或修改用户签名配置。npm、锁文件根项目、Android版本同步递增，依赖版本和数据库结构未改变。

## 包内变更

包含上一阶段已完成的首次隐私同意/仅本地、拒绝仍可手动保存、撤回同意并退出、前端与原生敏感入口检查、天气在途取消和远程封面限制；ML Kit按需初始化，通知监听和DataTransport后台入口默认关闭，移除未用生物识别权限。正式提交前仍需补政策实名与公网URL、版权和APP备案等材料。

## 验收

- 既有全量发布门禁27项通过，包括32个共享单测、根/移动类型检查、质量门禁、草稿/存储/备份/评分/分享/阅读/诊断/无障碍等回归。
- Android JUnit10/10通过；assembleRelease及lintVitalRelease通过。
- 新版本独立隐私检查5组通过，包括首次、拒绝保存/重启、重新同意、撤回/取消在途请求、旧/非法状态、保存失败及非Android行为；采用合成桥接。
- 17份public资源、3份平台资源与新构建逐字节一致；实际APK政策HTML与源码一致。
- 实际APK中MlKitInitProvider及生物识别权限已移除；通知监听、DataTransport job service和receiver均默认enabled=false。
- 原签名验签、包名/版本、ZIP16KB对齐及交付副本SHA-256通过；另与既有3.1.1核对包名、证书及版本递增。

证据在`release/codex_privacy_signed_20261008/`：`build_manifest.json`、`codex_delivery_validation.json`、`checks/codex_results.json`、`android-unit/`、`privacy/`及签名/manifest/资源核对记录。APK没有上传、发布、提交到应用商店或安装手机；原3.0.1和3.1.1包保留且哈希不变。

16KB ELF RELRO、真实手机OCR/通知绑定与SDK网络行为仍未实测，不把ZIP对齐通过当作全部运行兼容通过。本轮按Yves要求直接交付APK。

## 清理与保留

本聊天已核实累计生成量下限468,090,754字节，自动清理阈值已触发，后续不会因删除量扣回。保留最终原签名APK/SHA、必要源码、构建/检查脚本、原始验收日志/JSON、关键截图与交接。

实际删除657个普通文件、309,772,861字节，包含过期浏览器QA缓存、隔离原生副本、重复Debug/Release构建包、全量门禁的合成旧Web应用/数据库和Vite缓存；仅解除1个本任务创建的node_modules junction，共享依赖目标及31个保护文件哈希不变。旧阶段必要的浏览器和JUnit结果已集中保留到`release/codex_privacy_android_build_final_20261008/`；生成型构建目录中的重复APK不再保留。

最后一份一次性清理辅助脚本`release/codex_privacy_signed_20261008/codex_cleanup_execute.ps1`（9,456字节）直接删除被工具自动审批审核拒绝，仅返回`blocked by policy`，没有更具体理由。未重试相同动作或更换方式绕过；该1文件保留，清理状态为partial，APK构建交付已完成。准确清单和保护核对见`codex_cleanup_checks.json`。

## 下一步

Yves可将APK复制到手机，覆盖同包名、同签名且版本号更低的旧版，然后检查本地记录、隐私选择、当前播放和截图识别。后续若准备正式上架，再补实名、政策托管和个人资质材料。本轮未提交或推送Git。
