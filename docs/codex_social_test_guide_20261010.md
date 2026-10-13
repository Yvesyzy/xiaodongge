# 小懂哥 v3.4.1 好友圈使用与测试说明

好友圈是可选的自部署测试功能，目前没有公共服务。通过“更多 → 好友圈”进入；记录列表的“••• → 发布到好友圈”可以直接带入一篇本地乐评，发布前仍需确认。

当前下载：[原签名 v3.4.1 (39) APK](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.4.1/codex_xiaodongge-v3.4.1-39.apk)，[SHA-256](https://github.com/Yvesyzy/xiaodongge/releases/download/v3.4.1/codex_xiaodongge-v3.4.1-39.sha256.txt)。包名 `com.yves.musicarchive`，沿用正式 v3.2.0 签名，可覆盖同签名较低版本。v3.4.1的31项工程检查、30项Android单测通过，包含好友圈UI联调；公网双设备和真机Keystore仍需设备验收。

## 在本机体验

在项目根目录使用Node 24.13.0和项目依赖运行：

```powershell
npm.cmd run social:preview
```

打开 `http://127.0.0.1:5173/#/social`，在“好友圈服务地址”填写 `http://127.0.0.1:8787`。此命令同时启动两个仅绑定本机的服务，不会开放私人网页端。若端口被占用会明确退出，不接管其他进程。按 Ctrl+C 停止。

1. 在普通浏览器注册账号 A，再用另一个浏览器或无痕窗口注册账号 B。两边填写相同服务地址，密码至少12字符。浏览器只在内存保存登录，刷新后重新登录。
2. A 在“朋友”页生成邀请码，把其中的代码给 B；B 填入代码申请；A 刷新朋友并接受申请。
3. A 在“动态”页写文字，或选择本地乐评。评分、日期、封面默认不选，发布预览展示实际上传内容。
4. B 刷新动态，点赞、评论。解除好友后再刷新，双方不再通过服务访问对方动态。
5. 原图片分享照常在乐评的“分享这篇”中使用；好友圈的邀请和动态也能打开系统文字分享。平台是否提供微信/朋友圈接收入口由其实际安装和版本决定，本轮没有验证微信接收。

本机账号/动态保存在 `social/data/social.sqlite`，与私人档案、Prisma 数据库和测试脚本的合成数据库分开。该目录及 `social/backups` 不提交 Git。不要把好友圈数据库当作手机档案备份导入。

## 手机测试与公网部署

Android版本包含同样的好友圈入口，使用 HTTPS 服务地址。手机里的 `127.0.0.1` 指向手机本身，不能填电脑的本机地址。当前本机 HTTP 预览用于双浏览器联调；不同地点的真实朋友使用，需要先按[服务端部署说明](../social/codex_README.md)部署持续运行的 HTTPS 服务，再把相同根地址填进各自的应用。

同意包含好友圈数据范围的隐私政策后才能使用好友圈；选择仅本地功能仍可正常使用私人档案。Android token 通过 Keystore 加密保存；已完成原生编译和输入校验单测，但尚未验证真机重启后的 Keystore 行为、公网双设备连接和微信接收，不把浏览器模拟当作这些验证。

账号页支持退出与通过密码确认注销社交账号。发布是独立快照，本地改文/删文不会自动撤回；应到动态删除。朋友已经另存、截图或转发的副本不能远程收回。首版没有微信好友同步、公开广场、私聊或自动云同步。

## 可重复验证

```powershell
npm.cmd run social:test
npm.cmd run social:check
npm.cmd run typecheck:mobile
pwsh -NoProfile -File scripts/codex_check_android_unit.ps1
```

`social:test` 用合成账号验证邀请过期/重复、好友访问、退出与解除关系竞态、幂等、分页、账号删除隔离以及输入/CORS边界。`social:check` 启动隔离本机服务和三个独立浏览器上下文，验证真实 UI 交互，结果保存在新建的 `release/codex_social_qa_*` 中。不会使用个人浏览器资料或上传本地私人库。

服务端使用 Node 24 的内置 SQLite；该版本官方将其标为实验性接口，已按当前本机版本验证。首版按单服务进程、小范围好友测试设计；生产容量、反向代理限流、备份保留与账号运维需在选定部署平台后验证。[Node 24.13.0 SQLite](https://nodejs.org/download/release/v24.13.0/docs/api/sqlite.html)。
