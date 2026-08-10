// HIT SPARK TEST — v0.29.439. Traps the real spawnSpriteBurst during real
// hitMonster calls and checks the four requested behaviours:
//   1. EDGE     the spark lands on the monster's rim facing the player, not
//               at its centre (and stays inside the silhouette).
//   2. OPACITY  85%.
//   3. SIZE     scales with damage dealt, not just crit.
//   4. RANGE    bigger than the old flat 36/48, but bounded.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof hitMonster === 'function' && typeof spawnMonster === 'function', { timeout: 60000 });

const out = await page.evaluate(() => {
  const R = [];
  const ok = (n, c, d) => R.push({ n, pass: !!c, d: d || '' });
  const caught = [];
  const orig = window.spawnSpriteBurst;
  window.spawnSpriteBurst = function (x, y, key, opts) {
    if (/^hit_/.test(String(key))) caught.push({ x, y, key, size: opts && opts.size, opacity: opts && opts.opacity });
    return orig.apply(this, arguments);
  };

  const fire = (dmg, crit, playerSide) => {
    game.monsters.length = 0;
    const m = spawnMonster(600, 300, 'slime', false, false);
    if (!m || m._suppressed) return null;
    m.w = 120; m.h = 120; m.x = 600; m.y = 300;         // big target so edge vs centre is unambiguous
    m.currentHp = 1e9; m.maxHp = 1e9;
    player.hp = 100; player.atk = 100; player.cls = 'mage';
    // Level-gap accuracy gate: at the harness's boot level this mob is hit
    // ~76% of the time, so a two-sample test (left + right) flaked ~40% of
    // runs with no spark to inspect. Parity level + no evasion removes both
    // dice; the spark path itself is unchanged.
    try { player.level = Math.max(player.level || 1, _mobLevel(m)); } catch (e) {}
    m.evasion = 0;
    player.x = playerSide === 'left' ? 300 : 900; player.y = 330; player.w = 40; player.h = 60;
    game._lastClassHitFxFrame = -1;                      // clear the one-per-frame coalesce
    caught.length = 0;
    for (let i = 0; i < 20 && !caught.length; i++) {
      game._lastClassHitFxFrame = -1;                     // re-clear the per-frame coalesce
      hitMonster(m, dmg, crit, 'fireball');               // a non-basic skill -> spark path
    }
    const c = caught[caught.length - 1] || null;
    return c ? { ...c, mcx: m.x + m.w / 2, mcy: m.y + m.h / 2, mw: m.w, mh: m.h } : null;
  };

  const left = fire(100, false, 'left');
  const right = fire(100, false, 'right');
  ok('spark spawns on a skill hit', !!left);
  if (left && right) {
    // 1 — EDGE: offset from centre should be a large fraction of the radius,
    // and it must flip sides with the player.
    const offL = left.x - left.mcx, offR = right.x - right.mcx;
    ok('lands off-centre, not at the midpoint', Math.abs(offL) > left.mw * 0.25, `offset ${Math.round(offL)}px of r=${left.mw / 2}`);
    ok('offset points TOWARD the player (flips sides)', offL < 0 && offR > 0, `left-player ${Math.round(offL)}, right-player ${Math.round(offR)}`);
    ok('stays inside the silhouette', Math.abs(offL) <= left.mw / 2, `|${Math.round(Math.abs(offL))}| <= ${left.mw / 2}`);
    // 2 — OPACITY. Checking the option we passed in only proves the plumbing
    // accepted it; a parallel session once clobbered the draw-side line and
    // this test still went green while the setting did nothing. So render the
    // burst for real and read the globalAlpha the canvas actually receives.
    ok('opacity option reaches the burst', left.opacity === 0.85, String(left.opacity));
    // Record EVERY alpha the canvas is handed while this one burst draws —
    // reading only the last value catches whatever reset it afterwards.
    // A fresh burst at life==maxLife has base alpha 1, so 0.85 must appear
    // verbatim if the opacity multiplier is wired to the draw.
    game.smoothFx = [];
    spawnSpriteBurst(400, 300, 'hit_mage', { life: 20, size: 48, opacity: 0.85 });
    const alphas = [];
    const proto = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalAlpha');
    Object.defineProperty(ctx, 'globalAlpha', {
      configurable: true,
      get() { return proto.get.call(this); },
      set(v) { alphas.push(v); proto.set.call(this, v); },
    });
    try { drawSmoothFx(); } catch (e) { /* unrelated fx may be absent */ }
    delete ctx.globalAlpha;
    const hit85 = alphas.some((a) => Math.abs(a - 0.85) < 0.02);
    ok('RENDERED alpha is 85%, not full strength', hit85,
       `alphas seen: ${alphas.length ? alphas.map((a) => a.toFixed(2)).join(', ') : 'none — burst never drew (sprite undecoded?)'}`);
  }
  // 3/4 — SIZE vs DAMAGE (player.atk pinned at 100)
  const sizes = {};
  for (const [label, dmg] of [['chip 25 (0.25x atk)', 25], ['solid 100 (1x)', 100], ['heavy 250 (2.5x)', 250], ['execute 500 (5x)', 500]]) {
    const r = fire(dmg, false, 'left');
    sizes[label] = r && r.size;
  }
  const vals = Object.values(sizes);
  ok('size scales with damage', vals[0] < vals[3], `${vals.join(' -> ')}`);
  ok('smallest is bigger than the old 36', vals[0] > 36, `${vals[0]} vs 36`);
  ok('largest is bounded (not too large)', vals[3] <= 72, `${vals[3]} <= 72`);
  // Clamp check must compare two points BOTH past the ceiling. 2.5x raw is not
  // there yet — sizes track damage DELIVERED (post-DEF), so raw 250 lands well
  // under 3.5x effective. 5x and 20x are both comfortably past it.
  const huge = fire(2000, false, 'left');
  ok('clamps at the ceiling (5x vs 20x identical)', huge && huge.size === vals[3], `${vals[3]} vs ${huge && huge.size}`);
  const critR = fire(100, true, 'left');
  ok('crit is larger than the same non-crit', critR && critR.size > sizes['solid 100 (1x)'], `${critR && critR.size} vs ${sizes['solid 100 (1x)']}`);

  window.spawnSpriteBurst = orig;
  game.monsters.length = 0;
  return { R, sizes };
});
await browser.close();

let bad = 0;
for (const r of out.R) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  (' + r.d + ')' : ''}`); }
console.log('\nsize by damage:');
for (const [k, v] of Object.entries(out.sizes)) console.log(`   ${k.padEnd(22)} ${v}px`);
console.log(errs.length ? '\npage errors: ' + errs.join(' | ') : '\nno page errors');
console.log(`${out.R.length - bad}/${out.R.length} passed`);
process.exit(bad || errs.length ? 1 : 0);
