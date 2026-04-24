// =========================================================================
// levelx-server · auth.js (v0.25.0)
//
// Accounts, password hashing, session tokens, per-account save blobs.
// All state persists in a SQLite database so restarts don't wipe progress.
//
// Design notes
//   * Password hashing uses Node's stdlib `crypto.scrypt` (OWASP-approved
//     KDF, no external dep). Each account gets a 16-byte random salt.
//   * Session tokens are STATELESS — HMAC-signed JSON payloads
//     (`<base64url(body)>.<base64url(sig)>`). Verifying only needs the
//     server's SECRET, no DB lookup. Revocation is intentionally not
//     supported in this iteration (tokens just expire after 30 days).
//   * OAuth columns exist on the accounts table so a Google/Discord
//     flow can drop in later without a schema change.
//   * Per-account save blob is a single JSON column (we're a small game,
//     not a relational beast — keep it simple).
// =========================================================================

const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');
// Use Node 22+'s built-in SQLite — no native compile, zero extra deps.
// API shape mirrors better-sqlite3 for the subset we use (exec/prepare/run/get).
const { DatabaseSync } = require('node:sqlite');

// --- Config --------------------------------------------------------------

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'levelx.db');
const SESSION_TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS || '30', 10);

// SECRET controls HMAC signing. MUST be set in production — if absent we
// generate an ephemeral one at boot and warn loudly. Ephemeral = every
// restart invalidates all outstanding tokens.
const SECRET = (() => {
  if (process.env.SECRET && process.env.SECRET.length >= 16) return process.env.SECRET;
  if (process.env.NODE_ENV === 'production') {
    console.error('[auth] FATAL: SECRET env var not set (or too short) in production');
    process.exit(1);
  }
  const ephemeral = crypto.randomBytes(32).toString('hex');
  console.warn('[auth] SECRET not set — generated ephemeral secret (sessions invalidate on restart)');
  return ephemeral;
})();

// Ensure data directory exists BEFORE opening the DB
try { fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); } catch (e) {}

// --- DB init -------------------------------------------------------------

const db = new DatabaseSync(DB_PATH);
// node:sqlite uses raw SQL for pragmas (no .pragma() helper)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous  = NORMAL;
  PRAGMA foreign_keys = ON;
`);

db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email          TEXT UNIQUE COLLATE NOCASE,
  password_hash  BLOB,
  password_salt  BLOB,
  created_at     INTEGER NOT NULL,
  last_login_at  INTEGER,
  oauth_provider TEXT,
  oauth_subject  TEXT,
  UNIQUE (oauth_provider, oauth_subject)
);

CREATE TABLE IF NOT EXISTS saves (
  account_id INTEGER PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_accounts_created
  ON accounts(created_at DESC);
`);

// --- Password hashing ----------------------------------------------------

const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, SCRYPT_KEYLEN = 64;

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
  if (!storedHash || !storedSalt) return false;
  try {
    const { hash } = hashPassword(password, Buffer.from(storedSalt));
    const stored = Buffer.from(storedHash);
    if (hash.length !== stored.length) return false;
    return crypto.timingSafeEqual(hash, stored);
  } catch (e) { return false; }
}

// --- Session tokens (HMAC-signed stateless) ------------------------------

