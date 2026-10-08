#!/usr/bin/env python3
"""通过 GitHub API 以增量方式推送提交，绕过失效的 git HTTPS 代理。

背景：本机 git 走 127.0.0.1:7993 代理时 CONNECT 200 后不再转发数据（挂死），
但 HTTPS GET 与 api.github.com 正常，SSH 端口也通（无授权密钥）。
故改用 Git Data API 逐提交创建。

关键约束（踩过的坑）：
- 不能引用本地 tree oid：GitHub 重建远端 commit 后 tree oid 与本地不同，
  POST /git/commits 会报 "Tree SHA does not exist"。
- 不能省 base_tree：去掉它会让 tree 只含变更文件，其余文件全部消失。
- 正确做法：每提交用 base_tree=<父提交 tree> + 增量 entries 链式构建。
  父提交 tree 取自「上一个 API 创建的 commit」，保证链式自洽。

令牌从 git-credential-manager 读取，不落盘、不打印、不进命令行。
用法：python3 scripts/codex_push_via_api.py [--dry-run]
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

REPO = "Yvesyzy/xiaodongge"
GCM = r"C:\Users\lenovo\.workbuddy\binaries\PortableGit\versions\1.2.0\mingw64\bin\git-credential-manager.exe"
API = f"https://api.github.com/repos/{REPO}"
PER_FILE_DELAY = 0.0


def get_token():
    """依次尝试：环境变量 → 凭据文件（由 shell 侧 GCM 写入）→ GCM 子进程。

    注：本机 Node/Python 直接 spawn git-credential-manager 会超时，
    因此优先读 shell 侧准备好的凭据文件。
    """
    tok = os.environ.get("GITHUB_TOKEN", "")
    if tok:
        return tok
    path = os.environ.get("GITHUB_CRED_FILE", "")
    if path and os.path.exists(path):
        for line in open(path, encoding="utf-8", errors="replace").read().splitlines():
            if line.startswith("password="):
                return line.split("=", 1)[1]
    out = subprocess.run(
        [GCM, "get"], input=b"protocol=https\nhost=github.com\n\n",
        capture_output=True, timeout=30,
    ).stdout.decode("utf-8", "replace")
    for line in out.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1]
    raise SystemExit("未能取得 GitHub 令牌：请设置 GITHUB_TOKEN 或 GITHUB_CRED_FILE")


TOKEN = get_token()
_calls = 0


def api(path, method="GET", data=None, retries=4):
    global _calls
    body = json.dumps(data).encode() if data is not None else None
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(f"{API}{path}", data=body, method=method)
        req.add_header("Authorization", f"Bearer {TOKEN}")
        req.add_header("X-GitHub-Api-Version", "2022-11-28")
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", "codex-cli")
        try:
            _calls += 1
            if PER_FILE_DELAY:
                time.sleep(PER_FILE_DELAY)
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:200]
            if e.code in (502, 503, 504, 429) and attempt < retries:
                wait = 3 * attempt
                print(f"    HTTP {e.code}，{wait}s 后重试 {attempt}/{retries - 1}", flush=True)
                time.sleep(wait)
                continue
            raise SystemExit(f"API {method} {path} 失败 HTTP {e.code}: {detail}")
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < retries:
                print(f"    网络异常，{3 * attempt}s 后重试 {attempt}/{retries - 1}", flush=True)
                time.sleep(3 * attempt)
                continue
            raise SystemExit(f"API {method} {path} 网络失败: {e}")


def git(*args):
    r = subprocess.run(["git", *args], capture_output=True)
    if r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} 失败: {r.stderr.decode('utf-8','replace')[:200]}")
    return r.stdout.decode("utf-8", "replace")


def blob_sha(rev_path):
    """上传单个文件内容，返回其 blob sha。"""
    blob = subprocess.run(["git", "cat-file", "blob", rev_path], capture_output=True)
    if blob.returncode != 0:
        return None
    b64 = base64.b64encode(blob.stdout).decode()
    return api("/git/blobs", "POST", {"content": b64, "encoding": "base64"})["sha"]


def main():
    dry = "--dry-run" in sys.argv
    remote = api("/git/ref/heads/main")
    base_ref = remote["object"]["sha"]
    # 远端 commit 的真实 tree（用 API 读，不能用本地 oid）
    base_tree = api(f"/git/commits/{base_ref}")["tree"]["sha"]
    head = git("rev-parse", "HEAD").strip()

    print(f"远端 main : {base_ref[:12]}  tree {base_tree[:12]}")
    print(f"本地 HEAD : {head[:12]}")
    if base_ref == head:
        print("已同步，无需推送")
        return

    revs = git("rev-list", "--reverse", f"{base_ref}..{head}").split()
    print(f"待推送提交 : {len(revs)} 个\n", flush=True)
    if dry:
        for i, sha in enumerate(revs, 1):
            files = [f for f in git("diff-tree", "--no-commit-id", "--name-only", "-r", sha).splitlines() if f.strip()]
            print(f"  {i:2d}. {sha[:8]}  {len(files):3d} 文件  {git('log','-1','--format=%s',sha).strip()[:56]}")
        print("\n(dry-run，未做任何改动)")
        return

    parent_ref, parent_tree = base_ref, base_tree
    for i, sha in enumerate(revs, 1):
        subject = git("log", "-1", "--format=%s", sha).strip()
        body = git("log", "-1", "--format=%b", sha)
        name = git("log", "-1", "--format=%an", sha).strip()
        email = git("log", "-1", "--format=%ae", sha).strip()
        when = git("log", "-1", "--format=%cI", sha).strip()

        entries = []
        deleted = []
        for line in git("diff-tree", "--no-commit-id", "-r", "--name-status", sha).splitlines():
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            status, path = parts[0], parts[-1]
            if status.startswith("D"):
                deleted.append(path)
                continue
            ls = git("ls-tree", sha, "--", path)
            if not ls.strip():
                continue
            meta = ls.split("\t")[0].split()
            mode, otype, _ = meta[0], meta[1], meta[2]
            if otype != "blob":
                continue
            bs = blob_sha(f"{sha}:{path}")
            if bs:
                entries.append({"path": path, "mode": mode, "type": "blob", "sha": bs})
        for path in deleted:
            # GitHub Trees API 删除文件的正确写法是 sha=null（全零会被拒）
            entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})

        tree_payload = {"base_tree": parent_tree, "tree": entries}
        new_tree = api("/git/trees", "POST", tree_payload)["sha"]
        msg = f"{subject}\n\n{body}".strip() if body.strip() else subject
        new_commit = api("/git/commits", "POST", {
            "message": msg, "tree": new_tree, "parents": [parent_ref],
            "author": {"name": name, "email": email, "date": when},
            "committer": {"name": name, "email": email, "date": when},
        })["sha"]
        parent_ref, parent_tree = new_commit, new_tree
        n_del = len(deleted)
        extra = f" (-{n_del} 删除)" if n_del else ""
        print(f"  [{i}/{len(revs)}] {sha[:8]} -> {new_commit[:8]}  {len(entries)} 文件{extra}  {subject[:40]}", flush=True)

    api("/git/refs/heads/main", "PATCH", {"sha": parent_ref, "force": False})
    print(f"\n远端 main 已更新 {base_ref[:12]} -> {parent_ref[:12]}")
    print(f"共 {_calls} 次 API 调用")


if __name__ == "__main__":
    main()
