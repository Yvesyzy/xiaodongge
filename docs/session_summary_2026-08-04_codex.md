# Codex 会话交接：Android 原生导出、分享与复制修复

## 用户问题与根因

v2.1.9 备份页的 JSON、TXT、CSV 内容生成正常，但 Android 中“保存/分享文件”和“复制内容”没有可见结果。代码确认存在三个根因：

- 保存只调用 `Filesystem.writeFile(Directory.Documents)`，没有进入 Android 系统文件创建器。
- 同一个按钮没有真正触发系统分享；复制只依赖 WebView 剪贴板 API。
- 成功和错误信息位于完整导入表单之后，在导出按钮附近不可见。

## 已实施

- 分支：`codex/android-native-export`
- 设计提交：`f74df81 docs: design native Android export flow`
- 新增 `NativeExportPlugin.java`：
  - `saveFile` 使用 `ACTION_CREATE_DOCUMENT`，写入系统返回的 `content://` URI。
  - `shareFile` 写入专用 `cache/exports`，通过既有 `FileProvider` 和临时只读 URI 权限分享真实附件。
  - `copyText` 使用 `ClipboardManager.setPrimaryClip`。
- `MainActivity` 注册 `NativeExportPlugin`；`file_paths.xml`声明 `exports/` 缓存路径。
- 新增 `mobile/src/nativeExport.ts` 类型化 Capacitor 桥接。
- `BackupPage` 改为三个明确按钮：“保存到文件夹”“系统分享”“复制内容”。
- Android 使用原生桥接；浏览器保留下载、Web Share API 和浏览器剪贴板回退。
- 导出按钮下方增加 `aria-live` 状态，覆盖处理中、成功、取消和精确错误；操作期间禁用三个按钮。
- JSON 健康状态只在 Android 系统写入回调确认 `saved` 后更新。
- 新增 `scripts/codex_check_native_export.mjs`，验证插件注册、三个系统 API、FileProvider 路径、TypeScript 桥接和 UI 接线。

## 验证证据

- `npm run typecheck`：通过。
- `npm run mobile:check:native-export`：实现前因缺失插件按预期失败，实现后通过。
- `npm run mobile:check:exports`：通过。
- `npm run mobile:check:v219`：通过。
- `npm run mobile:build`：通过。
- `npm run android:sync`：通过。
- 本机缓存 Gradle 8.13 执行 `assembleDebug`：`BUILD SUCCESSFUL`。
- 本机缓存 Gradle 8.13 执行 `lintDebug`：`BUILD SUCCESSFUL`，App lint 无新增问题。
- `git diff --check`：通过。
- Debug APK：`android/app/build/outputs/apk/debug/app-debug.apk`
- APK 大小：69,498,262 bytes
- APK SHA-256：`6DAFCC8BEE350C99716314A2353CA3EB5FFE8E9DE1A6836C1823DD454149E5E3`

Gradle Wrapper 直接下载 `services.gradle.org` 两次超时，随后复用本机已有的完整 Gradle 8.13 分发目录完成构建；这不是代码编译失败。

## 当前状态与下一步

ADB 设备列表为空，因此尚未完成手机上的交互验收。需要安装 debug APK 后逐项确认：

1. JSON/TXT/CSV 均能打开系统文件创建器并保存到用户选择的文件夹。
2. 取消文件创建器会显示“已取消保存”，不会更新 JSON 健康状态。
3. 系统分享面板收到对应 MIME 类型、文件名和真实附件。
4. 复制后可在其他 Android App 粘贴完整内容。
5. 系统窗口打开期间重复点击不会创建多个窗口。

实现改动尚未提交；分支尚未推送；正式签名 release APK 尚未生成。`.claude/` 未修改、未暂存。
