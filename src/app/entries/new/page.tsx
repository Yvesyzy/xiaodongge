import { EntryForm } from "@/components/EntryForm";

export default function NewEntryPage() {
  return (
    <div className="page-narrow space-y-6">
      <section>
        <h1 className="section-title">新建记录</h1>
        <p className="section-subtitle">只保存你输入的内容。未填写的歌曲、专辑、歌手、标签、情绪和评分会保持为空。</p>
      </section>
      <div className="panel">
        <EntryForm mode="create" />
      </div>
    </div>
  );
}
