import { parsePublicationDraft, type PublicationDraft } from "./codex_publicationModel";

function key(ids: string[]) {
  let hash = 2166136261;
  for (const char of JSON.stringify(ids)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `codex.publication.draft.v1:${(hash >>> 0).toString(16)}`;
}
export function loadPublicationDraft(ids: string[]): PublicationDraft | null {
  const raw = localStorage.getItem(key(ids));
  if (raw === null) return null;
  if (raw.length > 3 * 1024 * 1024) throw new Error("推文草稿体积异常，原副本已保留");
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object" || !("version" in data) || data.version !== 1 || !("ids" in data) || JSON.stringify(data.ids) !== JSON.stringify(ids) || !("draft" in data)) throw new Error("推文草稿来源或格式异常，原副本已保留");
  const draft = parsePublicationDraft(data.draft);
  if (JSON.stringify(draft.sections.map(section => section.id)) !== JSON.stringify(ids)) throw new Error("推文草稿章节不匹配，原副本已保留");
  return draft;
}
export function savePublicationDraft(ids: string[], draft: PublicationDraft) {
  const safe = parsePublicationDraft({ ...draft, sections: draft.sections.map(section => ({ ...section, coverDataUrl: null })) });
  const value = JSON.stringify({ version: 1, ids, draft: safe });
  if (value.length > 3 * 1024 * 1024) throw new Error("推文草稿过大，无法自动保存；请先导出稿件");
  localStorage.setItem(key(ids), value);
  if (localStorage.getItem(key(ids)) !== value) throw new Error("未确认推文草稿保存，请先复制或导出");
}
export function removePublicationDraft(ids: string[]) {
  localStorage.removeItem(key(ids));
  if (localStorage.getItem(key(ids)) !== null) throw new Error("未确认推文草稿清除");
}
