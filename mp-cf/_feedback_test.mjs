// FEEDBACK PORTAL backend (mp-cf/src/feedback*.js) in plain Node: a fake Durable Object storage, real Request/Response.   node mp-cf/_feedback_test.mjs
import { feedbackApi } from './src/feedback_api.js';
import { sanitizeReport, FB_CAP } from './src/feedback.js';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m + (x !== undefined && !c ? '  [' + JSON.stringify(x).slice(0, 200) + ']' : '')); };
class Store { constructor() { this.m = new Map(); }
  async get(k) { return this.m.get(k); } async put(k, v) { this.m.set(k, JSON.parse(JSON.stringify(v))); } async delete(k) { return this.m.delete(k); }
  async list(o = {}) { let ks = [...this.m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).sort(); if (o.reverse) ks.reverse(); if (o.limit) ks = ks.slice(0, o.limit); return new Map(ks.map((k) => [k, this.m.get(k)])); } }
const CORS = { 'access-control-allow-origin': '*' };
let storage = new Store(), env = { FEEDBACK_ADMIN_KEY: 'correct-horse-battery' }, hits = {}, clock = 1_800_000_000_000, hooks = [], mails = [], mailResult = { ok: true, via: 'test' };
const throttle = async (req, bucket, limit) => { const k = bucket + ':' + (req.headers.get('cf-connecting-ip') || '?'); hits[k] = (hits[k] || 0) + 1; return hits[k] <= limit; };
let ipN = 0; const call = (path, { method = 'GET', body, key, ip, raw } = {}) => (ip = ip || '10.1.0.' + (++ipN), 1) &&  feedbackApi(new Request('https://x.test' + path, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: raw != null ? raw : (body ? JSON.stringify(body) : undefined) }),
  { storage, env, throttle, cors: CORS, mail: async (rec, shot, e) => { mails.push({ rec: JSON.parse(JSON.stringify(rec)), shot, e }); return mailResult; }, now: () => (clock += 1000), fetchFn: async (u, o) => { hooks.push({ u, o }); return new Response('ok'); } });
const rep = (o) => ({ type: 'bug', msg: 'The portal on the cliff sends me back to town', contact: 'me@example.com', ver: 'v0.30.1851', cid: 'c-' + Math.random().toString(36).slice(2, 10), diag: { map: 'cliff', level: 12, cls: 'mage', errors: ['TypeError: x is undefined'] }, ...o });
const KEY = env.FEEDBACK_ADMIN_KEY;

console.log('submit');
let r = await call('/api/feedback', { method: 'POST', body: rep(), ip: '203.0.113.77' }), j = await r.json();
ok(r.status === 200 && j.ok && /^\d{13}-[0-9a-f]{6}$/.test(j.id), 'a valid report is stored and answers its id', j);
const id1 = j.id;
for (const [name, body] of [['no type', rep({ type: 'nope' })], ['empty message', rep({ msg: '   ' })], ['too short', rep({ msg: 'hi' })]]) { r = await call('/api/feedback', { method: 'POST', body }); ok(r.status === 400, name + ' -> 400'); }
r = await call('/api/feedback', { method: 'POST', raw: '{not json' }); ok(r.status === 400, 'broken JSON -> 400');
r = await call('/api/feedback', { method: 'POST', raw: '{"type":"bug","msg":"' + 'a'.repeat(FB_CAP.shot + 30000) + '"}' }); ok(r.status === 413, 'an oversized body -> 413');
const same = rep({ cid: 'dedupe-1' }); const a = await (await call('/api/feedback', { method: 'POST', body: same })).json(), b = await (await call('/api/feedback', { method: 'POST', body: same })).json();
ok(a.ok && b.ok && a.id === b.id && b.dup === true, 'a retried client id is stored once', [a, b]);
r = await call('/api/feedback', { method: 'POST', body: rep({ hp: 'http://spam' }) }); j = await r.json(); ok(r.status === 200 && j.ok && (await storage.list({ prefix: 'fb:' })).size === 2, 'a honeypot hit looks accepted but stores nothing');
const longMsg = sanitizeReport(rep({ msg: 'x'.repeat(9000) })); ok(longMsg.rec.msg.length === FB_CAP.msg, 'the message is capped at ' + FB_CAP.msg);
const d = sanitizeReport(rep({ diag: { ok: 1, nested: { a: 1 }, 'bad key!': 'v', fn: () => 1, big: 'y'.repeat(900), list: ['a', 'b'], inf: Infinity } })).rec.diag;
ok(d.ok === 1 && d.nested === undefined && d.badkey === 'v' && d.big.length === FB_CAP.str && Array.isArray(d.list) && d.inf === undefined, 'diagnostics keep only bounded primitives', d);
const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
j = await (await call('/api/feedback', { method: 'POST', body: rep({ shot: jpeg }) })).json(); const idShot = j.id;
ok((await storage.get('fbs:' + idShot)) === jpeg && (await storage.get('fb:' + idShot)).hasShot === true, 'a JPEG screenshot is stored beside the report');
j = await (await call('/api/feedback', { method: 'POST', body: rep({ shot: 'data:text/html;base64,PHNjcmlwdD4=' }) })).json(); ok((await storage.get('fb:' + j.id)).hasShot === false && (await storage.get('fb:' + j.id)).shotDropped === true, 'a non-JPEG "screenshot" is dropped, the report still lands');

