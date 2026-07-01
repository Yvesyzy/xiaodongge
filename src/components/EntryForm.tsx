"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ENTRY_TYPE_LABELS, ENTRY_TYPES } from "@/lib/constants";
import type { SerializedEntry } from "@/lib/types";

type EntryFormProps = {
  mode: "create" | "edit";
  entry?: SerializedEntry;
};

export function EntryForm({ mode, entry }: EntryFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      type: String(form.get("type") ?? ""),
      title: String(form.get("title") ?? ""),
      year: String(form.get("year") ?? ""),
      month: String(form.get("month") ?? ""),
      albumName: String(form.get("albumName") ?? ""),
      songName: String(form.get("songName") ?? ""),
      artistName: String(form.get("artistName") ?? ""),
      content: String(form.get("content") ?? ""),
      tags: String(form.get("tags") ?? ""),
      moods: String(form.get("moods") ?? ""),
      rating: String(form.get("rating") ?? ""),
      listenedAt: String(form.get("listenedAt") ?? ""),
    };

    const endpoint = mode === "create" ? "/api/entries" : `/api/entries/${entry?.id}`;
    const response = await fetch(endpoint, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;

    if (!response.ok || !data?.id) {
      setError(data?.error ?? "保存失败");
      setLoading(false);
      return;
    }

    router.push(`/entries/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="field">
          <span>记录类型</span>
          <select name="type" defaultValue={entry?.type ?? "song"} className="select">
            {ENTRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {ENTRY_TYPE_LABELS[type]} / {type}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>标题</span>
          <input name="title" defaultValue={entry?.title ?? ""} className="input" required />
        </label>
        <label className="field">
          <span>关联年份</span>
          <input name="year" type="number" min="1" max="9999" defaultValue={entry?.year ?? new Date().getFullYear()} className="input" required />
        </label>
        <label className="field">
          <span>关联月份，可为空</span>
          <input name="month" type="number" min="1" max="12" defaultValue={entry?.month ?? ""} className="input" />
        </label>
        <label className="field">
          <span>专辑名称，可为空</span>
          <input name="albumName" defaultValue={entry?.albumName ?? ""} className="input" />
        </label>
        <label className="field">
          <span>歌曲名称，可为空</span>
          <input name="songName" defaultValue={entry?.songName ?? ""} className="input" />
        </label>
        <label className="field">
          <span>艺术家名称，可为空</span>
          <input name="artistName" defaultValue={entry?.artistName ?? ""} className="input" />
        </label>
        <label className="field">
          <span>听歌时间或感受发生时间，可为空</span>
          <input name="listenedAt" type="date" defaultValue={entry?.listenedAt?.slice(0, 10) ?? ""} className="input" />
        </label>
        <label className="field">
          <span>标签，多个用逗号或换行分隔</span>
          <input name="tags" defaultValue={entry?.tags.join(", ") ?? ""} className="input" />
        </label>
        <label className="field">
          <span>情绪关键词，可为空</span>
          <input name="moods" defaultValue={entry?.moods.join(", ") ?? ""} className="input" />
        </label>
        <label className="field">
          <span>评分，可为空，范围 1-10</span>
          <input name="rating" type="number" min="1" max="10" defaultValue={entry?.rating ?? ""} className="input" />
        </label>
      </div>

      <label className="field">
        <span>正文内容</span>
        <textarea name="content" defaultValue={entry?.content ?? ""} rows={16} className="textarea" required />
      </label>

      {error ? <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "保存中" : mode === "create" ? "保存记录" : "保存修改"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          返回
        </button>
      </div>
    </form>
  );
}
