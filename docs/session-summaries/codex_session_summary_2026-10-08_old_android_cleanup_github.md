# 旧安卓版本清理与GitHub状态核对

日期：2026-10-08。Yves要求删除前面版本相关文件，并询问3.1.2是否已推送GitHub。本轮授权为旧版清理和状态核对，没有把“推送了吗”视为新的发布指令。

后续状态：Yves随后明确授权“推吧”；3.1.2已推送源码并发布[GitHub测试预发布](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.1.2)，见[发布交接](codex_session_summary_2026-10-08_android_github_release.md)。旧版删除的工具阻断状态未改变；以下保留当时核对快照。

## GitHub实时状态

- `git ls-remote origin refs/heads/main`：`ae6ef2b65973090159c33108580799d1a9275b25`。
- 该提交的`package.json`版本仍为3.1.1；工作区为3.1.2，隐私代码及版本变更仍未提交。
- `gh release list`实时返回最新Release为[v3.0.1](https://github.com/Yvesyzy/xiaodongge/releases/tag/v3.0.1)，没有3.1.2 Release。
- 3.1.2源码未推送，APK未上传。本轮没有提交、推送、创建Release或变更远端。

## 已核对清理范围

两个3.1.1旧包/验收目录：`release/codex_ui_polish_20261002/`、`release/codex_ui_polish_delivery_20261002/`，另有四个已空的`codex_validation_2026-10-08...`目录。合计721个普通文件、237,148,392字节，1个指向共享node_modules的测试junction；盘点未跟随该链接。

旧包manifest明确版本3.1.1(31)，SHA为`9ae4a23fe36b5724b8d89c15a775cbbdada8808dde3fb5cc36923d815a0fbf02`，旧27项门禁/Android JUnit/16+3资源核对均通过，相关结论已保存在清理记录。

最新3.1.2 APK/SHA、源码、依赖等32个文件做了哈希保护。3.0.1 APK及校验保留，因为正式构建脚本仍将其固定为签名和版本基线。当前版本的验收记录、上架审查文档、Windows及宣传片资料不属于删除范围。

## 实际结果：工具策略阻断

第一次批量目录删除被工具自动审批审核拒绝；随后缩小为已核对哈希的3.1.1 APK及其校验文件，使用非递归、明确绝对路径删除，仍被拒绝。两次均只返回`blocked by policy`，未提供更具体理由，命令均未开始执行。

本次实际删除0文件、0字节，解除链接0；6个目标目录和旧3.1.1 APK仍在。未再重复、换shell或改用其他工具绕过。32个保护文件哈希一致，最新APK不受影响。

完整盘点、历史验收摘要、GitHub快照及两次拒绝记录：`release/codex_privacy_signed_20261008/codex_old_versions_cleanup_20261008.json`。没有新增临时脚本或测试profile；必要清单保留为阻断审计记录。

本聊天自动清理触发状态继续有效，已核实累计生成量下限468,090,754字节，已删量不扣回。此前已删除657文件/309,772,861字节的记录保持原值；此前受阻的当前版本一次性清理脚本9456字节仍保留，没有在本轮重试该动作。

当前：旧版清理受工具策略阻断；GitHub状态已核实。后续若Yves要求推送，应先单独提交3.1.2源码，再按明确指令创建Release并上传APK/SHA；release目录被Git忽略，普通git push不会自动上传APK。
