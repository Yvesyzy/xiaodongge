# 小懂哥 v1

一个在安卓手机本地运行的私人音乐感受记录 APK。它只保存你手动输入或截图识别后确认的记录，不自动编造歌曲、专辑、歌手或感受。

## 功能

- 新建、查看、编辑、删除音乐感受记录
- 按年份和月份查看时间轴
- 查看专辑聚合和歌曲聚合
- 给专辑或歌曲保存封面
- 从音乐截图中识别歌曲、专辑、艺术家等信息
- 搜索标题、正文、歌曲、专辑、艺术家、标签、情绪关键词
- 查看年度统计
- 生成并保存年度总结
- 导出、导入备份，并支持撤销最近一次导入

## 技术栈

- React
- Vite
- TypeScript
- Capacitor
- Android
- Capacitor SQLite

## 下载 APK

最新安装包下载：

```text
https://github.com/Yvesyzy/xiaodongge/releases/download/%E5%B0%8F%E6%87%82%E5%93%A5v1.0.0/app-debug.apk
```

发布页：

```text
https://github.com/Yvesyzy/xiaodongge/releases/tag/%E5%B0%8F%E6%87%82%E5%93%A5v1.0.0
```

当前公开下载的是 debug APK，适合测试安装；长期公开发布建议改用正式签名 APK。

## 构建 APK

首次安装依赖：

```cmd
npm.cmd install
```

构建 debug APK：

```cmd
powershell -ExecutionPolicy Bypass -File scripts/build-android-debug.ps1
```

APK 输出路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

如果手机已开启 USB 调试，可以安装：

```cmd
C:\Users\lenovo\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## 正式签名 APK

当前仓库没有提交 keystore，也没有保存签名密码。正式发布前需要先准备：

```text
keystore 文件
key alias
store password
key password
```

这些信息必须长期保存，不能提交到 Git。安卓应用升级时需要继续使用同一个 keystore，否则用户无法直接覆盖安装新版。

最小流程：

1. 生成或准备自己的 Android keystore。
2. 在本机私有配置中保存签名路径、alias 和密码。
3. 给 Android release 构建接入 signingConfig。
4. 构建 release APK。
5. 把 release APK 上传到 GitHub Releases，替换当前 debug APK。

## 本地数据

安卓真机运行时，数据保存在手机本地 SQLite。主要表：

```text
ReviewEntry      音乐感受记录
YearlySummary    年度总结
CoverImage       专辑和歌曲封面
```

第一版手机端从空库开始，不导入电脑上的 `prisma/dev.db`。

## 年度总结

年度总结只基于手机本地数据库中指定年份的记录生成，包括：

```text
统计信息
高频标签
高频情绪
高频专辑
高频歌曲
按月份归纳的记录摘要
从原文截取的关键片段
```

没有记录的年份不会生成年度总结。

## 电脑端网页

项目仍保留电脑端 Next.js + Prisma 网页代码，主要用于本地开发和历史版本参考。

运行电脑端网页：

```cmd
npx.cmd prisma generate
npx.cmd prisma migrate dev --name init
npm.cmd run dev
```

然后打开终端显示的本地地址，通常是 `http://localhost:3000`。

电脑端网页使用 `.env`：

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.5"
```

`.env.example` 提供同样的配置模板。

如果 Prisma 在 Windows 本机返回空的 `Schema engine error`，先在当前终端设置：

```cmd
set RUST_LOG=info
```

然后重新执行 `npx.cmd prisma migrate dev --name init`。这个环境变量只用于让 Prisma schema engine 输出并稳定初始化，不会改变数据库内容。

## OpenAI API Key

电脑端网页的年度总结默认使用本地基础总结。若要启用大模型总结：

1. 在 `.env` 填入 `OPENAI_API_KEY`。
2. 保留或调整 `OPENAI_MODEL`。
3. 重启 `npm run dev`。

OpenAI 调用失败时，系统会回退到本地基础总结，不影响记录、搜索、统计和本地总结。

## 项目结构

```text
mobile/                           安卓 APK 的前端界面和本地存储逻辑
android/                          Capacitor 生成的 Android 工程
scripts/build-android-debug.ps1   debug APK 构建脚本
prisma/schema.prisma              电脑端网页的数据模型
src/app                           电脑端 Next.js 页面和 API
docs/superpowers/specs            设计说明
```

## 本地 APK 备份

构建后的安装包可以复制到本地 `release/` 目录备份。该目录不提交到 Git。

## License

MIT
