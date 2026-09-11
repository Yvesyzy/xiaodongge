# 小懂哥 · 轻新拟物 v2（abu）

日期：2026-09-12。分支 `abu-neumorphism-v2`，基于 main a4d505f。未合并 main、未推送、未重新打包 APK。

## 本轮起点

截图中 Yves 向 Codex 提了两件事：专辑展示的封面太贴左边框；按钮按下要有音效或反馈。Codex 确认了根因（专辑列表沿用旧列表 `padding: 8px 2px 15px`，左右只有 2px），把 `.cover-row` 内边距改成 18px 后即耗尽额度中断。版本号已被推到 2.7.1-test.3，但未验证、未打包。

接手状态：`main` 工作区带 22 个已修改文件与 11 个未跟踪文件（导航、封面、返回修复 + 轻新拟物第一轮）。

## 设计判断

### 1. 光影基础是根因，不是配色问题

第一轮把新拟物铺到了九个页面，但阴影色 `#d4d8ce` 与纸面 `#f2f1eb` 只差约 9% 明度。新拟物的立体感完全由明度差承载，9% 不足以下沉出厚度——所有"浮起"看着只是描了边，按下时也没有可沉的空间。本轮拉到 `#c8cfc2`（约 15%），高光提到 `#fffffff0`，深色阅读阴影加深到 `#0b1310`。

光源统一在左上：凸起物高光走左上、阴影落右下，凹入物方向相反。封面原本用 `0 12px 24px` 的垂直投影，与卡片的新拟物光源冲突，已改为同一光源。

### 2. 专辑卡片

- 内边距左右 2px → 18px（codex 中断前已改，本轮验证达标）
- `align-items: center` → `start`：长文案时封面不再垂直漂在文字块中间，图文顶对齐更接近专辑货架
- 列表间距 14px → 16px；摘要补 1.62 行高与更深的墨色，避免五行副信息糊成一片
- 封面边长保持 82px，图文间距保持 14px

### 3. 按压反馈：不加音效

Yves 给的是"音效，或者加一些反馈"。这里做了一个和 Codex 不同的判断——**明确不加音效**：小懂哥是音乐记录工具，用户按按钮时手机大概率正在播放音乐，界面提示音会盖住正在听的段落，还要额外处理静音与音量。改用 8ms 轻振：看得见、摸得到，但不出声。

原实现的按下反馈只有 `scale:.97` 加 `brightness(.94)`，6% 的明暗变化在暖纸上基本看不见。本轮：

| 维度 | 之前 | 现在 |
|---|---|---|
| 明暗 | brightness .94 | brightness .92 |
| 阴影 | 仅主/次按钮翻凹入 | 所有浮起控件按下即凹入 |
| 响应 | 100–120ms | 90ms ease-out |

触觉通过标准 `navigator.vibrate` 实现，事件委托在 document 的 pointerdown，检测不到振动器时静默降级，无新依赖。已补 `android.permission.VIBRATE`，**必须重新打包才在真机生效**。

## 改动文件

| 文件 | 改动 |
|---|---|
| `mobile/src/codex_neumorphism.css` | 阴影/高光令牌、深色阅读令牌、专辑卡片光源与层级、按压反馈三处增强 |
| `mobile/src/styles.css` | `.cover-row` 顶对齐（内边距 18px 为 codex 上一轮所改） |
| `mobile/src/abu_haptics.ts` | 新增，轻触觉 |
| `mobile/src/main.tsx` | 接入触觉 |
| `android/app/src/main/AndroidManifest.xml` | 补 VIBRATE 权限 |
| `docs/designs/abu_neumorphism_v2_2026-09-11.html` | 设计与验证说明 |

未改信息架构、配色体系、存储、业务流程；未触碰 `release/` 与任何已生成 APK。

## 验证

- `tsc --noEmit` 通过（首轮 `navigator.vibrate` 的参数类型在 TS 6.0 下要求可迭代，已修正为数组）。
- `scripts/codex_check_neumorphism.mjs` PASS：十条路由、320/390/430/768/1280 视口、三档字号、深浅阅读、原文不变、无运行时报错；专辑/歌曲卡片封面距卡片左右各 ≥18px 且图文间距 ≥14px；按压 scale 0.97、阴影由凸起翻凹入、松手复原；减少动态效果下不改尺寸但保留色彩反馈；深色阅读按钮阴影不含白色光晕。
- 截图与指标：`release/abu_neumorphism_qa/`（合成数据、独立浏览器，未读取手机记录）。

## 仓库修复记录

接手时 HEAD 指向一个未出生的分支，git 把索引里 246 个文件全部误报为新增，一度像是有 246 个待提交新增。

实际未损坏：`refs/heads/main` = a4d505f（246 文件）与 `origin/main` 一致；索引与 main 树 diff 为空；工作区文件完整。已备份 `.git/HEAD` 到 `.git/ABU_HEAD_backup`，把 HEAD 接回 main 后用 `update-ref` 建分支。

三处根因线索：

1. `.git/packed-refs` 里 `refs/heads/main` 是旧值 `20f39c57`，与 loose ref `a4d505f` 不一致（loose 优先，main 解析正确，但 packed-refs 需要清理）。
2. `core.fscache true` 时 git 在跨进程下看不到刚创建的 ref——表现为分支建不成、ref 写入了却报 unborn。已在本仓库设 `core.fscache false` 规避。
3. 带斜杠的分支名 `abu/neumorphism-v2` 在本仓库写不进 refs：`update-ref` 返回 0，但文件未落地，目录创建后被回收。最终用 `abu-neumorphism-v2`。

**根因未定，建议 codex 或 Yves 复核**：这个仓库同时挂着两个 worktree（`release/codex_worktrees/share`、`.../year`），packed-refs 与 loose ref 又不一致，不排除是并发或 worktree 操作留下的状态。

## 未做与建议

- 未重新打包 APK、未推送、未合并 main。触觉反馈要真机生效必须重打包。
- 首页"可视化记忆"两张卡是深色底，与暖纸新拟物体系割裂。这属于配色决策而非新拟物本身，需要 Yves 定方向（改成暖纸同色系，还是保留深色作为强调）后再动。
- 底栏悬浮会遮住列表最后一张卡的下沿，`padding-bottom` 已给到 102px + safe-area，实测仍贴得较紧，值得再调。
