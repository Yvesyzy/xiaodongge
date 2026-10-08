# 2026-10-08 小懂哥 Git 状态核查

作者：Codex。用户：Yves。范围：核查提交、工作区和远端状态，不执行暂存、提交、推送、移动或删除。

## 原工作区

- 路径：`D:\codex\workspaces\codex\小懂哥`。
- Git：`2.55.0.windows.2`；PowerShell：`7.6.5`。
- 分支：`main`；本地 HEAD 与实时查询的远端 `refs/heads/main` 均为 `9ae4e01a037690e59aed1e9ac71091baa0e27acc`。
- 最新提交时间：`2026-09-28T15:02:28+08:00`；标题：`docs: inventory non-T release evidence`。
- 写入本核查记录前：42 个修改、27 个删除、178 个未跟踪文件，共 247 项；暂存区为空，只有一个工作树和一个本地分支，stash 列表为空。
- 本轮开始时未跟踪文件为 177 个；核查期间其他会话新增了 Android 商店咨询交接，复核后为 178 个。本轮不将该新增记录认作自己的产物。
- 27 个删除路径的文件名全部在 `docs/session-summaries/` 找到；与 9 月 28 日结构整理交接中的文档迁移对应。未声称迁移文件内容全部逐字未变。
- 原有未跟踪项分布：`codex_video/` 84 个，`docs/` 70 个，`desktop/` 15 个，`scripts/` 5 个，`mobile/` 1 个，根目录 3 个。
- 根目录未跟踪项包括 60,670,232 字节的宣传片 ZIP、对应 SHA 文件，以及 0 字节的 `({src`。均保留，未自动纳入提交或删除。
- 交接记录确认分享布局、六项评分、正文末尾字数和按钮间距等更新尚未在此仓库提交。Windows 移植与宣传片工程也仍出现在此工作区的未跟踪项中。

## 独立 Windows 工作区

- 路径：`D:\codex\workspaces\xiaodongge-windows`。
- 本地 HEAD 与实时远端 `refs/heads/main` 均为 `ce08a32c1b6dfa18054624fd565eef88c0aeddf6`，提交时间 `2026-10-07T13:01:36+08:00`，标题 `build(windows): add per-user installer and signing workflow`。
- 当前另有 5 项未提交改动：修改 `README.md`、`docs/codex_release_v3.1.1.md`；未跟踪 `.github/workflows/codex_windows_build.yml`、`docs/codex_code_signing_policy.md`、`docs/codex_privacy_policy.md`。
- 第一次 Windows 远端查询因 TLS 提前断开失败；以命令级 `http.version=HTTP/1.1` 重查成功，未修改 Git 配置。
- Windows 已有独立提交，不能用原目录的 Git 状态判断其发布源码是否提交。

## 验证、清理与下一步

- 验证使用 `git status --porcelain=v1 --untracked-files=all`、`git log`、`git branch -vv`、`git worktree list --porcelain`、`git stash list`、`git diff --cached --quiet` 和两个仓库的 `git ls-remote --heads origin refs/heads/main`。
- Git 查询使用 `--no-optional-locks`。未运行产品构建或测试；本任务只核查版本控制状态，不对当前源码的功能正确性重新验收。
- 本轮仅新增这份核查交接并追加自己的 `codex_status.txt`；既有业务文件、其他助手状态、暂存区及提交历史不修改。
- 已按「任务文件清理」检查本轮产物：未构建、下载或创建测试副本，累计新增量未超过 200,000,000 字节；无新增临时文件，删除量为 0。
- 当前状态：核查完成。原仓库最近更新尚未提交；Windows 独立仓库已有提交，但仍有 5 项新改动未提交。
- 下一步可按功能整理原仓库待提交源码与文档，将宣传片成品压缩包单独处理；独立 Windows 仓库的 5 项改动单独核对和提交。上述操作本轮未执行。
