// Lag pass 2 (v0.29.737) verification — the contracts, not the internals:
//   1. status tint still RENDERS on sprite mobs (burn = warm, freeze = cool)
//      now that it routes through the tint bake instead of live ctx.filter
//   2. the bake global NEVER leaks: _lxMobTintFilter is null after any draw
//      (a leak would tint the NEXT mob/player drawn — the failure mode that
//      made the old cap design "safe" and this one needs proof against)
//   3. the fx gradient caches exist and actually fill on slash/stab/explosion
//   4. the pad-root memo returns a stable value and the raw scan still exists
//   5. equipment/monster frames draw error-free for a stretch of live frames
// Run: node scripts/status_tint_bake_test.mjs [file.html]
// Against a pre-.737 build the wiring checks (3/4) FAIL — that is the
// negative control proving they test the new code, not tautologies.
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
await page.waitForFunction(() => typeof drawMonster === 'function' && typeof spawnMonster === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.waitForTimeout(4000);

const r = await page.evaluate(async () => {
  const out = {};
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  game.paused = true;

  // --- the unit under test is _drawMonsterSprite (the status block lives
  // there), so call it DIRECTLY: many types route to procedural draws in
  // drawMonster, and a spawn-table mob adds engine noise. A minimal mob
  // object + a decoded sprite exercise exactly the changed code. ---
  // Some types (snail, sparkling) draw with per-call shimmer/anim noise that
  // would swamp a tint comparison — probe candidates and take the first whose
  // back-to-back draws are pixel-stable.
  const cands = Object.keys(MONSTER_SPRITES).filter((k) =>
    !MONSTER_ANIMS[k] && MONSTER_SPRITES[k] && MONSTER_SPRITES[k].complete && MONSTER_SPRITES[k].naturalWidth).slice(0, 10);
  let t = null, m = null;
  for (const cand of cands) {
    const mm = { type: cand, x: 0, y: 0, w: 80, h: 80, facing: 1, currentHp: 100, maxHp: 100,
                 burnTimer: 0, freezeTimer: 0, stunTimer: 0, _dotKind: null };
    const one = () => {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 1280, 800); ctx.restore();
      try { _drawMonsterSprite(mm, 640, 400); } catch (e) { return null; }
      const d = ctx.getImageData(340, 40, 600, 560).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 30) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      return n ? { n, r: r / n, g: g / n, b: b / n } : null;
    };
    for (let i = 0; i < 4; i++) { try { _drawMonsterSprite(mm, 640, 400); } catch (e) {} await frame(); }
    const a = one(); await frame(); const b = one();
    if (a && b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1 && a.n === b.n) { t = cand; m = mm; break; }
  }
  out.type = t;
  out.spawned = !!t;
  if (!t) return out;

  // The scaled-sprite cache fills ASYNCHRONOUSLY (a fresh canvas is returned
  // before its bitmap lands), so warm it across real frames first; the
  // clear+draw+read triplet itself is synchronous (atomic vs the engine's
  // own loop). The tint bake itself is synchronous, but warm anyway.
  const sample = async () => {
    for (let i = 0; i < 5; i++) { try { _drawMonsterSprite(m, 640, 400); } catch (e) {} await frame(); }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    try { _drawMonsterSprite(m, 640, 400); } catch (e) { return { err: String(e).slice(0, 120) }; }
    const d = ctx.getImageData(340, 40, 600, 560).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 30) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    const leak = (typeof _lxMobTintFilter !== 'undefined') ? _lxMobTintFilter : '(absent)';
    if (!n) return { n: 0, leak };
    return { n, r: r / n, g: g / n, b: b / n, leak };
  };

  m.burnTimer = 0; m.freezeTimer = 0; m.stunTimer = 0; m._dotKind = null;
  out.clean = await sample();
  m.burnTimer = 200;                        // fire wash
  out.burn = await sample();
  // clean again right after — the leak's real victim would be here
  m.burnTimer = 0;
  out.after = await sample();
  m.freezeTimer = 200; m.burnTimer = 200;   // freeze outranks burn
  out.freeze = await sample();
  m.freezeTimer = 0; m.burnTimer = 0;

  // --- fx gradient caches fill from the real spawners. The slash/explosion
  // branches prefer decoded fx SPRITES and only build gradients as the
  // fallback, so blank the sprite table for the duration to force it. ---
  out.meleeCache = (typeof _MELEE_GRAD_CACHE !== 'undefined') ? 'yes' : 'no';
  out.exploCache = (typeof _EXPLO_GRAD_CACHE !== 'undefined') ? 'yes' : 'no';
  if (out.meleeCache === 'yes') {
    const saved = {};
    for (const k of Object.keys(LX_FX)) { saved[k] = LX_FX[k]; LX_FX[k] = null; }
    game.smoothFx = [];
    spawnSmoothSlash(game.camera.x + 300, 300, 0, 80, '#ff6633');
    spawnStabImpact(game.camera.x + 350, 320, 1, 90, '#66ccff');
    spawnSmoothExplosion(game.camera.x + 400, 340, 60, '#ffcc66', 'rgba(255,80,0,0.5)');
    // age them to mid-life: the slash reveal and the explosion radius are
    // driven by the update tick (paused here), and both draw nothing at age 0
    for (const fx of game.smoothFx) {
      fx.life = Math.round(fx.maxLife * 0.5);
      if (fx.type === 'explosion') fx.radius = fx.maxRadius * 0.6;
    }
    try { drawSmoothFx(); out.fxErr = null; } catch (e) { out.fxErr = String(e).slice(0, 120); }
    out.meleeN = _MELEE_GRAD_CACHE.size;
    out.exploN = _EXPLO_GRAD_CACHE.size;
    game.smoothFx = [];
    for (const k of Object.keys(saved)) LX_FX[k] = saved[k];
  }

  // --- pad-root memo ---
  out.scanFn = typeof _lxPadModalRootScan;
  const a1 = _lxPadModalRoot(), a2 = _lxPadModalRoot();
  out.memoStable = a1 === a2;

  // --- live frames: nothing throws with the new draw paths under real load ---
  game.paused = false;
  for (let i = 0; i < 90; i++) await frame();
  out.leakLive = (typeof _lxMobTintFilter !== 'undefined') ? _lxMobTintFilter : '(absent)';
  return out;
});
await browser.close();

