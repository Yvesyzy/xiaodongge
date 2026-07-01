# 个人音乐感受记录网页设计

## 范围

实现一个本地单用户全栈 Web 应用，用于手动记录音乐感受。记录对象覆盖 year、month、album、song。系统不接入音乐元数据服务，不自动补全歌曲、专辑、歌手或个人感受。

## 技术

- Next.js App Router + TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite
- OpenAI Responses API 为可选增强；没有 API Key 时使用本地总结

## 数据

`ReviewEntry` 保存每条音乐感受。`tags` 和 `moods` 使用 JSON 字符串存储数组，空值保存为 null。

`YearlySummary` 以 year 唯一保存当前年份总结，重新生成时覆盖该年份总结。

## 页面

- 首页：最近记录、当年记录数、当年专辑数、当年歌曲数、年度总结入口、新建记录按钮
- 时间轴：按年份和月份分组展示记录
- 新建、详情、编辑、删除：通过 API 保存和修改 SQLite 数据
- 专辑、歌曲：按用户填写的名称聚合，不补全信息
- 搜索：搜索标题、正文、歌曲、专辑、艺术家、标签、情绪
- 年度总结：选择年份、显示统计、生成并保存总结

## API

- `GET /api/entries`
- `POST /api/entries`
- `GET /api/entries/[id]`
- `PUT /api/entries/[id]`
- `DELETE /api/entries/[id]`
- `GET /api/search`
- `GET /api/albums`
- `GET /api/songs`
- `GET /api/year-stats/[year]`
- `GET /api/yearly-summaries/[year]`
- `POST /api/yearly-summaries/[year]/generate`

## 年度总结

生成前读取指定自然年的全部记录。没有记录时返回错误，不生成空总结。配置 OpenAI API Key 时调用 Responses API；调用失败或未配置 Key 时使用本地基础总结。本地总结只使用统计、高频标签、高频情绪、高频专辑、高频歌曲、月份摘要和原文片段。

## 取舍

- 不做登录和多用户。
- 不做 seed 数据，避免示例内容被误认为真实记录。
- 不引入 UI 组件库，保留项目体积和修改点。
- 搜索使用本地全量扫描；记录量明显变大后再切换 SQLite FTS。