console.log('hourly limit + email');
{ const IP = '198.51.100.9', send = (o) => call('/api/feedback', { method: 'POST', body: rep(o), ip: IP }); mails.length = 0;
  let x = await send({ msg: 'first report from this connection' }), jj = await x.json();
  ok(x.status === 200 && jj.ok && jj.mail === true && mails.length === 1, 'an accepted report is stored AND emailed (once)', [x.status, jj, mails.length]);
  ok(mails[0].rec.msg.includes('first report') && mails[0].rec.type === 'bug', 'the email carries the report');
  x = await send({ msg: 'a second report straight after' }); jj = await x.json();
  ok(x.status === 429 && jj.retryAfter > 3500 && jj.retryAfter <= 3600 && /already have a report/.test(jj.error) && mails.length === 1, 'a second report inside the hour from the same connection is refused (429) and not mailed', jj);
  ok((await storage.list({ prefix: 'fb:' })).size === (await storage.list({ prefix: 'fb:' })).size && ![...(await storage.list({ prefix: 'fb:' })).values()].some((r) => r.msg.includes('straight after')), 'the refused report is not stored');
  clock += 59 * 60 * 1000; x = await send({ msg: 'still inside the hour at 59 minutes' }); ok(x.status === 429, '59 minutes later it is still refused');
  clock += 2 * 60 * 1000; x = await send({ msg: 'an hour and a minute later it goes through' }); jj = await x.json(); ok(x.status === 200 && jj.ok && mails.length === 2, 'after the hour a new report is accepted and emailed');
  x = await send({ msg: 'and now the new hour is used up again' }); ok(x.status === 429, 'and the hour starts over');
  ok((await call('/api/feedback', { method: 'POST', body: rep({ msg: 'a different connection is unaffected' }), ip: '198.51.100.77' })).status === 200, 'another connection is not affected');
  // a refused / malformed / honeypot / duplicate request must NOT spend the hour
  const IP2 = '198.51.100.20', s2 = (o) => call('/api/feedback', { method: 'POST', body: rep(o), ip: IP2 });
  ok((await s2({ msg: 'x' })).status === 400 && (await s2({ type: 'nope' })).status === 400 && (await call('/api/feedback', { method: 'POST', raw: '{bad', ip: IP2 })).status === 400 && (await s2({ hp: 'spam' })).status === 200, 'refused, broken and honeypot requests answer as before');
  mails.length = 0; x = await s2({ msg: 'my real report after three refused tries', cid: 'spend-1' }); jj = await x.json(); ok(x.status === 200 && jj.ok && mails.length === 1, 'none of them used the hour up: the real report still goes through');
  mails.length = 0; x = await s2({ msg: 'my real report after three refused tries', cid: 'spend-1' }); jj = await x.json(); ok(x.status === 200 && jj.dup === true && mails.length === 0, 'a retry of a stored report (same client id) is answered, not limited and not mailed again');
  // env override of the gap (a wrangler var), bounded
  env.FEEDBACK_GAP_MS = '120000'; const IP3 = '198.51.100.30'; await call('/api/feedback', { method: 'POST', body: rep(), ip: IP3 }); clock += 117000; ok((await call('/api/feedback', { method: 'POST', body: rep(), ip: IP3 })).status === 429, 'FEEDBACK_GAP_MS shortens the wait (2 min: still refused at 1:58)'); clock += 3000; ok((await call('/api/feedback', { method: 'POST', body: rep(), ip: IP3 })).status === 200, '...and lets the next one through at 2:02'); delete env.FEEDBACK_GAP_MS;
  env.FEEDBACK_GAP_MS = '5'; const IP4 = '198.51.100.40'; await call('/api/feedback', { method: 'POST', body: rep(), ip: IP4 }); clock += 30000; ok((await call('/api/feedback', { method: 'POST', body: rep(), ip: IP4 })).status === 429, 'a silly gap is clamped to at least a minute'); delete env.FEEDBACK_GAP_MS;
  // the limiter keys are swept once lapsed
  clock += 3 * 3600 * 1000; await call('/api/feedback', { method: 'POST', body: rep(), ip: '198.51.100.99' }); const left = await storage.list({ prefix: 'fbrl:' }); ok(left.size <= 2, 'lapsed limiter keys are swept (the store does not grow with every connection ever seen)', left.size);
  // an email failure never loses the report
  mailResult = { ok: false, via: 'resend', error: 'Resend 403: domain not verified' }; const IP5 = '198.51.100.50'; x = await call('/api/feedback', { method: 'POST', body: rep({ msg: 'mail provider is down right now' }), ip: IP5 }); jj = await x.json();
  const stored = [...(await storage.list({ prefix: 'fb:' })).values()].find((r) => r.msg.includes('mail provider is down'));
  ok(x.status === 200 && jj.ok && jj.mail === false && stored && stored.mail.ok === false && /domain not verified/.test(stored.mail.error), 'when the email cannot be sent the report is still stored, and the failure is recorded on it', [jj, stored && stored.mail]);
  mailResult = { ok: true, via: 'test' };
  // admin: email again
  const kk = env.FEEDBACK_ADMIN_KEY; mails.length = 0; x = await call('/api/feedback/resend', { method: 'POST', key: kk, body: { id: stored.id } }); jj = await x.json();
  ok(x.status === 200 && jj.ok && mails.length === 1 && jj.item.mail.ok === true, 'admin Email again re-sends a stored report and updates its mail status', jj);
  ok((await call('/api/feedback/resend', { method: 'POST', body: { id: stored.id } })).status === 401, 'Email again needs the admin key');
  ok((await call('/api/feedback/resend', { method: 'POST', key: kk, body: { id: 'nope-0' } })).status === 404, 'Email again for an unknown id -> 404');
}
hits = {};
console.log('webhook');
hooks.length = 0; env.FEEDBACK_WEBHOOK = 'https://hooks.example/abc'; await call('/api/feedback', { method: 'POST', body: rep({ msg: 'hello @everyone this is a bug', ip: '7.7.7.7' }), ip: '7.7.7.7' });
ok(hooks.length === 1 && hooks[0].u === 'https://hooks.example/abc', 'a new report is posted to the webhook');
const wb = JSON.parse(hooks[0].o.body); ok(!/@everyone/.test(wb.content) && wb.allowed_mentions.parse.length === 0 && /bug/i.test(wb.content), 'the webhook text carries no live mention', wb);
hooks.length = 0; await call('/api/feedback', { method: 'POST', body: same, ip: '7.7.7.8' }); ok(hooks.length === 0, 'a duplicate retry does not ping again');
env.FEEDBACK_WEBHOOK = 'http://insecure.example/x'; await call('/api/feedback', { method: 'POST', body: rep(), ip: '7.7.7.9' }); ok(hooks.length === 0, 'a non-https webhook is ignored'); delete env.FEEDBACK_WEBHOOK;

