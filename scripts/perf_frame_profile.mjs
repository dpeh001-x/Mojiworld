// Where does a heavy frame actually go?
//
// Wraps every top-level per-frame draw/update in a timer, lets the REAL rAF
// loop run for a few seconds on a deliberately punishing scene, and reports
// accumulated ms per system plus the frame-time distribution.
//
// Measurement, not guesswork: "reduce unnecessary shaders" is only actionable
// once you know which ones cost anything. Several of these systems turn out to
// be free; optimising those would be pure churn.
//   node scripts/perf_frame_profile.mjs [file.html] [--map=<id>] [--secs=6]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const SECS = +((args.find(a => a.startsWith('--secs=')) || '').split('=')[1] || 6);
const MAP = (args.find(a => a.startsWith('--map=')) || '').split('=')[1] || '';
const URL = 'file:///' + path.join(ROOT, file).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawParticles === 'function', { timeout: 90000 });

const SYSTEMS = [
  'drawBackground','drawAmbient','drawPlatforms','drawPotholes','drawLaunchPads','drawWorldProps',
  'drawChests','drawPowerupOrbs','drawPortals','drawNPCs','drawMemoryEchoes','drawDrops',
  'drawMonster','_drawFadingMonsters','_drawAttackZones','drawProjectiles','drawHazards',
  'drawAfterImages','drawMinions','drawShadowClones','drawBallistaTurrets','drawPlayer',
  'drawAegisOrbs','drawNecromancerOrbs','drawPet','drawClassIdentityHUD','drawParticles',
  'drawFxInstances','drawSmoothFx','drawWorldArtOverlay','drawDamageNumbers','_drawDayNightTint',
  'drawArtPostFX','updateMonsters','updateParticles','updateSmoothFx','updateProjectiles','updateUI',
];

const FX = args.includes('--fx');
const setup = await page.evaluate(({ SYSTEMS, MAP, FX }) => {
  window.__perfFx = FX;
  // A punishing but REAL scene: the densest field map we can find, filled to
  // its monster cap, with the particle system primed.
  let mapId = MAP;
  if (!mapId) {
    let best = null, bestCap = -1;
    for (const [id, m] of Object.entries(MAPS)) {
      if (!m || m.isTown || !Array.isArray(m.spawns) || !m.spawns.length) continue;
      const cap = m.monsterCap | 0;
      if (cap > bestCap) { bestCap = cap; best = id; }
    }
    mapId = best;
  }
  // Get past the BOOT GATE. loop() returns early while the loading overlay is
  // up or the auth menu is shown, so in headless the sim/render never runs at
  // all - the first version of this profiler measured 0ms for all 38 systems
  // and 833 frames of its OWN rAF, which looked like "everything is free".
  window._lxBootGateDone = true;
  try { const bo = document.getElementById("loading-overlay"); if (bo) { bo.classList.add("fade"); bo.remove(); } } catch (e) {}
  try { const au = document.getElementById("lo-auth"); if (au) au.classList.remove("shown"); } catch (e) {}
  window._lxBootMenuSeen = true; window._lxSpriteGateHolding = false;
  loadMap(mapId);
  player.cls = 'warrior'; player.level = 60; player.hp = getMaxHp(); player.mp = getMaxMp();
  player._god = true;                       // profile rendering, not death/respawn
  game.paused = false;

  // Fill to the cap so we measure a crowded frame, not an empty one.
  const cap = (game.mapData && game.mapData.monsterCap) || 20;
  const types = (game.mapData.spawns || []).map(s => s.type).filter(Boolean);
  let guard = 0;
  while (game.monsters.length < cap && types.length && guard++ < 400) {
    const t = types[guard % types.length];
    try { spawnMonster(200 + (guard * 97) % 1600, 300, t, false, false); } catch (e) { break; }
  }

  const wrapped = [];
  window.__perf = Object.create(null);
  window.__perfFrames = 0;
  for (const name of SYSTEMS) {
    const fn = window[name];
    if (typeof fn !== 'function') continue;
    wrapped.push(name);
    window.__perf[name] = { ms: 0, calls: 0 };
    window[name] = function (...a) {
      const t0 = performance.now();
      try { return fn.apply(this, a); }
      finally { const e = window.__perf[name]; e.ms += performance.now() - t0; e.calls++; }
    };
  }
  // Frame clock: sample the gap between rAF ticks.
  window.__frameTimes = [];
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    window.__frameTimes.push(now - last); last = now;
    window.__perfFrames++;
    requestAnimationFrame(tick);
  };
  // --fx: keep the EFFECT systems saturated. The plain mob scene leaves
  // drawSmoothFx / drawFxInstances / drawParticles near zero because nothing is
  // casting - so it cannot answer "are the effects expensive?", which is the
  // actual question. This tops them up every frame to a busy-fight volume.
  if (window.__perfFx) {
    const px = () => player.x + (Math.random() - 0.5) * 500;
    const py = () => player.y + (Math.random() - 0.5) * 260;
    setInterval(() => {
      try {
        for (let i = 0; i < 6; i++) spawnSmoothSlash(px(), py(), Math.random() * 6.28, 120, "#ffcc66", { thickness: 10, life: 20 });
        for (let i = 0; i < 3; i++) spawnSmoothExplosion(px(), py(), 180, "#ff8844", "#ff444488", { life: 24 });
        for (let i = 0; i < 40; i++) game.particles.push({ x: px(), y: py(), vx: (Math.random()-0.5)*3, vy: -Math.random()*3, life: 40, color: "#ffdd88", size: 3 });
        for (let i = 0; i < 8; i++) game.damageNumbers.push({ x: px(), y: py(), vy: -2, text: "1234", life: 30, color: "#fff", size: 14 });
      } catch (e) {}
    }, 16);
  }
  requestAnimationFrame(tick);
  if (typeof _lxNextFrame === "function") _lxNextFrame();   // kick the real loop
  return { map: mapId, cap, monsters: game.monsters.length, wrapped: wrapped.length, missing: SYSTEMS.filter(n => typeof window[n] !== 'function') };
}, { SYSTEMS, MAP, FX });

