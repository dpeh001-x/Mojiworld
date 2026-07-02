// Tests the account + cloud-save HTTP API against `wrangler dev`.
const BASE = process.env.API_BASE || 'http://127.0.0.1:8802';
const U = 'testuser_' + Math.floor(Math.random() * 1e6);
const P = 'hunter2secret';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const post = (path, body, token) => fetch(BASE + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const get = (path, token) => fetch(BASE + path, { headers: token ? { authorization: 'Bearer ' + token } : {} });

// 1. register
let r = await post('/api/register', { username: U, password: P });
let j = await r.json();
ok(r.status === 200 && j.ok && j.token && j.kind === 'cloud', 'register returns a token');
const token = j.token;

// 2. duplicate register blocked
r = await post('/api/register', { username: U, password: P });
ok(r.status === 409, 'duplicate register -> 409');

// 3. bad username / password validation
ok((await post('/api/register', { username: 'ab', password: P })).status === 400, 'short username -> 400');
ok((await post('/api/register', { username: 'okname9', password: '123' })).status === 400, 'short password -> 400');

// 4. login ok (fresh token, different from register token)
r = await post('/api/login', { username: U, password: P });
j = await r.json();
ok(r.status === 200 && j.ok && j.token, 'login ok');
ok(j.token !== token, 'login mints a distinct token (multi-device)');
const token2 = j.token;

// 5. wrong password
r = await post('/api/login', { username: U, password: 'wrongwrong' });
ok(r.status === 401, 'wrong password -> 401');

// 6. unknown user
ok((await post('/api/login', { username: 'nobody_' + Math.floor(Math.random() * 1e6), password: P })).status === 404, 'unknown user -> 404');

// 7. save round-trip (both tokens see the same account save)
const SAVE = { v: 1, cls: 'mage', level: 42, mojicoins: 1234, inventory: [{ id: 'x', stars: 3 }] };
ok((await post('/api/save', SAVE, token)).status === 200, 'POST save (token 1) ok');
r = await get('/api/save', token2);
j = await r.json();
ok(r.status === 200 && j.ok && j.save && j.save.level === 42 && j.save.mojicoins === 1234, 'GET save (token 2) returns the same save (shared account)');

// 8. auth guards
ok((await get('/api/save', 'bogustoken')).status === 401, 'GET save with bad token -> 401');
ok((await get('/api/save')).status === 401, 'GET save with no token -> 401');
ok((await post('/api/save', SAVE)).status === 401, 'POST save with no token -> 401');

// 9. new account has null save
r = await post('/api/register', { username: 'fresh_' + Math.floor(Math.random() * 1e6), password: P });
j = await r.json();
r = await get('/api/save', j.token); j = await r.json();
ok(r.status === 200 && j.ok && j.save === null, 'new account save is null');

// 10. CORS preflight
r = await fetch(BASE + '/api/login', { method: 'OPTIONS' });
ok(r.status === 204 && r.headers.get('access-control-allow-origin') === '*', 'OPTIONS preflight -> 204 + CORS');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
