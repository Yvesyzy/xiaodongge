import { prisma } from "./prisma";
import { InputError, serializeEntry } from "./entry";
import { calculateYearStats } from "./stats";
import type { SerializedEntry, YearStats } from "./types";
import { excerpt, monthLabel } from "./format";

export async function getSavedYearlySummary(year: number) {
  return prisma.yearlySummary.findUnique({ where: { year } });
}

export async function generateAndSaveYearlySummary(year: number) {
  const rawEntries = await prisma.reviewEntry.findMany({
    where: { year },
    orderBy: [{ month: "asc" }, { createdAt: "asc" }],
  });
  const entries = rawEntries.map(serializeEntry);
  if (!entries.length) throw new InputError("该年份没有记录，无法生成年度总结");

  const stats = calculateYearStats(year, entries);
  const local = buildLocalYearlySummary(year, entries, stats);
  const aiContent = await generateOpenAISummary(year, entries, stats);

  return prisma.yearlySummary.upsert({
    where: { year },
    update: {
      title: local.title,
      content: aiContent ?? local.content,
      sourceEntryCount: entries.length,
      generatedAt: new Date(),
    },
    create: {
      year,
      title: local.title,
      content: aiContent ?? local.content,
      sourceEntryCount: entries.length,
      generatedAt: new Date(),
    },
  });
}

export function buildLocalYearlySummary(year: number, entries: SerializedEntry[], stats: YearStats) {
  const title = `${year} 年音乐感受总结`;
  const monthGroups = groupByMonth(entries);
  const fragments = entries.slice(0, 8).map((entry, index) => {
    return `${index + 1}. ${entry.title}：${excerpt(entry.content, 100)}`;
  });

  const content = [
    `# ${title}`,
    "",
    "## 统计信息",
    `- 总记录数：${stats.totalEntries}`,
    `- 涉及月份数量：${stats.monthCount}`,
    `- 涉及专辑数量：${stats.albumCount}`,
    `- 涉及歌曲数量：${stats.songCount}`,
    `- 评分平均值：${stats.averageRating ?? "暂无评分"}`,
    `- 记录最多的月份：${stats.mostActiveMonth ? `${stats.mostActiveMonth.name}（${stats.mostActiveMonth.count} 条）` : "暂无"}`,
    `- 记录最多的专辑：${stats.topAlbum ? `${stats.topAlbum.name}（${stats.topAlbum.count} 条）` : "暂无"}`,
    `- 记录最多的歌曲：${stats.topSong ? `${stats.topSong.name}（${stats.topSong.count} 条）` : "暂无"}`,
    "",
    "## 这一年的音乐整体关键词",
    renderFrequency(stats.topTags, "暂无标签"),
    "",
    "## 这一年最常出现的情绪",
    renderFrequency(stats.topMoods, "暂无情绪关键词"),
    "",
    "## 反复出现的专辑或歌曲",
    `- 专辑：${stats.topAlbum ? `${stats.topAlbum.name}（${stats.topAlbum.count} 条记录）` : "暂无"}`,
    `- 歌曲：${stats.topSong ? `${stats.topSong.name}（${stats.topSong.count} 条记录）` : "暂无"}`,
    "",
    "## 按月份归纳的记录摘要",
    ...monthGroups.flatMap(([month, items]) => [
      `### ${monthLabel(month)}`,
      ...items.map((entry) => `- ${entry.title}：${excerpt(entry.content, 90)}`),
      "",
    ]),
    "## 关键片段",
    ...(fragments.length ? fragments : ["暂无可摘录片段"]),
    "",
    "## 这一年和音乐之间的关系总结",
    `以上总结仅根据 ${year} 年数据库中已有的 ${entries.length} 条记录整理。未填写的歌曲、专辑、歌手、标签、情绪和评分没有被补全，也没有加入数据库外的音乐信息。`,
  ].join("\n");

  return { title, content };
}

async function generateOpenAISummary(year: number, entries: SerializedEntry[], stats: YearStats) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";
  const source = entries.map((entry) => ({
    type: entry.type,
    title: entry.title,
    year: entry.year,
    month: entry.month,
    albumName: entry.albumName,
    songName: entry.songName,
    artistName: entry.artistName,
    tags: entry.tags,
    moods: entry.moods,
    rating: entry.rating,
    listenedAt: entry.listenedAt,
    content: entry.content,
  }));

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        input: [
          {
            role: "developer",
            content:
              "你是私人音乐日记整理助手。只能依据用户提供的数据库记录写总结，不得编造歌曲、专辑、歌手、事件、感受或结论。未出现的信息必须写成未记录或不展开。",
          },
          {
            role: "user",
            content: [
              `请基于以下 ${year} 年音乐感受记录生成中文年度总结。`,
              "结构包括：音乐整体关键词、常见情绪、主要阶段、反复出现的专辑或歌曲、审美变化、音乐和心理状态的关系、重要记录摘录、最后总结。",
              "统计信息：",
              JSON.stringify(stats, null, 2),
              "记录来源：",
              JSON.stringify(source, null, 2),
            ].join("\n"),
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { output_text?: string; output?: unknown };
    return extractResponseText(data);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function extractResponseText(data: { output_text?: string; output?: unknown }) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) return null;
  const text = data.output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map((content) => (isRecord(content) && typeof content.text === "string" ? content.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || null;
}

function groupByMonth(entries: SerializedEntry[]): Array<[number | null, SerializedEntry[]]> {
  const map = new Map<number | null, SerializedEntry[]>();
  for (const entry of entries) {
    map.set(entry.month, [...(map.get(entry.month) ?? []), entry]);
  }
  return Array.from(map.entries()).sort(([a], [b]) => (a ?? 0) - (b ?? 0));
}

function renderFrequency(items: Array<{ name: string; count: number }>, empty: string) {
  if (!items.length) return empty;
  return items.map((item) => `- ${item.name}：${item.count} 次`).join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