console.log(`\nscene: ${setup.map}   monsters ${setup.monsters}/${setup.cap}   systems wrapped ${setup.wrapped}`);
if (setup.missing.length) console.log(`  (not found, skipped: ${setup.missing.join(', ')})`);
// WAIT LIKE THE REAL BOOT GATE DOES. The commence gate awaits
// _lxNpcSpritesReady (and the registry warm) before the game starts, so a
// player never sees the pre-decode state. Forcing the gate open and measuring
// immediately profiles a moment that does not exist in play - it reported town
// NPCs costing 1.79ms/frame on the procedural fallback when the real starting
// condition is 0.05ms with the sprites already decoded.
const warm = await page.evaluate(async () => {
  const t0 = Date.now();
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise(r => setTimeout(r, 30000))]); } catch (e) {}
  const names = (game.npcs || []).map(n => n.name);
  return { waitedMs: Date.now() - t0, npcs: names.length,
           decoded: names.filter(n => { const i = NPC_SPRITES[n]; return i && i.complete && i.naturalWidth > 0; }).length };
});
console.log(`boot-gate warm: waited ${warm.waitedMs}ms, NPC sprites decoded ${warm.decoded}/${warm.npcs}`);
// Zero the counters so the warm-up is not folded into the measurement.
await page.evaluate(() => { for (const k of Object.keys(window.__perf)) { window.__perf[k].ms = 0; window.__perf[k].calls = 0; } window.__frameTimes.length = 0; });
console.log(`profiling ${SECS}s of real frames ...`);
await page.waitForTimeout(SECS * 1000);

const out = await page.evaluate(() => {
  const ft = window.__frameTimes.slice(5);          // drop warm-up
  const sorted = ft.slice().sort((a, b) => a - b);
  const pct = (p) => sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(2) : 0;
  const rows = Object.entries(window.__perf)
    .map(([name, e]) => ({ name, ms: +e.ms.toFixed(1), calls: e.calls }))
    .filter(r => r.calls > 0)
    .sort((a, b) => b.ms - a.ms);
  const total = rows.reduce((a, r) => a + r.ms, 0);
  return { frames: ft.length, med: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: +Math.max(...ft).toFixed(2),
           over16: ft.filter(t => t > 16.7).length, rows, total: +total.toFixed(1) };
});

console.log(`\nframes ${out.frames}   median ${out.med}ms   p95 ${out.p95}ms   p99 ${out.p99}ms   max ${out.max}ms`);
console.log(`frames over 16.7ms (i.e. below 60fps): ${out.over16} / ${out.frames}  (${(out.over16 / out.frames * 100).toFixed(1)}%)`);
console.log(`\ntop systems by accumulated ms (of ${out.total}ms measured):`);
console.log('  ' + 'system'.padEnd(24) + 'ms'.padStart(9) + '%'.padStart(8) + 'calls'.padStart(9) + 'ms/call'.padStart(10));
for (const r of out.rows.slice(0, 18)) {
  console.log('  ' + r.name.padEnd(24) + String(r.ms).padStart(9)
    + (out.total ? (r.ms / out.total * 100).toFixed(1) : '0').padStart(8)
    + String(r.calls).padStart(9) + (r.ms / r.calls).toFixed(3).padStart(10));
}
const tail = out.rows.slice(18);
if (tail.length) console.log(`  ... ${tail.length} more totalling ${tail.reduce((a, r) => a + r.ms, 0).toFixed(1)}ms`);
if (errs.length) console.log('\npage errors: ' + errs.slice(0, 3).join(' | '));
await browser.close();
