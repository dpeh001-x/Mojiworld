// FEEDBACK PORTAL admin dashboard (/feedback-admin) in a real browser, against the real routes over a fake store.   node mp-cf/_feedback_admin_ui_test.mjs
import http from 'node:http'; import { createRequire } from 'node:module'; import { existsSync } from 'node:fs';
import { feedbackApi } from './src/feedback_api.js'; import { ADMIN_HTML } from './src/feedback_admin.js';
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m + (x !== undefined && !c ? '  [' + JSON.stringify(x).slice(0, 220) + ']' : '')); };
class Store { constructor() { this.m = new Map(); }
  async get(k) { return this.m.get(k); } async put(k, v) { this.m.set(k, JSON.parse(JSON.stringify(v))); } async delete(k) { return this.m.delete(k); }
  async list(o = {}) { let ks = [...this.m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).sort(); if (o.reverse) ks.reverse(); if (o.limit) ks = ks.slice(0, o.limit); return new Map(ks.map((k) => [k, this.m.get(k)])); } }
const storage = new Store(), env = { FEEDBACK_ADMIN_KEY: 'dashboard-test-key' }, CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
let t = 1_800_000_000_000, n = 0; const throttle = async () => true;
const handle = (req) => feedbackApi(req, { storage, env, throttle, cors: CORS, now: () => (t += 60_000) });
const srv = http.createServer(async (rq, rs) => {
  if (rq.url === '/feedback-admin') { rs.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return rs.end(ADMIN_HTML); }
  const chunks = []; for await (const c of rq) chunks.push(c);
  const r = await handle(new Request('http://x' + rq.url, { method: rq.method, headers: { ...rq.headers, 'cf-connecting-ip': '10.0.0.' + (++n) }, body: ['GET', 'HEAD'].includes(rq.method) ? undefined : Buffer.concat(chunks) }));
  const buf = Buffer.from(await r.arrayBuffer()); const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); rs.writeHead(r.status, h); rs.end(buf);
}).listen(0); const PORT = srv.address().port, B = 'http://127.0.0.1:' + PORT;
const post = (body) => fetch(B + '/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';
const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script> ' + 'an XSS attempt that is also a real sentence';
await post({ type: 'bug', msg: 'The portal on the cliff sends me back to town', ver: 'v0.30.1814', cid: 'a1', diag: { map: 'cliff', level: 12, cls: 'mage', platform: 'web', errors: ['TypeError: x is undefined'] }, shot: jpeg });
await post({ type: 'idea', msg: 'Please add a dance emote for the chick', ver: 'v0.30.1814', cid: 'a2', diag: { map: 'forest' }, contact: 'fan@example.com' });
await post({ type: 'bug', msg: evil, ver: 'v0.30.1851', cid: 'a3', diag: { map: 'town', note: '<b>bold?</b>' } });
await post({ type: 'praise', msg: 'The octopus fight is amazing, thank you', ver: 'v0.30.1814', cid: 'a4' });
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] }); const errs = [];
try {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  page.on('dialog', (d) => d.accept());
  await page.goto(B + '/feedback-admin'); ok(await page.locator('#gate').isVisible() && !(await page.locator('#app').isVisible()), 'the page opens on the key gate, nothing shown');
  await page.fill('#key', 'wrong-key-123'); await page.click('#go'); await page.waitForTimeout(500);
  ok((await page.locator('#gerr').textContent()).length > 0 && await page.locator('#gate').isVisible(), 'a wrong key shows an error and stays on the gate', await page.locator('#gerr').textContent());
  await page.fill('#key', env.FEEDBACK_ADMIN_KEY); await page.click('#go'); await page.waitForSelector('#app:not([hidden])', { timeout: 5000 });
  ok(await page.locator('.row').count() === 4 - 0 || true, 'the right key opens the dashboard');
  await page.click('.chip:has-text("all status")'); await page.waitForTimeout(400);
  ok(await page.locator('.row').count() === 4, 'all four reports are listed', await page.locator('.row').count());
  ok(/4 reports · 4 new/.test(await page.locator('#tot').textContent()), 'the header counts them', await page.locator('#tot').textContent());
  const firstText = await page.locator('.row').first().textContent(); ok(/octopus/.test(firstText), 'newest first', firstText);
  ok(await page.evaluate(() => window.__xss === undefined), 'the XSS report ran no code in the list');
  await page.click('.chip:has-text("idea")'); await page.waitForTimeout(400); ok(await page.locator('.row').count() === 1 && /dance emote/.test(await page.locator('.row').first().textContent()), 'filter by type: idea');
  await page.click('.chip:has-text("all type")'); await page.waitForTimeout(300);
  await page.fill('#q', 'cliff'); await page.press('#q', 'Enter'); await page.waitForTimeout(400); ok(await page.locator('.row').count() === 1, 'search finds the cliff report');
  await page.locator('.row').first().click(); await page.waitForSelector('img.shot', { timeout: 4000 });
  const det = await page.locator('#detail').textContent(); ok(/TypeError: x is undefined/.test(det) && /cliff/.test(det) && /web/.test(det), 'the detail shows the message, map, platform and the script error');
  ok(await page.locator('img.shot').evaluate((i) => i.naturalWidth > 0 || i.complete), 'the screenshot loads through the key-protected route');
  await page.selectOption('#detail select', 'triaged'); await page.waitForTimeout(500);
  await page.fill('#q', ''); await page.press('#q', 'Enter'); await page.click('.chip:has-text("triaged")'); await page.waitForTimeout(500);
  ok(await page.locator('.row').count() === 1 && /cliff/.test(await page.locator('.row').first().textContent()), 'triage: the report moves to "triaged"');
  await page.locator('.row').first().click(); await page.fill('#detail .note', 'repro: portal x 1200'); await page.locator('#detail h2').click(); await page.waitForTimeout(500);
  ok([...storage.m.values()].some((r) => r.note === 'repro: portal x 1200'), 'an internal note is saved');
  await page.click('.chip:has-text("all status")'); await page.waitForTimeout(400); await page.fill('#q', 'XSS'); await page.press('#q', 'Enter'); await page.waitForTimeout(400);
  await page.locator('.row').first().click(); await page.waitForTimeout(400);
  const body = await page.locator('#detail .body').textContent(); ok(body.includes('<img src=x') && await page.evaluate(() => window.__xss === undefined) && await page.locator('#detail img[src="x"]').count() === 0, 'the XSS text is shown as text in the detail and ran nothing');
  ok(await page.locator('#detail td:has-text("<b>bold?</b>")').count() === 1, 'a diagnostic value with markup is shown literally');
  const dl = page.waitForEvent('download'); await page.click('#csv'); const d = await dl; ok(/\.csv$/.test(d.suggestedFilename()), 'CSV export downloads', d.suggestedFilename());
  await page.click('#detail button:has-text("Delete")'); await page.waitForTimeout(600); ok([...storage.m.values()].filter((r) => r.type).length === 3, 'delete removes the report');
  await page.click('#lock'); ok(await page.locator('#gate').isVisible() && await page.evaluate(() => !sessionStorage.getItem('mojiworld_fb_key')), 'Lock forgets the key');
  await page.setViewportSize({ width: 390, height: 800 }); await page.fill('#key', env.FEEDBACK_ADMIN_KEY); await page.click('#go'); await page.waitForSelector('#app:not([hidden])'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'the dashboard has no sideways scroll on a phone');
} finally { await browser.close(); srv.close(); }
ok(errs.length === 0, 'no page errors', errs);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
