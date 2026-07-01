import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { ENTRY_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateOnly, monthLabel } from "@/lib/format";
import { serializeEntry } from "@/lib/entry";
import { prisma } from "@/lib/prisma";

type EntryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EntryDetailPage({ params }: EntryDetailPageProps) {
  const { id } = await params;
  const rawEntry = await prisma.reviewEntry.findUnique({ where: { id } });
  if (!rawEntry) notFound();
  const entry = serializeEntry(rawEntry);

  return (
    <div className="page-narrow space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/timeline" className="text-sm font-medium text-teal-700 hover:text-teal-900">
          返回时间轴
        </Link>
        <div className="flex gap-3">
          <Link href={`/entries/${entry.id}/edit`} className="btn-secondary">
            编辑
          </Link>
          <DeleteEntryButton id={entry.id} />
        </div>
      </div>

      <article className="panel">
        <p className="text-sm font-medium text-teal-800">{ENTRY_TYPE_LABELS[entry.type]}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-stone-950">{entry.title}</h1>

        <dl className="mt-6 grid gap-x-6 sm:grid-cols-2">
          <DetailItem label="年份" value={String(entry.year)} />
          <DetailItem label="月份" value={monthLabel(entry.month)} />
          <DetailItem label="专辑" value={entry.albumName ?? "未填写"} />
          <DetailItem label="歌曲" value={entry.songName ?? "未填写"} />
          <DetailItem label="艺术家" value={entry.artistName ?? "未填写"} />
          <DetailItem label="评分" value={entry.rating ? `${entry.rating}/10` : "未填写"} />
          <DetailItem label="听歌时间或感受发生时间" value={formatDateOnly(entry.listenedAt)} />
          <DetailItem label="创建时间" value={formatDate(entry.createdAt)} />
          <DetailItem label="更新时间" value={formatDate(entry.updatedAt)} />
        </dl>

        <div className="mt-6 space-y-4">
          <TagBlock label="标签" values={entry.tags} />
          <TagBlock label="情绪关键词" values={entry.moods} mood />
        </div>

        <div className="mt-8 border-t border-stone-200 pt-6">
          <div className="whitespace-pre-wrap font-serif text-lg leading-9 text-stone-800">{entry.content}</div>
        </div>
      </article>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function TagBlock({ label, values, mood = false }: { label: string; values: string[]; mood?: boolean }) {
  return (
    <div>
      <p className="text-xs text-stone-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length ? (
          values.map((value) => (
            <span key={value} className={mood ? "tag tag-rose" : "tag"}>
              {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-stone-500">未填写</span>
        )}
      </div>
    </div>
  );
}
