export const RESTORE_GATE_KEY = "music-feelings-restore-gate:v1";
export const WEB_RESTORE_JOURNAL_KEY = "music-feelings-restore-journal:v1";
const LOCK_NAME = "codex-archive-storage:v1";
const listeners = new Set<() => void>();
let state = { busy: false, error: "", generation: 0 };
let releaseSession: (() => void) | undefined;
let sessionRequest: Promise<void> | undefined;
let sessionReady: Promise<void> | undefined;

export const getRestoreState = () => state;
export function subscribeRestoreState(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function update(patch: Partial<typeof state>) {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
}
export function storageGeneration() { return state.generation; }
export function assertStorageWritable(generation = state.generation) {
  if (generation !== state.generation) throw new Error("档案已重新载入，旧操作已取消，请重新打开页面。");
  if (state.busy || state.error || localStorage.getItem(RESTORE_GATE_KEY) !== null
    || localStorage.getItem(WEB_RESTORE_JOURNAL_KEY) !== null) {
    throw new Error("档案正在恢复，已暂停保存；请先完成恢复或重试。");
  }
}

// ponytail: 同 origin 的另一窗口保持打开时拒绝导入；需要协作编辑时再设计跨窗口迁移协议。
export function acquireStorageSession(): Promise<void> {
  if (!navigator.locks) return Promise.resolve();
  if (sessionReady) return sessionReady;
  sessionReady = new Promise<void>((resolve, reject) => {
    sessionRequest = Promise.resolve().then(() => navigator.locks.request(LOCK_NAME, { mode: "shared" }, async () => {
      const released = new Promise<void>(done => { releaseSession = done; });
      resolve();
      await released;
    }));
    void sessionRequest.catch(error => {
      releaseSession = undefined;
      sessionRequest = undefined;
      sessionReady = undefined;
      reject(error);
    });
  });
  return sessionReady;
}
async function dropSession() {
  if (sessionReady) await sessionReady;
  releaseSession?.();
  await sessionRequest;
  releaseSession = undefined;
  sessionReady = undefined;
  sessionRequest = undefined;
}

export async function withStorageAccess<T>(action: () => Promise<T>): Promise<T> {
  const generation = state.generation;
  assertStorageWritable(generation);
  const run = () => { assertStorageWritable(generation); return action(); };
  return navigator.locks ? navigator.locks.request(LOCK_NAME, { mode: "shared" }, run) : run();
}

export async function withRestoreLock(action: () => Promise<void>) {
  if (state.busy) throw new Error("已有恢复操作进行中，请等待完成。");
  if (!navigator.locks) throw new Error("当前环境不支持安全恢复锁，无法导入或撤销；请更新系统或使用支持 Web Locks 的浏览器。");
  const previousError = state.error;
  update({ busy: true, generation: state.generation + 1 });
  let acquired = false;
  let token = "";
  let failure: unknown;
  try {
    await dropSession();
    await navigator.locks.request(LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) throw new Error("其他窗口仍打开或保存尚未结束，请关闭其他小懂哥窗口、等待保存后重试。");
      acquired = true;
      try {
        token = localStorage.getItem(RESTORE_GATE_KEY) ?? crypto.randomUUID();
        localStorage.setItem(RESTORE_GATE_KEY, token);
        if (localStorage.getItem(RESTORE_GATE_KEY) !== token) throw new Error("恢复屏障写入校验失败");
        await action();
      } finally {
        // Queue our shared lease before releasing exclusive. Never await it while holding exclusive.
        void acquireStorageSession().catch(() => {});
      }
    });
  } catch (error) { failure = error; }
  try {
    await acquireStorageSession();
    if (acquired && failure === undefined) {
      if (localStorage.getItem(RESTORE_GATE_KEY) !== token) throw new Error("恢复屏障已变化，原文保留，请重试恢复。");
      localStorage.removeItem(RESTORE_GATE_KEY);
      if (localStorage.getItem(RESTORE_GATE_KEY) !== null) throw new Error("恢复屏障无法清除，请重试。");
    }
  } catch (error) { failure ??= error; }
  update({ busy: false, error: failure === undefined ? "" : acquired
    ? (failure instanceof Error ? failure.message : "恢复失败，原文已保留") : previousError });
  if (failure !== undefined) throw failure;
}

export function markRecoveryError(error: unknown) {
  update({ error: error instanceof Error ? error.message : "恢复读取失败，原文已保留" });
}
export function clearRecoveryError() { update({ error: "" }); }
