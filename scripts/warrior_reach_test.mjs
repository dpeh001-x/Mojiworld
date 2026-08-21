// The warrior's basic swing hits where the arc is drawn, not far past it.
// Per user: "the hit x-axis hit range of warrior is too far, reduce it to
// slightly past the arc it creates."
//
// Measures the REAL swing: drives SKILL_FNS.slash, captures the arc it spawns,
// and probes the hit box by planting dummies at increasing distance and seeing
// which ones actually take damage.
// Run: node scripts/warrior_reach_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9256;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(() => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.level = 50; player.hp = 9e6; player.maxHp = 9e6;
  player._enh = null; player._warlordBanner = 0;
  if (player.mods) player.mods.diagSlash = 0;
  player._god = true; game.paused = false;
  loadMap('forest', 300);
  player.x = 500; player.y = 400; player.facing = 1;
  const pcx = player.x + player.w / 2;

  // 1. the ARC the swing draws
  game.smoothFx = [];
  game.monsters.length = 0;
  try { SKILL_FNS.slash(); } catch (e) { return { err: String(e).slice(0, 150) }; }
  const fx = (game.smoothFx || []).filter(f => f && f.type === 'slash');
  const arc = fx[fx.length - 1];
  if (!arc) return { err: 'no slash arc spawned' };
  const arcOuter = arc.x + arc.length + (arc.thickness || 0) / 2;

  // 2. the HIT BOX, probed empirically: one dummy per distance, swing, see who bled
  const probe = (gap) => {
    game.monsters.length = 0;
    const m = spawnMonster(player.x + player.w + gap, player.y, 'slime', false, false);
    if (!m) return null;
    m.currentHp = m.maxHp = 1e9;
    const before = m.currentHp;
    try { SKILL_FNS.slash(); } catch (e) {}
    const hit = m.currentHp < before;
    const front = m.x;                       // the dummy's near edge
    game.monsters.length = 0;
    return { hit, front };
  };
  let lastHit = -1, firstMiss = -1;
  for (let gap = 0; gap <= 400; gap += 4) {
    const r = probe(gap);
    if (!r) continue;
    if (r.hit) lastHit = r.front;
    else if (lastHit >= 0) { firstMiss = r.front; break; }
  }
  return {
    playerW: player.w, pcx,
    arcOuter, arcPastCentre: arcOuter - pcx,
    arcOriginOffset: arc.x - pcx, arcLength: arc.length,
    lastHitFront: lastHit, hitPastCentre: lastHit - pcx,
    overshoot: lastHit - arcOuter,
  };
});
await browser.close(); server.kill();

ok('the swing draws an arc and the probe found its hit edge', !out.err && out.lastHitFront > 0, out.err || '');
if (!out.err) {
  console.log(`  arc reaches ${Math.round(out.arcPastCentre)}px past centre; furthest monster hit sits ${Math.round(out.hitPastCentre)}px past centre`);
  ok('the hit box no longer reaches far past the drawn arc',
     out.overshoot <= 45, `hit edge is ${Math.round(out.overshoot)}px past the arc's outer edge`);
  ok('the hit box still reaches slightly PAST the arc (not short of it)',
     out.overshoot >= -10, `overshoot ${Math.round(out.overshoot)}px`);
  ok('the drawn arc keeps its authored size (origin ~+38px, length ~84px)',
     Math.abs(out.arcOriginOffset - 38.25) < 3 && Math.abs(out.arcLength - 84.15) < 3,
     `origin +${out.arcOriginOffset.toFixed(1)}, length ${out.arcLength.toFixed(1)}`);
  ok('the warrior still has a usable reach (not nerfed to nothing)',
     out.hitPastCentre >= 100, `${Math.round(out.hitPastCentre)}px past centre`);
}

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
