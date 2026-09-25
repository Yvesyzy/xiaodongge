# T18 集成与验收交接（2026-09-25）

工作区 `D:\codex\workspaces\小懂哥`，分支 `codex/v29-p1`，HEAD `b563e3249424cb72ff08846ce3c9698c20fc0d98`；所有本轮修改仍未提交。原计划 T00–T18 共 19 个工作包，27 个追踪项加 NP1 共 28 项。完整逐项判断见 [`codex_v29_upgrade_acceptance.md`](codex_v29_upgrade_acceptance.md)，不可仅凭此交接把全量技术或 Yves 体验验收标为完成。

T13 每日专辑重听标题改用专辑名；T14 旧 v5 备份差异排除设备专属备份健康键；T15 轨迹纳入当前正文/重听正文，同名不同目录 ID 在详情分离并提示榜单缺 ID 归属不明；T16 榜单来源匹配规范化，复制预检遵守全部隐私开关；T17 存储读取失败显示状态未知且复制 API 缺失可见。定向检查 `release/codex_t18_review2_targeted_20260925/codex_results.json` 通过；T13/T14、T15–T17 两轮独立只读复查确认已指出的 P2 闭合。T15 顶层卡片按名称/艺人聚合这一展示边界已在界面说明，没有把不同目录 ID 的名次强行分配。

最新完整签名测试包为 `release/codex_t18_final_signed_20260925/codex_xiaodongge-v2.9-27-test.apk`，75,772,938 字节，SHA-256 `6a5d927676627898e6e4686090cae0f9b042425e6539c4dce48cb28af2198ac1`；包名 `com.yves.musicarchive`、versionName `2.9`、versionCode `27`，证书 SHA-256 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022` 与原 v2.9(26) 相同。构建清单同目录 `build_manifest.json`；26/26 完整检查、Android JUnit 8/8、`lintVitalRelease`、17 个 public + 3 个平台资产集合/哈希通过。原发布 APK SHA-256 `f8923da74bb59af85bf5c86fee582e6890f4327f8091ce28c5154247fa0968c0` 保持不变。

项目自建 `codex_t18_upgrade_api36` Android16 模拟器用原发布 APK 创建一条合成正式乐评和一份速记草稿，系统正常 `adb install -r` 覆盖最终签名包，不卸载。旧 v5 备份经 DocumentsUI 选择后，页面显示格式校验、旧备份不含草稿及隔离 SQLite 实写回读通过；正式导入后导出 v6，乐评逐字段与旧版相同、草稿原文未变。可重复断言与备份哈希在 `release/codex_t18_upgrade_20260924/codex_final_restore_result.json`，原备份、后备份和 UI XML/截图同目录。最终签名包诊断页面和复制到搜索框的脱敏字段检查在 `codex_final_diagnostics_result.json`。项目 AVD 已停止，ADB 转发为空；未操作 Yves 手机或个人数据。

T12 同机固定 15 条数据、离线测量 `release/codex_t18_performance_20260925/codex_assessment.json`：初始 JS 649,281→535,694 B（−17.49%）；暖启 P90 872→804 ms、15 张总预览 3,395→3,550 ms、峰值 PSS 165,022→150,157 KiB，三项符合计划；冷启 P90 3,485→5,974 ms、首次预览 1,825→2,173 ms，不符合 ≤10% 不恶化门槛。宿主时序波动明显；不能断言是代码性能回退，也不能放行该门槛。一次复测因未建立输出目录而未写报告，已建立目录并完整重跑，最终报告有 10 次冷启、10 次暖启、3 次预览原始样本。

剩余：低干扰环境同条件前后复测并处理 T12 未达标；真实手机/第二 Android-WebView 组合、实际 B 站、系统分享接收应用、TalkBack 等现场验收。Yves 已说不会连接个人手机，继续工作不以此为前提。当前只交付本地签名测试包与证据，未提交、推送或公开发布。旧 APK 不支持 v6 备份，不得通过卸载重装回退。
