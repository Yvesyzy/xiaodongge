# 公众号稿预览、复制与配图导出

Yves已选择上一轮第2项：实现公众号稿预览、复制及配图导出。公众号为个人主体；采用本地整理原文、用户在公众号后台审阅发布的方案。维持不推送，不上传草稿、不自动发布，不实施网易云/豆瓣跳转。

## 行为

- 乐评/月年报告统一分享面板增加“公众号稿”；更多页提供独立入口，允许用户选择并排序多篇正式记录。年度榜单可使用已保存入选理由出稿，不自行添加未选乐评。
- 标题、署名、导语和各节正文可编辑；默认来自已选原文，不生成未经确认的听感或音乐事实。编辑不修改原记录。
- 预览、排版复制、纯文字复制、HTML和配图包遵循同一隐私状态：hideRating/hideDate/hideBrand/hideContent。hideContent同时移除导语和各节正文，不让摘要/图片再次带出这些文字；正文中的用户原文不做HTML解释。
- 本机推文草稿按来源组合保存，只保存文字/选项，不复制大图，不进入既有乐评备份；关闭/重开可恢复。保存失败保留当前输入并提示，离开需确认。格式损坏不得覆盖原草稿，允许用户明确放弃损坏副本。
- “复制正文（带排版）”写入text/html和text/plain；正文不重复公众号单独的标题字段。正文复制中的图片用素材位置说明，实际图片另导出，不声称已上传微信。原生Android和浏览器分别使用系统HTML剪贴板/浏览器兼容路径；不支持或超限时明确建议纯文字或HTML导出。
- 导出包为ZIP：独立可打开的HTML（含本地图片）、纯文字正文、使用说明、生成横版封面及选中章节配图。文件名ASCII、无路径穿越；包最大8MiB，无外部依赖和网络请求。可另导出HTML/单张封面。PNG配图按1024像素上限处理，横版封面1200×510为本工具设计尺寸，不宣称是微信强制尺寸。
- 公众号实际编辑器的粘贴、图片上传和外链表现未验证，交付时如实说明。

## 新模型契约

文件 `mobile/src/codex_publicationModel.ts`（纯函数，不依赖DOM/Capacitor）。

`PublicationPrivacy = { hideRating:boolean, hideDate:boolean, hideBrand:boolean, hideContent:boolean }`。

`PublicationSection = { id:string, title:string, content:string, musicLabel:string, ratingText:string, dateText:string, coverDataUrl:string|null, includeImage:boolean }`。

`PublicationDraft = { version:1, title:string, author:string, intro:string, sections:PublicationSection[], privacy:PublicationPrivacy }`。

`PublicationImage = { fileName:string, dataUrl:string, caption:string }`，只允许有效本地PNG data URL，文件名为`codex_publication_image_001.png`等。

`buildPublication(draft:PublicationDraft): { title:string, plainText:string, htmlFragment:string, htmlDocument:string, images:PublicationImage[] }`。htmlFragment仅含排版正文、作者和允许的元数据、配图位置说明；htmlDocument含标题与嵌入式PNG，独立阅读。所有用户文字转义；无script、事件属性、外部URL、iframe、表单。HTML文档加入限制性CSP。title/author/intro上限分别200/100/20000字符，全文总文字上限2MiB；没有无提示的正文截断。隐藏正文仍可导出音乐摘要，但intro/content不得出现在任何输出。

`parsePublicationDraft(value:unknown): PublicationDraft` 严格检查可恢复的草稿形状、字段类型、体积和图片格式。纯模型不补全私有媒体URI、系统来源、天气、标签或情绪。

新ZIP模块 `mobile/src/codex_publicationZip.ts`：`buildPublicationZip(files:Array<{name:string,data:Uint8Array}>):Uint8Array`，标准不压缩ZIP，UTF8文件名标志、CRC32、central directory、EOCD，8MiB上限，拒绝重复/路径名/非法文件名。不用新依赖。

## 原生新契约

现有NativeExport插件增加 `copyHtml({text:string,html:string}):Promise<{status:"copied"}>`。总UTF8载荷至多512KiB，输入必须为非空字符串，HTML里不接收可执行内容。原来的copyText保持不变。

`exportBytes`允许application/zip的严格Base64，仍保留image/png的严格校验和8MiB上限。ZIP检查不应改变stageFile/saveImageToGallery仅PNG的边界；只保存，不解压。既有UTF8文本/HTML保存路径保持回执校验。

## 验收

纯模型/ZIP测试覆盖转义、Unicode/换行、所有隐私组合、无正文、长内容、图片名单/失效、损坏草稿和ZIP标准读取/CRC/路径限制。Android单测覆盖HTML输入和ZIP校验边界，实际剪贴板/文件提供器需真机验证。

Playwright隔离数据验证单篇/多篇/月年报告/榜单入口、编辑和恢复、隐私影响所有导出、HTML与纯文本复制、ZIP下载实际内容与图片、弱能力/保存失败明确反馈、原记录不变、320/390/1280视口和浅深色。生成原签名测试APK，保持既有签名/包名和本地数据兼容，不提交推送。
