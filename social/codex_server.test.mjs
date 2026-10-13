import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createSocialServer } from './codex_server.mjs';

const testRoot = dirname(fileURLToPath(import.meta.url));
const allowedOrigin = 'http://allowed.test';
const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function startApp() {
  const directory = await mkdtemp(join(testRoot, 'codex_social_test-'));
  const dbPath = join(directory, 'social.sqlite');
  const social = createSocialServer({ dbPath, allowedOrigins: [allowedOrigin] });
  await new Promise((resolve) => social.server.listen(0, '127.0.0.1', resolve));
  const address = social.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function api(path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    if (options.origin !== null) headers.Origin = options.origin ?? allowedOrigin;
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    let body;
    if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // The test asserts JSON for API routes; retaining the raw body helps failures.
    }
    return { status: response.status, json, text, headers: response.headers };
  }

  return { directory, dbPath, social, api, baseUrl };
}

async function closeApp(app) {
  await app.social.close();
  await rm(app.directory, { recursive: true, force: true });
}

async function register(api, username, password = `${username}-password-12`) {
  const response = await api('/v1/auth/register', {
    method: 'POST',
    body: { username, displayName: username.toUpperCase(), password },
  });
  assert.equal(response.status, 201);
  assert.equal(typeof response.json.token, 'string');
  assert.equal(response.json.token.length, 43);
  return response.json;
}

async function login(api, username, password = `${username}-password-12`) {
  const response = await api('/v1/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  assert.equal(response.status, 200);
  return response.json;
}

function openChunkedRequest(baseUrl, path, { method = 'POST', token, head, tail }) {
  const address = new URL(baseUrl);
  let settled = false;
  let resolveResponse;
  let rejectResponse;
  const promise = new Promise((resolve, reject) => {
    resolveResponse = resolve;
    rejectResponse = reject;
  });
  const request = httpRequest({
    hostname: address.hostname,
    port: address.port,
    path,
    method,
    headers: {
      Origin: allowedOrigin,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      Connection: 'close',
    },
  }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    response.on('end', () => {
      settled = true;
      const text = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        // The assertion below reports a useful status even for a malformed response.
      }
      resolveResponse({ status: response.statusCode, json, text });
    });
  });
  request.on('error', (error) => {
    settled = true;
    rejectResponse(error);
  });
  request.write(head);
  return {
    finish() {
      if (!settled && !request.destroyed) request.end(tail);
    },
    promise,
  };
}

function pauseForBodyRead() {
  return new Promise((resolve) => setTimeout(resolve, 75));
}

function expireInvite(dbPath, code) {
  const db = new DatabaseSync(dbPath);
  db.prepare('UPDATE invites SET expires_at = ? WHERE code_hash = ?').run(Date.now() - 1, createHash('sha256').update(code).digest('hex'));
  db.close();
}

