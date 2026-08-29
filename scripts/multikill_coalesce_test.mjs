// A 30-kill wipe may not thrash layout or mint 30 toasts.
// ============================================================================
// v0.30.277: per-kill DOM work coalesces per frame. Profiled before the fix,
// a 40-kill wipe spent 26-34ms in `get offsetWidth` (one forced reflow per
// kill from _renderMasteryBar's pop-replay) inside a ~55ms synchronous stall;
// after, the wipe task measures ~11ms and offsetWidth leaves the profile.
//
// The test asserts the MECHANISM, not machine-dependent milliseconds:
//   1. offsetWidth reads during the wipe task: patched <= 6, baseline ~30+
//      (counted via an instrumented getter on HTMLElement.prototype).
//   2. the wipe yields ONE merged kill toast, not a stack of four survivors.
//   3. CONTROL: the kills really processed (game.kills advanced) and the
//      mastery bar is visible - so a pass cannot come from the HUD simply
//      not rendering.
// Run: node scripts/multikill_coalesce_test.mjs
//      MOJI_GAME_FILE=scripts/_pre277.html ... -> must FAIL checks 1 and 2.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11051);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);

const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 6000); await page.waitForTimeout(1500);
await click('#auth-submit', 6000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const ready = await page.evaluate(() => {
    const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40);
  });
  if (ready) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => {
  const o = document.getElementById('class-options');
  if (o && o.firstElementChild) o.firstElementChild.click();
});
let inControl = false;
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) { inControl = true; break; }
}

const R = inControl ? await page.evaluate(async () => {
  try { loadMap('forest'); game.paused = false; } catch (e) {}
  await new Promise((r) => setTimeout(r, 4000));
  let spawned = 0;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2, r = 120 + (i % 4) * 55;
    const m = spawnMonster(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r,
      ['snail', 'slime', 'petalfly'][i % 3], false);
    if (m && !m._suppressed) spawned++;
  }
  await new Promise((r) => setTimeout(r, 900));

  // Count offsetWidth READS during the wipe task only.
  const proto = HTMLElement.prototype;
  const d = Object.getOwnPropertyDescriptor(proto, 'offsetWidth')
    // Chromium defines it on Element.prototype in some versions.
    || Object.getOwnPropertyDescriptor(Element.prototype, 'offsetWidth');
  let reads = 0;
  const host = d && d.get ? (Object.getOwnPropertyDescriptor(proto, 'offsetWidth') ? proto : Element.prototype) : null;
  if (host) Object.defineProperty(host, 'offsetWidth', {
    configurable: true, enumerable: d.enumerable,
    get() { reads++; return d.get.call(this); },
  });
  const kills0 = game.kills | 0;
  for (const m of [...game.monsters]) if (!m.isBoss) killMonster(m);
  const readsDuringWipe = reads;
  if (host) Object.defineProperty(host, 'offsetWidth', d);   // restore

  await new Promise((r) => setTimeout(r, 400));
  const toasts = [...document.querySelectorAll('.coin-toast-kill')];
  const mb = document.getElementById('mastery-bar');
  return {
    spawned,
    kills: (game.kills | 0) - kills0,
    readsDuringWipe,
    toastCount: toasts.length,
    toastText: toasts[0] ? (toasts[0].textContent || '').slice(0, 40) : '',
    masteryShown: !!(mb && getComputedStyle(mb).display !== 'none'),
    instrumented: !!host,
  };
}) : null;

await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

if (!R) ok('reached gameplay', false, 'prologue never cleared');
else {
  console.log(`  spawned ${R.spawned}, kills processed ${R.kills}, offsetWidth reads during wipe: ${R.readsDuringWipe}`);
  console.log(`  kill toasts after wipe: ${R.toastCount}  first: "${R.toastText}"  mastery bar shown: ${R.masteryShown}`);
  ok('CONTROL: the wipe really processed a pack', R.spawned >= 20 && R.kills >= 20,
     `${R.kills} kills from ${R.spawned} spawned`);
  ok('CONTROL: instrumentation attached', R.instrumented);
  ok('CONTROL: the mastery bar still renders (the fix must not hide the HUD)', R.masteryShown);
  // Pre-fix: one forced reflow per kill (~30). Post-fix: one per frame for the
  // bar (+ a handful from unrelated UI) - the margin between 6 and 30 is wide.
  ok('the wipe does not thrash layout', R.readsDuringWipe <= 6,
     `${R.readsDuringWipe} offsetWidth reads in the wipe task (pre-v0.30.277: ~one per kill)`);
  ok('same-frame kills merge into one toast', R.toastCount === 1 && /\+\d/.test(R.toastText),
     `${R.toastCount} toast(s), first reads "${R.toastText}" (pre-fix: the 4-cap survivors of 30)`);
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
