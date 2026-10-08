const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { CodexSQLite, MAIN_DATABASE } = require('./codex_sqlite.cjs');

function open(bridge, database = MAIN_DATABASE) {
  const options = { database, encrypted: false, mode: 'no-encryption', version: 1, readonly: false };
  bridge.createConnection(options);
  bridge.open(options);
  return options;
}

test('绑定文本、文件持久化和重开连接', () => {
  const directory = mkdtempSync(join(tmpdir(), 'codex-windows-sqlite-'));
  const bridge = new CodexSQLite(directory);
  const options = open(bridge);
  bridge.execute({ ...options, statements: 'CREATE TABLE ReviewEntry(id TEXT PRIMARY KEY, content TEXT NOT NULL)' });
  const content = "引号 ' 与 SQL ; DROP TABLE ReviewEntry; 中文 🎵";
  bridge.run({ ...options, statement: 'INSERT INTO ReviewEntry VALUES (?, ?)', values: ['one', content] });
  bridge.closeConnection(options);
  open(bridge);
  assert.deepEqual(bridge.query({ ...options, statement: 'SELECT * FROM ReviewEntry' }).values, [{ id: 'one', content }]);
  bridge.dispose();
});

test('批量恢复遇到约束失败会完整回滚，外键删除同步', () => {
  const bridge = new CodexSQLite(mkdtempSync(join(tmpdir(), 'codex-windows-sqlite-')));
  const options = open(bridge);
  bridge.execute({ ...options, statements: 'CREATE TABLE ReviewEntry(id TEXT PRIMARY KEY); CREATE TABLE ListeningMoment(id TEXT PRIMARY KEY, entryId TEXT REFERENCES ReviewEntry(id) ON DELETE CASCADE)' });
  bridge.executeSet({ ...options, set: [
    { statement: 'INSERT INTO ReviewEntry VALUES (?)', values: ['before'] },
    { statement: 'INSERT INTO ListeningMoment VALUES (?, ?)', values: ['moment', 'before'] },
  ] });
  assert.throws(() => bridge.executeSet({ ...options, set: [
    { statement: 'DELETE FROM ReviewEntry', values: [] },
    { statement: 'INSERT INTO ReviewEntry VALUES (?)', values: ['after'] },
    { statement: 'INSERT INTO ListeningMoment VALUES (?, ?)', values: ['bad', 'missing'] },
  ] }), /FOREIGN KEY/);
  assert.deepEqual(bridge.query({ ...options, statement: 'SELECT * FROM ReviewEntry' }).values, [{ id: 'before' }]);
  assert.equal(bridge.query({ ...options, statement: 'SELECT * FROM ListeningMoment' }).values.length, 1);
  bridge.run({ ...options, statement: 'DELETE FROM ReviewEntry WHERE id = ?', values: ['before'] });
  assert.equal(bridge.query({ ...options, statement: 'SELECT * FROM ListeningMoment' }).values.length, 0);
  assert.equal(bridge.isTransactionActive(options).result, false);
  bridge.dispose();
});

test('页面重载重新登记同一连接保留正式数据，仍拒绝不支持的连接参数', () => {
  const bridge = new CodexSQLite(mkdtempSync(join(tmpdir(), 'codex-windows-sqlite-')));
  const options = open(bridge);
  bridge.execute({ ...options, statements: 'CREATE TABLE ReviewEntry(id TEXT PRIMARY KEY, content TEXT)' });
  bridge.run({ ...options, statement: 'INSERT INTO ReviewEntry VALUES (?, ?)', values: ['before-reload', '原文 🎵'] });
  open(bridge);
  assert.deepEqual(bridge.query({ ...options, statement: 'SELECT * FROM ReviewEntry' }).values, [{ id: 'before-reload', content: '原文 🎵' }]);
  assert.throws(() => bridge.createConnection({ ...options, encrypted: true }), /仅支持/);
  assert.throws(() => bridge.createConnection({ ...options, readonly: true }), /不创建只读连接/);
  bridge.dispose();
});

test('显式事务与关窗回滚保持一致', () => {
  const bridge = new CodexSQLite(mkdtempSync(join(tmpdir(), 'codex-windows-sqlite-')));
  const options = open(bridge);
  bridge.execute({ ...options, statements: 'CREATE TABLE t(id TEXT)' });
  bridge.beginTransaction(options);
  bridge.run({ ...options, statement: 'INSERT INTO t VALUES (?)', values: ['uncommitted'] });
  assert.equal(bridge.isTransactionActive(options).result, true);
  bridge.close(options);
  bridge.open(options);
  assert.deepEqual(bridge.query({ ...options, statement: 'SELECT * FROM t' }).values, []);
  bridge.dispose();
});

test('恢复预演使用隔离内存库，关闭后不留下数据库文件', () => {
  const directory = mkdtempSync(join(tmpdir(), 'codex-windows-sqlite-'));
  const bridge = new CodexSQLite(directory);
  const main = open(bridge);
  bridge.execute({ ...main, statements: 'CREATE TABLE t(id TEXT)' });
  bridge.run({ ...main, statement: 'INSERT INTO t VALUES (?)', values: ['original'] });
  const database = 'codex_restore_preview_0123456789abcdef0123456789abcdef';
  assert.equal(bridge.isDatabase({ database }).result, false);
  const preview = open(bridge, database);
  bridge.execute({ ...preview, statements: 'CREATE TABLE t(id TEXT)' });
  bridge.run({ ...preview, statement: 'INSERT INTO t VALUES (?)', values: ['preview'] });
  assert.deepEqual(bridge.query({ ...main, statement: 'SELECT * FROM t' }).values, [{ id: 'original' }]);
  bridge.closeConnection(preview);
  assert.equal(bridge.isDatabase({ database }).result, false);
  assert.equal(readdirSync(directory).some(name => name.includes('preview')), false);
  bridge.dispose();
});

test('路径、跨数据库访问、外键关闭和错误参数被拒绝', () => {
  const bridge = new CodexSQLite(mkdtempSync(join(tmpdir(), 'codex-windows-sqlite-')));
  assert.throws(() => bridge.createConnection({ database: '../outside' }), /名称无效/);
  const options = open(bridge);
  assert.throws(() => bridge.execute({ ...options, statements: "ATTACH DATABASE ':memory:' AS other" }), /authorized/);
  assert.throws(() => bridge.execute({ ...options, statements: 'PRAGMA foreign_keys = OFF' }), /authorized/);
  assert.throws(() => bridge.query({ ...options, statement: 'SELECT ?', values: [Infinity] }), /参数无效/);
  assert.equal(bridge.query({ ...options, statement: 'PRAGMA foreign_keys' }).values[0].foreign_keys, 1);
  assert.equal(bridge.query({ ...options, statement: 'PRAGMA quick_check' }).values[0].quick_check, 'ok');
  bridge.dispose();
});
