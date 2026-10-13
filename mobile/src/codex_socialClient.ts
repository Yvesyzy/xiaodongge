import { Capacitor, registerPlugin } from "@capacitor/core";
import { privacyFetch, requirePrivacyConsent, subscribePrivacy, hasPrivacyConsent } from "./codex_privacy";
import { normalizeSocialEndpoint, object, parseComment, parseCursor, parseFriends, parseItems, parsePost, parseUser, type ReviewSnapshot, type SocialUser } from "./codex_socialModel";

const ENDPOINT_KEY = "codex.social.endpoint.v1";
const ERRORS: Record<string, string> = {
  unauthorized: "登录已过期，请重新登录。", invalid_credentials: "用户名或密码不正确。", username_taken: "这个用户名已有人使用，请换一个。",
  wrong_password: "密码不正确，账号未注销。", invalid_invite: "邀请码无效、已使用或已过期，请向朋友索取新的邀请码。",
  already_friends: "你们已经是好友。", request_exists: "你们之间已有待处理申请，请在朋友页查看。",
  forbidden: "你目前无权访问或修改这条内容，好友关系可能已变化。", not_found: "内容已不存在，请刷新列表。",
  invalid_input: "提交内容格式不符合要求，请检查长度、必填项和封面。", body_too_large: "发布内容过大，请缩短文字或取消封面。",
  origin_not_allowed: "服务尚未允许此应用连接，请让服务维护者核对访问设置。", rate_limited: "操作太频繁，请稍后再试。",
  server_error: "好友圈服务暂时无法处理请求，请稍后重试。", invalid_json: "请求内容格式无效，请重试。",
  invalid_body: "请求未完整送达，请检查网络后重试。", unsupported_media_type: "服务不支持此请求格式，请联系维护者。",
  unsupported_content_encoding: "服务不支持此请求编码，请联系维护者。", invalid_url: "请求地址格式无效。",
};
type Credentials = { endpoint: string; token: string; expiresAt: string };
type SessionPlugin = { readSession(): Promise<{ session: Credentials | null }>; writeSession(options: Credentials): Promise<{ ok: true }>; clearSession(): Promise<{ ok: true }> };
const NativeSession = registerPlugin<SessionPlugin>("CodexSocialSession");
export type SocialSession = { endpoint: string; expiresAt: string; user: SocialUser; api: SocialApi };
let session: SocialSession | null = null;
let restoring: Promise<void> | undefined;
let generation = 0;
const listeners = new Set<() => void>();
export const getSocialSession = () => session;
export function subscribeSocialSession(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function notify() { listeners.forEach(listener => listener()); }
const android = () => Capacitor.getPlatform() === "android";

export function readSocialEndpoint() {
  try { return localStorage.getItem(ENDPOINT_KEY) || ""; } catch { return ""; }
}
export function saveSocialEndpoint(value: string) {
  const endpoint = normalizeSocialEndpoint(value, android());
  if (session && session.endpoint !== endpoint) throw new Error("请先退出当前账号，再切换好友圈服务。");
  try { localStorage.setItem(ENDPOINT_KEY, endpoint); } catch { throw new Error("本机无法保存服务地址，请检查存储空间或浏览器设置。"); }
  return endpoint;
}
export class SocialApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
function credentials(value: unknown): Credentials {
  const data = object(value);
  if (typeof data.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.token) || typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error("登录凭据格式不正确，请联系服务维护者。");
  return { endpoint: normalizeSocialEndpoint(String(data.endpoint), android()), token: data.token, expiresAt: data.expiresAt };
}

export class SocialApi {
  readonly endpoint: string;
  private token: string;
  private requests = new Set<AbortController>();
  private closed = false;
  constructor(endpoint: string, token = "") { this.endpoint = normalizeSocialEndpoint(endpoint, android()); this.token = token; }
  abort() { this.closed = true; this.requests.forEach(controller => controller.abort()); this.requests.clear(); }
  async request(path: string, method = "GET", body?: unknown): Promise<unknown> {
    requirePrivacyConsent();
    if (this.closed) throw new Error("账号连接已结束，请重新登录。");
    const controller = new AbortController();
    this.requests.add(controller);
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await privacyFetch(this.endpoint + path, {
        method, signal: controller.signal, credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer",
        headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      // A configured service is a trust boundary. Bound even chunked responses.
      const reader = response.body?.getReader();
      let raw = "";
      if (reader) {
        const decoder = new TextDecoder();
        let bytes = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > 8 * 1024 * 1024) { await reader.cancel(); throw new Error("服务返回内容过大，请联系服务维护者。"); }
            raw += decoder.decode(chunk.value, { stream: true });
          }
          raw += decoder.decode();
        } finally { reader.releaseLock(); }
      } else raw = await response.text();
      let value: unknown;
      try { value = JSON.parse(raw); } catch { throw new SocialApiError("该地址没有返回好友圈服务数据，请检查服务地址。", response.status); }
      if (!response.ok) {
        const error = object(value).error;
        throw new SocialApiError(typeof error === "string" ? ERRORS[error] || error.slice(0, 240) : "好友圈请求失败，请重试。", response.status);
      }
      requirePrivacyConsent();
      return value;
    } catch (error) {
      if (controller.signal.aborted) throw new Error("请求超时或已取消；当前输入仍保留，可重试。");
      if (error instanceof TypeError) throw new Error("无法连接好友圈服务，请检查地址、网络及服务状态。");
      throw error;
    } finally {
      window.clearTimeout(timer);
      // privacyFetch's compatibility abort listeners live through body consumption.
      controller.abort();
      this.requests.delete(controller);
    }
  }
  async me() { return parseUser(object(await this.request("/v1/me")).user); }
  async feed(cursor: string | null = null) {
    const data = object(await this.request("/v1/feed" + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : "")));
    return { posts: parseItems(data.posts, parsePost), nextCursor: parseCursor(data.nextCursor) };
  }
  async friends() { return parseFriends(await this.request("/v1/friends")); }
  async invite() {
    const data = object(await this.request("/v1/invites", "POST", {}));
    if (typeof data.code !== "string" || data.code.length > 128 || !data.code || typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error("邀请返回格式无效。");
    return { code: data.code, expiresAt: data.expiresAt };
  }
  async ok(path: string, method: string, body?: unknown) {
    if (object(await this.request(path, method, body)).ok !== true) throw new Error("服务未确认操作成功，请刷新核对。");
  }
  requestFriend(inviteCode: string) { return this.ok("/v1/friend-requests", "POST", { inviteCode }); }
  acceptFriend(id: string) { return this.ok(`/v1/friend-requests/${encodeURIComponent(id)}/accept`, "POST", {}); }
  cancelFriend(id: string) { return this.ok(`/v1/friend-requests/${encodeURIComponent(id)}`, "DELETE"); }
  removeFriend(id: string) { return this.ok(`/v1/friends/${encodeURIComponent(id)}`, "DELETE"); }
  async publish(clientId: string, text: string, review: ReviewSnapshot | null) { return parsePost(object(await this.request("/v1/posts", "POST", { clientId, text, review })).post); }
  async post(id: string) { return parsePost(object(await this.request(`/v1/posts/${encodeURIComponent(id)}`)).post); }
  deletePost(id: string) { return this.ok(`/v1/posts/${encodeURIComponent(id)}`, "DELETE"); }
  like(id: string, liked: boolean) { return this.ok(`/v1/posts/${encodeURIComponent(id)}/like`, liked ? "PUT" : "DELETE", liked ? {} : undefined); }
  async comments(id: string, cursor: string | null = null) {
    const data = object(await this.request(`/v1/posts/${encodeURIComponent(id)}/comments` + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : "")));
    return { comments: parseItems(data.comments, parseComment), nextCursor: parseCursor(data.nextCursor) };
  }
  async comment(id: string, clientId: string, text: string) { return parseComment(object(await this.request(`/v1/posts/${encodeURIComponent(id)}/comments`, "POST", { clientId, text })).comment); }
  deleteComment(id: string) { return this.ok(`/v1/comments/${encodeURIComponent(id)}`, "DELETE"); }
  logout() { return this.ok("/v1/auth/logout", "POST", {}); }
  deleteAccount(password: string) { return this.ok("/v1/me", "DELETE", { password }); }
  async revokeAfterClose() {
    const api = new SocialApi(this.endpoint, this.token);
    try { await api.logout(); }
    catch (error) { if (!(error instanceof SocialApiError && error.status === 401)) throw new Error("已退出本机；服务端未确认撤销登录，原会话会到期失效。"); }
    finally { api.abort(); this.token = ""; }
  }
}

