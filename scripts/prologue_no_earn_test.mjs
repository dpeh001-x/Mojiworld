// v0.30.x — NOTHING IN A MEMORY IS EARNED.
// The intro is a flash-forward played at player.level = 100 with a master class.
// Two permanent, PERSISTED progression maps were written during it and were not
// in the four-field prologue snapshot, so they outlived the reset to Lv.1:
//
//   game.achievements — one prologue kill latched the whole lv10..lv100 chain
//                       and fired the matching Steam unlocks, which no restore
//                       can take back.
//   game.early        — _earlyState() grandfathers the entire Trainee Path at
//                       level >= 10, so the new character silently forfeited
//                       ~54k coins, 40+ setshards and +5 ATK/+5 DEF.
//
// This is the same root cause as the Guguma ascension chip (v0.30.502): the
// borrowed level bleeding into the real character.
//
//   node scripts/prologue_no_earn_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11227);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Pro');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const out = {};
  const lv0 = player.level;

  // ---- reproduce the apex segment's conditions exactly
  delete game.early;
  delete game.achievements;
  window._prologueActive = true;
  player.level = 100;

  // the two writers that ran unguarded during the intro
  try { checkAchievements(); } catch (e) { out.achErr = String(e && e.message).slice(0, 90); }
  try { if (typeof _earlyState === 'function') _earlyState(); } catch (e) { out.earlyErr = String(e && e.message).slice(0, 90); }

  out.achDuringPrologue = Object.keys(game.achievements || {}).length;
  out.earlyGrandfathered = !!(game.early && (game.early.grandfathered
    || Object.keys(game.early.done || {}).length > 0));

  // ---- and the same calls on a REAL level-100 character must still work
  window._prologueActive = false;
  delete game.early;
  delete game.achievements;
  try { checkAchievements(); } catch (e) {}
  try { if (typeof _earlyState === 'function') _earlyState(); } catch (e) {}
  out.achAtRealCap = Object.keys(game.achievements || {}).length;
  out.earlyGrandfatheredAtRealCap = !!(game.early && (game.early.grandfathered
    || Object.keys(game.early.done || {}).length > 0));

  // ---- and a genuine fresh Lv.1 character must still get the real ladder
  delete game.early;
  player.level = 1;
  try { if (typeof _earlyState === 'function') _earlyState(); } catch (e) {}
  out.earlyFreshDone = Object.keys((game.early && game.early.done) || {}).length;

  player.level = lv0;
  return out;
});

console.log(JSON.stringify(r));
const checks = [
  ['a prologue kill latches NO achievements', r.achDuringPrologue === 0, 'got ' + r.achDuringPrologue],
  ['the prologue does NOT grandfather the Trainee Path away', r.earlyGrandfathered === false],
  ['a real Lv.100 character still unlocks achievements', r.achAtRealCap > 0, 'got ' + r.achAtRealCap],
  ['...and an established Lv.100 save is still grandfathered', r.earlyGrandfatheredAtRealCap === true],
  ['a fresh Lv.1 character still gets the real ladder', r.earlyFreshDone === 0, 'done=' + r.earlyFreshDone],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
