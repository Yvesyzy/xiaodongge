import { EntryList } from "@/components/EntryList";
import { searchEntries } from "@/lib/stats";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const results = query ? await searchEntries(query) : [];

  return (
    <div className="page space-y-6">
      <section>
        <h1 className="section-title">搜索</h1>
        <p className="section-subtitle">搜索标题、正文、歌曲名、专辑名、艺术家名、标签和情绪关键词。</p>
      </section>

      <form className="panel flex flex-col gap-3 sm:flex-row" action="/search">
        <input name="q" defaultValue={query} className="input" placeholder="输入关键词" />
        <button type="submit" className="btn-primary">
          搜索
        </button>
      </form>

      {query ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-stone-950">搜索结果：{results.length} 条</h2>
          <EntryList entries={results} emptyText="没有找到匹配记录。" />
        </section>
      ) : (
        <p className="empty-text">请输入关键词后开始搜索。</p>
      )}
    </div>
  );
}
