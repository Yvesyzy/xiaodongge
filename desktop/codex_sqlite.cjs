const { DatabaseSync, constants } = require('node:sqlite');
const { mkdirSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const MAIN_DATABASE = 'music_feelings_archive';
const PREVIEW_DATABASE = /^codex_restore_preview_[0-9a-f]{32}$/;

class CodexSQLite {
  constructor(directory) {
    mkdirSync(directory, { recursive: true });
    this.directory = directory;
    this.connections = new Map();
  }

  name(options) {
    const name = options?.database;
    if (name !== MAIN_DATABASE && !(typeof name === 'string' && PREVIEW_DATABASE.test(name))) {
      throw new Error('数据库名称无效');
    }
    if (options.readonly === true) throw new Error('当前档案接口不创建只读连接');
    return name;
  }

  connection(options, opened = true) {
    const connection = this.connections.get(this.name(options));
    if (!connection || (opened && !connection.db)) throw new Error('数据库尚未打开');
    return connection;
  }

  createConnection(options) {
    const name = this.name(options);
    if (options.encrypted || options.mode !== 'no-encryption' || options.version !== 1) {
      throw new Error('此版本仅支持现有的本地未加密档案');
    }
    // A renderer reload resets SQLiteConnection's JS registry; the main process still owns this validated connection.
    if (this.connections.has(name)) return;
    this.connections.set(name, { db: null });
  }

  open(options) {
    const name = this.name(options);
    const connection = this.connection(options, false);
    if (connection.db) return;
    const db = new DatabaseSync(name === MAIN_DATABASE ? join(this.directory, `${name}.sqlite`) : ':memory:', {
      enableForeignKeyConstraints: true,
      allowExtension: false,
    });
    try {
      db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
      if (name === MAIN_DATABASE) db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
      db.setAuthorizer((action, first, second) => {
        if (action === constants.SQLITE_ATTACH || action === constants.SQLITE_DETACH) return constants.SQLITE_DENY;
        if (action === constants.SQLITE_FUNCTION && ['load_extension', 'readfile', 'writefile'].includes(second?.toLowerCase())) {
          return constants.SQLITE_DENY;
        }
        if (action === constants.SQLITE_PRAGMA && !(first === 'table_info'
          || ['foreign_keys', 'quick_check', 'integrity_check'].includes(first) && second === null)) {
          return constants.SQLITE_DENY;
        }
        return constants.SQLITE_OK;
      });
      connection.db = db;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  close(options) {
    const connection = this.connection(options, false);
    if (connection.db) {
      if (connection.db.isTransaction) connection.db.exec('ROLLBACK');
      connection.db.close();
      connection.db = null;
    }
  }

  closeConnection(options) {
    const name = this.name(options);
    this.close(options);
    this.connections.delete(name);
  }

  isDBOpen(options) { return { result: !!this.connections.get(this.name(options))?.db }; }

  isDatabase(options) {
    const name = this.name(options);
    return { result: name === MAIN_DATABASE
      ? existsSync(join(this.directory, `${name}.sqlite`))
      : this.connections.has(name) };
  }

  sql(value) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('SQL 语句不能为空');
    return value;
  }

  values(values = []) {
    if (!Array.isArray(values) || values.some(value => !(value === null || typeof value === 'string'
      || typeof value === 'number' && Number.isFinite(value)))) throw new Error('SQL 参数无效');
    return values;
  }

  transaction(db, enabled, work) {
    const ownsTransaction = enabled !== false && !db.isTransaction;
    if (ownsTransaction) db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      if (ownsTransaction) db.exec('COMMIT');
      return result;
    } catch (error) {
      if (ownsTransaction && db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
  }

  execute(options) {
    const db = this.connection(options).db;
    const statements = this.sql(options.statements);
    return this.transaction(db, options.transaction, () => {
      const before = db.prepare('SELECT total_changes() AS count').get().count;
      db.exec(statements);
      return { changes: { changes: db.prepare('SELECT total_changes() AS count').get().count - before } };
    });
  }

  run(options) {
    const db = this.connection(options).db;
    const statement = this.sql(options.statement);
    const values = this.values(options.values);
    return this.transaction(db, options.transaction, () => {
      const result = db.prepare(statement).run(...values);
      return { changes: { changes: Number(result.changes), lastId: Number(result.lastInsertRowid) } };
    });
  }

  executeSet(options) {
    const db = this.connection(options).db;
    if (!Array.isArray(options.set)) throw new Error('SQL 批处理参数无效');
    const set = options.set.map(item => ({ statement: this.sql(item?.statement), values: this.values(item?.values) }));
    return this.transaction(db, options.transaction, () => {
      let changes = 0;
      let lastId = 0;
      for (const item of set) {
        const result = db.prepare(item.statement).run(...item.values);
        changes += Number(result.changes);
        lastId = Number(result.lastInsertRowid);
      }
      return { changes: { changes, lastId } };
    });
  }

  query(options) {
    const db = this.connection(options).db;
    return { values: db.prepare(this.sql(options.statement)).all(...this.values(options.values)).map(row => ({ ...row })) };
  }

  beginTransaction(options) { this.connection(options).db.exec('BEGIN IMMEDIATE'); return { changes: { changes: 0 } }; }
  commitTransaction(options) { this.connection(options).db.exec('COMMIT'); return { changes: { changes: 0 } }; }
  rollbackTransaction(options) { this.connection(options).db.exec('ROLLBACK'); return { changes: { changes: 0 } }; }
  isTransactionActive(options) { return { result: this.connection(options).db.isTransaction }; }

  dispose() {
    for (const database of [...this.connections.keys()]) this.closeConnection({ database });
  }
}

module.exports = { CodexSQLite, MAIN_DATABASE };
