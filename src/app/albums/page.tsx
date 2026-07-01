import Link from "next/link";
import { formatDate } from "@/lib/format";
import { getAlbumAggregates } from "@/lib/stats";

export default async function AlbumsPage() {
  const albums = await getAlbumAggregates();

  return (
    <div className="page space-y-6">
      <section>
        <h1 className="section-title">专辑</h1>
        <p className="section-subtitle">只展示记录中填写过专辑名称的内容。</p>
      </section>

      {!albums.length ? <p className="empty-text">暂无专辑记录。</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {albums.map((album) => {
          const href = `/albums/detail?albumName=${encodeURIComponent(album.albumName)}${album.artistName ? `&artistName=${encodeURIComponent(album.artistName)}` : ""}`;
          return (
            <Link key={`${album.albumName}-${album.artistName ?? ""}`} href={href} className="entry-card">
              <p className="text-xs text-teal-700">专辑</p>
              <h2 className="mt-1 text-xl font-semibold text-stone-950">{album.albumName}</h2>
              <p className="mt-2 text-sm text-stone-600">{album.artistName ?? "未填写艺术家"}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-stone-500">关联年份</dt>
                  <dd className="font-medium text-stone-900">{album.years.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">记录数量</dt>
                  <dd className="font-medium text-stone-900">{album.recordCount}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-stone-500">最近记录时间</dt>
                  <dd className="font-medium text-stone-900">{formatDate(album.lastRecordedAt)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-sm leading-6 text-stone-700">{album.summary}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