function createToken(accountId) {
  const payload = {
    uid:   accountId,
    iat:   Date.now(),
    exp:   Date.now() + SESSION_TTL_DAYS * 86400_000,
    nonce: crypto.randomBytes(8).toString('base64url'),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.indexOf('.');
  const body = token.slice(0, dot);
  const sig  = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  let sigBuf, expBuf;
  try {
    sigBuf = Buffer.from(sig, 'base64url');
    expBuf = Buffer.from(expected, 'base64url');
  } catch (e) { return null; }
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch (e) { return null; }
  if (!payload || typeof payload.uid !== 'number') return null;
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

// --- Input validation ----------------------------------------------------

function validateUsername(u) {
  if (typeof u !== 'string') return 'Username required';
  if (u.length < 3)  return 'Username too short (min 3)';
  if (u.length > 20) return 'Username too long (max 20)';
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Username: letters, digits, underscore only';
  return null;
}
function validatePassword(p) {
  if (typeof p !== 'string') return 'Password required';
  if (p.length < 8)   return 'Password too short (min 8)';
  if (p.length > 200) return 'Password too long';
  return null;
}
function validateEmail(e) {
  if (e == null || e === '') return null;      // email is optional
  if (typeof e !== 'string') return 'Email invalid';
  if (e.length > 100) return 'Email too long';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return 'Email format invalid';
  return null;
}

// --- Account CRUD --------------------------------------------------------

function createAccount({ username, password, email }) {
  const err = validateUsername(username) || validatePassword(password) || validateEmail(email);
  if (err) { const e = new Error(err); e.code = 'VALIDATION'; throw e; }
  const { hash, salt } = hashPassword(password);
  const now = Date.now();
  try {
    const info = db.prepare(`
      INSERT INTO accounts (username, email, password_hash, password_salt, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, email || null, hash, salt, now);
    return {
      id: info.lastInsertRowid,
      username,
      email: email || null,
      createdAt: now,
    };
  } catch (e) {
    // better-sqlite3 puts the SQLite code in e.code; node:sqlite puts it
    // in e.message. Check both.
    if (/CONSTRAINT_UNIQUE/i.test(String(e.code || '')) ||
        /UNIQUE constraint failed/i.test(String(e.message || ''))) {
      const u = new Error('Username or email already registered');
      u.code = 'DUPLICATE';
      throw u;
    }
    throw e;
  }
}

function authenticate({ username, password }) {
  if (validateUsername(username) || validatePassword(password)) {
    const e = new Error('Invalid credentials'); e.code = 'AUTH'; throw e;
  }
  const row = db.prepare(`
    SELECT id, password_hash, password_salt FROM accounts WHERE username = ?
  `).get(username);
  if (!row || !verifyPassword(password, row.password_hash, row.password_salt)) {
    const e = new Error('Invalid credentials'); e.code = 'AUTH'; throw e;
  }
  db.prepare(`UPDATE accounts SET last_login_at = ? WHERE id = ?`).run(Date.now(), row.id);
  return row.id;
}

function getAccount(id) {
  const row = db.prepare(`
    SELECT id, username, email,
           created_at    AS createdAt,
           last_login_at AS lastLoginAt,
           oauth_provider AS oauthProvider
      FROM accounts WHERE id = ?
  `).get(id);
  return row || null;
}

function deleteAccount(id) {
  return db.prepare(`DELETE FROM accounts WHERE id = ?`).run(id).changes > 0;
}

// --- Per-account save blob ----------------------------------------------

function getSave(accountId) {
  const row = db.prepare(`SELECT data, updated_at AS updatedAt FROM saves WHERE account_id = ?`).get(accountId);
  if (!row) return null;
  try { return { data: JSON.parse(row.data), updatedAt: row.updatedAt }; }
  catch (e) { return null; }
}

function putSave(accountId, data) {
  if (typeof data !== 'object' || data == null) throw new Error('Save data must be an object');
  const json = JSON.stringify(data);
  if (json.length > 1_000_000) throw new Error('Save payload too large (max ~1 MB)');
  const now = Date.now();
  db.prepare(`
    INSERT INTO saves (account_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(accountId, json, now);
  return now;
}

// --- Stats helper (used by /health) -------------------------------------

function stats() {
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM accounts`).get();
  const { saves } = db.prepare(`SELECT COUNT(*) AS saves FROM saves`).get();
  return { accounts: count, saves };
}

module.exports = {
  // account ops
  createAccount, authenticate, getAccount, deleteAccount,
  // session tokens
  createToken, verifyToken,
  // persistent saves
  getSave, putSave,
  // misc
  stats,
  // raw DB handle (escape hatch)
  db,
};
