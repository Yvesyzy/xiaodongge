# 2026-09-26 播放读取与完整乐评回归交接

## 当前状态

Yves 的目标是从其手机当前播放器读出歌曲、专辑、歌手。Yves 反馈网易云音乐正在播放，但小懂哥读取失败且无提示；同时完整乐评的情绪、评分、曲风入口不见了。实体手机未连接，本轮没有取得其系统媒体会话或本机诊断结果，因此不能宣称手机故障已修复。已异步请求 Yves 提供「更多 → 本机诊断」中的「已安装 Android 包」「通知读取权限」两行。

## 原因与改动

- 比对 v2.5 (`a2d7a52`)、v2.6 (`a60f893`)、v3.0 (`27fcee0`)：Android `NowPlayingPlugin` 媒体会话读取算法未变；v2.6 把完整乐评的补充信息、情绪、评分、曲风收进默认关闭的 `<details>`，v3.0 继承。因此把该区域改为默认展开。
- 完整乐评和速记的读取链继续调用原生 `NowPlaying.getCurrentTrack()`。速记读取状态改为在按钮下方即时显示；完整乐评与速记的成功提示明确列出读到的歌曲、专辑、歌手。原生无权限、无正在播放会话和异常仍分别显示，不伪造读取成功。
- 专辑优先记录保留系统媒体会话给出的歌曲名，并避免把仅有的专辑标题误当歌曲；速记保存该歌曲名。同专辑重复提醒仍按专辑身份判断。
- 更新浏览器回归与 Android 仪器测试，覆盖三个字段、展开的完整乐评、速记保存及无会话/撤权反馈。

## 验证

- `node scripts/codex_check_capture_regressions.mjs` 通过；`npm.cmd run typecheck:mobile`、32 项基础测试、26/26 项完整项目检查、Android JUnit 8/8 通过。最后一处提示文字修改后再次运行了受影响的捕获回归。
- Android 36 项目模拟器上，真实 `MediaSession` → Capacitor → WebView 仪器测试通过，返回歌曲、专辑、歌手，表单填入。旧证据 `release/codex_netease_playback_20260922/codex_netease_result.json` 记录官方网易云 9.5.95 实播时原生桥返回三字段及 `sourcePackage=com.netease.cloudmusic`。
- 本轮网易云模拟器没有重新进入在线 `PLAYING`：启动时移动数据关闭；开启后默认网络出现，但外网 ping 失败。当前网易云会话为 `STOPPED`，不可当作新一轮实播成功。
- 最终同证书签名测试 APK：`release/codex_playback_regression_20260926/codex_xiaodongge-v3.0-28-playback-triad.apk`，包名 `com.yves.musicarchive`、版本 `3.0 (28)`，证书 SHA-256 `6386734ef9b4a3fe106d690a8d31ae952697c2ea652ea1ee82f3f7ab488f1022`，APK SHA-256 `ddb9537e456f905055a59ef98259fcee05b79612744fd165b49a1dc2175e9df2`。`codex_signed_assets_latest.json` 核实 49 个 public 资源及 3 个平台资源与最新构建相同，入口引用 `index-Hpsf7ofV.js`。同目录旧 `playback-test`、`playback-test-final`、`playback-verified` APK 均不是最终源码构建，勿使用。
- 最终 APK 已用 `adb install -r` 在项目 `codex_t18_upgrade_api36` 模拟器覆盖已安装同证书 v3.0，安装成功且 `firstInstallTime=2026-09-24 07:15:14` 不变；应用可启动。`codex_np1_api36` 的通知监听权限已恢复允许，移动数据与 Wi-Fi 还原为测试前关闭状态；两台项目模拟器均已停止。

## 交接事项

- Yves 随后提供实体手机本机诊断：应用 `3.0.0`、Web 构建 `web-2026-09-25T12:00:18.270Z`、Android 包 `3.0 (28)`、**通知读取权限：未开启**、读取代码：无。由原生 `getCurrentTrack` 的权限门槛可确定：当前手机无法进入媒体会话读取分支；先开启通知使用权，再重试网易云播放。已告知 Yves 在现有公开 v3.0 的「新建 → 完整 → 补充作品信息、评分与日期（选填）→ 当前播放 → 打开系统设置」开启“小懂哥”通知使用权，返回后点「读取当前播放」。异步等待 Yves 回报权限和三字段结果。
- 若授权后仍读不到，需 Yves 在手机播放时提供读取按钮旁的原话及更新后的本机诊断；不能从模拟器推断手机的 OEM 媒体会话差异。
- 当前源码改动未提交/推送，GitHub v3.0 Release 未变更。不要把本地测试 APK 当成已发布版本。
- 若 Yves 手机上已经安装公开 v3.0，此测试 APK 可用相同签名覆盖安装；同版本号覆盖在项目模拟器已验证。没有在 Yves 手机上安装或读取其实际媒体会话。
