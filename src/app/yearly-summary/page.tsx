import { GenerateSummaryButton } from "@/components/GenerateSummaryButton";
import { getSavedYearlySummary } from "@/lib/summary";
import { getYearStats } from "@/lib/stats";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type YearlySummaryPageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function YearlySummaryPage({ searchParams }: YearlySummaryPageProps) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = readPageYear(params.year, currentYear);
  const [years, stats, savedSummary] = await Promise.all([getAvailableYears(currentYear), getYearStats(selectedYear), getSavedYearlySummary(selectedYear)]);

  return (
    <div className="page space-y-8">
      <section>
        <h1 className="section-title">年度总结</h1>
        <p className="section-subtitle">年度总结只基于所选自然年内已有记录生成。没有 OpenAI API Key 时，会使用本地基础总结。</p>
      </section>

      <form className="panel flex flex-col gap-3 sm:flex-row sm:items-end" action="/yearly-summary">
        <label className="field sm:min-w-52">
          <span>选择年份</span>
          <select name="year" defaultValue={selectedYear} className="select">
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-secondary">
          查看
        </button>
        <GenerateSummaryButton year={selectedYear} />
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="总记录数" value={stats.totalEntries} />
        <Stat label="涉及月份数量" value={stats.monthCount} />
        <Stat label="涉及专辑数量" value={stats.albumCount} />
        <Stat label="涉及歌曲数量" value={stats.songCount} />
        <Stat label="评分平均值" value={stats.averageRating ?? "暂无"} />
        <Stat label="记录最多的月份" value={stats.mostActiveMonth ? `${stats.mostActiveMonth.name} / ${stats.mostActiveMonth.count}` : "暂无"} />
        <Stat label="记录最多的专辑" value={stats.topAlbum ? `${stats.topAlbum.name} / ${stats.topAlbum.count}` : "暂无"} />
        <Stat label="记录最多的歌曲" value={stats.topSong ? `${stats.topSong.name} / ${stats.topSong.count}` : "暂无"} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <FrequencyPanel title="最常出现的标签" items={stats.topTags} />
        <FrequencyPanel title="最常出现的情绪关键词" items={stats.topMoods} mood />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="section-title">已保存总结</h2>
          <p className="section-subtitle">
            {savedSummary ? `生成时间：${formatDate(savedSummary.generatedAt)}` : "当前年份还没有保存年度总结。"}
          </p>
        </div>
        {savedSummary ? <div className="summary-content">{savedSummary.content}</div> : <p className="empty-text">点击“生成年度总结”后会保存到数据库。</p>}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat-card">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function FrequencyPanel({ title, items, mood = false }: { title: string; items: Array<{ name: string; count: number }>; mood?: boolean }) {
  return (
    <div className="panel">
      <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span key={item.name} className={mood ? "tag tag-rose" : "tag"}>
              {item.name} / {item.count}
            </span>
          ))
        ) : (
          <span className="text-sm text-stone-500">暂无</span>
        )}
      </div>
    </div>
  );
}

async function getAvailableYears(currentYear: number) {
  const rows = await prisma.reviewEntry.findMany({
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });
  const years = rows.map((row) => row.year);
  return Array.from(new Set([currentYear, ...years])).sort((a, b) => b - a);
}

function readPageYear(value: string | undefined, fallback: number) {
  const year = Number(value);
  return Number.isInteger(year) && year > 0 && year <= 9999 ? year : fallback;
}
