// ELEMENTAL CONVERGENCE — the chain arcs as forked lightning.
// ============================================================================
// Per user: "The lightning chain of the elemental convergence skill can be
// regenerated with more spark and intensity".
//
// The arc between two hops was a single straight gradient beam. However many
// spark particles were sprinkled along it -- v0.26.126 already tripled them --
// the SHAPE underneath stayed a ruler-straight line, which is why it read as a
// glowing wire rather than a discharge. So the assertion is about geometry, not
// particle count: every hop must lay down real forked bolts whose vertices are
// off-axis, plus branches that connect to nothing.
//
// Measured from a real cast into a real line of monsters, reading game.smoothFx
// -- the effect list the renderer actually draws -- rather than the source.
// Run: node scripts/chain_lightning_fx_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9551);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'ChainTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  player.level = 99; player._god = true;
  player.cls = 'mage'; player.job = 'archmage';
  loadMap('forest', 300);
});
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  player.maxMp = 999999; player.mp = 999999; player.baseAtk = 500;
  player.skillCooldowns = {}; player._castLockUntil = 0;
  game.monsters.length = 0; game.smoothFx = []; game.particles.length = 0;
  // A line of targets within chain range (450 to the first, 300 per hop).
  const mobs = [];
  for (let i = 0; i < 5; i++) {
    const m = spawnMonster(player.x + 180 + i * 200, player.y - (i % 2) * 60, 'slime', false);
    if (m) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; m.speed = 0; mobs.push(m); }
  }
  await new Promise(r => setTimeout(r, 400));
  for (const m of mobs) { m.currentHp = m.maxHp; }
  const fxBefore = (game.smoothFx || []).length;
  const pBefore = (game.particles || []).length;
  castSkill('elemental');
  await new Promise(r => requestAnimationFrame(r));
  const fx = (game.smoothFx || []).slice();
  const bolts = fx.filter(f => f.type === 'bolt');
  const beams = fx.filter(f => f.type === 'beam');
  // How jagged is a bolt? Peak |offset| as a fraction of its length: a straight
  // line scores 0. Only the arcs (the long bolts) are measured -- the short
  // dead-end branches at each node are counted separately.
  const arcBolts = bolts.filter(b => b.length > 90);
  const branchBolts = bolts.filter(b => b.length <= 90);
  let jagFrac = 0, offAxisVerts = 0, totalVerts = 0;
  for (const b of arcBolts) {
    let peak = 0;
    for (const p of (b.pts || [])) { totalVerts++; if (Math.abs(p.off) > 1) offAxisVerts++; if (Math.abs(p.off) > peak) peak = Math.abs(p.off); }
    if (b.length > 0) jagFrac = Math.max(jagFrac, peak / b.length);
  }
  const hopCount = mobs.filter(m => m.currentHp < m.maxHp).length;
  const sparkAdded = (game.particles || []).length - pBefore;
  const branchy = arcBolts.filter(b => (b.branches || []).length >= 2).length;
  const rimmed = bolts.filter(b => b.rim !== false).length;
  // Budget: game.smoothFx is capped at MAX_SMOOTH_FX and evicts OLDEST first,
  // so spending more entries per hop deletes the START of a long chain.
  const kinds = {};
  for (const f of fx) kinds[f.type] = (kinds[f.type] || 0) + 1;
  return {
    hopCount, fxAdded: fx.length - fxBefore, sparkAdded, kinds,
    boltCount: bolts.length, arcBolts: arcBolts.length, branchy, rimmed,
    beamCount: beams.length,
    jagFrac: +jagFrac.toFixed(3), offAxisVerts, totalVerts,
    boltColors: [...new Set(bolts.map(b => b.color))],
    linkArt: !!(typeof LX_FX !== 'undefined' && LX_FX.elemental_link),
    cap: (typeof MAX_SMOOTH_FX !== 'undefined') ? MAX_SMOOTH_FX : null,
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 140) });

ok('the cast actually chained through several enemies', R.hopCount >= 3, `${R.hopCount} enemies hit`);
ok('every arc is forked lightning, not a straight beam',
   R.arcBolts >= R.hopCount && R.beamCount === 0,
   `${R.arcBolts} arc bolts, ${R.beamCount} straight beams (pre-fix: 0 bolts, one beam per hop)`);
ok('the forks are genuinely off-axis', R.jagFrac >= 0.05 && R.offAxisVerts > 0,
   `peak deviation ${(R.jagFrac * 100).toFixed(1)}% of arc length; ${R.offAxisVerts}/${R.totalVerts} vertices off the straight line`);
ok('every arc throws dead-end branches that connect to nothing', R.branchy >= R.hopCount,
   `${R.branchy}/${R.arcBolts} arcs carry 2+ branches`);
// THE regression guard. A first version of this change spawned 8 fx per hop and
// measured spriteBurst:1 where the old build had 5 -- the cap had evicted every
// early hop, so the richer chain rendered LESS. One node sprite per hop must
// survive, and the arc must still cost a single entry.
ok('every hop still gets its node stamp (the fx cap evicts oldest-first)',
   (R.kinds.spriteBurst | 0) >= R.hopCount,
   `${R.kinds.spriteBurst | 0} node stamps for ${R.hopCount} hops, cap ${R.cap} — ${JSON.stringify(R.kinds)}`);
ok('the arc costs one fx entry, as the straight beam did', R.arcBolts <= R.hopCount,
   `${R.arcBolts} entries for ${R.hopCount} hops`);
ok('bolts carry a dark rim so they read on bright maps', R.rimmed === R.boltCount && R.boltCount > 0,
   `${R.rimmed}/${R.boltCount} rimmed (additive-only bolts vanish on pale backgrounds)`);
ok('the chain still sheds spark particles', R.sparkAdded >= 100, `${R.sparkAdded} particles`);
ok('the chain-node art is loaded', R.linkArt === true, `elemental_link present: ${R.linkArt}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
