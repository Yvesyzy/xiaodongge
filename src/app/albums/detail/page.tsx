import Link from "next/link";
import { EntryList } from "@/components/EntryList";
import { getEntriesByAlbum } from "@/lib/stats";

type AlbumDetailPageProps = {
  searchParams: Promise<{ albumName?: string; artistName?: string }>;
};

export default async function AlbumDetailPage({ searchParams }: AlbumDetailPageProps) {
  const params = await searchParams;
  const albumName = params.albumName?.trim() ?? "";
  const artistName = params.artistName?.trim() || null;
  const entries = albumName ? await getEntriesByAlbum(albumName, artistName) : [];

  return (
    <div className="page space-y-6">
      <Link href="/albums" className="text-sm font-medium text-teal-700 hover:text-teal-900">
        返回专辑
      </Link>
      <section>
        <p className="text-sm text-teal-800">专辑记录</p>
        <h1 className="section-title">{albumName || "未选择专辑"}</h1>
        <p className="section-subtitle">{artistName ?? "未填写艺术家"}</p>
      </section>
      <EntryList entries={entries} emptyText="没有找到这个专辑下的记录。" />
    </div>
  );
}
