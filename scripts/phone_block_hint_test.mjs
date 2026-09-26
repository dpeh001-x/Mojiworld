// Phone deck, final polish (mc-dodge). Two things a thumb met on a phone in landscape:
//  - the "K Hotkeys & Skills" chip sat between the X skill and the Z attack at every phone size and stayed tappable around
//    both, so a slightly-off tap on Z opened the keyboard remap panel and paused the fight;
//  - on a 16:9 phone (no letterbox) and on a tablet, Block's top-left corner spot sat on the stats plate.
// Emulates the phones, measures, and taps where the chip used to be.
//   node scripts/phone_block_hint_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9938);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'chrome' }), args: ['--mute-audio'] });
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${JSON.stringify(x)}`); };
const overlap = (a, b) => a && b && Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1;
for (const [vw, vh] of [[667, 375], [842, 325], [1180, 820]]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: UA });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof player !== 'undefined', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.cls = 'rogue'; player.level = 12; player.hp = player.maxHp = 600; player._god = true;
    loadMap('town'); game.paused = false;
    await new Promise((r) => setTimeout(r, 2500));
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false; document.body.classList.remove('forced-modal', 'cinematic');
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  });
  await page.waitForTimeout(1500);
  const g = await page.evaluate(() => {
    const R = (q) => { const e = document.querySelector(q); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); };
    const blk = document.querySelector('#mobile-deck .mc-block'), br = blk.getBoundingClientRect();
    const hit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    return { body: /mc-landscape/.test(document.body.className), hint: R('#hotkey-hint'), block: R('#mobile-deck .mc-block'), plate: R('#top-ui'), dpad: R('#mobile-deck .mc-dpad'),
      z: R('#mobile-deck .mc-basic'), x: R('#mobile-deck .mc-skill[data-mkey="x"]'), blockLive: !!hit && blk.contains(hit) };
  });
  // the first uncovered point of the chip when it is drawn (forced on for one measurement, then released), a thumb's reach from X and Z
  const spot = await page.evaluate(() => { const e = document.getElementById('hotkey-hint'); if (!e) return null; e.style.setProperty('display', 'block', 'important');
    const r = e.getBoundingClientRect(); let pt = null;
    for (let x = r.left + 3; x < r.right && !pt; x += 5) for (let y = r.top + 3; y < r.bottom && !pt; y += 4) { const t = document.elementFromPoint(x, y); if (t && e.contains(t)) pt = [Math.round(x), Math.round(y)]; }
    e.style.removeProperty('display'); return pt || (r.width ? [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)] : null); });
  const [tx, ty] = spot || [0, 0];
  let opened = null;
  if (tx) { await page.touchscreen.tap(tx, ty); await page.waitForTimeout(600);
    opened = await page.evaluate(() => { const m = document.getElementById('keybind-modal'); return !!m && getComputedStyle(m).display !== 'none' && m.getClientRects().length > 0; }); }
  const tag = vw + 'x' + vh;
  ok(`${tag}: the phone deck is up`, g.body, g.body);
  ok(`${tag}: no Hotkeys chip on the touch deck`, !g.hint, g.hint);
  ok(`${tag}: a tap where the chip sat (between X and Z) does not open the keyboard remap panel`, opened === false, { at: [tx, ty], opened });
  ok(`${tag}: Block is off the stats plate`, !overlap(g.block, g.plate), { block: g.block, plate: g.plate });
  ok(`${tag}: Block clears the d-pad and stays on screen and tappable`, !overlap(g.block, g.dpad) && g.block[1] >= 0 && g.block[3] <= vh && g.blockLive, { block: g.block, dpad: g.dpad, live: g.blockLive });
  ok(`${tag}: no page errors`, errs.length === 0, errs.slice(0, 2));
  await ctx.close();
}
await browser.close(); server.kill();
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
