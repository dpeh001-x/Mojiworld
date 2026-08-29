// Live smoke test for the draw-path perf batch (audit 2026-08-29, items 7-12).
//
// All changes are behavior-identical caches/memos; this pins the behaviors:
//   - _heroVecWalkGait: memo returns the same object for the same t, and the
//     gait still VARIES with t (the memo isn't stuck)
//   - _defaultPortalY: cached-slab answer matches a fresh filter-based
//     recompute on a stepped-floor map, per x
//   - the charge halo draws through one cached unit gradient per class
//   - a warrior slash exercises the smoothFx shadow-string memo
//   - _lxDrsEnabled still answers (boot-const path) and DRS state is sane
//   - no pageerrors / [loop] errors through it all
//   node scripts/perf_draw_smoke_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const loopErrs = []; page.on('console', (msg) => {
  if (msg.type() === 'error' && /\[loop\]/.test(msg.text())) loopErrs.push(msg.text().slice(0, 200)); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _heroVecWalkGait === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1000);

const r = await page.evaluate(async () => {
  const out = {};
  // gait: pure-in-t, memoized, not stuck
  const g1 = _heroVecWalkGait(0.37), g2 = _heroVecWalkGait(0.37);
  const g3 = _heroVecWalkGait(0.81);
  out.gaitMemoSame = g1 === g2;
  out.gaitFields = ['legR', 'legL', 'bodyY', 'legRSy', 'legLSy', 'legRY', 'legLY'].every((k) => Number.isFinite(g1[k]));
  out.gaitVaries = g1.legR !== g3.legR || g1.bodyY !== g3.bodyY;

  // portal ground line: cached answer == fresh filter recompute, on a
  // stepped-floor map (Sauropod Slope steps its ground across the width)
  try { loadMap('sauroSlope'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const expectY = (x) => {
    const gs = (game.mapData && game.mapData.platforms || []).filter(p => p.type === 'ground');
    if (!gs.length) return 480;
    if (Number.isFinite(x)) {
      let best = null;
      for (const gg of gs) if (x >= gg.x && x <= gg.x + gg.w && (!best || gg.y < best.y)) best = gg;
      if (best) return best.y;
    }
    return gs[0].y;
  };
  const xs = [40, 400, 900, 1600, 2200];
  out.portalYMatch = xs.every((x) => _defaultPortalY(x) === expectY(x));
  out.portalYSample = xs.map((x) => _defaultPortalY(x));

  // charge halo: warrior hold draws via the cached unit gradient.
  // v0.30.313 — the fabricated charge now carries a HELD slotKey: the
  // v0.26.1033 key-flush cancel in _tickClassIdentity nulls any charge whose
  // key is not down in game.keys, which silently wiped the old fixture.
  player.cls = 'warrior'; player.level = 30; player._god = true;
  game.keys = game.keys || {};
  const _mkCharge = () => ({ power: 0.6, start: game.time - 200, frames: 60, slotKey: 'x', cls: 'warrior' });
  game.keys.x = true; player._warCharge = _mkCharge();
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; game.keys.x = true;
    player._warCharge = player._warCharge || _mkCharge(); if (++n > 40) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.haloCached = !!(window._chargeHaloCache && window._chargeHaloCache.w);
  player._warCharge = null; game.keys.x = false;

  // smoothFx melee arc: a real slash near a mob runs the shadow-string memo
  game.monsters = [];
  spawnMonster(Math.round(player.x + player.facing * 60), Math.round(player.y), 'slime', false);
  const m0 = game.monsters[game.monsters.length - 1];
  m0.hp = m0.currentHp = 5e6; m0.maxHp = 5e6; m0.atk = 0;
  try { performMelee(90, 1.0); } catch (e) { out.meleeThrew = String(e).slice(0, 120); }
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 90) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.slashLanded = m0.currentHp < 5e6;
  out.shadowMemo = !!(window._sfxShadowStr && Object.keys(window._sfxShadowStr).length);

  // DRS gate still answers through the boot-const path
  out.drsEnabledType = typeof _lxDrsEnabled === 'function' ? typeof _lxDrsEnabled() : 'missing';
  return out;
});

ok('gait memo returns the same object for the same t', r.gaitMemoSame, r);
ok('gait pose fields all finite', r.gaitFields, r);
ok('gait still varies with t (memo not stuck)', r.gaitVaries, r);
ok('portal ground line matches a fresh recompute on a stepped map', r.portalYMatch, r);
ok('charge halo drew through the cached unit gradient', r.haloCached, r);
ok('a warrior slash still lands', r.slashLanded, r);
ok('the smoothFx shadow-string memo populated during the slash', r.shadowMemo, r);
ok('_lxDrsEnabled answers a boolean', r.drsEnabledType === 'boolean', r);
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });
ok('no [loop] watchdog errors', loopErrs.length === 0, { loopErrs: loopErrs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 300));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