console.log('admin');
hits = {}; r = await call('/api/feedback/list'); ok(r.status === 401, 'no key -> 401');
r = await call('/api/feedback/list', { key: 'wrong-key-here' }); ok(r.status === 401, 'wrong key -> 401');
r = await call('/api/feedback/list', { key: KEY }); j = await r.json(); ok(r.status === 200 && j.ok && j.items.length >= 4 && j.counts.total === j.items.length, 'the right key lists the reports', j.counts);
ok(j.items[0].id > j.items[j.items.length - 1].id, 'newest first');
ok(!JSON.stringify(j).includes('203.0.113.77') && j.items.every((x) => /^[0-9a-f]{8}$/.test(x.ipH)), 'no raw IP is stored or returned (a short hash groups spammers)');
const saved = env.FEEDBACK_ADMIN_KEY; delete env.FEEDBACK_ADMIN_KEY; r = await call('/api/feedback/list', { key: KEY }); ok(r.status === 503, 'no admin key configured -> closed (503), never open'); env.FEEDBACK_ADMIN_KEY = 'short'; r = await call('/api/feedback/list', { key: 'short' }); ok(r.status === 503, 'a key under 8 characters is refused'); env.FEEDBACK_ADMIN_KEY = saved;
j = await (await call('/api/feedback/list?type=bug&q=cliff', { key: KEY })).json(); ok(j.items.length >= 1 && j.items.every((x) => x.type === 'bug'), 'filter by type and search text');
j = await (await call('/api/feedback/list?status=fixed', { key: KEY })).json(); ok(j.items.length === 0, 'filter by status');
r = await call('/api/feedback/update', { method: 'POST', key: KEY, body: { id: id1, status: 'triaged', note: 'repro on cliff, portal x' } }); j = await r.json(); ok(r.status === 200 && j.item.status === 'triaged' && j.item.note.includes('cliff'), 'triage: status + note');
r = await call('/api/feedback/update', { method: 'POST', key: KEY, body: { id: id1, status: 'banana' } }); ok(r.status === 400, 'an unknown status is refused');
r = await call('/api/feedback/update', { method: 'POST', key: KEY, body: { id: '000-none', status: 'fixed' } }); ok(r.status === 404, 'an unknown id -> 404');
j = await (await call('/api/feedback/list?status=triaged', { key: KEY })).json(); ok(j.items.length === 1 && j.items[0].id === id1, 'the triaged report shows under its status');
r = await call('/api/feedback/shot?id=' + idShot, { key: KEY }); const bytes = new Uint8Array(await r.arrayBuffer()); ok(r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8, 'the screenshot comes back as a JPEG');
r = await call('/api/feedback/shot?id=' + idShot); ok(r.status === 401, 'the screenshot needs the key');
await call('/api/feedback', { method: 'POST', body: rep({ msg: '=HYPERLINK("http://evil","click") and a "quote", comma\nnewline' }) });
r = await call('/api/feedback/list?format=csv', { key: KEY }); const csv = await r.text();
ok(r.status === 200 && /text\/csv/.test(r.headers.get('content-type')) && csv.split('\r\n')[0].startsWith('id,time,type'), 'CSV export');
ok(csv.includes('"\'=HYPERLINK') && !/(^|,)"=HYPERLINK/m.test(csv) && csv.includes('""quote""'), 'CSV: a formula-looking message is neutralised and quotes are escaped');
r = await call('/api/feedback/delete', { method: 'POST', key: KEY, body: { id: idShot } }); ok(r.status === 200 && !(await storage.get('fb:' + idShot)) && !(await storage.get('fbs:' + idShot)), 'delete removes the report and its screenshot');
r = await call('/api/feedback/nope', { key: KEY }); ok(r.status === 404, 'an unknown admin route -> 404');
r = await call('/api/feedback', { method: 'OPTIONS' }); ok(r.status === 204, 'CORS preflight answers');

console.log('cap'); storage = new Store(); const keep = FB_CAP.keep; FB_CAP.keep = 5; hits = {};
for (let i = 0; i < 8; i++) await call('/api/feedback', { method: 'POST', body: rep({ msg: 'report number ' + i + ' padding', shot: i === 0 ? jpeg : undefined }), ip: '10.0.0.' + i });
const left = await storage.list({ prefix: 'fb:' }); ok(left.size === 5, 'the store keeps only the newest ' + 5 + ' reports (a flood cannot grow it)', left.size); ok(![...left.values()].some((x) => x.msg.includes('number 0')) && [...left.values()].some((x) => x.msg.includes('number 7')), 'the oldest go first');
ok((await storage.list({ prefix: 'fbs:' })).size === 0 && (await storage.list({ prefix: 'fbc:' })).size === 5, 'their screenshots and client-id keys go with them'); FB_CAP.keep = keep;
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
