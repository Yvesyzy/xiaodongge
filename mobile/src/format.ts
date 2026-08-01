export function excerpt(value: string, length = 90) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}...` : clean;
}

export function formatDate(value: string | null) {
  if (!value) return "未填写";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateOnly(value: string | null) {
  if (!value) return "未填写";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function monthLabel(month: number | null) {
  return month ? `${month} 月` : "全年";
}

// 提取存储时间戳的“本地日期”（YYYY-MM-DD）。
// 表单把日期输入存为本地午夜再转 ISO（UTC），slice(0,10) 在 UTC+8 会取到前一天；
// 这里用本地时区重构日期，保证按日聚合/天气/节假日/重复检测与用户选择的日期一致。
export function localDateOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
