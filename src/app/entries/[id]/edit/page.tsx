import { notFound } from "next/navigation";
import { EntryForm } from "@/components/EntryForm";
import { serializeEntry } from "@/lib/entry";
import { prisma } from "@/lib/prisma";

type EditEntryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditEntryPage({ params }: EditEntryPageProps) {
  const { id } = await params;
  const rawEntry = await prisma.reviewEntry.findUnique({ where: { id } });
  if (!rawEntry) notFound();

  return (
    <div className="page-narrow space-y-6">
      <section>
        <h1 className="section-title">编辑记录</h1>
        <p className="section-subtitle">修改后会覆盖当前记录，不会自动补全任何音乐信息。</p>
      </section>
      <div className="panel">
        <EntryForm mode="edit" entry={serializeEntry(rawEntry)} />
      </div>
    </div>
  );
}
