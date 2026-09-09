// v0.30.x — GUGUMA'S ASCENSION CHIP ONLY EXISTS AT THE REAL CAP.
// Guards the exact regression the user reported ("This is showing when i just
// created my character: not supposed to have it"): the prologue is a
// flash-forward played at player.level = 100, so the slow guard raised the
// ascension chip DURING the intro, and nothing took it down when the prologue
// clamped the character back to Lv.1 — the removal path lives behind a
// function that is not called once the level is under the cap.
//
// Four states, because the failure needed two of them at once:
//   prologue @ Lv100  -> no chip   (a borrowed level is not the cap)
//   real     @ Lv100  -> chip      (the offer still has to work)
//   dropped  @ Lv1    -> no chip   (the reconciler takes it back down)
//   maxed prestige    -> no chip   (nothing left to offer)
//
//   node scripts/guguma_ascend_gate_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11217);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Gug');
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

// The guard runs on a 4s interval, so every state has to be given more than one
// tick to settle — otherwise this passes on timing rather than on behaviour.
const TICK = 9000;
const r = await page.evaluate(async (TICK) => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const shown = () => !!document.getElementById('guguma-ascend');
  const out = {};
  const capLevel = (typeof PRESTIGE_LEVEL !== 'undefined') ? PRESTIGE_LEVEL : 100;
  out.capLevel = capLevel;

  // start clean, whatever the boot left behind
  if (typeof _gugumaAscendChip === 'function') _gugumaAscendChip(false);
  game.prestige = game.prestige || { count: 0 };
  game.prestige.count = 0;

  // 1) the prologue's borrowed cap must not raise it
  window._prologueActive = true;
  player.level = capLevel;
  await wait(TICK);
  out.duringPrologue = shown();

  // 2) ...and the real cap still must
  window._prologueActive = false;
  player.level = capLevel;
  await wait(TICK);
  out.atRealCap = shown();

  // 3) dropping back under the cap takes it down again (the reported bug: it did not)
  player.level = 1;
  await wait(TICK);
  out.afterDropToOne = shown();

  // 4) nothing to offer once the ladder is finished
  player.level = capLevel;
  await wait(TICK);
  out.backAtCap = shown();
  game.prestige.count = 20;
  await wait(TICK);
  out.atMaxPrestige = shown();

  // leave it as we found it
  game.prestige.count = 0; player.level = 1;
  if (typeof _gugumaAscendChip === 'function') _gugumaAscendChip(false);
  return out;
}, TICK);

console.log(JSON.stringify(r));
const checks = [
  ['the prologue\'s Lv.' + r.capLevel + ' flash-forward does NOT raise the chip', r.duringPrologue === false],
  ['a real Lv.' + r.capLevel + ' character still gets the offer', r.atRealCap === true],
  ['dropping back under the cap takes the chip down (the reported bug)', r.afterDropToOne === false],
  ['returning to the cap offers it again', r.backAtCap === true],
  ['a finished prestige ladder offers nothing', r.atMaxPrestige === false],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
