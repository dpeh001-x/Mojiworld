// FEEDBACK PORTAL through the real Worker entry + MojiRoom (fake DO namespace + storage).   node mp-cf/_feedback_worker_test.mjs
import worker, { MojiRoom } from './src/index.js';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m + (x !== undefined && !c ? '  [' + JSON.stringify(x).slice(0, 200) + ']' : '')); };
class Store { constructor() { this.m = new Map(); this.alarm = null; }
  async get(k) { return this.m.get(k); } async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, b); else this.m.set(k, JSON.parse(JSON.stringify(v))); } async delete(k) { return this.m.delete(k); }
  async list(o = {}) { let ks = [...this.m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).sort(); if (o.reverse) ks.reverse(); if (o.limit) ks = ks.slice(0, o.limit); return new Map(ks.map((k) => [k, this.m.get(k)])); }
  async setAlarm(t) { this.alarm = t; } async getAlarm() { return this.alarm; } }
const env = { FEEDBACK_ADMIN_KEY: 'integration-key-123' }, objs = new Map(), calls = [];
env.ROOMS = { idFromName: (n) => ({ name: n, equals(o) { return o.name === n; } }), get(id) {
  calls.push(id.name);
  if (!objs.has(id.name)) objs.set(id.name, new MojiRoom({ storage: new Store(), id, getWebSockets: () => [], setWebSocketAutoResponse() {}, acceptWebSocket() {} }, env));
  return objs.get(id.name); } };
const req = (path, o = {}) => worker.fetch(new Request('https://w.test' + path, { method: o.method || 'GET', headers: { 'content-type': 'application/json', 'cf-connecting-ip': o.ip || '8.8.8.8', ...(o.key ? { authorization: 'Bearer ' + o.key } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }), env);

let r = await req('/api/feedback', { method: 'POST', body: { type: 'bug', msg: 'integration report from the game', diag: { map: 'forest', level: 7 }, ver: 'v0.30.1851', cid: 'int-1' } }); let j = await r.json();
ok(r.status === 200 && j.ok && j.id, 'POST /api/feedback through the Worker stores a report', j);
ok(calls[calls.length - 1] === 'feedback' && !calls.includes('global'), "it went to the 'feedback' Durable Object, not 'global' (the relay)", calls);
ok([...(await objs.get('feedback').storage.list({ prefix: 'fb:' })).keys()].length === 1, 'the report is in that instance storage');
r = await req('/api/feedback/list', { key: env.FEEDBACK_ADMIN_KEY }); j = await r.json(); ok(r.status === 200 && j.items.length === 1 && j.items[0].msg.includes('integration'), 'the admin list reads it back');
r = await req('/api/feedback/list'); ok(r.status === 401, 'the admin list needs the key through the Worker too');
r = await req('/api/feedback', { method: 'OPTIONS' }); ok(r.status === 204 && r.headers.get('access-control-allow-origin') === '*', 'CORS preflight on the public route');
r = await req('/feedback-admin'); const html = await r.text();
ok(r.status === 200 && /text\/html/.test(r.headers.get('content-type')) && /noindex/.test(r.headers.get('x-robots-tag')) && r.headers.get('x-frame-options') === 'DENY' && !calls.slice(1).includes('global'), 'the dashboard page is served, noindex, unframeable, without waking any Durable Object');
ok(/Mojiworld Feedback/.test(html) && !html.includes(env.FEEDBACK_ADMIN_KEY), 'the page carries no key');
const js = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>')); let parses = true; try { new Function(js); } catch (e) { parses = String(e); } ok(parses === true, 'the dashboard script parses', parses);
calls.length = 0; r = await req('/api/save', { method: 'GET' }); ok(calls[0] === 'global', "other /api routes still go to 'global'", calls);
r = await req('/api/time'); j = await r.json(); ok(j.ok && typeof j.now === 'number', '/api/time is untouched');
env.FEEDBACK_ADMIN_KEY = undefined; r = await req('/api/feedback/list', { key: 'integration-key-123' }); ok(r.status === 503, 'with the secret unset the dashboard API is closed, not open');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
