#!/usr/bin/env python3
"""补推 API 推送时漏掉的中文文件名文件。

背景：GitHub Trees API 对非 ASCII 路径的处理与本地 git core.quotePath 行为不一致，
导致 codex_video/codex_交付说明.md 未写入远端 tree。

实测约束（踩过的坑）：
- codex_video 子树 sha 可读（GET 正常）但不可写（POST /git/trees/<sha> 恒 404），
  因此无法「在子目录上增量补文件」，也无法「读出子树全部条目再重建」。
- 可行解法：把该目录所有文件以「含完整路径的扁平条目」一次性提交到根 tree。
  GitHub Trees API 接受 path 含 "/" 的条目，会自动归入对应子目录。

令牌从 GITHUB_TOKEN 环境变量读取，不落盘。
"""
import base64
import json
import os
import subprocess
import urllib.error
import urllib.request

REPO = "Yvesyzy/xiaodongge"
API = f"https://api.github.com/repos/{REPO}"
TOKEN = os.environ.get("GITHUB_TOKEN", "")


def api(path, method="GET", data=None, retries=3):
    body = json.dumps(data).encode() if data else None
    for i in range(1, retries + 1):
        req = urllib.request.Request(f"{API}{path}", data=body, method=method)
        req.add_header("Authorization", f"Bearer {TOKEN}")
        req.add_header("User-Agent", "codex-cli")
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            if e.code in (502, 503, 504) and i < retries:
                continue
            raise SystemExit(f"{method} {path} -> HTTP {e.code}: {detail}")


def sh(*args):
    return subprocess.run(args, stdout=subprocess.PIPE).stdout.decode("utf-8").strip()


def main():
    if not TOKEN:
        raise SystemExit("需要 GITHUB_TOKEN 环境变量")

    ref = api("/git/ref/heads/main")
    remote_head = ref["object"]["sha"]
    remote_tree = api(f"/git/commits/{remote_head}")["tree"]["sha"]

    remote_names = {t["path"] for t in api(f"/git/trees/{remote_tree}?recursive=1")["tree"]
                    if t["type"] == "blob"}
    local_names = [p for p in sh("git", "-c", "core.quotePath=false",
                                  "ls-tree", "-r", "--name-only", "HEAD").split("\n") if p.strip()]
    missing = [p for p in local_names if p not in remote_names]

    if not missing:
        print(f"远端已完整（{len(remote_names)} 文件），无需补推")
        return
    print(f"远端 {len(remote_names)} / 本地 {len(local_names)}，缺失 {len(missing)}：")
    for p in missing:
        print("  -", p)

    # 受影响的顶层目录需整目录重传（子树 sha 不可写）
    prefixes = {"/".join(p.split("/")[:-1]) for p in missing}
    impacted = [p for p in local_names
                if p in missing or any(p.startswith(pre + "/") for pre in prefixes)]
    print(f"需整目录重传，涉及 {len(impacted)} 个文件")

    entries = []
    for n, p in enumerate(impacted, 1):
        blob = subprocess.run(["git", "cat-file", "blob", f"HEAD:{p}"], stdout=subprocess.PIPE).stdout
        b64 = base64.b64encode(blob).decode()
        sha = api("/git/blobs", "POST", {"content": b64, "encoding": "base64"})["sha"]
        entries.append({"path": p, "mode": "100644", "type": "blob", "sha": sha})
        if n % 25 == 0 or n == len(impacted):
            print(f"  blob {n}/{len(impacted)}")

    new_tree = api(f"/git/trees/{remote_tree}", "POST",
                   {"base_tree": remote_tree, "tree": entries})["sha"]

    author, email = sh("git", "log", "-1", "--format=%an", "HEAD"), sh("git", "log", "-1", "--format=%ae", "HEAD")
    when = sh("git", "log", "-1", "--format=%cI", "HEAD")
    commit = api("/git/commits", "POST", {
        "message": "fix(video): 补充 API 推送时漏掉的中文文件名文件",
        "tree": new_tree, "parents": [remote_head],
        "author": {"name": author, "email": email, "date": when},
        "committer": {"name": author, "email": email, "date": when},
    })["sha"]
    api("/git/refs/heads/main", "PATCH", {"sha": commit, "force": False})
    print(f"\n已提交 {commit[:12]} 并快进 main")

    final_tree = api(f"/git/commits/{commit}")["tree"]["sha"]
    final = {t["path"] for t in api(f"/git/trees/{final_tree}?recursive=1")["tree"] if t["type"] == "blob"}
    print(f"最终核对：远端 {len(final)} / 本地 {len(local_names)}，完全一致={final == set(local_names)}")


if __name__ == "__main__":
    main()
