// Gravitos' 3rd form gives you time to answer its one-shots, per user:
// "Gravitos 3rd form is still impossible to beat because of the short time span
// for OHKO moves".
//
// Measured before changing anything: the warn window was 2 * 60 game frames in
// EVERY phase. Phase 3 was never given less time — it is given less
// information, because v0.29.261 deliberately dropped the named callout there.
// Two seconds is a reaction window for a telegraph you can name; it is not a
// decision window for one of three one-shots that each need a different answer.
//
// This reads the window off the live boss by watching _ohkoWarnUntil open, so
// it measures what the fight actually grants rather than a source literal.
// Run: node scripts/gravitos_ohko_warn_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 90; player._gravitosCineSeen = true;
  loadMap('gravitosArena');
});
await page.waitForTimeout(9000);

// Measure the granted window in game.time frames — the unit the game uses, and
// the only one that converts cleanly to seconds (60 = 1s). Wall-clock rAF
// frames do NOT: this harness runs several rAF ticks per game.time tick.
const measure = (phase) => page.evaluate(async (PHASE) => {
  const f = () => new Promise((res) => requestAnimationFrame(res));
  const m = game.monsters.find((x) => x.type === 'gravitos');
  if (!m) return { noBoss: true };
  m._ohkoWarnUntil = null;
  const windows = [];
  for (let i = 0; i < 12000 && windows.length < 3; i++) {
    m.maxHp = 1e6;
    m.currentHp = PHASE >= 3 ? 1e5 : (PHASE === 2 ? 5e5 : 9e5);
    m.aggro = true;
    player.hp = player.maxHp = 9e8; player.mp = player.maxMp || 100;
    player.x = m.x + m.w + 140; player.y = m.y + m.h - player.h;
    const warnBefore = m._ohkoWarnUntil;
    await f();
    // The instant the warn opens, its length is (target - now) in game frames.
    if (warnBefore == null && m._ohkoWarnUntil != null) {
      windows.push(Math.round(m._ohkoWarnUntil - (game.time | 0)));
    }
  }
  return { windows, phase3: !!(PHASE >= 3) };
}, phase);

const p1 = await measure(1);
const p3 = await measure(3);
await browser.close();

const secs = (f) => (f / 60).toFixed(2);
console.log(`  phase 1 warn windows (game frames): ${JSON.stringify(p1.windows)}  -> ${p1.windows.map(secs).join('s, ')}s`);
console.log(`  phase 3 warn windows (game frames): ${JSON.stringify(p3.windows)}  -> ${p3.windows.map(secs).join('s, ')}s`);

check(!p1.noBoss && p1.windows.length > 0, 'the warn window was observed opening', p1.windows);
check(p1.windows.every((w) => w === 120), 'phases 1-2 keep their 2.0s window', p1.windows);
check(p3.windows.length > 0 && p3.windows.every((w) => w === 210),
      'phase 3 now grants 3.5s to identify and answer the one-shot (was 2.0s)', p3.windows);
check(p3.windows.every((w) => w > p1.windows[0]),
      'and it is strictly longer than the earlier phases', { p3: p3.windows[0], p1: p1.windows[0] });
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
