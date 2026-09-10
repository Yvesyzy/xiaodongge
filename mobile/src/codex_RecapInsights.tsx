import { Link } from "react-router-dom";
import type { ReviewEntry } from "./types";

export type RecapPattern = {
  kind: "tag" | "mood";
  term: string;
  strongerMonth: number;
  strongerCount: number;
  strongerTotal: number;
  weakerMonth: number;
  weakerCount: number;
  weakerTotal: number;
  entryIds: string[];
};

// Only compare periods with at least two music reviews; single-entry periods are too weak for a useful contrast.
export function buildRecapPatterns(entries: ReviewEntry[], minimumEntries = 6): RecapPattern[] {
  if (entries.length < minimumEntries) return [];
  const groups = Array.from(new Map(entries.map((entry) => [new Date(entry.createdAt).getMonth() + 1, null])).keys())
    .sort((a, b) => a - b)
    .map((month) => ({ month, entries: entries.filter((entry) => new Date(entry.createdAt).getMonth() + 1 === month) }))
    .filter((group) => group.entries.length >= 2);
  if (groups.length < 2) return [];

  const patterns: RecapPattern[] = [];
  for (const kind of ["tag", "mood"] as const) {
    const terms = Array.from(new Set(groups.flatMap((group) => group.entries.flatMap((entry) => entry[kind === "tag" ? "tags" : "moods"])))).filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-CN"));
    for (const term of terms) {
      let best: RecapPattern | null = null;
      for (let leftIndex = 0; leftIndex < groups.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < groups.length; rightIndex += 1) {
          const left = groups[leftIndex];
          const right = groups[rightIndex];
          const leftEntries = left.entries.filter((entry) => entry[kind === "tag" ? "tags" : "moods"].includes(term));
          const rightEntries = right.entries.filter((entry) => entry[kind === "tag" ? "tags" : "moods"].includes(term));
          const leftRate = leftEntries.length / left.entries.length;
          const rightRate = rightEntries.length / right.entries.length;
          const difference = Math.abs(leftRate - rightRate);
          const stronger = leftRate >= rightRate
            ? { month: left.month, count: leftEntries.length, total: left.entries.length, entries: leftEntries }
            : { month: right.month, count: rightEntries.length, total: right.entries.length, entries: rightEntries };
          const weaker = leftRate >= rightRate
            ? { month: right.month, count: rightEntries.length, total: right.entries.length, entries: rightEntries }
            : { month: left.month, count: leftEntries.length, total: left.entries.length, entries: leftEntries };
          // Require a real count and a one-third coverage gap before showing a contrast.
          if (difference < 1 / 3 || stronger.count < 2 || !weaker.count) continue;
          const next: RecapPattern = {
            kind,
            term,
            strongerMonth: stronger.month,
            strongerCount: stronger.count,
            strongerTotal: stronger.total,
            weakerMonth: weaker.month,
            weakerCount: weaker.count,
            weakerTotal: weaker.total,
            entryIds: Array.from(new Set([...stronger.entries, ...weaker.entries].map((entry) => entry.id))),
          };
          if (!best || patternGap(next) > patternGap(best) || patternGap(next) === patternGap(best) && next.strongerCount > best.strongerCount) best = next;
        }
      }
      if (best) patterns.push(best);
    }
  }
  return patterns.sort((a, b) => patternGap(b) - patternGap(a) || b.strongerCount - a.strongerCount || a.term.localeCompare(b.term, "zh-CN")).slice(0, 4);
}

export function RecapInsights({ entries }: { entries: ReviewEntry[] }) {
  const patterns = buildRecapPatterns(entries);
  if (!patterns.length) return null;
  return <section className="journal-insights" aria-labelledby="journal-insights-title">
    <h2 id="journal-insights-title">记录里的标签与情绪差异</h2>
    <p className="journal-muted">只展示有足够记录支持、且能链接回原文的事实分布；这不是对听感的主观判断。</p>
    <div className="journal-insight-list">{patterns.map((pattern) => <article className="journal-insight" key={`${pattern.kind}-${pattern.term}`}>
      <strong>{pattern.kind === "tag" ? "标签" : "情绪"}「{pattern.term}」</strong>
      <p>{pattern.strongerMonth} 月 {pattern.strongerCount}/{pattern.strongerTotal} 篇，{pattern.weakerMonth} 月 {pattern.weakerCount}/{pattern.weakerTotal} 篇。</p>
      <div className="journal-insight-sources"><span>依据：</span>{pattern.entryIds.map((id) => <Link key={id} to={`/entries/${encodeURIComponent(id)}`}>打开记录</Link>)}</div>
    </article>)}</div>
  </section>;
}

function patternGap(pattern: RecapPattern) {
  return Math.abs(pattern.strongerCount / pattern.strongerTotal - pattern.weakerCount / pattern.weakerTotal);
}
