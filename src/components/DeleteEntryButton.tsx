"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteEntryButtonProps = {
  id: string;
};

export function DeleteEntryButton({ id }: DeleteEntryButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    if (!window.confirm("确认删除这条记录？删除后不可恢复。")) return;
    setLoading(true);
    setError("");

    const response = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "删除失败");
      setLoading(false);
      return;
    }

    router.push("/timeline");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={onDelete} disabled={loading} className="btn-danger">
        {loading ? "删除中" : "删除"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
