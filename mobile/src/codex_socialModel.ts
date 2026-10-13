import type { ReviewEntry } from "./types";

export type SocialUser = { id: string; username: string; displayName: string };
export type ReviewSnapshot = {
  type: "album" | "song" | "month" | "year";
  title: string;
  albumName: string | null;
  songName: string | null;
  artistName: string | null;
  rating: number | null;
  listenedAt: string | null;
  coverDataUrl: string | null;
};
export type SocialPost = { id: string; author: SocialUser; text: string; review: ReviewSnapshot | null; createdAt: string; likeCount: number; likedByMe: boolean; commentCount: number };
export type SocialComment = { id: string; postId: string; author: SocialUser; text: string; createdAt: string };
export type FriendRequest = { id: string; from: SocialUser; to: SocialUser; createdAt: string };
export type Friends = { friends: SocialUser[]; incoming: FriendRequest[]; outgoing: FriendRequest[] };
export type Feed = { posts: SocialPost[]; nextCursor: string | null };

export function normalizeSocialEndpoint(value: string, android = false): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("请输入完整的好友圈服务地址，例如 https://你的域名"); }
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && !android)) {
    throw new Error(android ? "手机端需要 HTTPS 服务地址。" : "服务地址必须使用 HTTPS；本机联调可使用 HTTP localhost。");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("请输入服务的根地址，不要附带账号、路径、参数或邀请码。");
  return url.origin;
}

const invalid = () => new Error("好友圈服务返回的数据格式不正确，请联系服务维护者。");
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 20000): string {
  if (typeof value !== "string" || !value.length || value.length > max) throw invalid();
  return value;
}
function nullableText(value: unknown, max: number): string | null { return value === null ? null : text(value, max); }
function date(value: unknown): string {
  const result = text(value, 40);
  if (!Number.isFinite(Date.parse(result))) throw invalid();
  return result;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
}
export function parseUser(value: unknown): SocialUser {
  const user = object(value);
  return { id: text(user.id, 128), username: text(user.username, 32), displayName: text(user.displayName, 40) };
}
export function parseReview(value: unknown): ReviewSnapshot | null {
  if (value === null) return null;
  const review = object(value);
  if (!["album", "song", "month", "year"].includes(String(review.type))) throw invalid();
  if (review.rating !== null && (typeof review.rating !== "number" || !Number.isFinite(review.rating) || review.rating < 0 || review.rating > 10)) throw invalid();
  const cover = review.coverDataUrl === null ? null : text(review.coverDataUrl, 350000);
  if (cover && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(cover)) throw invalid();
  return {
    type: review.type as ReviewSnapshot["type"], title: text(review.title, 300),
    albumName: nullableText(review.albumName, 300), songName: nullableText(review.songName, 300), artistName: nullableText(review.artistName, 300),
    rating: review.rating as number | null, listenedAt: review.listenedAt === null ? null : date(review.listenedAt), coverDataUrl: cover,
  };
}
export function parsePost(value: unknown): SocialPost {
  const post = object(value);
  if (typeof post.likedByMe !== "boolean") throw invalid();
  return { id: text(post.id, 128), author: parseUser(post.author), text: text(post.text), review: parseReview(post.review), createdAt: date(post.createdAt), likeCount: count(post.likeCount), likedByMe: post.likedByMe, commentCount: count(post.commentCount) };
}
export function parseComment(value: unknown): SocialComment {
  const comment = object(value);
  return { id: text(comment.id, 128), postId: text(comment.postId, 128), author: parseUser(comment.author), text: text(comment.text, 2000), createdAt: date(comment.createdAt) };
}
export function parseItems<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > 1000) throw invalid();
  return value.map(parse);
}
export function parseCursor(value: unknown): string | null { return value === null ? null : text(value, 512); }
export function parseFriends(value: unknown): Friends {
  const result = object(value);
  const request = (value: unknown): FriendRequest => {
    const item = object(value);
    return { id: text(item.id, 128), from: parseUser(item.from), to: parseUser(item.to), createdAt: date(item.createdAt) };
  };
  return { friends: parseItems(result.friends, parseUser), incoming: parseItems(result.incoming, request), outgoing: parseItems(result.outgoing, request) };
}

// Deliberately enumerate the published fields; never spread a private ReviewEntry.
export function reviewSnapshot(entry: ReviewEntry, options: { rating: boolean; date: boolean; cover: string | null }): ReviewSnapshot {
  return {
    type: entry.type, title: entry.title, albumName: entry.albumName || null, songName: entry.songName || null, artistName: entry.artistName || null,
    rating: options.rating ? entry.rating : null, listenedAt: options.date ? entry.listenedAt : null, coverDataUrl: options.cover,
  };
}
