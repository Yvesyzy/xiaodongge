import Link from "next/link";
import { EntryList } from "@/components/EntryList";
import { getEntriesBySong } from "@/lib/stats";

type SongDetailPageProps = {
  searchParams: Promise<{ songName?: string; artistName?: string; albumName?: string }>;
};

export default async function SongDetailPage({ searchParams }: SongDetailPageProps) {
  const params = await searchParams;
  const songName = params.songName?.trim() ?? "";
  const artistName = params.artistName?.trim() || null;
  const albumName = params.albumName?.trim() || null;
  const entries = songName ? await getEntriesBySong(songName, artistName, albumName) : [];

  return (
    <div className="page space-y-6">
      <Link href="/songs" className="text-sm font-medium text-teal-700 hover:text-teal-900">
        返回歌曲
      </Link>
      <section>
        <p className="text-sm text-rose-800">歌曲记录</p>
        <h1 className="section-title">{songName || "未选择歌曲"}</h1>
        <p className="section-subtitle">
          {artistName ?? "未填写艺术家"} / 所属专辑：{albumName ?? "未填写"}
        </p>
      </section>
      <EntryList entries={entries} emptyText="没有找到这首歌下的记录。" />
    </div>
  );
}
