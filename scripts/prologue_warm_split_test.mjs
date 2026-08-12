// The prologue's blocking warm covers form 1 only, and the deferred phase art
// still gets baked. Measures the REAL _warmMapArt cost both ways on the same
// page, so the numbers are comparable rather than two separate runs.
// Run: node scripts/prologue_warm_split_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _warmMapArt === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = false;
});
await page.waitForTimeout(4000);

const r = await page.evaluate(async () => {
  const SKIP = /^gravitos[23]/;
  const isCanvas = (im) => im && typeof HTMLCanvasElement !== 'undefined' && im instanceof HTMLCanvasElement;
  const countBaked = (re) => {
    let baked = 0, total = 0;
    for (const k of Object.keys(BOSS_SPRITES)) {
      if (!re.test(k)) continue;
      for (const arr of [BOSS_IDLE_FRAMES[k], BOSS_WALK_FRAMES[k], BOSS_ATTACK_FRAMES[k]]) {
        for (const im of (arr || [])) { total++; if (isCanvas(im)) baked++; }
      }
    }
    return { baked, total };
  };

  // 1. the blocking pass the prologue actually issues
  const t0 = performance.now();
  const bakedA = await _warmMapArt('gravitosArena', { skip: SKIP });
  const blockingMs = Math.round(performance.now() - t0);
  const afterA = { phase: countBaked(SKIP), form1: countBaked(/^gravitos(?![23])/) };

  // 2. the background pass that follows
  const t1 = performance.now();
  const bakedB = await _warmMapArt('gravitosArena');
  const backgroundMs = Math.round(performance.now() - t1);
  const afterB = { phase: countBaked(SKIP), form1: countBaked(/^gravitos(?![23])/) };

  return { blockingMs, backgroundMs, bakedA, bakedB, afterA, afterB, totalMs: blockingMs + backgroundMs };
});
await browser.close();

console.log(`blocking ${r.blockingMs} ms (${r.bakedA} slots) | background ${r.backgroundMs} ms (${r.bakedB} slots) | total ${r.totalMs} ms`);
console.log(`after blocking : form1 ${r.afterA.form1.baked}/${r.afterA.form1.total} baked, phase2-3 ${r.afterA.phase.baked}/${r.afterA.phase.total}`);
console.log(`after backgrnd : form1 ${r.afterB.form1.baked}/${r.afterB.form1.total} baked, phase2-3 ${r.afterB.phase.baked}/${r.afterB.phase.total}`);

// The point of the change: the hold is SHORTER, not merely moved again. The
// full warm measured 13.5 s on the build before this; require a real cut with
// margin so a regression that quietly re-includes the phase art fails here.
check(r.blockingMs < 9000, 'the blocking warm is well under the 13.5 s it replaced', r.blockingMs);
check(r.blockingMs > 200, 'and it is doing real work (not silently skipping everything)', r.blockingMs);
check(r.afterA.phase.baked === 0, 'the blocking pass bakes NO phase-2/3 art', r.afterA.phase);
check(r.afterA.form1.baked > 0, 'but it does bake the form-1 art the fight opens with', r.afterA.form1);
check(r.afterB.phase.baked === r.afterB.phase.total, 'the background pass finishes the phase art', r.afterB.phase);
check(r.bakedB > 0, 'the background pass actually had work left to do', r.bakedB);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
