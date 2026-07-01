import Link from "next/link";
import { EntryList } from "@/components/EntryList";
import { getSavedYearlySummary } from "@/lib/summary";
import { getRecentEntries, getYearStats } from "@/lib/stats";

export default async function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [recentEntries, stats, summary] = await Promise.all([
    getRecentEntries(5),
    getYearStats(currentYear),
    getSavedYearlySummary(currentYear),
  ]);

  return (
    <div className="page space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-stone-950 sm:text-4xl">私人音乐感受档案</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
            这里只保存你手动写下的音乐感受：年份、月份、专辑、歌曲，以及反复听见时留下的心理触动。
          </p>
        </div>
        <div className="flex lg:justify-end">
          <Link href="/entries/new" className="btn-primary w-full sm:w-auto">
            新建记录
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`${currentYear} 年记录`} value={stats.totalEntries} />
        <StatCard label={`${currentYear} 年专辑`} value={stats.albumCount} />
        <StatCard label={`${currentYear} 年歌曲`} value={stats.songCount} />
        <div className="stat-card">
          <p className="text-sm text-stone-500">年度总结</p>
          {summary ? (
            <Link href={`/yearly-summary?year=${currentYear}`} className="mt-2 block text-2xl font-semibold text-teal-800">
              已生成
            </Link>
          ) : (
            <Link href={`/yearly-summary?year=${currentYear}`} className="mt-2 block text-2xl font-semibold text-stone-950">
              去生成
            </Link>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">最近写下的音乐感受</h2>
            <p className="section-subtitle">按创建时间展示最近的记录。</p>
          </div>
          <Link href="/timeline" className="text-sm font-medium text-teal-700 hover:text-teal-900">
            查看时间轴
          </Link>
        </div>
        <EntryList entries={recentEntries} emptyText="还没有记录，先写下第一条音乐感受。" />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}
