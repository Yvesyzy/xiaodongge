import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const scryptAsync = promisify(scrypt);

const JSON_BODY_LIMIT = 512 * 1024;
const COVER_LIMIT = 256 * 1024;
const PAGE_SIZE = 20;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 32;
const PASSWORD_SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://localhost',
];

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS invites (
  code_hash TEXT PRIMARY KEY,
  inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS invites_inviter_idx ON invites(inviter_id);

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE(from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS friend_requests_to_idx ON friend_requests(to_user_id, created_at);
CREATE INDEX IF NOT EXISTS friend_requests_from_idx ON friend_requests(from_user_id, created_at);

CREATE TABLE IF NOT EXISTS friendships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, friend_id),
  CHECK(user_id <> friend_id)
);
CREATE INDEX IF NOT EXISTS friendships_friend_idx ON friendships(friend_id);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  text TEXT NOT NULL,
  review_json TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(author_id, client_id)
);
CREATE INDEX IF NOT EXISTS posts_feed_idx ON posts(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS likes_post_idx ON likes(post_id);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(post_id, author_id, client_id)
);
CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS comments_author_idx ON comments(author_id);
`;

class HttpError extends Error {
  constructor(status, error, headers = {}) {
    super(error);
    this.status = status;
    this.error = error;
    this.headers = headers;
  }
}

class IpRateLimiter {
  constructor(limit, windowMs, maxEntries = 4096) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
    this.entries = new Map();
  }

  allow(key, now = Date.now()) {
    let entry = this.entries.get(key);
    if (!entry || now - entry.startedAt >= this.windowMs) {
      entry = { startedAt: now, count: 0 };
      this.entries.set(key, entry);
    } else {
      this.entries.delete(key);
      this.entries.set(key, entry);
    }

    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined && oldest !== key) this.entries.delete(oldest);
    }

    if (entry.count >= this.limit) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((entry.startedAt + this.windowMs - now) / 1000)),
      };
    }
    entry.count += 1;
    return { allowed: true, retryAfter: 0 };
  }
}

function normalizeAllowedOrigins(value) {
  const values = value === undefined
    ? DEFAULT_ALLOWED_ORIGINS
    : Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',').map((item) => item.trim()).filter(Boolean)
        : null;

  if (!values || values.length === 0) throw new Error('allowedOrigins must contain at least one origin');
  const origins = [];
  for (const valueItem of values) {
    if (typeof valueItem !== 'string' || valueItem === '*' || valueItem.length > 300) {
      throw new Error('allowedOrigins contains an invalid origin');
    }
    let parsed;
    try {
      parsed = new URL(valueItem);
    } catch {
      throw new Error('allowedOrigins contains an invalid origin');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== valueItem || parsed.username || parsed.password) {
      throw new Error('allowedOrigins contains an invalid origin');
    }
    if (!origins.includes(parsed.origin)) origins.push(parsed.origin);
  }
  return new Set(origins);
}

function requestIp(req) {
  return typeof req.socket?.remoteAddress === 'string' && req.socket.remoteAddress.length > 0
    ? req.socket.remoteAddress
    : 'unknown';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalidInput() {
  throw new HttpError(400, 'invalid_input');
}

function requirePlainObject(value) {
  if (!isPlainObject(value)) invalidInput();
  return value;
}

function requireExactKeys(value, keys) {
  const object = requirePlainObject(value);
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((item, index) => item !== expected[index])) invalidInput();
  return object;
}

function stringLength(value) {
  return value.length;
}

function requireString(value, min, max) {
  if (typeof value !== 'string') invalidInput();
  const length = stringLength(value);
  if (length < min || length > max) invalidInput();
  return value;
}

function requireUuid(value) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) invalidInput();
  return value.toLowerCase();
}

function requireClientId(value) {
  return requireUuid(value);
}

function encodeCursor(createdAt, id) {
  return Buffer.from(JSON.stringify({ createdAt, id }), 'utf8').toString('base64url');
}

function decodeCursor(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    invalidInput();
  }
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    invalidInput();
  }
  const object = requireExactKeys(decoded, ['createdAt', 'id']);
  if (!Number.isSafeInteger(object.createdAt) || object.createdAt < 0) invalidInput();
  requireUuid(object.id);
  return { createdAt: object.createdAt, id: object.id.toLowerCase() };
}

function parseCursor(url) {
  if (url.searchParams.getAll('cursor').length > 1) invalidInput();
  for (const key of url.searchParams.keys()) {
    if (key !== 'cursor') invalidInput();
  }
  const raw = url.searchParams.get('cursor');
  return raw === null ? null : decodeCursor(raw);
}

function parsePathId(value) {
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    invalidInput();
  }
  return requireUuid(decoded);
}

function coverDimensions(bytes, kind) {
  if (kind === 'png') {
    if (bytes.length < 24 || bytes.readUInt32BE(12) !== 0x49484452) return null;
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      if (segmentLength < 7) return null;
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    if (marker === 0xda) break;
    offset += segmentLength;
  }
  return null;
}

function validateCoverDataUrl(value) {
  if (typeof value !== 'string') invalidInput();
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match) invalidInput();
  const kind = match[1];
  const encoded = match[2];
  if (encoded.length === 0 || encoded.length % 4 === 1 || /=/.test(encoded.slice(0, -2))) invalidInput();
  let bytes;
  try {
    bytes = Buffer.from(encoded, 'base64');
  } catch {
    invalidInput();
  }
  const canonical = bytes.toString('base64').replace(/=+$/, '');
  if (canonical !== encoded.replace(/=+$/, '') || bytes.length === 0 || bytes.length > COVER_LIMIT) invalidInput();
  const isJpeg = kind === 'jpeg' && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = kind === 'png'
    && bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isJpeg && !isPng) invalidInput();
  const dimensions = coverDimensions(bytes, kind);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 8192 || dimensions.height > 8192 || dimensions.width * dimensions.height > 40_000_000) {
    invalidInput();
  }
  return value;
}

function parseReviewSnapshot(value) {
  if (value === null) return null;
  const review = requireExactKeys(value, [
    'type',
    'title',
    'albumName',
    'songName',
    'artistName',
    'rating',
    'listenedAt',
    'coverDataUrl',
  ]);
  if (!['album', 'song', 'month', 'year'].includes(review.type)) invalidInput();
  const title = requireString(review.title, 1, 300);
  const nullableText = (item) => item === null ? null : requireString(item, 1, 300);
  const rating = review.rating === null ? null : review.rating;
  if (rating !== null && (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0 || rating > 10)) invalidInput();
  const listenedAt = review.listenedAt === null ? null : requireString(review.listenedAt, 1, 40);
  if (listenedAt !== null && !Number.isFinite(Date.parse(listenedAt))) invalidInput();
  const coverDataUrl = review.coverDataUrl === null ? null : validateCoverDataUrl(review.coverDataUrl);
  return {
    type: review.type,
    title,
    albumName: nullableText(review.albumName),
    songName: nullableText(review.songName),
    artistName: nullableText(review.artistName),
    rating,
    listenedAt,
    coverDataUrl,
  };
}

function parseRegisterBody(value) {
  const body = requireExactKeys(value, ['username', 'displayName', 'password']);
  if (typeof body.username !== 'string' || !/^[a-z0-9_]{3,32}$/.test(body.username)) invalidInput();
  return {
    username: body.username,
    displayName: requireString(body.displayName, 1, 40),
    password: requireString(body.password, 12, 128),
  };
}

function parseLoginBody(value) {
  const body = requireExactKeys(value, ['username', 'password']);
  if (typeof body.username !== 'string' || !/^[a-z0-9_]{3,32}$/.test(body.username)) invalidInput();
  return { username: body.username, password: requireString(body.password, 12, 128) };
}

function parsePostBody(value) {
  const body = requireExactKeys(value, ['clientId', 'text', 'review']);
  return {
    clientId: requireClientId(body.clientId),
    text: requireString(body.text, 1, 20_000),
    review: parseReviewSnapshot(body.review),
  };
}

function parseCommentBody(value) {
  const body = requireExactKeys(value, ['clientId', 'text']);
  return { clientId: requireClientId(body.clientId), text: requireString(body.text, 1, 2_000) };
}

function userFromRow(row, prefix = '') {
  return {
    id: row[`${prefix}id`],
    username: row[`${prefix}username`],
    displayName: row[`${prefix}display_name`],
  };
}

function isoTime(value) {
  return new Date(Number(value)).toISOString();
}

function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function derivePassword(password, salt) {
  return scryptAsync(password, salt, PASSWORD_KEY_BYTES, PASSWORD_SCRYPT_OPTIONS);
}

async function hashPassword(password) {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const hash = await derivePassword(password, salt);
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}

async function verifyPassword(user, password) {
  let salt;
  let expected;
  try {
    salt = Buffer.from(user.password_salt, 'base64');
    expected = Buffer.from(user.password_hash, 'base64');
  } catch {
    return false;
  }
  if (salt.length !== PASSWORD_SALT_BYTES || expected.length !== PASSWORD_KEY_BYTES) return false;
  const actual = await derivePassword(password, salt);
  return timingSafeEqual(actual, expected);
}

function createUserResponse(row) {
  return { id: row.id, username: row.username, displayName: row.display_name };
}

function ensureDatabaseDirectory(dbPath) {
  if (dbPath === ':memory:') return;
  if (typeof dbPath !== 'string' || dbPath.length === 0) throw new Error('dbPath is required');
  mkdirSync(dirname(resolve(dbPath)), { recursive: true });
}

function transaction(db, callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = callback();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Preserve the original error.
    }
    throw error;
  }
}

function getUserById(db, id) {
  return db.prepare('SELECT id, username, display_name, password_salt, password_hash FROM users WHERE id = ?').get(id) ?? null;
}

function getUserByUsername(db, username) {
  return db.prepare('SELECT id, username, display_name, password_salt, password_hash FROM users WHERE username = ?').get(username) ?? null;
}

function isFriend(db, userId, friendId) {
  return Boolean(db.prepare('SELECT 1 AS present FROM friendships WHERE user_id = ? AND friend_id = ?').get(userId, friendId));
}

function getPostById(db, id) {
  return db.prepare('SELECT id, author_id, client_id, text, review_json, created_at FROM posts WHERE id = ?').get(id) ?? null;
}

function requireVisiblePost(db, post, userId) {
  if (!post) throw new HttpError(404, 'not_found');
  if (post.author_id !== userId && !isFriend(db, userId, post.author_id)) throw new HttpError(403, 'forbidden');
  return post;
}

function postResponse(db, row, userId) {
  const author = getUserById(db, row.author_id);
  if (!author) throw new HttpError(404, 'not_found');
  const likeCount = db.prepare('SELECT COUNT(*) AS count FROM likes WHERE post_id = ?').get(row.id).count;
  const commentCount = db.prepare('SELECT COUNT(*) AS count FROM comments WHERE post_id = ?').get(row.id).count;
  const likedByMe = Boolean(db.prepare('SELECT 1 AS present FROM likes WHERE post_id = ? AND user_id = ?').get(row.id, userId));
  let review = null;
  if (row.review_json !== null) {
    try {
      review = JSON.parse(row.review_json);
    } catch {
      throw new HttpError(500, 'server_error');
    }
  }
  return {
    id: row.id,
    author: createUserResponse(author),
    text: row.text,
    review,
    createdAt: isoTime(row.created_at),
    likeCount: Number(likeCount),
    likedByMe,
    commentCount: Number(commentCount),
  };
}

function commentResponse(row) {
  return {
    id: row.id,
    postId: row.post_id,
    author: userFromRow(row, 'author_'),
    text: row.text,
    createdAt: isoTime(row.created_at),
  };
}

function friendRequestResponse(row) {
  return {
    id: row.id,
    from: userFromRow(row, 'from_'),
    to: userFromRow(row, 'to_'),
    createdAt: isoTime(row.created_at),
  };
}

function sendJson(res, status, payload, origin, allowedOrigins, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  };
  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(body);
}

function sendNoContent(res, status, origin, allowedOrigins, extraHeaders = {}) {
  const headers = { 'Cache-Control': 'no-store', ...extraHeaders };
  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  res.writeHead(status, headers);
  res.end();
}

async function readJsonBody(req) {
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
    throw new HttpError(415, 'unsupported_content_encoding');
  }
  const contentLength = req.headers['content-length'];
  if (contentLength !== undefined) {
    if (!/^\d+$/.test(contentLength) || Number(contentLength) > JSON_BODY_LIMIT) {
      req.resume();
      throw new HttpError(413, 'body_too_large');
    }
  }
  if (contentLength === '0') return undefined;
  const contentType = typeof req.headers['content-type'] === 'string'
    ? req.headers['content-type'].split(';', 1)[0].trim().toLowerCase()
    : '';
  if (contentType !== 'application/json') throw new HttpError(415, 'unsupported_media_type');

  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > JSON_BODY_LIMIT) {
        req.resume();
        throw new HttpError(413, 'body_too_large');
      }
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'invalid_body');
  }
  if (total === 0) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
  return parsed;
}

function requireRateLimit(req, limiter) {
  const result = limiter.allow(requestIp(req));
  if (!result.allowed) {
    req.resume();
    throw new HttpError(429, 'rate_limited', { 'Retry-After': String(result.retryAfter) });
  }
}

function parseInviteBody(value) {
  const body = requireExactKeys(value, ['inviteCode']);
  return { inviteCode: requireString(body.inviteCode, 8, 128) };
}

function parseDeleteAccountBody(value) {
  const body = requireExactKeys(value, ['password']);
  return { password: requireString(body.password, 12, 128) };
}

function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(hashToken(token), userId, expiresAt, now);
  return { token, expiresAt: isoTime(expiresAt) };
}

function parseRequestUrl(req) {
  try {
    return new URL(req.url ?? '/', 'http://localhost');
  } catch {
    throw new HttpError(400, 'invalid_url');
  }
}

function requestOrigin(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return null;
  if (typeof origin !== 'string' || origin.length === 0) throw new HttpError(403, 'origin_not_allowed');
  return origin;
}

function routeAuthUser(db, req) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ') || !TOKEN_RE.test(authorization.slice(7))) {
    throw new HttpError(401, 'unauthorized');
  }
  const token = authorization.slice(7);
  const row = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.password_salt, u.password_hash, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(hashToken(token));
  if (!row) throw new HttpError(401, 'unauthorized');
  if (Number(row.expires_at) <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    throw new HttpError(401, 'unauthorized');
  }
  return row;
}

function buildFriendRequestQuery(direction) {
  const filter = direction === 'incoming' ? 'fr.to_user_id = ?' : 'fr.from_user_id = ?';
  return `
    SELECT
      fr.id,
      fr.created_at,
      from_user.id AS from_id,
      from_user.username AS from_username,
      from_user.display_name AS from_display_name,
      to_user.id AS to_id,
      to_user.username AS to_username,
      to_user.display_name AS to_display_name
    FROM friend_requests fr
    JOIN users from_user ON from_user.id = fr.from_user_id
    JOIN users to_user ON to_user.id = fr.to_user_id
    WHERE ${filter}
    ORDER BY fr.created_at ASC, fr.id ASC
  `;
}

async function handleRequest(req, res, context) {
  const { db, allowedOrigins, authLimiter, writeLimiter } = context;
  const origin = requestOrigin(req);
  if (origin && !allowedOrigins.has(origin)) {
    throw new HttpError(403, 'origin_not_allowed');
  }
  if (req.method === 'OPTIONS') {
    if (!origin) return sendNoContent(res, 204, null, allowedOrigins);
    return sendNoContent(res, 204, origin, allowedOrigins, {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '600',
    });
  }

  const url = parseRequestUrl(req);
  const pathname = url.pathname;
  const method = req.method ?? 'GET';
  if (method === 'POST' && (pathname === '/v1/auth/register' || pathname === '/v1/auth/login')) {
    requireRateLimit(req, authLimiter);
  } else if (method === 'DELETE' && pathname === '/v1/me') {
    requireRateLimit(req, authLimiter);
    requireRateLimit(req, writeLimiter);
  } else if (pathname.startsWith('/v1/') && ['POST', 'PUT', 'DELETE'].includes(method)) {
    requireRateLimit(req, writeLimiter);
  }

  if (method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, { status: 'ok' }, origin, allowedOrigins);
  }

  if (method === 'POST' && pathname === '/v1/auth/register') {
    const body = parseRegisterBody(await readJsonBody(req));
    const existing = getUserByUsername(db, body.username);
    if (existing) throw new HttpError(409, 'username_taken');
    const credentials = await hashPassword(body.password);
    const user = { id: randomUUID(), username: body.username, display_name: body.displayName };
    let session;
    try {
      session = transaction(db, () => {
        db.prepare(`
          INSERT INTO users(id, username, display_name, password_salt, password_hash, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(user.id, user.username, user.display_name, credentials.salt, credentials.hash, Date.now());
        return createSession(db, user.id);
      });
    } catch (error) {
      if (String(error?.message ?? '').includes('UNIQUE constraint failed: users.username')) throw new HttpError(409, 'username_taken');
      throw error;
    }
    return sendJson(res, 201, {
      token: session.token,
      expiresAt: session.expiresAt,
      user: createUserResponse(user),
    }, origin, allowedOrigins);
  }

  if (method === 'POST' && pathname === '/v1/auth/login') {
    const body = parseLoginBody(await readJsonBody(req));
    const userBeforeHash = getUserByUsername(db, body.username);
    const valid = userBeforeHash
      ? await verifyPassword(userBeforeHash, body.password)
      : await derivePassword(body.password, Buffer.alloc(PASSWORD_SALT_BYTES, 0x5a)).then(() => false);
    const userAfterHash = getUserByUsername(db, body.username);
    if (!valid || !userBeforeHash || !userAfterHash || userAfterHash.id !== userBeforeHash.id) throw new HttpError(401, 'invalid_credentials');
    const user = userAfterHash;
    const session = createSession(db, user.id);
    return sendJson(res, 200, {
      token: session.token,
      expiresAt: session.expiresAt,
      user: createUserResponse(user),
    }, origin, allowedOrigins);
  }

  if (method === 'GET' && pathname === '/v1/me') {
    const user = routeAuthUser(db, req);
    return sendJson(res, 200, { user: createUserResponse(user) }, origin, allowedOrigins);
  }

  if (method === 'POST' && pathname === '/v1/auth/logout') {
    routeAuthUser(db, req);
    requireExactKeys(await readJsonBody(req), []);
    const currentUser = routeAuthUser(db, req);
    const authorization = req.headers.authorization;
    db.prepare('DELETE FROM sessions WHERE token_hash = ? AND user_id = ?').run(hashToken(authorization.slice(7)), currentUser.id);
    return sendJson(res, 200, { ok: true }, origin, allowedOrigins);
  }

  if (method === 'DELETE' && pathname === '/v1/me') {
    routeAuthUser(db, req);
    const body = parseDeleteAccountBody(await readJsonBody(req));
    let user = routeAuthUser(db, req);
    const passwordValid = await verifyPassword(user, body.password);
    const currentUser = routeAuthUser(db, req);
    if (!passwordValid) throw new HttpError(403, 'wrong_password');
    user = currentUser;
    transaction(db, () => {
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    });
    return sendJson(res, 200, { ok: true }, origin, allowedOrigins);
  }

  if (method === 'POST' && pathname === '/v1/invites') {
    routeAuthUser(db, req);
    requireExactKeys(await readJsonBody(req), []);
    const user = routeAuthUser(db, req);
    const code = randomBytes(18).toString('base64url');
    const expiresAt = Date.now() + INVITE_TTL_MS;
    db.prepare('INSERT INTO invites(code_hash, inviter_id, expires_at) VALUES (?, ?, ?)').run(hashToken(code), user.id, expiresAt);
    return sendJson(res, 201, { code, expiresAt: isoTime(expiresAt) }, origin, allowedOrigins);
  }

  if (method === 'GET' && pathname === '/v1/friends') {
    const user = routeAuthUser(db, req);
    for (const key of url.searchParams.keys()) invalidInput();
    const friends = db.prepare(`
      SELECT u.id, u.username, u.display_name
      FROM friendships f JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ?
      ORDER BY u.username ASC, u.id ASC
    `).all(user.id).map((row) => createUserResponse(row));
    const incoming = db.prepare(buildFriendRequestQuery('incoming')).all(user.id).map(friendRequestResponse);
    const outgoing = db.prepare(buildFriendRequestQuery('outgoing')).all(user.id).map(friendRequestResponse);
    return sendJson(res, 200, { friends, incoming, outgoing }, origin, allowedOrigins);
  }

  if (method === 'POST' && pathname === '/v1/friend-requests') {
    routeAuthUser(db, req);
    const body = parseInviteBody(await readJsonBody(req));
    const user = routeAuthUser(db, req);
    const inviteHash = hashToken(body.inviteCode);
    const createdAt = Date.now();
    transaction(db, () => {
      const invite = db.prepare('SELECT code_hash, inviter_id, expires_at, used_at FROM invites WHERE code_hash = ?').get(inviteHash);
      if (!invite || invite.used_at !== null || Number(invite.expires_at) <= createdAt) throw new HttpError(400, 'invalid_invite');
      if (invite.inviter_id === user.id) throw new HttpError(400, 'invalid_invite');
      if (isFriend(db, user.id, invite.inviter_id)) throw new HttpError(409, 'already_friends');
      const pending = db.prepare(`
        SELECT id FROM friend_requests
        WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
      `).get(user.id, invite.inviter_id, invite.inviter_id, user.id);
      if (pending) throw new HttpError(409, 'request_exists');
      const update = db.prepare('UPDATE invites SET used_at = ? WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?').run(createdAt, inviteHash, createdAt);
      if (update.changes !== 1) throw new HttpError(400, 'invalid_invite');
      db.prepare('INSERT INTO friend_requests(id, from_user_id, to_user_id, created_at) VALUES (?, ?, ?, ?)').run(randomUUID(), user.id, invite.inviter_id, createdAt);
    });
    return sendJson(res, 201, { ok: true }, origin, allowedOrigins);
  }

  const acceptMatch = /^\/v1\/friend-requests\/([^/]+)\/accept$/.exec(pathname);
  if (method === 'POST' && acceptMatch) {
    routeAuthUser(db, req);
    const requestId = parsePathId(acceptMatch[1]);
    requireExactKeys(await readJsonBody(req), []);
    const user = routeAuthUser(db, req);
    transaction(db, () => {
      const request = db.prepare('SELECT id, from_user_id, to_user_id FROM friend_requests WHERE id = ?').get(requestId);
      if (!request) throw new HttpError(404, 'not_found');
      if (request.to_user_id !== user.id) throw new HttpError(403, 'forbidden');
      const now = Date.now();
      db.prepare('INSERT OR IGNORE INTO friendships(user_id, friend_id, created_at) VALUES (?, ?, ?)').run(user.id, request.from_user_id, now);
      db.prepare('INSERT OR IGNORE INTO friendships(user_id, friend_id, created_at) VALUES (?, ?, ?)').run(request.from_user_id, user.id, now);
      db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
    });
    return sendJson(res, 200, { ok: true }, origin, allowedOrigins);
  }

  const friendRequestMatch = /^\/v1\/friend-requests\/([^/]+)$/.exec(pathname);
  if (method === 'DELETE' && friendRequestMatch) {
    const user = routeAuthUser(db, req);
    const requestId = parsePathId(friendRequestMatch[1]);
    const request = db.prepare('SELECT id, from_user_id, to_user_id FROM friend_requests WHERE id = ?').get(requestId);
    if (!request) throw new HttpError(404, 'not_found');
    if (request.from_user_id !== user.id && request.to_user_id !== user.id) throw new HttpError(403, 'forbidden');
    db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
    return sendJson(res, 200, { ok: true }, origin, allowedOrigins);
  }

  const friendMatch = /^\/v1\/friends\/([^/]+)$/.exec(pathname);
  if (method === 'DELETE' && friendMatch) {
    const user = routeAuthUser(db, req);
    const friendId = parsePathId(friendMatch[1]);
    if (friendId === user.id) throw new HttpError(400, 'invalid_input');
    if (!isFriend(db, user.id, friendId)) throw new HttpError(404, 'not_found');
    transaction(db, () => {
      db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(user.id, friendId, friendId, user.id);
      db.prepare('DELETE FROM friend_requests WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)').run(user.id, friendId, friendId, user.id);
    });
    return sendJson(res, 200, { ok: true }, origin, allowedOrigins);
  }

  if (method === 'GET' && pathname === '/v1/feed') {
    const user = routeAuthUser(db, req);
    const cursor = parseCursor(url);
    const args = [user.id, user.id];
    let condition = '';
    if (cursor) {
      condition = ' AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))';
      args.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }
    args.push(PAGE_SIZE + 1);
    const rows = db.prepare(`
      SELECT p.id, p.author_id, p.client_id, p.text, p.review_json, p.created_at
      FROM posts p
      WHERE (p.author_id = ? OR EXISTS (
        SELECT 1 FROM friendships f WHERE f.user_id = ? AND f.friend_id = p.author_id
      ))${condition}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ?
    `).all(...args);
    const hasNext = rows.length > PAGE_SIZE;
    const page = hasNext ? rows.slice(0, PAGE_SIZE) : rows;
    const posts = page.map((row) => postResponse(db, row, user.id));
    const nextCursor = hasNext ? encodeCursor(page.at(-1).created_at, page.at(-1).id) : null;
    return sendJson(res, 200, { posts, nextCursor }, origin, allowedOrigins);
  }

  if (method === 'POST' && pathname === '/v1/posts') {
    routeAuthUser(db, req);
    const body = parsePostBody(await readJsonBody(req));
    const user = routeAuthUser(db, req);
    const reviewJson = body.review === null ? null : JSON.stringify(body.review);
    const createdAt = Date.now();
    let row;
    try {
      row = transaction(db, () => {
        const existing = db.prepare('SELECT id, author_id, client_id, text, review_json, created_at FROM posts WHERE author_id = ? AND client_id = ?').get(user.id, body.clientId);
        if (existing) return existing;
        const id = randomUUID();
        db.prepare('INSERT INTO posts(id, author_id, client_id, text, review_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, user.id, body.clientId, body.text, reviewJson, createdAt);
        return getPostById(db, id);
      });
    } catch (error) {
      if (String(error?.message ?? '').includes('UNIQUE constraint failed: posts.author_id, posts.client_id')) {
        row = getPostById(db, db.prepare('SELECT id FROM posts WHERE author_id = ? AND client_id = ?').get(user.id, body.clientId).id);
      } else {
        throw error;
      }
    }
    return sendJson(res, 201, { post: postResponse(db, row, user.id) }, origin, allowedOrigins);
  }

  const postMatch = /^\/v1\/posts\/([^/]+)$/.exec(pathname);
  const postLikeMatch = /^\/v1\/posts\/([^/]+)\/like$/.exec(pathname);
  const postCommentsMatch = /^\/v1\/posts\/([^/]+)\/comments$/.exec(pathname);
  if ((method === 'GET' || method === 'DELETE') && postMatch) {
    const user = routeAuthUser(db, req);
    const postId = parsePathId(postMatch[1]);
    const post = requireVisiblePost(db, getPostById(db, postId), user.id);
    if (method === 'GET') return sendJson(res, 200, { post: postResponse(db, post, user.id) }, origin, allowedOrigins);
    if (post.author_id !== user.id) throw new HttpError(403, 'forbidden');
    db.prepare('DELETE FROM posts WHERE id = ? AND author_id = ?').run(postId, user.id);
    return sendJson(res, 200, { ok: true }, origin, allowedOrigins);
  }

  if ((method === 'PUT' || method === 'DELETE') && postLikeMatch) {
    routeAuthUser(db, req);
    const postId = parsePathId(postLikeMatch[1]);
    if (method === 'PUT') {
      const body = await readJsonBody(req);
      if (body !== undefined) requireExactKeys(body, []);
      const user = routeAuthUser(db, req);
      transaction(db, () => {
        const post = requireVisiblePost(db, getPostById(db, postId), user.id);
        db.prepare('INSERT OR IGNORE INTO likes(post_id, user_id, created_at) VALUES (?, ?, ?)').run(post.id, user.id, Date.now());
      });
    } else {
      const user = routeAuthUser(db, req);
      const post = requireVisiblePost(db, getPostById(db, postId), user.id);
      db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(post.id, user.id);
    }
    return sendJson(res, 200, { ok: true }, origin, allowedOrigins);
  }

  if (method === 'GET' && postCommentsMatch) {
    const user = routeAuthUser(db, req);
    const postId = parsePathId(postCommentsMatch[1]);
    requireVisiblePost(db, getPostById(db, postId), user.id);
    const cursor = parseCursor(url);
    const args = [postId];
    let condition = '';
    if (cursor) {
      condition = ' AND (c.created_at < ? OR (c.created_at = ? AND c.id < ?))';
      args.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }
    args.push(PAGE_SIZE + 1);
    const rows = db.prepare(`
      SELECT c.id, c.post_id, c.text, c.created_at,
        u.id AS author_id, u.username AS author_username, u.display_name AS author_display_name
      FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.post_id = ?${condition}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT ?
    `).all(...args);
    const hasNext = rows.length > PAGE_SIZE;
    const page = hasNext ? rows.slice(0, PAGE_SIZE) : rows;
    const comments = page.map(commentResponse);
    const nextCursor = hasNext ? encodeCursor(page.at(-1).created_at, page.at(-1).id) : null;
    return sendJson(res, 200, { comments, nextCursor }, origin, allowedOrigins);
  }

  if (method === 'POST' && postCommentsMatch) {
    routeAuthUser(db, req);
    const postId = parsePathId(postCommentsMatch[1]);
    const body = parseCommentBody(await readJsonBody(req));
    const user = routeAuthUser(db, req);
    const createdAt = Date.now();
    let row;
    try {
      row = transaction(db, () => {
        const post = requireVisiblePost(db, getPostById(db, postId), user.id);
        const existing = db.prepare(`
          SELECT c.id, c.post_id, c.text, c.created_at,
            u.id AS author_id, u.username AS author_username, u.display_name AS author_display_name
          FROM comments c JOIN users u ON u.id = c.author_id
          WHERE c.post_id = ? AND c.author_id = ? AND c.client_id = ?
        `).get(post.id, user.id, body.clientId);
        if (existing) return existing;
        const id = randomUUID();
        db.prepare('INSERT INTO comments(id, post_id, author_id, client_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, post.id, user.id, body.clientId, body.text, createdAt);
        return db.prepare(`
          SELECT c.id, c.post_id, c.text, c.created_at,
            u.id AS author_id, u.username AS author_username, u.display_name AS author_display_name
          FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?
        `).get(id);
      });
    } catch (error) {
      if (String(error?.message ?? '').includes('UNIQUE constraint failed: comments.post_id, comments.author_id, comments.client_id')) {
        row = db.prepare(`
          SELECT c.id, c.post_id, c.text, c.created_at,
            u.id AS author_id, u.username AS author_username, u.display_name AS author_display_name
          FROM comments c JOIN users u ON u.id = c.author_id
          WHERE c.post_id = ? AND c.author_id = ? AND c.client_id = ?
        `).get(postId, user.id, body.clientId);
      } else {
        throw error;
      }
    }
    return sendJson(res, 201, { comment: commentResponse(row) }, origin, allowedOrigins);
  }

  const commentMatch = /^\/v1\/comments\/([^/]+)$/.exec(pathname);
  if (method === 'DELETE' && commentMatch) {
    const user = routeAuthUser(db, req);
    const commentId = parsePathId(commentMatch[1]);
    const row = db.prepare(`
      SELECT c.id, c.post_id, c.author_id, p.author_id AS post_author_id
      FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ?
    `).get(commentId);
    if (!row) throw new HttpError(404, 'not_found');
    requireVisiblePost(db, getPostById(db, row.post_id), user.id);
    if (row.author_id !== user.id && row.post_author_id !== user.id) throw new HttpError(403, 'forbidden');
    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    return sendJson(res, 200, { ok: true }, origin, allowedOrigins);
  }

  throw new HttpError(404, 'not_found');
}

export function createSocialServer({ dbPath, allowedOrigins } = {}) {
  ensureDatabaseDirectory(dbPath);
  const origins = normalizeAllowedOrigins(allowedOrigins);
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  const authLimiter = new IpRateLimiter(30, 15 * 60 * 1000);
  const writeLimiter = new IpRateLimiter(180, 60 * 1000);
  const context = { db, allowedOrigins: origins, authLimiter, writeLimiter };
  const server = createServer((req, res) => {
    handleRequest(req, res, context).catch((error) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.error }, (() => {
          const origin = req.headers.origin;
          return typeof origin === 'string' && origins.has(origin) ? origin : null;
        })(), origins, error.headers);
        return;
      }
      const origin = req.headers.origin;
      const responseOrigin = typeof origin === 'string' && origins.has(origin) ? origin : null;
      sendJson(res, 500, { error: 'server_error' }, responseOrigin, origins);
    });
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.on('clientError', (_error, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    if (server.listening) {
      await new Promise((resolveClose) => server.close(() => resolveClose()));
    }
    db.close();
  };
  return { server, close };
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  try {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

function parsePort(value) {
  if (value === undefined || value === '') return 8787;
  if (!/^\d+$/.test(value)) throw new Error('CODEX_SOCIAL_PORT must be a number');
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('CODEX_SOCIAL_PORT is out of range');
  return port;
}

if (isDirectExecution()) {
  const host = process.env.CODEX_SOCIAL_HOST || '127.0.0.1';
  const port = parsePort(process.env.CODEX_SOCIAL_PORT);
  const dbPath = process.env.CODEX_SOCIAL_DB || resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'social.sqlite');
  const allowedOrigins = process.env.CODEX_SOCIAL_ORIGINS === undefined
    ? undefined
    : process.env.CODEX_SOCIAL_ORIGINS;
  const social = createSocialServer({ dbPath, allowedOrigins });
  const shutdown = () => {
    social.close().finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  social.server.listen(port, host, () => {
    const address = social.server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`codex social server listening on ${host}:${actualPort}`);
  });
}
