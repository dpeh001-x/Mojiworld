// The Singularity's boss frames must actually shrink before the fight.
//
// Per user: "It has an incredible amount of lag when fighting gravitos."
// Root cause found: the v0.29.742 memo fast-path in the boss-frame bake pump
// called swap() three lines ABOVE swap's own `const` declaration, so it threw
// ReferenceError inside a Promise executor every time it hit. The pump
// consumed the rejection with a bare .then(), so each throw permanently
// leaked one of its four concurrent slots — four throws wedged it forever.
// Consequences, both measured: the Gravitos frames stayed at their 1656px
// source size for the whole fight, and the boss-sizing pre-derive that runs
// AFTER the pump promise (the pass whose entire job is keeping getImageData
// sweeps out of the fight) never ran at all.
//
// What this asserts, by inspecting the live registry rather than the source:
//   1. entering the Singularity raises no page errors
//   2. the phase-1 Gravitos frames are baked down, not left at source size
//   3. the boss-sizing derive still runs clean (smoke check)
// Run: node scripts/gravitos_bake_pump_test.mjs [file.html]
// Negative control: a pre-fix build throws 4 ReferenceErrors and leaves 13 of
// 14 frames at 1656px, failing checks 1 and 2.
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
await page.waitForFunction(() => typeof loadMap === 'function' && typeof BOSS_SPRITES !== 'undefined', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 100; player._gravitosCineSeen = true;
  loadMap('gravitosArena');
});
await page.waitForTimeout(22000);   // the warm pump + entry beats

const r = await page.evaluate(() => {
  const out = {};
  // The warm pass deliberately SKIPS the later phases (_warmMapArt is called
  // with skip:/^gravitos[23]/ for this arena) because they are not on screen
  // when the fight opens — they shrink lazily later. So the contract here is
  // about the phase-1 set, which IS warmed and IS what the tutorial fights.
  const all = Object.keys(BOSS_SPRITES || {}).filter((k) => /^gravitos/i.test(k));
  const p1 = all.filter((k) => !/^gravitos[23]/i.test(k));
  const info = (k) => {
    const im = BOSS_SPRITES[k];
    if (!im) return null;
    const w = im.naturalWidth || im.width || 0, h = im.naturalHeight || im.height || 0;
    return { k, w, h, mp: +(w * h / 1e6).toFixed(2), canvas: /Canvas/.test(im.constructor.name) };
  };
  out.all = all.length;
  out.p1 = p1.map(info).filter(Boolean);
  out.p1Baked = out.p1.filter((f) => f.canvas).length;
  out.p1AtSource = out.p1.filter((f) => Math.max(f.w, f.h) >= 1600).length;
  out.p1MP = +out.p1.reduce((a, b) => a + b.mp, 0).toFixed(1);
  // Smoke-check only: this calls the derive directly, and it computes lazily
  // on demand, so it passes on a wedged pump too. It is here to catch the
  // derive itself throwing, NOT as evidence the pump completed — the frame
  // sizes above are that evidence.
  out.refDerived = (() => {
    try {
      const probe = _deriveBossRefHeight('gravitos', null);
      return typeof probe === 'number' && probe > 0;
    } catch (e) { return 'THREW:' + String(e).slice(0, 60); }
  })();
  return out;
});
await browser.close();

const tdz = errs.filter((e) => /Cannot access 'swap'/.test(e));
console.log(`  ${r.all} gravitos frames; phase-1 set: ${r.p1.map((f) => f.k + ' ' + f.w + 'x' + f.h + (f.canvas ? ' (baked)' : ' (SOURCE)')).join(', ')}`);
console.log(`  phase-1 total: ${r.p1MP} MP, baked ${r.p1Baked}/${r.p1.length}`);

check(tdz.length === 0, 'no temporal-dead-zone throw from the bake pump (the wedge that caused this)', tdz);
check(errs.length === 0, 'and no page errors at all entering the Singularity', [...new Set(errs)].slice(0, 4));
check(r.p1.length >= 3, 'the phase-1 Gravitos frames exist to be measured', r.p1.length);
check(r.p1AtSource === 0, 'none of them are still at their 1656px source size', r.p1.filter((f) => Math.max(f.w, f.h) >= 1600).map((f) => f.k));
check(r.p1Baked === r.p1.length, 'every one of them is a baked canvas, not the raw image', { baked: r.p1Baked, of: r.p1.length });
// Measured: 8.1 MP with one frame baked before the fix, 2.5 MP with all four after.
check(r.p1MP < 6, 'and the set is a fraction of the source megapixels it used to carry', r.p1MP);
check(r.refDerived === true, 'the boss-sizing derive runs without throwing (smoke check, not pump evidence)', r.refDerived);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
