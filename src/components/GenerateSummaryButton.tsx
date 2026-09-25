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

    try {
      const response = await fetch(`/api/yearly-summaries/${year}/generate`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string; year?: number; content?: string } | null;
      if (!response.ok || data?.year !== year || typeof data?.content !== "string" || !data.content.trim()) throw new Error(data?.error ?? "生成失败，服务器未返回有效总结");
      setMessage("年度总结已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? `生成失败：${error.message}` : "生成失败，请重试");
    } finally {
      setLoading(false);
    }
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
