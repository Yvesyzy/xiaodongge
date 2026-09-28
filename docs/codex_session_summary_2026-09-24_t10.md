# T10 OCR 输入与内存保护交接（2026-09-24）

本轮在 `codex/v29-p1` 的未提交工作区实施 T10。Yves 明确不连接个人手机；全部 Android 实测在项目专用 `codex_np1_api36` 模拟器及合成图片上进行。没有改动个人数据、正式发布 APK，也没有提交、推送或发布。

## 实现

- `mobile/src/App.tsx` 在 `FileReader` 与 Capacitor 桥接之前拒绝超过 12 MiB 的图片，并保持已有表单和 OCR 文本；错误提示用户裁剪或更换图片。
- `ScreenshotOcrPlugin.java` 在截取 Base64 子串及解码前限制编码长度，解码后再次限制 12 MiB；先读取尺寸，再用二次幂采样使解码结果不超过 600 万像素。异常路径明确拒绝；识别完成或失败均关闭识别器并释放 bitmap。
- `CodexScreenshotOcrTest.java` 覆盖字节和像素预算的阈值前、等于、阈值后，以及长图、24 MP 和极端尺寸。前端捕获回归覆盖 12 MiB 三个边界、超限不跨桥接和表单保持。

`ponytail:` 注释记录阈值的测量依据和提高阈值前的复测条件。12 MiB 高于本轮 11,142,031 字节的高分图；600 万像素使该 4000×6000 图片按 2 倍采样。阈值只表示本轮受控设备的预算，不宣称所有低内存手机都安全。

## 验证

证据在 `release/codex_t10_baseline_20260923/`、`release/codex_t10_native_initial_20260923/`、`release/codex_t10_full_acceptance_reviewed_20260924/`、`release/codex_t10_android_unit_final_20260924/`。原生设备记录由 `scripts/codex_profile_ocr_android.mjs` 在确认 AVD 名称后经真实 WebView/Capacitor 桥接获取。

| 合成图 | 字节 / 原尺寸 | 旧包识别耗时 / 峰值 PSS | 新包识别耗时 / 峰值 PSS | 新解码尺寸与字段 |
|---|---|---|---|---|
| 普通截图 | 110,098 / 1080×2400 | 3,221 ms / 204,702 KiB | 5,991 ms / 213,288 KiB | 1080×2400，专辑/艺人均识别 |
| 长截图 | 366,669 / 1080×8000 | 5,913 ms / 226,865 KiB | 2,529 ms / 205,206 KiB | 540×4000，专辑/艺人均识别 |
| 相册高分图 | 11,142,031 / 4000×6000 | 6,695 ms / 429,787 KiB | 4,057 ms / 331,065 KiB | 2000×3000，专辑/艺人均识别 |

耗时和 PSS 是单次运行，不作为跨设备性能承诺；普通图首次识别新包较慢。高分图峰值 PSS 在本次测量中降低 98,722 KiB。9 字节损坏 PNG 与声明 100000×100000 但无图像数据的 PNG 均显示“图片读取失败”，进程继续运行。

原生桥接实测：12 MiB−1 与恰好 12 MiB 的填充 JPEG 均识别出专辑和艺人；12 MiB＋1 字节被拒绝，提示裁剪或更换。超限图强行直接跨桥接仍会造成短时内存升高，所以前端先行拒绝是必要保护。相同普通图连续识别 20 次均成功，字段 20/20 保留；结束后 PSS 范围 170,842–173,679 KiB，首尾 172,215/172,650 KiB，未见逐次累积。这个 PSS 结果是活动 bitmap 是否积累的外部代理指标，无法直接计数内部 bitmap 对象。

初次全量入口曾报告 22/22 通过；独立复查发现并补充“成功 A→失败 B”字段保持断言，初次原始输出已在后续清理中删除。修正后的定向检查通过，最终全量结果见 `release/codex_t10_full_acceptance_reviewed_20260924/codex_results.json`。Android JUnit 8/8 通过：`release/codex_t10_android_unit_final_20260924/`。`git diff --check` 退出 0。调试 APK `release/codex_t10_native_initial_20260923/codex_t10_debug.apk` 为 81,180,420 字节，SHA-256 `B6D5B36F9EABA3E23ACB3733FA654CD4B689023CB80B5B95CC73A6F7B8B7F234`，与构建输出逐字节摘要相同；仅用于项目模拟器。

独立只读复查未发现已确认的 bitmap/recognizer 泄漏或预算运算问题；两项证据反馈已关闭：成功后再次失败仍保留旧 OCR 文本和用户表单，以及 `dumpsys meminfo` 无效或无采样时剖析脚本必须失败、峰值纳入结束值。修正后原生超限记录为 `release/codex_t10_native_initial_20260923/codex_profile_over_limit_reviewed.json`。ML Kit 内部任务失败时的清理未被故障注入直接触发，当前依据源码收尾路径与 20 次连续运行核对，不能把它写成已实测故障注入。

## 剩余边界与接续

Yves 的个人手机没有连接，因此原计划“实际测试手机”及低内存 OEM 体验不能标记通过；T18 中保留这项最终验收，不再要求 Yves 为当前开发连接手机。T10 的代码、自动边界和项目模拟器实测已完成。下一工作包为 S3 T11 发布质量入口，随后 T12 性能和 S4–S5。
