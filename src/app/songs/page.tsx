import Link from "next/link";
import { formatDate } from "@/lib/format";
import { getSongAggregates } from "@/lib/stats";

export default async function SongsPage() {
  const songs = await getSongAggregates();

  return (
    <div className="page space-y-6">
      <section>
        <h1 className="section-title">歌曲</h1>
        <p className="section-subtitle">只展示记录中填写过歌曲名称的内容。</p>
      </section>

      {!songs.length ? <p className="empty-text">暂无歌曲记录。</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {songs.map((song) => {
          const params = new URLSearchParams({ songName: song.songName });
          if (song.artistName) params.set("artistName", song.artistName);
          if (song.albumName) params.set("albumName", song.albumName);

          return (
            <Link key={`${song.songName}-${song.artistName ?? ""}-${song.albumName ?? ""}`} href={`/songs/detail?${params.toString()}`} className="entry-card">
              <p className="text-xs text-rose-700">歌曲</p>
              <h2 className="mt-1 text-xl font-semibold text-stone-950">{song.songName}</h2>
              <p className="mt-2 text-sm text-stone-600">{song.artistName ?? "未填写艺术家"}</p>
              <p className="mt-1 text-sm text-stone-600">所属专辑：{song.albumName ?? "未填写"}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-stone-500">关联年份</dt>
                  <dd className="font-medium text-stone-900">{song.years.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">记录数量</dt>
                  <dd className="font-medium text-stone-900">{song.recordCount}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-stone-500">最近记录时间</dt>
                  <dd className="font-medium text-stone-900">{formatDate(song.lastRecordedAt)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-sm leading-6 text-stone-700">{song.summary}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
