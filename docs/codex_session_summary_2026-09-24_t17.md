# T17 本机诊断交接（2026-09-24）

在 `codex/v29-p1` 未提交工作区增加“更多 → 本机诊断”。页面显示 package.json 应用版本、Vite 构建时间标识、实际 Android PackageManager 的 versionName/versionCode、最近备份验证与保存时间、格式有效/损坏草稿数、恢复只读屏障状态，以及通知读取权限。资源哈希明确标为“运行时未核验；构建检查结果以打包清单为准”。读取失败保留“未知”和固定阶段代码，不显示原生异常原文。

原生 `NowPlaying.getDiagnostics` 只读取安装包版本和通知监听器授权布尔值，不读取当前曲目。Web 页不调用外部接口、不申请权限、不写测试记录或自动备份。`StorageGate` 在恢复错误/只读状态下提供诊断入口；复制摘要由固定字段白名单生成。备份时间转为规范 ISO，备份文件名及路径不进入页面。标题、正文、OCR、封面、路径和模拟异常中的独特标记均未进入复制文本。

Web 合成测试 `scripts/codex_check_diagnostics.mjs` 覆盖离线、恢复屏障、原始错误脱敏、有效/损坏草稿与存储前后逐字节相同。`release/codex_t17_full_20260924/codex_results.json` 为 26/26 全量通过；最后对时间规范化和离线屏障测试的修改由 `release/codex_t17_final_targeted_20260924/codex_results.json` 的类型、构建、榜单、诊断及存储定向检查通过。

项目专用 Android36 `codex_np1_api36` 模拟器运行实际新 Java 插件：返回 2.9(27)，与 PackageManager 一致；通知访问开启时返回 true，临时撤销后返回 false，再恢复原设置。桥接没有请求曲目信息或写入 Web 存储。证据 `release/codex_t17_native_permission_20260924/codex_results.json`。8 项 Android JUnit 通过：`release/codex_t17_android_unit_20260924/`。原生调试包 `release/codex_t17_native_20260924/codex_t17_debug.apk`，SHA-256 `2FD91BEC50139F9C8CE9B518EF3CDB345E59D80A34DCE496B2ACA91EEEE7BD36`；该包用于插件桥接验证，网页资源是上一版，因此不能作为 T17 完整页面交付包。

模拟器已停止，ADB 转发清空；没有连接 Yves 手机、提交、推送或发布。T12 冷启/首次导出门槛仍未证明满足，T18 应生成包含最新网页与原生代码的签名测试包，完成合成档案覆盖安装及系统接收应用验证；真实手机项目需标为未执行，不能用模拟器冒充。
