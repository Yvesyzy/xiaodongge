# 元数据获取通道降级链审视(2026-08-15)

现状梳理 + 缺口清单。不实现,只审视;修复建议按最小改动排列。

## 现状:四个捕获通道

```
捕获入口
├── A 媒体通知(自动,首页加载 + "读取当前播放"按钮)
│     ├─ 权限未开(accessEnabled=false) → 引导去通知使用权设置
│     ├─ 无 PLAYING 会话 → "没有读到正在播放的歌曲,请确认正在播放后重试"
│     ├─ 读 title(必需)/artist/album/musicMetadata
│     └─ 有 song+artist → Apple 目录补全(CN 唯一匹配失败再查 US)
│          唯一匹配 → 合并 releaseDate/genre/时长/曲号
│          无唯一匹配 → 保留原生信息,提示可重试
├── B 截图识别(手动选图,App.tsx recognizeScreenshot)
│     ├─ OCR → 专辑信息页模式 / 标签行模式(标题:·专辑:)/ "歌名 - 歌手"模式
│     └─ 预览待确认 → 应用到表单
├── C 系统分享(其他音乐 App → 小懂哥速记页)
│     └─ payload(id/subject/text) → 速记页预填
└── D 手动输入(兜底,永远可用)
```

## 缺口清单

### G1(高):截图通道不走目录补全
`App.tsx:813` 识别后只 `setRecognizedFields`,直接停手;`QuickCapturePage.tsx:204` 的 `enrichNowPlaying` 目录补全只挂在"读取当前播放"路径。截图常常只有"歌名 - 歌手"两行,连专辑名都没有——恰好是最需要目录补全的场景,而它恰好没有。
**建议**:把 `enrichNowPlaying` 抽成共享函数(或复用 `findAppleCatalogMatch` + `applyAppleCatalogMatch`),截图识别后自动补全,补全结果仍走"预览待确认"再应用。改动小,复用现有逻辑。

### G2(中):通知读取只认 PLAYING,且只取第一个会话
`NowPlayingPlugin.java:52`:
- 状态过滤 `!= STATE_PLAYING` 就跳过:缓冲中(BUFFERING)读不到;**暂停(Paused)时读不到**——"暂停后想记录"是很常见的用户场景,现在会得到"没有读到正在播放的歌曲"。
- 多个媒体会话活跃时取第一个 PLAYING 后 `break`:多播放器并存(如同时装了 NeriPlayer 和网易云)时可能取错会话。
**建议**:状态放宽为 `PLAYING | BUFFERING | PAUSED`;多会话时按 `PlaybackState.getLastPositionUpdateTime()` 取最新的一个(暂停中的会话时间戳是新的,已停止的会话时间戳旧,天然区分)。原生 Java 改动约 5 行。

### G3(低):无歌手名时完全放弃联网补全
`App.tsx:735` / `QuickCapturePage.tsx:208` 要求 song+artist 都齐才查目录。有的播放器只给 title(播客、广播、本地文件)。title-only 搜索 iTunes 可做,但 `findAppleCatalogMatch` 强制 artist 匹配是防误配的保守设计。
**建议**:暂不动。若要支持,加一级"title-only 且唯一命中"的弱匹配,需人工确认兜底。记录待定,不进当前路线。

### G4(低):截图 OCR 空识别无感知
OCR 有文字但 `parseMusicInfoText` 解析不出任何字段时,提示文案仍是"请检查后应用到表单",用户以为识别到了。`recognitionNotice(fields)` 对空字段的行为需核对,若无"未识别出歌曲字段"分支则补一句。
**建议**:`recognitionNotice` 增加空字段分支提示。一行级改动。

### G5(未来,不在本次范围):封面自动化
`musicMetadata.artworkUri` 已在读,但前端不主动拉取封面(封面靠手动选图/截图)。做成"目录补全后顺带取封面"是新功能,涉及图片获取与隐私边界,另行评估。

## 明确不做的

- 多源音源接入(网易云/B站/YT 播放能力):是 NeriPlayer 的领域,本 App 以"并存联动"方式获取其价值,不内置。
- 播放历史回写/上报:与隐私定位冲突。

## 结论

G1 + G2 是两个真实痛点(截图补全缺失、暂停读不到),合计改动集中在两个文件,复用现有 `enrichNowPlaying` 链,无新依赖。G4 顺手一行。G3/G5 记录待定。