test('private friends circle API enforces account, friendship, content and request boundaries', async (t) => {
  const app = await startApp();
  t.after(async () => closeApp(app));

  const health = await app.api('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.json, { status: 'ok' });
  assert.equal(health.headers.get('access-control-allow-origin'), allowedOrigin);

  const alice = await register(app.api, 'alice');
  const bob = await register(app.api, 'bob');
  const carol = await register(app.api, 'carol');

  const unauthenticated = await app.api('/v1/feed');
  assert.equal(unauthenticated.status, 401);
  assert.deepEqual(unauthenticated.json, { error: 'unauthorized' });

  const expiredInvite = await app.api('/v1/invites', { method: 'POST', token: alice.token, body: {} });
  assert.equal(expiredInvite.status, 201);
  expireInvite(app.dbPath, expiredInvite.json.code);
  const expiredUse = await app.api('/v1/friend-requests', {
    method: 'POST',
    token: bob.token,
    body: { inviteCode: expiredInvite.json.code },
  });
  assert.equal(expiredUse.status, 400);
  assert.deepEqual(expiredUse.json, { error: 'invalid_invite' });

  const invite = await app.api('/v1/invites', { method: 'POST', token: alice.token, body: {} });
  assert.equal(invite.status, 201);
  const request = await app.api('/v1/friend-requests', {
    method: 'POST',
    token: bob.token,
    body: { inviteCode: invite.json.code },
  });
  assert.equal(request.status, 201);
  const usedInvite = await app.api('/v1/friend-requests', {
    method: 'POST',
    token: carol.token,
    body: { inviteCode: invite.json.code },
  });
  assert.equal(usedInvite.status, 400);

  const aliceFriendsBeforeAccept = await app.api('/v1/friends', { token: alice.token });
  assert.equal(aliceFriendsBeforeAccept.json.incoming.length, 1);
  const requestId = aliceFriendsBeforeAccept.json.incoming[0].id;
  const wrongAccept = await app.api(`/v1/friend-requests/${requestId}/accept`, {
    method: 'POST',
    token: carol.token,
    body: {},
  });
  assert.equal(wrongAccept.status, 403);
  const accepted = await app.api(`/v1/friend-requests/${requestId}/accept`, {
    method: 'POST',
    token: alice.token,
    body: {},
  });
  assert.equal(accepted.status, 200);
  const aliceFriends = await app.api('/v1/friends', { token: alice.token });
  assert.deepEqual(aliceFriends.json.friends.map((item) => item.username), ['bob']);

  const postClientId = randomUUID();
  const createdPost = await app.api('/v1/posts', {
    method: 'POST',
    token: alice.token,
    body: {
      clientId: postClientId,
      text: 'private post',
      review: {
        type: 'album',
        title: 'A snapshot',
        albumName: 'Album',
        songName: null,
        artistName: 'Artist',
        rating: 9,
        listenedAt: '2026-10-10T00:00:00.000Z',
        coverDataUrl: png1x1,
      },
    },
  });
  assert.equal(createdPost.status, 201);
  assert.equal(createdPost.json.post.review.coverDataUrl, png1x1);
  const postId = createdPost.json.post.id;
  const duplicatePost = await app.api('/v1/posts', {
    method: 'POST',
    token: alice.token,
    body: { clientId: postClientId, text: 'changed text is ignored', review: null },
  });
  assert.equal(duplicatePost.status, 201);
  assert.equal(duplicatePost.json.post.id, postId);
  assert.equal(duplicatePost.json.post.text, 'private post');

  const bobFeed = await app.api('/v1/feed', { token: bob.token });
  assert.equal(bobFeed.status, 200);
  assert.equal(bobFeed.json.posts[0].id, postId);
  const carolFeed = await app.api('/v1/feed', { token: carol.token });
  assert.equal(carolFeed.status, 200);
  assert.equal(carolFeed.json.posts.length, 0);
  const strangerGet = await app.api(`/v1/posts/${postId}`, { token: carol.token });
  assert.equal(strangerGet.status, 403);
  const strangerLike = await app.api(`/v1/posts/${postId}/like`, { method: 'PUT', token: carol.token, body: {} });
  assert.equal(strangerLike.status, 403);
  const strangerComment = await app.api(`/v1/posts/${postId}/comments`, {
    method: 'POST',
    token: carol.token,
    body: { clientId: randomUUID(), text: 'no access' },
  });
  assert.equal(strangerComment.status, 403);
  const strangerDelete = await app.api(`/v1/posts/${postId}`, { method: 'DELETE', token: carol.token });
  assert.equal(strangerDelete.status, 403);

  const liked = await app.api(`/v1/posts/${postId}/like`, { method: 'PUT', token: bob.token, body: {} });
  assert.equal(liked.status, 200);
  const unliked = await app.api(`/v1/posts/${postId}/like`, { method: 'DELETE', token: bob.token });
  assert.equal(unliked.status, 200);
  const comment = await app.api(`/v1/posts/${postId}/comments`, {
    method: 'POST',
    token: bob.token,
    body: { clientId: randomUUID(), text: 'a visible comment' },
  });
  assert.equal(comment.status, 201);
  const strangerCommentDelete = await app.api(`/v1/comments/${comment.json.comment.id}`, {
    method: 'DELETE',
    token: carol.token,
  });
  assert.equal(strangerCommentDelete.status, 403);
  const commentClientId = randomUUID();
  const idempotentComment = await app.api(`/v1/posts/${postId}/comments`, {
    method: 'POST',
    token: bob.token,
    body: { clientId: commentClientId, text: 'idempotent comment' },
  });
  assert.equal(idempotentComment.status, 201);
  const duplicateComment = await app.api(`/v1/posts/${postId}/comments`, {
    method: 'POST',
    token: bob.token,
    body: { clientId: commentClientId, text: 'different text' },
  });
  assert.equal(duplicateComment.status, 201);
  assert.equal(duplicateComment.json.comment.id, idempotentComment.json.comment.id);
  assert.equal(duplicateComment.json.comment.text, 'idempotent comment');

  for (let index = 0; index < 20; index += 1) {
    const extra = await app.api(`/v1/posts/${postId}/comments`, {
      method: 'POST',
      token: bob.token,
      body: { clientId: randomUUID(), text: `comment ${index}` },
    });
    assert.equal(extra.status, 201);
  }
  const commentsFirst = await app.api(`/v1/posts/${postId}/comments`, { token: alice.token });
  assert.equal(commentsFirst.status, 200);
  assert.equal(commentsFirst.json.comments.length, 20);
  assert.equal(typeof commentsFirst.json.nextCursor, 'string');
  const commentsSecond = await app.api(`/v1/posts/${postId}/comments?cursor=${encodeURIComponent(commentsFirst.json.nextCursor)}`, { token: alice.token });
  assert.equal(commentsSecond.status, 200);
  assert.equal(commentsSecond.json.comments.length, 2);
  const authorDeleteComment = await app.api(`/v1/comments/${commentsFirst.json.comments[0].id}`, {
    method: 'DELETE',
    token: alice.token,
  });
  assert.equal(authorDeleteComment.status, 200);

  for (let index = 0; index < 21; index += 1) {
    const extra = await app.api('/v1/posts', {
      method: 'POST',
      token: alice.token,
      body: { clientId: randomUUID(), text: `post ${index}`, review: null },
    });
    assert.equal(extra.status, 201);
  }
  const feedFirst = await app.api('/v1/feed', { token: bob.token });
  assert.equal(feedFirst.status, 200);
  assert.equal(feedFirst.json.posts.length, 20);
  assert.equal(typeof feedFirst.json.nextCursor, 'string');
  const feedSecond = await app.api(`/v1/feed?cursor=${encodeURIComponent(feedFirst.json.nextCursor)}`, { token: bob.token });
  assert.equal(feedSecond.status, 200);
  assert.ok(feedSecond.json.posts.length >= 2);
  assert.equal(feedSecond.json.nextCursor, null);

  const unlink = await app.api(`/v1/friends/${bob.user.id}`, { method: 'DELETE', token: alice.token });
  assert.equal(unlink.status, 200);
  const afterUnlinkGet = await app.api(`/v1/posts/${postId}`, { token: bob.token });
  assert.equal(afterUnlinkGet.status, 403);
  const afterUnlinkLike = await app.api(`/v1/posts/${postId}/like`, { method: 'PUT', token: bob.token, body: {} });
  assert.equal(afterUnlinkLike.status, 403);
  const afterUnlinkComment = await app.api(`/v1/posts/${postId}/comments`, {
    method: 'POST',
    token: bob.token,
    body: { clientId: randomUUID(), text: 'blocked after unlink' },
  });
  assert.equal(afterUnlinkComment.status, 403);
  const afterUnlinkDelete = await app.api(`/v1/posts/${postId}`, { method: 'DELETE', token: bob.token });
  assert.equal(afterUnlinkDelete.status, 403);

  const ownDelete = await app.api(`/v1/posts/${postId}`, { method: 'DELETE', token: alice.token });
  assert.equal(ownDelete.status, 200);
  const deletedGet = await app.api(`/v1/posts/${postId}`, { token: alice.token });
  assert.equal(deletedGet.status, 404);

  const bobLogout = await app.api('/v1/auth/logout', { method: 'POST', token: bob.token, body: {} });
  assert.equal(bobLogout.status, 200);
  const revoked = await app.api('/v1/me', { token: bob.token });
  assert.equal(revoked.status, 401);

  const carolDelete = await app.api('/v1/me', {
    method: 'DELETE',
    token: carol.token,
    body: { password: 'carol-password-12' },
  });
  assert.equal(carolDelete.status, 200);
  const retainedAliceFeed = await app.api('/v1/feed', { token: alice.token });
  assert.equal(retainedAliceFeed.status, 200);
  assert.ok(retainedAliceFeed.json.posts.length >= 20);
  const deletedCarolSession = await app.api('/v1/me', { token: carol.token });
  assert.equal(deletedCarolSession.status, 401);
});

test('strict input, body, cover, and CORS checks return bounded JSON errors', async (t) => {
  const app = await startApp();
  t.after(async () => closeApp(app));

  const disallowed = await app.api('/health', { origin: 'http://evil.test' });
  assert.equal(disallowed.status, 403);
  assert.deepEqual(disallowed.json, { error: 'origin_not_allowed' });
  assert.equal(disallowed.headers.get('access-control-allow-origin'), null);

  const invalidRegister = await app.api('/v1/auth/register', {
    method: 'POST',
    body: { username: 'bad', displayName: 'Bad', password: 'long-enough-password', extra: true },
  });
  assert.equal(invalidRegister.status, 400);
  assert.deepEqual(invalidRegister.json, { error: 'invalid_input' });

  const oversize = await app.api('/v1/auth/register', {
    method: 'POST',
    body: { username: 'large_user', displayName: 'Large', password: 'x'.repeat(512 * 1024) },
  });
  assert.equal(oversize.status, 413);
  assert.deepEqual(oversize.json, { error: 'body_too_large' });

  const alice = await register(app.api, 'alice');
  const fakeCover = 'data:image/png;base64,' + Buffer.from('not-a-png').toString('base64');
  const invalidCover = await app.api('/v1/posts', {
    method: 'POST',
    token: alice.token,
    body: {
      clientId: randomUUID(),
      text: 'bad cover',
      review: {
        type: 'song',
        title: 'bad',
        albumName: null,
        songName: 'bad',
        artistName: null,
        rating: null,
        listenedAt: null,
        coverDataUrl: fakeCover,
      },
    },
  });
  assert.equal(invalidCover.status, 400);
  assert.deepEqual(invalidCover.json, { error: 'invalid_input' });

  const invalidPost = await app.api('/v1/posts', {
    method: 'POST',
    token: alice.token,
    body: { clientId: randomUUID(), text: 'missing review' },
  });
  assert.equal(invalidPost.status, 400);
  assert.deepEqual(invalidPost.json, { error: 'invalid_input' });

  const malformedStoredReview = await app.api('/v1/posts', {
    method: 'POST',
    token: alice.token,
    body: { clientId: randomUUID(), text: 'generic error probe', review: null },
  });
  assert.equal(malformedStoredReview.status, 201);
  const corruptDb = new DatabaseSync(app.dbPath);
  corruptDb.prepare('UPDATE posts SET review_json = ? WHERE id = ?').run('{', malformedStoredReview.json.post.id);
  corruptDb.close();
  const genericError = await app.api(`/v1/posts/${malformedStoredReview.json.post.id}`, { token: alice.token });
  assert.equal(genericError.status, 500);
  assert.deepEqual(genericError.json, { error: 'server_error' });
  assert.equal(genericError.headers.get('access-control-allow-origin'), allowedOrigin);
});

test('slow chunked writes recheck sessions and friendship at body completion', async (t) => {
  const app = await startApp();
  t.after(async () => closeApp(app));

  const alice = await register(app.api, 'alice');
  const bob = await register(app.api, 'bob');
  const invite = await app.api('/v1/invites', { method: 'POST', token: alice.token, body: {} });
  assert.equal(invite.status, 201);
  const request = await app.api('/v1/friend-requests', {
    method: 'POST',
    token: bob.token,
    body: { inviteCode: invite.json.code },
  });
  assert.equal(request.status, 201);
  const aliceRequests = await app.api('/v1/friends', { token: alice.token });
  const accept = await app.api(`/v1/friend-requests/${aliceRequests.json.incoming[0].id}/accept`, {
    method: 'POST',
    token: alice.token,
    body: {},
  });
  assert.equal(accept.status, 200);

  const post = await app.api('/v1/posts', {
    method: 'POST',
    token: alice.token,
    body: { clientId: randomUUID(), text: 'race target', review: null },
  });
  assert.equal(post.status, 201);
  const postId = post.json.post.id;

  const revokedClientId = randomUUID();
  const secondAliceSession = await login(app.api, 'alice');
  const slowPublish = openChunkedRequest(app.baseUrl, '/v1/posts', {
    token: secondAliceSession.token,
    head: `{"clientId":"${revokedClientId}","text":"revoked before body completion","review":`,
    tail: 'null}',
  });
  await pauseForBodyRead();
  const logout = await app.api('/v1/auth/logout', { method: 'POST', token: secondAliceSession.token, body: {} });
  assert.equal(logout.status, 200);
  slowPublish.finish();
  const revokedPublish = await slowPublish.promise;
  assert.equal(revokedPublish.status, 401);
  const afterRevokedPublishDb = new DatabaseSync(app.dbPath);
  const revokedPostCount = afterRevokedPublishDb.prepare('SELECT COUNT(*) AS count FROM posts WHERE author_id = ? AND client_id = ?').get(alice.user.id, revokedClientId).count;
  afterRevokedPublishDb.close();
  assert.equal(Number(revokedPostCount), 0);

  const slowLike = openChunkedRequest(app.baseUrl, `/v1/posts/${postId}/like`, {
    method: 'PUT',
    token: bob.token,
    head: '{',
    tail: '}',
  });
  await pauseForBodyRead();
  const unlink = await app.api(`/v1/friends/${bob.user.id}`, { method: 'DELETE', token: alice.token });
  assert.equal(unlink.status, 200);
  slowLike.finish();
  const unfriendedLike = await slowLike.promise;
  assert.equal(unfriendedLike.status, 403);
  const afterUnfriendedLikeDb = new DatabaseSync(app.dbPath);
  const staleLikeCount = afterUnfriendedLikeDb.prepare('SELECT COUNT(*) AS count FROM likes WHERE post_id = ? AND user_id = ?').get(postId, bob.user.id).count;
  afterUnfriendedLikeDb.close();
  assert.equal(Number(staleLikeCount), 0);

  const secondInvite = await app.api('/v1/invites', { method: 'POST', token: alice.token, body: {} });
  assert.equal(secondInvite.status, 201);
  const secondRequest = await app.api('/v1/friend-requests', {
    method: 'POST',
    token: bob.token,
    body: { inviteCode: secondInvite.json.code },
  });
  assert.equal(secondRequest.status, 201);
  const secondAliceRequests = await app.api('/v1/friends', { token: alice.token });
  const secondAccept = await app.api(`/v1/friend-requests/${secondAliceRequests.json.incoming[0].id}/accept`, {
    method: 'POST',
    token: alice.token,
    body: {},
  });
  assert.equal(secondAccept.status, 200);
  const friendsBeforeComment = await app.api('/v1/friends', { token: bob.token });
  assert.deepEqual(friendsBeforeComment.json.friends.map((item) => item.id), [alice.user.id]);
  const commentsBeforeDb = new DatabaseSync(app.dbPath);
  const commentCountBefore = commentsBeforeDb.prepare('SELECT COUNT(*) AS count FROM comments WHERE post_id = ?').get(postId).count;
  commentsBeforeDb.close();

  const slowCommentClientId = randomUUID();
  const slowComment = openChunkedRequest(app.baseUrl, `/v1/posts/${postId}/comments`, {
    method: 'POST',
    token: bob.token,
    head: `{"clientId":"${slowCommentClientId}","text":`,
    tail: '"blocked after body completion"}',
  });
  await pauseForBodyRead();
  const unlinkBeforeCommentCompletion = await app.api(`/v1/friends/${bob.user.id}`, { method: 'DELETE', token: alice.token });
  assert.equal(unlinkBeforeCommentCompletion.status, 200);
  slowComment.finish();
  const unfriendedComment = await slowComment.promise;
  assert.equal(unfriendedComment.status, 403);
  const commentsAfterDb = new DatabaseSync(app.dbPath);
  const commentCountAfter = commentsAfterDb.prepare('SELECT COUNT(*) AS count FROM comments WHERE post_id = ?').get(postId).count;
  commentsAfterDb.close();
  assert.equal(Number(commentCountAfter), Number(commentCountBefore));
});
