# 第一批依赖安全记录

执行日期：2026-09-17。对应 T04 / E1。仅升级依赖和本机入口，未修改数据库结构，未签名、安装或发布 APK。

2026-09-21 的全依赖和生产依赖审计均为 critical 0、high 3、其他 0；退出码均为 1，原始结果保留，未把非零结果记成审计清零。注意：npm audit 基于依赖树记录，旧结果不能证明磁盘实际包版本已全部同步，见下方更正。

2026-09-22 收尾发现 9 个磁盘包与锁文件版本不符，包括 PostCSS 实际仍为 8.5.15。已从官方 registry 按现有锁文件执行 `npm ci` 并重新生成 Prisma Client，锁文件哈希不变，版本差异消除。统一检查入口现会核对锁文件中实际存在的包版本，旧环境已被此门槛明确拒绝。重建后的全依赖/生产依赖审计均仍为 3 high、0 critical，退出 1，均在同一条 Prisma 配置链；证据为 `release/codex_validation_locked_final_20260922/codex_npm_audit_all.json` 和 `codex_npm_audit_prod.json`。

| 项目 | 修改与判断 | 依据 |
|---|---|---|
| Next.js | 16.2.9 → 16.3.5；旧网页端在 Windows 启动，适用漏洞路径必须修补 | [Next.js 官方安全公告](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)；实际安装版本与锁文件核对；隔离构建/启动/API 回归 |
| React Router | 7.18.0 → 7.18.4；应用使用 HashRouter，未使用公告中的 unstable RSC 路径，仍纳入同主版本补丁 | [React Router 公告](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)；mobile/src/App.tsx |
| 构建依赖 | PostCSS 8.5.28；tar 7.5.22、xmldom 0.9.12、brace-expansion 5.0.12、browserslist 4.29.0 与 baseline-browser-mapping 2.11.24 | npm 官方 registry 的审计与兼容版本解析；package-lock.json 记录完整传递依赖变化 |
| 旧网页入口 | dev/start 均显式绑定 127.0.0.1；不提供远程认证能力 | package.json；测试读取操作系统实际 LISTENING 地址 |

没有执行 `npm audit fix --force`，没有为了清零审计降级 Prisma。当前保留 Prisma / @prisma/client 6.19.3。

## 未清零项的适用范围

生产审计仍有 3 个 high 节点：`prisma` → `@prisma/config` → `deepmerge-ts`。三者属于同一条漏洞依赖链，不是三个独立业务漏洞。[DeepmergeTS 公告](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)涉及合并递归对象图时栈耗尽。

本次读取实际安装的 `node_modules/@prisma/config/dist/index.js`：`loadConfigTsOrJs` 在本地 Prisma 配置加载器中动态导入 deepmerge，并作为 c12 的 `merger`；`dotenv`、`rcFile`、`giget`、`extend`、`packageJson` 均为 false。项目没有 Prisma 配置扩展文件；网页运行入口 `src/lib/prisma.ts` 仅构造 `PrismaClient`，API 输入不传给该配置合并器。移动产品使用 Capacitor SQLite，与该 CLI 配置路径分离。

因此本项目现有应用请求路径未发现触发入口。这是基于当前调用链的适用范围判断，不等于依赖已修复。npm 提议的自动修复是 Prisma 6.12.0 回退，不采用。后续引入动态 Prisma 配置、接收外部配置或升级 ORM 时必须重新评估。

## 证据与复查方式

历史审计保存在 `release/codex_p1_security_20260917/`，其中 `codex_npm_audit_installed*.json` 是当时 npm 的结果，不代表已核对所有磁盘包版本。当前以 2026-09-22 重建后证据为准。早期 `codex_npm_audit_all.json` 是补丁前记录，保留用来追溯，不能冒充最终结果。

统一回归 `npm.cmd run verify:full` 包含旧网页端测试：只复制源码到新证据目录，通过既有迁移建立合成 SQLite 库，子进程显式指定测试 DATABASE_URL 并禁用外部 AI 调用；核对 dev/build/start、真实监听地址、CRUD、断网、HTTP 错误、异常响应及重试。真实数据库与用户浏览器档案不参与测试。

最终结果与独立复查状态见 `docs/codex_v29_execution_ledger.md`；此记录本身不代表 Android 真机或发布验收通过。