const L1 = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
console.log(`  mob: ${r.type}; clean n=${r.clean && r.clean.n}`);
for (const k of ['clean', 'burn', 'freeze', 'after']) if (r[k] && r[k].n) console.log(`  ${k.padEnd(6)} r ${r[k].r.toFixed(1)} g ${r[k].g.toFixed(1)} b ${r[k].b.toFixed(1)}`);
check(r.spawned && r.clean && r.clean.n > 300, 'the sprite mob painted pixels at all', r.clean);
check(r.burn && !r.burn.err && L1(r.clean, r.burn) > 12, 'burn tint still renders through the bake', { L1: r.burn && L1(r.clean, r.burn) });
check(r.burn && (r.burn.r - r.burn.b) > (r.clean.r - r.clean.b) + 5, 'and it leans WARM (fire), not just different', { burn: r.burn });
// The freeze filter colourises: on a green-dominant base the result is icy-
// pale with BLUE as the top channel — rank, not lean, is the robust signal.
check(r.freeze && r.freeze.b > r.freeze.g && r.freeze.b > r.freeze.r
      && (r.freeze.b - r.freeze.r) > (r.burn.b - r.burn.r) + 50,
      'freeze reads COOL (blue-dominant), unmistakably apart from burn (freeze outranks: it was set WITH burn)', { freeze: r.freeze, burn: r.burn });
check(r.after && L1(r.clean, r.after) < 6, 'a clean mob drawn right after an afflicted one is NOT tinted (no leak victim)', { L1: r.after && L1(r.clean, r.after) });
check(r.burn && r.burn.leak === null && r.after.leak === null, 'the tint global is null after every draw (leak-proof)', { burn: r.burn && r.burn.leak, after: r.after && r.after.leak });
check(r.leakLive === null, 'and still null after 90 live frames', r.leakLive);
check(r.meleeCache === 'yes' && r.exploCache === 'yes', 'the fx gradient caches are wired in', { melee: r.meleeCache, explo: r.exploCache });
check(!r.fxErr && r.meleeN >= 2 && r.exploN >= 1, 'slash+stab+explosion filled them without error', { err: r.fxErr, melee: r.meleeN, explo: r.exploN });
check(r.scanFn === 'function' && r.memoStable, 'pad-root memo: stable result, raw scan preserved', { scan: r.scanFn, stable: r.memoStable });
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
