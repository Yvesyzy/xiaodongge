"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type GenerateSummaryButtonProps = {
  year: number;
};

export function GenerateSummaryButton({ year }: GenerateSummaryButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function generate() {
    setLoading(true);
    setMessage("");

    const response = await fetch(`/api/yearly-summaries/${year}/generate`, { method: "POST" });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setMessage(data?.error ?? "生成失败");
      return;
    }

    setMessage("年度总结已保存");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={generate} disabled={loading} className="btn-primary">
        {loading ? "生成中" : "生成年度总结"}
      </button>
      {message ? <p className="text-sm text-stone-600">{message}</p> : null}
    </div>
  );
}
