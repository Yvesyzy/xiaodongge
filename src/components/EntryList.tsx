import Link from "next/link";
import { ENTRY_TYPE_LABELS } from "@/lib/constants";
import { formatDate, monthLabel } from "@/lib/format";
import type { SerializedEntry } from "@/lib/types";

type EntryListProps = {
  entries: SerializedEntry[];
  emptyText?: string;
};

export function EntryList({ entries, emptyText = "暂无记录" }: EntryListProps) {
  if (!entries.length) {
    return <p className="empty-text">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Link key={entry.id} href={`/entries/${entry.id}`} className="entry-card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs text-teal-700">
                {ENTRY_TYPE_LABELS[entry.type]} / {entry.year} / {monthLabel(entry.month)}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-stone-950">{entry.title}</h3>
            </div>
            <time className="text-xs text-stone-500">{formatDate(entry.createdAt)}</time>
          </div>
          <p className="mt-2 text-sm text-stone-600">{entry.musicLabel}</p>
          <p className="mt-3 text-sm leading-6 text-stone-700">{entry.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
            {entry.moods.map((mood) => (
              <span key={mood} className="tag tag-rose">
                {mood}
              </span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}
