# 小懂哥 Windows 使用说明

后续 Windows 开发、安装器和正式发布已转入[独立 Windows 仓库](https://github.com/Yvesyzy/xiaodongge-windows)，维护目录为 `D:\codex\workspaces\xiaodongge-windows`。以下说明保留原目录首版移植的使用和验证方法。

这是 Windows x64 便携版。解压完整目录后，双击 `codex_xiaodongge.exe`。程序运行需要同目录的 DLL、`resources` 和 `locales`，请一起保留。

首版面向 Windows 10/11 x64，本轮实际验收在 Windows 11 x64 完成。测试包未签名，没有自动更新。

## 从安卓版迁移

1. 在安卓版的备份页导出包含封面的 JSON；保留原文件。
2. 在 Windows 的「备份与恢复」选择该 JSON。
3. 查看格式检查结果，点击「预演恢复并查看差异」。预演使用隔离内存 SQLite，不更改正式档案。
4. 核对差异后点击「导入并覆盖当前数据」。这是整库恢复，会替换本机记录和相关数据。
5. 需要回退时使用「撤销上次导入」。成功撤销后，这次撤销快照会清除。确认迁移后再次导出 JSON 留作备份。

支持 JSON v1–v6。v1–v5 不含草稿时保留本机草稿；v6 的草稿按备份整体替换。旧总分、加减号及旧词曲分保留，不自动拆成新的词、曲评分；六项完整评分才计算平均。

## 保存与更新

正式档案位于 `%APPDATA%\xiaodongge-windows\archive\music_feelings_archive.sqlite`。草稿、主题和阅读偏好位于同一个应用数据目录中的 Chromium 存储。

更新时解压新版到新目录并运行，沿用同一应用数据目录。请先正常关闭旧版并导出 JSON；不要通过复制运行目录替代备份。程序允许一个实例。

「保存到文件夹」使用 Windows 文件对话框；取消不会标记为保存成功。批量保存遇到同名文件会停止并报告已保存部分，不覆盖原文件。「打开导出文件夹」在本机生成文件并打开资源管理器，之后由你选择复制或发送。生成的分享文件暂存在应用数据目录的 `exports` 中。

## Windows 功能

- 当前播放读取 Windows 系统媒体会话，只使用正在播放的会话。播放器需要提供此接口；不支持时可手动输入或识别截图。
- 网易云音乐：在「设置 → 系统」勾选「开启SMTC」，保持歌曲播放，再返回小懂哥点击「读取当前播放」。本机网易云音乐 `3.1.41.205529` 已通过真实播放、暂停及恢复播放检查；未勾选时 Windows 媒体会话数为 0。
- 网易云系统会话缺少专辑或合作歌手时，程序只读本机播放队列，按歌曲名和歌手唯一匹配后补齐；无需联网。同名版本有歧义、专辑冲突或队列不可读时保留系统结果，可手动输入或识别截图。读取不会自动保存正式乐评，也不会覆盖已有手填信息。
- 截图 OCR 在本机完成，支持 PNG/JPEG/BMP/WebP 解码能力取决于 Windows。语言取决于已安装的 OCR 语言包，可在「本机诊断」查看。截图上限 12 MiB，原生解码另有像素限制。
- 当前播放具备作品名和艺术家时，沿用现有 Apple iTunes 目录补全；天气仅在手动选择城市后请求 Open-Meteo。本地记录功能可离线使用。
- 使用侧栏切换页面；评分滑块支持方向键、Home/End、PageUp/PageDown。`Ctrl +` / `Ctrl -` 调整页面缩放，`Ctrl 0` 恢复 100%。

## 开发与验证

在项目根目录执行：

```powershell
npm.cmd ci
node node_modules/electron/install.js
npm.cmd run windows:build
npm.cmd run windows:start
npm.cmd run windows:check
npm.cmd run windows:package
```

运行时安装保留 npm 包附带的官方校验和。GitHub 下载连接不可用时，可按 [Electron 官方安装文档](https://www.electronjs.org/docs/latest/tutorial/installation) 临时设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 与 `ELECTRON_CUSTOM_DIR={{ version }}` 后重试。

`windows:check` 使用工作区 `release` 内的独立 profile 和合成记录，不读取正式个人档案。封面和 OCR 测试图片由脚本自行生成，验收 JSON 与截图存入新的 `codex_windows_qa_*` 目录。传入打包后的 EXE 路径还会检查目录搬移、屏蔽 HTTP/HTTPS 后的冷启动，以及离线保存/导出：

```powershell
npm.cmd run windows:check -- "实际解压目录\codex_xiaodongge.exe"
```

`desktop/codex_sqlite.test.cjs` 覆盖持久化、事务失败回滚、外键和预演隔离；`node --test desktop/codex_now_playing.test.cjs` 检查网易云本机补全及歧义/损坏边界。保持网易云播放后执行 `node scripts/codex_check_windows_playback.mjs`，使用独立 profile 检查完整乐评、速记、专辑优先、手填保护及暂停/恢复，并恢复播放。`windows:package` 逐项校验 ZIP 大小和 SHA-256，并生成外部哈希文件。运行包无需另装 Node、npm 或数据库组件。

Electron、Chromium 及字体授权说明随包保留。源码依据项目 MIT License。
