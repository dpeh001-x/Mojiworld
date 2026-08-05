// Monster Plant on T certification (moved from key 3, per user).
//   1. Dev mode LOCKED: T does NOT open Monster Plant; co-op ping still fires.
//   2. Dev mode UNLOCKED (LX_DEV=1): T toggles Monster Plant, ping does NOT
//      double-fire (dev takes the key), toggle closes it again.
//   3. A skill bound on T wins (yield guard).
//   4. Key 3 no longer opens Monster Plant (it's an emote now).
import { chromium } from 'playwright-core';
const EXE = process.env.PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

async function boot(browser, unlocked) {
  const ctx = await browser.newContext();
  if (unlocked) await ctx.addInitScript(() => { try { localStorage.setItem('LX_DEV', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  page._errors = errs;
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof _lxMpToggle === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    try { player.cls = player.cls || 'warrior'; game.paused = false; window._prologueActive = false; } catch (e) {}
    // stub the ping counter + fake a live co-op link so the ping branch is armed
    window.__pings = 0;
    window._coopSendPing = () => { window.__pings++; };
    if (typeof net === 'object' && net) { net.connected = true; }
  });
  return page;
}
const pressT = (page) => page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })));

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  // ── LOCKED ──
  const L = await boot(browser, false);
  await pressT(L);
  const locked = await L.evaluate(() => ({ mpOpen: (typeof _LX_MP !== 'undefined' && !!_LX_MP.open), pings: window.__pings, dev: localStorage.getItem('LX_DEV') }));
  ok('locked: T does NOT open Monster Plant', !locked.mpOpen, locked);
  ok('locked: T still fires the co-op ping for players', locked.pings === 1, locked);
  ok('no page errors (locked)', L._errors.length === 0, L._errors.slice(0, 2));
  await L.close();

  // ── UNLOCKED ──
  const U = await boot(browser, true);
  await pressT(U);
  const open1 = await U.evaluate(() => ({ mpOpen: (typeof _LX_MP !== 'undefined' && !!_LX_MP.open), pings: window.__pings }));
  ok('unlocked: T OPENS Monster Plant', open1.mpOpen === true, open1);
  ok('unlocked: ping does NOT double-fire (dev takes the key)', open1.pings === 0, open1);
  await pressT(U);
  const open2 = await U.evaluate(() => (typeof _LX_MP !== 'undefined' && !!_LX_MP.open));
  ok('unlocked: T again CLOSES Monster Plant (toggle)', open2 === false, { open2 });

  // skill bound on T wins
  const bound = await U.evaluate(() => {
    KEY_TO_SLOT['t'] = 'q';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
    const r = (typeof _LX_MP !== 'undefined' && !!_LX_MP.open);
    delete KEY_TO_SLOT['t'];
    return r;
  });
  ok('a skill bound on T wins over the dev tool (yield guard)', bound === false, { bound });

  // key 3 no longer toggles Monster Plant
  const three = await U.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    return (typeof _LX_MP !== 'undefined' && !!_LX_MP.open);
  });
  ok('key 3 no longer opens Monster Plant (moved to T)', three === false, { three });

  // panel header advertises the new key
  const hdr = await U.evaluate(() => { _lxMpToggle(); const t = _LX_MP.root.textContent; _lxMpToggle(); return t.slice(0, 60); });
  ok('overlay header shows "(T)"', hdr.includes('Monster Plant (T)'), { hdr });

  ok('no page errors (unlocked)', U._errors.length === 0, U._errors.slice(0, 2));
  await U.close();
} finally { await browser.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
