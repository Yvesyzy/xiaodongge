import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSocialEndpoint, parsePost, parseReview, reviewSnapshot } from "./codex_socialModel.ts";
import type { ReviewEntry } from "./types.ts";

test("endpoints require a trusted transport and origin-only address", () => {
  assert.equal(normalizeSocialEndpoint(" https://music.example/ ", true), "https://music.example");
  assert.equal(normalizeSocialEndpoint("http://127.0.0.1:8787"), "http://127.0.0.1:8787");
  for (const value of ["http://music.example", "file:///private", "https://name:secret@music.example", "https://music.example/v1", "https://music.example?token=secret", "https://music.example/#secret"]) assert.throws(() => normalizeSocialEndpoint(value));
  assert.throws(() => normalizeSocialEndpoint("http://localhost:8787", true));
});
test("published snapshot allowlist omits private fields and unselected metadata", () => {
  const entry = { id: "private-id", type: "album", title: "专辑听感", albumName: "专辑", artistName: "艺人", songName: null, content: "私人全文", rating: 8.5, listenedAt: "2026-10-10T00:00:00.000Z", moods: ["私人情绪"], tags: ["私人标签"], musicMetadata: { mediaUri: "private://player" } } as ReviewEntry;
  const snapshot = reviewSnapshot(entry, { rating: false, date: false, cover: null });
  assert.deepEqual(Object.keys(snapshot).sort(), ["type", "title", "albumName", "songName", "artistName", "rating", "listenedAt", "coverDataUrl"].sort());
  assert.equal(snapshot.rating, null); assert.equal(snapshot.listenedAt, null);
  assert.equal(JSON.stringify(snapshot).includes("private"), false);
  assert.equal(JSON.stringify(snapshot).includes("私人"), false);
  assert.equal(reviewSnapshot(entry, { rating: true, date: true, cover: null }).rating, 8.5);
});
test("service responses reject remote or active image formats and invalid counts", () => {
  const review = { type: "album", title: "专辑", albumName: null, songName: null, artistName: null, rating: null, listenedAt: null, coverDataUrl: null };
  assert.deepEqual(parseReview(review), review);
  for (const coverDataUrl of ["https://tracking.example/image", "data:image/svg+xml;base64,PHN2Zz4=", "javascript:alert(1)"]) assert.throws(() => parseReview({ ...review, coverDataUrl }));
  const post = { id: "post", author: { id: "user", username: "user_a", displayName: "听友" }, text: "听感", review, createdAt: "2026-10-10T00:00:00.000Z", likeCount: 0, likedByMe: false, commentCount: 0 };
  assert.equal(parsePost(post).text, "听感");
  assert.throws(() => parsePost({ ...post, likeCount: -1 }));
  assert.throws(() => parsePost({ ...post, likedByMe: "false" }));
  assert.throws(() => parsePost({ ...post, createdAt: "not-a-date" }));
});
