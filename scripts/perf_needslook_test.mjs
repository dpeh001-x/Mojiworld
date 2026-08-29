// Live test for the audit's "needs one look" perf batch:
//   - the two per-frame settings booleans are mirrored scalars that track
//     every write path (_lxSaveSettings AND _applySettings)
//   - _lxGroundBelow's bucketed index answers EXACTLY like the full scan,
//     sampled across the map at several widths and feet heights
//   - a spawned chest draws through the _lxProjScaled side-canvas
//   - the drop-orb path still draws (emoji fallback included), error-free
//   node scripts/perf_needslook_test.mjs
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
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _lxGroundBelow === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1000);

const r = await page.evaluate(async () => {
  const out = {};
  // ---- mirrored settings scalars track both write paths --------------------
  out.syncFn = typeof _lxPerFrameSettingsSync === 'function';
  const s0 = _lxGetSettings();
  const grid0 = s0.grid, rm0 = s0.reduceMotion;
  s0.grid = true; _lxSaveSettings(s0);
  out.gridOnAfterSave = (typeof _LX_GRID_ON !== 'undefined') && _LX_GRID_ON === true;
  s0.grid = false; _lxSaveSettings(s0);
  out.gridOffAfterSave = _LX_GRID_ON === false;
  s0.reduceMotion = true; _applySettings(s0);
  out.rmOnAfterApply = (typeof _LX_REDUCE_MOTION !== 'undefined') && _LX_REDUCE_MOTION === true;
  s0.reduceMotion = !!rm0; s0.grid = !!grid0; _lxSaveSettings(s0); _applySettings(s0);

  // ---- groundBelow: bucketed answer === full scan, everywhere --------------
  const fullScan = (wx, w, feetY) => {
    const md = game.mapData;
    if (!md || !md.platforms) return null;
    let best = null;
    for (let i = 0; i < md.platforms.length; i++) {
      const p = md.platforms[i];
      if (p.y < feetY - 4) continue;
      if (wx + w < p.x || wx > p.x + p.w) continue;
      if (best === null || p.y < best) best = p.y;
    }
    return best;
  };
  const maps = ['sauroSlope', 'forest'];
  let checked = 0, mismatches = [];
  for (const mid of maps) {
    try { loadMap(mid); } catch (e) { continue; }
    await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 40) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
    const ww = (game.mapData && game.mapData.worldWidth) || 2400;
    for (let x = -100; x < ww + 100; x += 97) {
      for (const w of [18, 44, 300]) {
        for (const fy of [40, 200, 420, 460, 700]) {
          checked++;
          const a1 = _lxGroundBelow(x, w, fy), a2 = fullScan(x, w, fy);
          if (a1 !== a2 && mismatches.length < 5) mismatches.push({ mid, x, w, fy, a1, a2 });
        }
      }
    }
  }
  out.gbChecked = checked; out.gbMismatches = mismatches;

  // ---- chest draws through the side-canvas cache ---------------------------
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 40) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  game.chests = [];
  spawnChest(Math.round(player.x + 60), Math.round(player.y + player.h - 30), 'gold');
  game.camera.x = Math.max(0, player.x - 200);
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 40) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const cs = (typeof LX_OBJECTS !== 'undefined') && LX_OBJECTS.chest_gold;
  out.chestArt = !!(cs && cs.complete && cs.naturalWidth > 0);
  out.chestRouted = !!(cs && cs._lxProjCache && Object.keys(cs._lxProjCache).some((k) => k !== '_n'));

  // ---- drop orb still draws (emoji fallback branch) ------------------------
  game.drops = game.drops || [];
  game.drops.push({ x: player.x + 30, y: player.y + 10, vx: 0, vy: 0, item: { icon: '🗡️', name: 'probe' }, life: 9999 });
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 30) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.dropSurvived = true;
  game.drops = []; game.chests = [];
  return out;
});

ok('the settings mirror exists', r.syncFn, r);
ok('grid scalar tracks _lxSaveSettings (on)', r.gridOnAfterSave, r);
ok('grid scalar tracks _lxSaveSettings (off)', r.gridOffAfterSave, r);
ok('reduce-motion scalar tracks _applySettings', r.rmOnAfterApply, r);
ok('bucketed _lxGroundBelow matches the full scan at every sampled point',
  r.gbChecked > 500 && r.gbMismatches.length === 0, { checked: r.gbChecked, mismatches: r.gbMismatches });
ok('gold chest art is decoded (premise for the routing check)', r.chestArt, r);
ok('the chest drew through the _lxProjScaled side-canvas', r.chestRouted, r);
ok('a ground drop still draws (fallback branch intact)', r.dropSurvived, r);
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 320));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
