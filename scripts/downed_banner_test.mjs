// Live test: the DOWNED banner is bigger and explains the co-op revive.
//
// Per user: "For the downed box make it bigger. And with a small font
// explanation that if you had a member in your room they could revive you once
// per map."
//
// Built through the real _coopDownedBanner and measured off the live DOM, so
// "bigger" is a number rather than an impression, and the wording is checked
// against the constants it describes.
//   node scripts/downed_banner_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _coopDownedBanner === 'function', null, { timeout: 120000 });
await page.waitForTimeout(1200);

const shot = async (state) => page.evaluate((st) => {
  document.getElementById('coop-downed-banner')?.remove();
  player._downedSilent = false;
  player._downRevivable = st === 'revivable';
  player._downAlreadyRevived = st === 'spent';
  _coopDownedBanner(25);
  const el = document.getElementById('coop-downed-banner');
  if (!el) return { missing: true };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const btn = document.getElementById('coop-downed-skip');
  const sub = el.querySelector('div');
  const divs = [...el.querySelectorAll('div')];
  const explain = divs.length > 1 ? divs[divs.length - 1] : null;
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    title: parseFloat(cs.fontSize),
    subSize: sub ? parseFloat(getComputedStyle(sub).fontSize) : 0,
    explainSize: explain ? parseFloat(getComputedStyle(explain).fontSize) : 0,
    explainText: explain ? explain.textContent.replace(/\s+/g, ' ').trim() : '',
    divCount: divs.length,
    btnSize: btn ? parseFloat(getComputedStyle(btn).fontSize) : 0,
    text: el.textContent.replace(/\s+/g, ' ').trim(),
    offRight: Math.round(r.right - innerWidth), offLeft: Math.round(r.left),
  };
}, state);

const solo = await shot('solo');
const spent = await shot('spent');
const revivable = await shot('revivable');
// the phone case: the box must not run off a 375px screen
await page.setViewportSize({ width: 375, height: 812 });
const mobile = await shot('solo');
await page.setViewportSize({ width: 1280, height: 720 });
await page.evaluate(() => document.getElementById('coop-downed-banner')?.remove());

// the rule the copy claims, read from the game's own constants
const consts = await page.evaluate(() => ({ channelMs: COOP_REVIVE_MS, cooldownMs: COOP_REVIVE_COOLDOWN_MS }));

// baseline: the old box measured ~15px title / 11px sub, and no explainer at all
ok('the box is materially bigger than the old one', solo.w >= 340 && solo.h >= 150 && solo.title >= 20,
  { w: solo.w, h: solo.h, titlePx: solo.title, was: 'title 15px, no min-width' });
ok('the sub-line and button grew with it', solo.subSize >= 13 && solo.btnSize >= 13,
  { sub: solo.subSize, btn: solo.btnSize, was: { sub: 11, btn: 12 } });
ok('there is a SMALL-font explainer, smaller than the sub-line',
  solo.explainSize > 0 && solo.explainSize < solo.subSize && solo.divCount >= 2,
  { explainPx: solo.explainSize, subPx: solo.subSize });
ok('it says a partner in your room can revive you, once per map',
  /co-op room/i.test(solo.explainText) && /partner/i.test(solo.explainText)
  && /revive per map|one revive per map/i.test(solo.explainText), { text: solo.explainText });
ok('...and the numbers in it match the code',
  new RegExp(`${consts.channelMs / 1000}s`).test(solo.explainText), { channel: consts.channelMs, cooldown: consts.cooldownMs, text: solo.explainText });
ok('the already-revived state shows it too (that player still needs the rule)',
  spent.explainSize > 0 && /already revived on this map/.test(spent.text), { text: spent.text.slice(0, 90) });
ok('but a player who CAN be revived does not get the redundant explainer',
  revivable.divCount === 1 && /stand beside you for 3s/.test(revivable.text),
  { divCount: revivable.divCount, text: revivable.text.slice(0, 90) });
ok('it still fits a 375px phone screen', mobile.offLeft >= 0 && mobile.offRight <= 0 && mobile.w <= 375,
  { w: mobile.w, left: mobile.offLeft, rightOverflow: mobile.offRight });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
