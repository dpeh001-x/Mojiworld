// The HUD Taxi button, pop comic.
//
// Per user: "this taxi modal can be designed with black white and Yellow to have a strong pop comic feel" (on a
// crop of the HUD Taxi button). Checks, in the running game:
//   1. black with taxi-yellow lettering in heavy capitals, a hard yellow offset (a drop-shadow filter, so
//      low-effects mode keeps it), and a black-and-white checker stripe down the left edge (second pass, per
//      user: "make the background black and the TAXI yellow")
//   2. the lettering clears #hotkey-hint, which has always overlapped the button's top edge by a few px
//   3. it flips to yellow with ink lettering under the pointer, and a click still opens the Taxi window
//   4. the "K Hotkeys & Skills" hint above it in the same style (per user: "The K hotkeys & skills could improve
//      with a similar style as well"): black, yellow capitals, a yellow offset, the K a yellow keycap; the cab's
//      lettering clears the hint's whole box; under the pointer it flips to yellow; a click still opens a panel
//   node scripts/taxi_button_test.mjs        (MOJI_GAME_FILE to test a candidate)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT || process.argv[2]; for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: process.env });
await new Promise((r) => setTimeout(r, 2000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openTaxi === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.evaluate(() => {
  try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
  document.querySelectorAll('[id^="story-beat"], #lo-stack, #tutorial-modal, #everdawn-welcome-overlay').forEach((e) => e.remove());
  player.cls = 'warrior'; player.level = 30; player.invulnerable = 9e9;
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
  loadMap('town', 300); game.paused = false;
});
await page.waitForTimeout(3000);
const A = await page.evaluate(() => {
  document.querySelectorAll('#lx-pause, #everdawn-welcome-overlay, [id^="story-beat"]').forEach((e) => e.remove());
  const t = document.getElementById('taxi-btn'), cs = getComputedStyle(t), af = getComputedStyle(t, '::after'), h = document.getElementById('hotkey-hint');
  const tn = [...t.childNodes].find((n) => n.nodeType === 3 && /taxi/i.test(n.textContent)); const rg = document.createRange(); if (tn) rg.selectNodeContents(tn);
  const txt = tn ? rg.getBoundingClientRect() : null, hs = h && getComputedStyle(h), hb = h && hs.display !== 'none' ? h.getBoundingClientRect() : null;
  // the hint's TEXT area: its box less its bottom border and padding (the hint is zoomed with the HUD, like the button)
  const z = hb ? hb.height / h.offsetHeight : 1, hr = hb ? { left: hb.left, right: hb.right, bottom: hb.bottom - (parseFloat(hs.borderBottomWidth) + parseFloat(hs.paddingBottom)) * z } : null;
  return { bg: cs.backgroundColor, border: cs.borderTopColor + ' ' + cs.borderTopWidth, color: cs.color, weight: cs.fontWeight, tt: cs.textTransform, filter: cs.filter, stripe: af.backgroundImage, stripeW: af.width, stripeLeft: af.left, txtTop: txt && txt.top, hintBottom: hr && hr.bottom, hintOverlaps: !!(hr && txt && hr.right > txt.left && hr.left < txt.right) };
});
ok('1. black with heavy taxi-yellow capitals and a hard yellow offset', A.bg === 'rgb(12, 11, 16)' && A.color === 'rgb(255, 228, 92)' && +A.weight >= 900 && A.tt === 'uppercase' && /drop-shadow\(rgb\(255, 228, 92\) 2\.5px 2\.5px 0px\)/.test(A.filter), JSON.stringify(A));
ok('1. a black-and-white checker stripe down the left edge', /^repeating-conic-gradient\(/.test(A.stripe) && /rgb\(12, 11, 16\)/.test(A.stripe) && /rgb\(244, 241, 234\)/.test(A.stripe) && A.stripeLeft === '0px' && parseFloat(A.stripeW) >= 5, JSON.stringify([A.stripe, A.stripeW, A.stripeLeft]));
ok('2. the TAXI lettering clears the text of the Hotkeys hint above it', A.hintBottom == null || !A.hintOverlaps || A.txtTop >= A.hintBottom - 0.5, JSON.stringify([A.txtTop, A.hintBottom, A.hintOverlaps]));
const box = await page.evaluate(() => { const r = document.getElementById('taxi-btn').getBoundingClientRect(); return { x: r.x + r.width * 0.7, y: r.y + r.height * 0.7 }; });
await page.mouse.move(box.x, box.y); await page.waitForTimeout(300);
await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} }));   // read the hover state, not a frame of its transition
const H = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('taxi-btn')); return cs.backgroundColor + ' / ' + cs.color; });
ok('3. it flips to yellow with ink lettering under the pointer', H === 'rgb(255, 228, 92) / rgb(12, 11, 16)', H);
await page.mouse.click(box.x, box.y); await page.waitForTimeout(500);
const O = await page.evaluate(() => { const m = document.getElementById('taxi-modal'); return !!m && m.style.display !== 'none' && getComputedStyle(m).display !== 'none'; });
ok('3. a click still opens the Taxi window', O, O);
await page.keyboard.press('Escape'); await page.evaluate(() => { if (typeof closeAllModals === 'function') closeAllModals(); }); await page.waitForTimeout(400);
const K = await page.evaluate(() => {
  const h = document.getElementById('hotkey-hint'), t = document.getElementById('taxi-btn'), cs = getComputedStyle(h), k = h.querySelector('kbd'), ks = getComputedStyle(k);
  const tn = [...t.childNodes].find((n) => n.nodeType === 3 && /taxi/i.test(n.textContent)); const rg = document.createRange(); rg.selectNodeContents(tn);
  return { bg: cs.backgroundColor, color: cs.color, weight: cs.fontWeight, tt: cs.textTransform, filter: cs.filter, kBg: ks.backgroundColor, kColor: ks.color, hintBottom: h.getBoundingClientRect().bottom, taxiText: rg.getBoundingClientRect().top };
});
ok('4. the hint: black, heavy yellow capitals, a yellow offset, the K a yellow keycap with an ink letter', K.bg === 'rgb(12, 11, 16)' && K.color === 'rgb(255, 228, 92)' && +K.weight >= 900 && K.tt === 'uppercase' && /drop-shadow\(rgb\(255, 228, 92\)/.test(K.filter) && K.kBg === 'rgb(255, 228, 92)' && K.kColor === 'rgb(12, 11, 16)', JSON.stringify(K));
ok('4. the cab\'s lettering clears the hint\'s whole box', K.taxiText >= K.hintBottom - 0.5, JSON.stringify([K.taxiText, K.hintBottom]));
const hb = await page.evaluate(() => { const r = document.getElementById('hotkey-hint').getBoundingClientRect(); return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 }; });
await page.mouse.move(hb.x, hb.y); await page.waitForTimeout(300); await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} }));
const KH = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('hotkey-hint')); return cs.backgroundColor + ' / ' + cs.color; });
ok('4. the hint flips to yellow with ink lettering under the pointer', KH === 'rgb(255, 228, 92) / rgb(12, 11, 16)', KH);
await page.mouse.click(hb.x, hb.y); await page.waitForTimeout(700);
const KO = await page.evaluate(() => [...document.querySelectorAll('.modal-overlay, [id$="-modal"]')].filter((m) => m.id !== 'taxi-modal' && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 40).map((m) => m.id));
ok('4. a click on the hint still opens a panel', KO.length > 0, JSON.stringify(KO));
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close(); srv.kill();
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.pass ? '' : '  -- ' + r.x));
const np = results.filter((r) => r.pass).length;
console.log('\n' + np + '/' + results.length + ' passed');
process.exit(np === results.length ? 0 : 1);
