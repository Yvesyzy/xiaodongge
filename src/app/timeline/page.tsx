import { EntryList } from "@/components/EntryList";
import { monthLabel } from "@/lib/format";
import { getAllEntries } from "@/lib/stats";
import type { SerializedEntry } from "@/lib/types";

export default async function TimelinePage() {
  const entries = await getAllEntries();
  const groups = groupByYearAndMonth(entries);

  return (
    <div className="page space-y-8">
      <section>
        <h1 className="section-title">时间轴</h1>
        <p className="section-subtitle">按年份和月份回看所有音乐感受记录。</p>
      </section>

      {!groups.length ? <p className="empty-text">暂无记录。</p> : null}

      <div className="space-y-8">
        {groups.map(([year, monthGroups]) => (
          <section key={year} className="space-y-4">
            <h2 className="border-b border-stone-200 pb-2 text-2xl font-semibold text-stone-950">{year}</h2>
            {monthGroups.map(([month, items]) => (
              <div key={`${year}-${month ?? "year"}`} className="grid gap-4 lg:grid-cols-[120px_1fr]">
                <h3 className="pt-4 text-sm font-semibold text-teal-800">{monthLabel(month)}</h3>
                <EntryList entries={items} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function groupByYearAndMonth(entries: SerializedEntry[]) {
  const yearMap = new Map<number, Map<number | null, SerializedEntry[]>>();

  for (const entry of entries) {
    if (!yearMap.has(entry.year)) yearMap.set(entry.year, new Map());
    const monthMap = yearMap.get(entry.year) as Map<number | null, SerializedEntry[]>;
    monthMap.set(entry.month, [...(monthMap.get(entry.month) ?? []), entry]);
  }

  return Array.from(yearMap.entries()).map(([year, monthMap]) => {
    const monthGroups = Array.from(monthMap.entries()).sort(([a], [b]) => (b ?? 0) - (a ?? 0));
    return [year, monthGroups] as const;
  });
}
