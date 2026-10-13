import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPublication,
  parsePublicationDraft,
  type PublicationDraft,
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
    const textOutputs = [result.plainText, result.htmlFragment, result.htmlDocument];
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
