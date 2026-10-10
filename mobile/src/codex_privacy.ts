import { Capacitor, registerPlugin } from "@capacitor/core";
import policy from "./codex_privacy_policy.json";

export type PrivacyStatus = "pending" | "accepted" | "declined";
type PrivacyState = { status: PrivacyStatus; policyVersion: string };
const NativePrivacy = registerPlugin<{
  getState(): Promise<PrivacyState>;
  setConsent(options: { accepted: boolean }): Promise<PrivacyState>;
}>("CodexPrivacy");
export const PRIVACY_VERSION = policy.version;
const listeners = new Set<() => void>();
let status: PrivacyStatus = "pending";
let startup: Promise<void> | undefined;
let changing = false;
let requests = new AbortController();

export const getPrivacyStatus = () => status;
export function subscribePrivacy(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function hasPrivacyConsent() {
  return Capacitor.getPlatform() !== "android" || status === "accepted";
}
export function requirePrivacyConsent() {
  if (!hasPrivacyConsent()) throw new Error("请先在“更多 → 隐私说明”中同意增强功能的数据处理，仍可手动记录。");
}
function update(next: PrivacyStatus) {
  if (next !== "accepted") requests.abort();
  else if (requests.signal.aborted) requests = new AbortController();
  status = next;
  listeners.forEach(listener => listener());
}
function readState(value: unknown): PrivacyStatus {
  if (typeof value !== "object" || value === null || !("policyVersion" in value) || !("status" in value)) {
    throw new Error("隐私选择返回格式无效，请重试。");
  }
  if (value.policyVersion !== PRIVACY_VERSION) return "pending";
  if (value.status === "pending" || value.status === "accepted" || value.status === "declined") return value.status;
  throw new Error("隐私选择状态无效，请重试。");
}
export function initializePrivacy(): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return Promise.resolve();
  startup ??= NativePrivacy.getState().then(value => { update(readState(value)); }).catch(error => {
    startup = undefined;
    throw error;
  });
  return startup;
}
export async function setPrivacyConsent(accepted: boolean) {
  if (Capacitor.getPlatform() !== "android") return;
  if (changing) throw new Error("正在保存隐私选择，请稍候。");
  changing = true;
  const previous = status;
  if (!accepted) update("declined");
  try {
    const next = readState(await NativePrivacy.setConsent({ accepted }));
    if (next !== (accepted ? "accepted" : "declined")) throw new Error("隐私选择没有保存，请重试。");
    update(next);
  } catch (error) {
    update(previous);
    throw error;
  } finally { changing = false; }
}
export const privacyFetch: typeof fetch = async (input, options) => {
  if (Capacitor.getPlatform() !== "android") return fetch(input, options);
  requirePrivacyConsent();
  let signal = requests.signal;
  let cleanup = () => {};
  if (options?.signal) {
    if (typeof AbortSignal.any === "function") signal = AbortSignal.any([signal, options.signal]);
    else {
      const signals = [signal, options.signal];
      const controller = new AbortController();
      cleanup = () => signals.forEach(item => item.removeEventListener("abort", abort));
      const abort = () => { cleanup(); controller.abort(signals.find(item => item.aborted)?.reason); };
      if (signals.some(item => item.aborted)) abort();
      else signals.forEach(item => item.addEventListener("abort", abort, { once: true }));
      signal = controller.signal;
      // ponytail: weather callers always abort after 8/10 seconds; retain listeners
      // through body consumption, then that timeout cleans them. Add body lifecycle
      // tracking before using this fetcher for requests without a bounded signal.
    }
  }
  try {
    const response = await fetch(input, { ...options, signal });
    requirePrivacyConsent();
    return response;
  } catch (error) { cleanup(); throw error; }
};
export function privacyAllowsImage(uri: string) {
  if (hasPrivacyConsent()) return true;
  try {
    const url = new URL(uri, window.location.href);
    return !["http:", "https:"].includes(url.protocol) || url.origin === window.location.origin;
  } catch { return false; }
}
