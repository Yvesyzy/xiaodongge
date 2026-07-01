# 私人音乐感受档案

一个本地运行的个人音乐感受记录网页。它只保存你手动输入的记录，不自动编造歌曲、专辑、歌手或感受。

## 功能

- 新建、查看、编辑、删除音乐感受记录
- 按年份和月份查看时间轴
- 查看专辑聚合和歌曲聚合
- 搜索标题、正文、歌曲、专辑、艺术家、标签、情绪关键词
- 查看年度统计
- 生成并保存年度总结
- 没有 OpenAI API Key 时使用本地基础总结

## 技术栈

- Next.js
- TypeScript
- Tailwind CSS
- SQLite
- Prisma ORM
- OpenAI Responses API，可选

## 安装和运行

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

然后打开终端显示的本地地址，通常是 `http://localhost:3000`。

如果 Windows PowerShell 拦截 `npm.ps1`，可以在同一目录使用：

```bash
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma migrate dev --name init
npm.cmd run dev
```

如果 Prisma 在 Windows 本机返回空的 `Schema engine error`，先在当前终端设置：

```bash
$env:RUST_LOG="info"
```

然后重新执行 `npx.cmd prisma migrate dev --name init`。这个环境变量只用于让 Prisma schema engine 输出并稳定初始化，不会改变数据库内容。

## 环境变量

项目已带本地 `.env`：

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.5"
```

`.env.example` 提供同样的配置模板。

## 数据库初始化

Prisma schema 位于 `prisma/schema.prisma`。首次运行：

```bash
npx prisma generate
npx prisma migrate dev --name init
```

SQLite 数据库会生成在 `prisma/dev.db`。

## OpenAI API Key

年度总结默认使用本地基础总结。若要启用大模型总结：

1. 在 `.env` 填入 `OPENAI_API_KEY`。
2. 保留或调整 `OPENAI_MODEL`。
3. 重启 `npm run dev`。

OpenAI 调用失败时，系统会回退到本地基础总结，不影响记录、搜索、统计和本地总结。

## 本地总结规则

本地总结只基于数据库中指定年份的记录生成，包括：

- 统计信息
- 高频标签
- 高频情绪
- 高频专辑
- 高频歌曲
- 按月份归纳的记录摘要
- 从原文截取的关键片段

没有记录的年份不会生成年度总结。

## 项目结构

```text
prisma/schema.prisma              数据模型
src/app                           Next.js 页面和 API
src/app/api                       API 路由
src/components                    前端组件
src/lib                          Prisma、校验、统计、总结逻辑
docs/superpowers/specs            精简设计说明
```

## 可扩展方向

- 多版本年度总结
- SQLite FTS 全文搜索
- 导出 Markdown 或 PDF
- 标签和情绪的独立管理页
- 本地备份和恢复

## 安卓离线 APK

项目保留电脑端 Next + Prisma 网页，同时新增 `mobile/` 手机端。手机端使用 Capacitor 打包为 Android 应用，数据保存在手机本地 SQLite，不依赖电脑服务，也不调用 OpenAI。

首次生成 Android 工程：

```bash
npm.cmd run mobile:build
npx.cmd cap add android
```

构建 debug APK：

```bash
powershell -ExecutionPolicy Bypass -File scripts/build-android-debug.ps1
```

APK 输出路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

如果手机已开启 USB 调试，可以安装：

```bash
C:\Users\lenovo\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r android/app/build/outputs/apk/debug/app-debug.apk
```

第一版手机端从空库开始，不导入 `prisma/dev.db`。正式签名发布需要后续提供 keystore。
