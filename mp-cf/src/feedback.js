// Mojiworld FEEDBACK PORTAL - backend core (v0.30.1851). Pure functions + storage helpers, no Cloudflare globals beyond Web APIs,
// so scripts/ and mp-cf/_feedback_test.mjs run it in plain Node. The routes live in feedback_api.js; the admin page in feedback_admin.js.
//
// Storage (one Durable Object instance, named 'feedback', so reports never queue behind the multiplayer relay):
//   fb:<13-digit ms>-<6 hex>   the report record (JSON)         fbs:<id>  its screenshot (a data: URL, optional)
//   fbc:<client id>            -> record id, so a retried POST is stored once
export const FB_TYPES = ['bug', 'feedback', 'idea', 'praise'];
export const FB_STATUS = ['new', 'triaged', 'fixed', 'wontfix', 'dup'];
export const FB_GAP_MS = 60 * 60 * 1000;   // one accepted report per connection per hour (per user)
export const FB_CAP = { msg: 3000, minMsg: 5, contact: 120, str: 300, keys: 40, list: 12, shot: 200000, keep: 3000, note: 600 };
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;   // keeps \t and \n in the message, drops everything else that is control
const clean = (v, n) => String(v == null ? '' : v).replace(CTRL, '').slice(0, n);
const num = (v) => (typeof v === 'number' && isFinite(v)) ? Math.round(v * 100) / 100 : null;

// diagnostics: whatever the client attaches, bounded - flat keys, short strings, numbers, booleans, short string lists. The schema stays open
// so the game can add a field without a server deploy, and nothing but those primitives can ever be stored.
export function cleanDiag(d) {
  const out = {}; if (!d || typeof d !== 'object' || Array.isArray(d)) return out;
  let n = 0;
  for (const k of Object.keys(d)) {
    if (n >= FB_CAP.keys) break;
    const key = clean(k, 32).replace(/[^A-Za-z0-9_]/g, ''); if (!key) continue;
    const v = d[k];
    if (typeof v === 'string') out[key] = clean(v, FB_CAP.str);
    else if (typeof v === 'boolean') out[key] = v;
    else if (typeof v === 'number') { const x = num(v); if (x !== null) out[key] = x; else continue; }
    else if (Array.isArray(v)) out[key] = v.slice(0, FB_CAP.list).map((x) => clean(x, 200));
    else continue;
    n++;
  }
  return out;
}

// -> { rec, shot } or { error }. A report is a typed message plus optional contact, diagnostics and one JPEG screenshot.
export function sanitizeReport(body) {
  if (!body || typeof body !== 'object') return { error: 'bad request' };
  if (body.hp) return { error: 'ignored', spam: true };   // the form's hidden honeypot field: a person never fills it
  const type = FB_TYPES.includes(body.type) ? body.type : null; if (!type) return { error: 'Pick a type: bug, feedback, idea or praise.' };
  const msg = clean(body.msg, FB_CAP.msg).trim();
  if (msg.length < FB_CAP.minMsg) return { error: 'Please write a little more (at least ' + FB_CAP.minMsg + ' characters).' };
  const diag = cleanDiag(body.diag);
  const rec = { type, msg, contact: clean(body.contact, FB_CAP.contact).trim(), status: 'new', note: '', ver: clean(body.ver || diag.ver, 24), cid: clean(body.cid, 48).replace(/[^A-Za-z0-9_-]/g, ''), diag };
  let shot = '';
  if (typeof body.shot === 'string' && body.shot) {
    if (body.shot.length <= FB_CAP.shot && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.shot)) shot = body.shot; else rec.shotDropped = true;
  }
  return { rec, shot };
}

const pad13 = (t) => String(t).padStart(13, '0');
export const recId = (t, rnd) => pad13(t) + '-' + rnd;
export const KEY = (id) => 'fb:' + id;
const rand6 = () => { const a = new Uint8Array(3); crypto.getRandomValues(a); return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join(''); };
export async function ipHash(ip) {   // a short salted fingerprint so one spammer's reports group together; the address itself is never stored
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('fb|' + ip));
  return Array.from(new Uint8Array(b)).slice(0, 4).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// store one sanitized report; returns the record. A repeated client id returns the report already stored (idempotent retry).
export async function storeReport(storage, rec, shot, ip, now) {
  if (rec.cid) { const old = await storage.get('fbc:' + rec.cid); if (old) { const r = await storage.get(KEY(old)); if (r) return { rec: r, dup: true }; } }
  const id = recId(now, rand6());
  const full = { id, t: now, ...rec, ipH: await ipHash(ip || 'unknown'), hasShot: !!shot };
  await storage.put(KEY(id), full);
  if (shot) await storage.put('fbs:' + id, shot);
  if (rec.cid) await storage.put('fbc:' + rec.cid, id);
  // keep the newest FB_CAP.keep: a flood can never grow the store without bound
  const all = await storage.list({ prefix: 'fb:', limit: FB_CAP.keep + 100 });
  const over = all.size - FB_CAP.keep;
  if (over > 0) { let i = 0; for (const [k, v] of all) { if (i++ >= over) break; await storage.delete(k); await storage.delete('fbs:' + v.id); if (v.cid) await storage.delete('fbc:' + v.cid); } }
  return { rec: full, dup: false };
}

// one line for a chat webhook (Discord / Slack style): no mentions, no links, bounded
export function webhookText(rec) {
  const head = ({ bug: '🐞 Bug', feedback: '💬 Feedback', idea: '💡 Idea', praise: '❤ Praise' })[rec.type] || rec.type;
  const where = [rec.ver, rec.diag && rec.diag.map, rec.diag && rec.diag.cls && ('Lv' + (rec.diag.level || '?') + ' ' + rec.diag.cls)].filter(Boolean).join(' · ');
  return (head + (where ? ' [' + where + ']' : '') + ' #' + rec.id + '\n' + rec.msg.slice(0, 500) + (rec.msg.length > 500 ? '…' : '')).replace(/@/g, '@​');
}

// ---- the hourly limit: ONE accepted report per connection per hour. Only an ACCEPTED report uses the hour up: a refused, malformed or duplicate-retry one never reaches setLimit.
// Keyed on the salted IP hash (the address itself is never stored). Returns the seconds left, or 0 when the connection may send.
export async function limitLeft(storage, ipH, now, gap) { const r = await storage.get('fbrl:' + ipH); if (!r) return 0; const left = r.t + (gap || FB_GAP_MS) - now; return left > 0 ? Math.ceil(left / 1000) : 0; }
export async function setLimit(storage, ipH, now, gap) {
  await storage.put('fbrl:' + ipH, { t: now });
  // sweep the lapsed ones a little at a time, so the keys of connections that never come back do not pile up
  const old = await storage.list({ prefix: 'fbrl:', limit: 100 }); let n = 0;
  for (const [k, v] of old) { if (v && now - v.t > (gap || FB_GAP_MS)) { await storage.delete(k); if (++n >= 25) break; } }
}