export async function loginSocial(endpoint: string, input: { username: string; password: string; displayName?: string }, register: boolean) {
  requirePrivacyConsent();
  const currentGeneration = ++generation;
  const api = new SocialApi(endpoint);
  const data = object(await api.request(register ? "/v1/auth/register" : "/v1/auth/login", "POST", input));
  const auth = credentials({ ...data, endpoint });
  const user = parseUser(data.user);
  const connected = new SocialApi(auth.endpoint, auth.token);
  try {
    if (currentGeneration !== generation || !hasPrivacyConsent()) throw new Error("登录已取消，请重试。");
    if (android() && (await NativeSession.writeSession(auth)).ok !== true) throw new Error("系统未确认安全保存登录状态。");
    if (currentGeneration !== generation || !hasPrivacyConsent()) {
      if (android()) await NativeSession.clearSession();
      throw new Error("登录已取消，请重试。");
    }
    session?.api.abort();
    session = { endpoint: auth.endpoint, expiresAt: auth.expiresAt, user, api: connected };
    notify();
  } catch (error) {
    if (hasPrivacyConsent()) await connected.logout().catch(() => {});
    connected.abort();
    throw error;
  }
}
export function restoreSocialSession(): Promise<void> {
  if (session || !android()) return Promise.resolve();
  if (restoring) return restoring;
  const currentGeneration = generation;
  restoring = (async () => {
    requirePrivacyConsent();
    const result = await NativeSession.readSession();
    if (!result || !("session" in result)) throw new Error("系统未返回安全登录状态，请重试读取。");
    if (result.session === null || currentGeneration !== generation) return;
    const auth = credentials(result.session);
    if (Date.parse(auth.expiresAt) <= Date.now()) {
      if ((await NativeSession.clearSession()).ok !== true) throw new Error("无法清除过期登录状态，请重试。");
      throw new Error("登录已过期，请重新登录。");
    }
    const api = new SocialApi(auth.endpoint, auth.token);
    try {
      const user = await api.me();
      if (currentGeneration === generation && hasPrivacyConsent()) { session = { endpoint: auth.endpoint, expiresAt: auth.expiresAt, user, api }; notify(); }
      else api.abort();
    } catch (error) {
      api.abort();
      if (error instanceof SocialApiError && error.status === 401) await NativeSession.clearSession();
      throw error;
    }
  })().finally(() => { restoring = undefined; });
  return restoring;
}
export async function signOutSocial(revoke = true) {
  const previous = session;
  if (android() && (await NativeSession.clearSession()).ok !== true) throw new Error("系统未确认清除登录状态，请重试退出。");
  ++generation;
  previous?.api.abort();
  session = null;
  notify();
  if (previous && revoke && hasPrivacyConsent()) {
    await previous.api.revokeAfterClose();
  }
}
subscribePrivacy(() => {
  if (!hasPrivacyConsent()) {
    ++generation;
    session?.api.abort();
    session = null;
    notify();
    // On Android the process exits on withdrawal. Clear credentials on next open
    // as well; a local-only launch must never restore a social connection.
  }
});
