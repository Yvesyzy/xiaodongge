import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPublication,
  parsePublicationDraft,
  type PublicationDraft,
  type PublicationMetaField,
} from "./codex_publicationModel.ts";

const ONE_PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function draft(overrides: Partial<PublicationDraft> = {}): PublicationDraft {
  return {
    version: 1,
    title: "<公众号标题> & 2026",
    author: "作者 &\nYves",
    intro: "导语私密词\n第二行",
    sections: [
      {
        id: "entry-1",
        title: "第一篇 <标题>",
        content: "正文私密词 <script>alert(1)</script>\n下一行 & 保留 Unicode：春天🎵",
        musicLabel: "品牌私密词",
        ratingText: "评分私密词 9/10",
        dateText: "日期私密词 2026-10-12",
        coverDataUrl: ONE_PIXEL_PNG,
        includeImage: true,
      },
      {
        id: "entry-2",
        title: "第二篇",
        content: "第二篇正文",
        musicLabel: "第二品牌",
        ratingText: "第二评分",
        dateText: "第二日期",
        coverDataUrl: null,
        includeImage: false,
      },
    ],
    privacy: { hideRating: false, hideDate: false, hideBrand: false, hideContent: false },
    ...overrides,
  };
}

test("publication output escapes literal text, preserves Unicode/newlines, and leaves the draft unchanged", () => {
  const source = draft();
  const before = structuredClone(source);
  const result = buildPublication(source);

  assert.deepEqual(source, before);
  assert.equal(result.title, source.title);
  assert.equal(result.plainText.includes(source.title), false, "the separate title is not repeated in the copied body");
  assert.match(result.plainText, /正文私密词 <script>alert\(1\)<\/script>\n下一行 & 保留 Unicode：春天🎵/);
  assert.match(result.htmlFragment, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(result.htmlFragment, /&#39;|&amp;|&lt;/);
  assert.equal(result.htmlFragment.includes("data:image/png;base64"), false);
  assert.equal(result.htmlFragment.includes("<img"), false);
  assert.equal(result.htmlFragment.includes("<script>"), false);
  assert.match(result.htmlFragment, /codex_publication_image_001\.png/);
  assert.match(result.htmlDocument, /<h1[^>]*>&lt;公众号标题&gt; &amp; 2026<\/h1>/);
  assert.match(result.htmlDocument, /data:image\/png;base64,/);
  assert.match(result.htmlDocument, /Content-Security-Policy/);
  assert.equal(result.htmlDocument.includes("<script>"), false);
  assert.match(result.plainText, /小懂哥 · 私人音乐档案/);
  assert.match(result.htmlFragment, /小懂哥 · 私人音乐档案/);
  assert.match(result.htmlDocument, /小懂哥 · 私人音乐档案/);
  assert.match(result.markdown, /^# &lt;公众号标题&gt; &amp; 2026\n/, "markdown carries an escaped H1 title");
  assert.match(result.markdown, /## 第一篇 &lt;标题&gt;/, "markdown uses H2 for sections");
  assert.match(result.markdown, /正文私密词 &lt;script&gt;alert\(1\)&lt;\/script&gt;/, "markdown escapes HTML while keeping body text");
  assert.equal(result.markdown.includes("<script>"), false);
  assert.equal(result.markdown.includes("!["), false, "no broken relative-path images in imported markdown");
  assert.equal(result.markdown.includes("data:image/png;base64"), false);
  assert.match(result.markdown, /【配图位置】codex_publication_image_001\.png/, "image is a text placement note");
  assert.match(result.markdown, /小懂哥 · 私人音乐档案/);
  assert.equal(result.images.length, 1);
  assert.deepEqual(result.images[0], {
    fileName: "codex_publication_image_001.png",
    dataUrl: ONE_PIXEL_PNG,
    caption: "第一篇 <标题>",
  });
});

test("all 16 privacy combinations remove only the selected private fields from every text output", () => {
  for (let mask = 0; mask < 16; mask += 1) {
    const privacy = {
      hideRating: Boolean(mask & 1),
      hideDate: Boolean(mask & 2),
      hideBrand: Boolean(mask & 4),
      hideContent: Boolean(mask & 8),
    };
    const result = buildPublication(draft({ privacy }));
    const textOutputs = [result.plainText, result.htmlFragment, result.htmlDocument, result.markdown];
    const allText = textOutputs.join("\n");
    assert.equal(allText.includes("评分私密词"), !privacy.hideRating, `rating mask ${mask}`);
    assert.equal(allText.includes("日期私密词"), !privacy.hideDate, `date mask ${mask}`);
    assert.equal(allText.includes("品牌私密词"), true, `music identity mask ${mask}`);
    assert.equal(allText.includes("小懂哥 · 私人音乐档案"), !privacy.hideBrand, `app brand mask ${mask}`);
    assert.equal(allText.includes("导语私密词"), !privacy.hideContent, `intro mask ${mask}`);
    assert.equal(allText.includes("正文私密词"), !privacy.hideContent, `body mask ${mask}`);
    assert.equal(allText.includes("第二篇正文"), !privacy.hideContent, `second body mask ${mask}`);
    assert.equal(result.images.length, 1, "a selected local cover remains a separately exported image");
  }
});

test("parsePublicationDraft strictly validates and clones the recoverable shape", () => {
  const source = draft();
  const parsed = parsePublicationDraft(source);
  assert.deepEqual(parsed, source);
  assert.notEqual(parsed, source);
  assert.notEqual(parsed.sections, source.sections);
  assert.notEqual(parsed.sections[0], source.sections[0]);
  parsed.sections[0].title = "changed only in parsed copy";
  assert.equal(source.sections[0].title, "第一篇 <标题>");

  assert.throws(() => parsePublicationDraft({ ...source, version: 2 }), /版本/);
  assert.throws(() => parsePublicationDraft({ ...source, title: "" }), /标题不能为空/);
  assert.throws(() => parsePublicationDraft({ ...source, sections: [] }), /不能为空/);
  assert.throws(() => parsePublicationDraft({ ...source, sections: [source.sections[0], { ...source.sections[0] }] }), /不能重复/);
  assert.throws(() => parsePublicationDraft({ ...source, extra: "private" }), /无法恢复/);
  assert.throws(() => parsePublicationDraft({ ...source, privacy: { ...source.privacy, extra: true } }), /无法恢复/);
  assert.throws(() => parsePublicationDraft({ ...source, sections: [{ ...source.sections[0], extra: "private" }] }), /无法恢复/);
  assert.throws(() => parsePublicationDraft({ ...source, sections: [{ ...source.sections[0], coverDataUrl: "https://remote.example/cover.png" }] }), /远程URL|URL协议/);
  assert.throws(() => parsePublicationDraft({ ...source, sections: [{ ...source.sections[0], coverDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }] }), /PNG/);
  assert.throws(() => parsePublicationDraft({ ...source, sections: [{ ...source.sections[0], coverDataUrl: "data:image/png;base64,%%%%" }] }), /Base64/);
  assert.doesNotThrow(() => parsePublicationDraft({ ...source, sections: [{ ...source.sections[0], includeImage: true, coverDataUrl: null }] }));
});

test("text and image limits reject without silent truncation", () => {
  assert.throws(() => parsePublicationDraft(draft({ intro: "导语".repeat(20_001) })), /导语过长/);
  assert.throws(() => parsePublicationDraft(draft({ sections: [{ ...draft().sections[0], content: "x".repeat(2 * 1024 * 1024) }] })), /2 MiB/);
  assert.throws(() => parsePublicationDraft(draft({ sections: [{ ...draft().sections[0], content: "正文", coverDataUrl: "data:image/png;base64," + "A===", includeImage: false }] })), /Base64/);
  const oversizedBase64 = "data:image/png;base64," + "A".repeat(Math.ceil((8 * 1024 * 1024) / 3) * 4 + 4);
  assert.throws(() => parsePublicationDraft(draft({ sections: [{ ...draft().sections[0], coverDataUrl: oversizedBase64, includeImage: false }] })), /8 MiB/);
  const largePng = Buffer.concat([Buffer.from(ONE_PIXEL_PNG.slice("data:image/png;base64,".length), "base64"), Buffer.alloc(5 * 1024 * 1024)]);
  const largeDataUrl = "data:image/png;base64," + largePng.toString("base64");
  const sections = ["large-1", "large-2"].map(id => ({ ...draft().sections[0], id, coverDataUrl: largeDataUrl }));
  assert.throws(() => buildPublication(draft({ sections })), /配图总量超过8 MiB/);
  assert.doesNotThrow(() => buildPublication(draft({ sections: sections.map(section => ({ ...section, includeImage: false })) })));
});

const STRUCTURED_META: readonly PublicationMetaField[] = [
  { label: "专辑", value: "商业与玩法", kind: "music" },
  { label: "歌曲", value: "cut：我真的还想再活500年", kind: "music" },
  { label: "艺术家", value: "卡力老虎 / 周乘羽", kind: "music" },
  { label: "评分", value: "8.3 / 10", kind: "rating" },
  { label: "制作", value: "9/10", kind: "rating" },
  { label: "词", value: "8/10", kind: "rating" },
  { label: "曲", value: "8.5/10", kind: "rating" },
  { label: "人声", value: "9/10", kind: "rating" },
  { label: "原创性", value: "8/10", kind: "rating" },
  { label: "共鸣", value: "8/10", kind: "rating" },
  { label: "专辑/歌曲发行时间", value: "未填写", kind: "date" },
  { label: "首次收听时间", value: "2026.05.20", kind: "date" },
  { label: "乐评记录时间", value: "2026.09.30", kind: "date" },
];

function structuredDraft(overrides: Partial<PublicationDraft> = {}): PublicationDraft {
  const base = draft();
  return { ...base, sections: [{ ...base.sections[0], metaFields: STRUCTURED_META.map(field => ({ ...field })) }], ...overrides };
}

test("markdown groups three rating dimensions per paragraph and keeps every other field on its own line", () => {
  const result = buildPublication(structuredDraft());
  const dimensionGroups = [
    "制作：9/10 · 词：8/10 · 曲：8.5/10",
    "人声：9/10 · 原创性：8/10 · 共鸣：8/10",
  ];
  for (const field of STRUCTURED_META) {
    const line = `${field.label}：${field.value}`;
    assert.ok(result.plainText.includes(line), `plain text keeps ${field.label}`);
    assert.ok(result.htmlFragment.includes(line), `HTML fragment keeps ${field.label}`);
  }
  for (const group of dimensionGroups) {
    assert.ok(result.markdown.includes(`\n\n${group}\n\n`), `markdown packs a rating group into one paragraph: ${group}`);
    assert.ok(result.plainText.includes(group), `plain text keeps the compact rating group: ${group}`);
    assert.ok(result.htmlFragment.includes(group), `HTML keeps the compact rating group: ${group}`);
  }
  const blocks = result.markdown.split("\n\n");
  const heading = blocks.indexOf("## 第一篇 &lt;标题&gt;");
  assert.deepEqual(blocks.slice(heading + 1, heading + 10), [
    "专辑：商业与玩法",
    "歌曲：cut：我真的还想再活500年",
    "艺术家：卡力老虎 / 周乘羽",
    "评分：8.3 / 10",
    dimensionGroups[0],
    dimensionGroups[1],
    "专辑/歌曲发行时间：未填写",
    "首次收听时间：2026.05.20",
    "乐评记录时间：2026.09.30",
  ], "music, overall rating, two rating groups and three dates each keep their own paragraph");
  assert.equal(result.markdown.includes("  \n"), false, "no importer-unsupported trailing-space hard breaks");
  assert.equal(result.markdown.includes("音乐：品牌私密词"), false, "structured fields replace the collapsed one-line label");
  const legacy = buildPublication(draft()).markdown;
  assert.match(legacy, /音乐：品牌私密词/, "old drafts without metaFields fall back to the original three lines");
  assert.match(legacy, /\n\n评分：评分私密词 9\/10\n\n/, "legacy fields also become separate paragraphs");
});

test("privacy hides every rating dimension and all three dates, keeping music fields", () => {
  const result = buildPublication(structuredDraft({ privacy: { hideRating: true, hideDate: true, hideBrand: false, hideContent: false } }));
  const all = [result.plainText, result.htmlFragment, result.htmlDocument, result.markdown].join("\n");
  for (const field of STRUCTURED_META) {
    const line = `${field.label}：${field.value}`;
    assert.equal(all.includes(line), field.kind === "music", `${field.label} privacy`);
  }
  assert.ok(!all.includes("8.3 / 10"), "no overall rating leaks into any output");
  assert.ok(!all.includes("9/10"), "no dimension score leaks into any output");
  for (const label of ["专辑/歌曲发行时间", "首次收听时间", "乐评记录时间"]) {
    assert.ok(!all.includes(`${label}：`), `${label} is hidden together with the other dates`);
  }
  assert.ok(!all.includes("未填写"), "an unset date does not leak through the date toggle");
});

test("parsePublicationDraft validates, clones and preserves optional metaFields", () => {
  const source = structuredDraft();
  const parsed = parsePublicationDraft(source);
  assert.deepEqual(parsed.sections[0].metaFields, STRUCTURED_META.map(field => ({ ...field })));
  parsed.sections[0].metaFields![0].value = "changed only in parsed copy";
  assert.equal(source.sections[0].metaFields![0].value, "商业与玩法");
  assert.throws(() => parsePublicationDraft({ ...source, sections: [{ ...source.sections[0], metaFields: "nope" }] }), /元信息列表格式不正确/);
  assert.throws(() => parsePublicationDraft({ ...source, sections: [{ ...source.sections[0], metaFields: [{ label: "制作", value: "9/10", kind: "unknown" }] }] }), /类型不正确/);
  assert.throws(() => parsePublicationDraft({ ...source, sections: [{ ...source.sections[0], metaFields: [{ label: "制作", value: "9/10" }] }] }), /无法恢复/);
  assert.throws(() => parsePublicationDraft({ ...source, sections: [{ ...source.sections[0], metaFields: Array(33).fill({ label: "制作", value: "9/10", kind: "rating" }) }] }), /元信息项目过多/);
  assert.doesNotThrow(() => parsePublicationDraft(draft()), "legacy drafts without metaFields remain recoverable");
});

test("markdown keeps user text readable while blocking block-level and HTML injection", () => {
  const source = draft();
  const result = buildPublication(draft({
    intro: "> 伪装引用\n第二行",
    sections: [{ ...source.sections[0], content: "# 伪装标题\r\n- 伪装列表\r\n1. 有序列表\r\n> 伪装引用\r\n正文 <b>粗体</b> & 原创" }],
    privacy: { hideRating: true, hideDate: true, hideBrand: false, hideContent: false },
  }));
  assert.match(result.markdown, /\\# 伪装标题/);
  assert.match(result.markdown, /\\- 伪装列表/);
  assert.match(result.markdown, /1\\\. 有序列表/);
  assert.match(result.markdown, /&gt; 伪装引用/, "a user '>' cannot create a blockquote");
  assert.match(result.markdown, /正文 &lt;b&gt;粗体&lt;\/b&gt; &amp; 原创/);
  assert.equal(result.markdown.includes("\r"), false, "CRLF is normalised for the importer");
  assert.equal(result.markdown.includes("评分私密词"), false);
  assert.equal(result.markdown.includes("日期私密词"), false);
  assert.match(result.markdown, /^> &gt; 伪装引用\n> 第二行/m, "intro is a real blockquote");
  assert.ok(result.markdown.endsWith("\n"));
});
