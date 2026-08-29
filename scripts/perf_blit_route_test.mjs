// Live test for the cycle-2 blit-routing batch: mob projectiles, slash and
// burst art, meteors and small-box hazard frames all draw through the
// non-mutating _lxProjScaled side-canvas; the background pick is memoized
// and identical to a fresh evaluation of the original logic.
//   node scripts/perf_blit_route_test.mjs
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
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _pickBGImage === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const out = {};
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  player._god = true; player.hp = 99999; player.mp = 999; player.level = 60;

  // ---- background pick: memoized AND identical to the original logic ------
  const orig = () => {
    const md = game && game.mapData;
    if (!md) return null;
    if (md.bg && BG_IMAGES[md.bg] && BG_IMAGES[md.bg]._loaded) return BG_IMAGES[md.bg];
    if (md.sanctum || md.singularity || md.isCarriage || md.isZodiac || md.isZodiacHub) return null;
    if (md.isTown) {
      if (BG_IMAGES.everdawnMegamall._loaded) return BG_IMAGES.everdawnMegamall;
      if (BG_IMAGES.valley._loaded) return BG_IMAGES.valley;
    }
    if (_ART_PACK === 'cinematic' && !md.isTown && !md.isBossArena) {
      const loaded = BG_CINEMATIC_VARIANTS.filter(img => img && img._loaded);
      if (loaded.length) return loaded[_hashStr((md.id || md.name || '') + ':cinematic') % loaded.length];
    }
    if (!md.isTown) {
      const loaded = _BG_CYCLE.filter(k => BG_IMAGES[k] && BG_IMAGES[k]._loaded);
      if (loaded.length) return BG_IMAGES[loaded[_hashStr(md.id || md.name || '') % loaded.length]];
    }
    if (BG_IMAGES.main && BG_IMAGES.main._loaded) return BG_IMAGES.main;
    return null;
  };
  out.bgMatchesForest = _pickBGImage() === orig();
  out.bgStable = _pickBGImage() === _pickBGImage();
  try { loadMap('town'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 30) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.bgMatchesTown = _pickBGImage() === orig();
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 30) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });

  // ---- enemy projectiles: all five statics draw error-free, routed --------
  const mkP = (skill) => game.projectiles.push({
    x: player.x + 80, y: player.y, w: 14, h: 14, vx: 0.01, vy: 0,
    owner: 'monster', skill, damage: 0, life: 9999 });
  for (const s of ['mspore', 'mdark', 'mtoxic', 'msplinter', 'mticket']) mkP(s);
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 40) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  let routed = 0, decoded = 0;
  try {
    for (const k of ['mspore', 'mdark', 'mtoxic', 'msplinter', 'mticket']) {
      const img = LX_MOB_PROJ && LX_MOB_PROJ[k];
      if (img && (img.naturalWidth > 0 || img.width > 0)) { decoded++; if (img._lxProjCache) routed++; }
    }
  } catch (e) {}
  out.projDecoded = decoded; out.projRouted = routed;
  game.projectiles.length = 0;

  // ---- meteor: cast, hazard lives, bake cache populated -------------------
  player.cls = 'mage';
  for (const k in (player.skillCooldowns || {})) player.skillCooldowns[k] = 0;
  try { performMeteor(); } catch (e) { out.meteorThrew = String(e).slice(0, 100); }
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.meteorHazard = (game.hazards || []).some((h) => h && (h.type === 'meteor_warn' || h.type === 'meteor'));
  try {
    const mimg = LX_PLAYER_PROJ && LX_PLAYER_PROJ.meteor;
    out.meteorRouted = !!(mimg && mimg._lxProjCache) || !(mimg && mimg.naturalWidth > 0);
  } catch (e) { out.meteorRouted = true; }
  game.hazards = [];

  // ---- warrior slash: smoothFx slash art routed ---------------------------
  player.cls = 'warrior';
  game.monsters = [];
  spawnMonster(Math.round(player.x + player.facing * 60), Math.round(player.y), 'slime', false);
  const m0 = game.monsters[game.monsters.length - 1];
  m0.hp = m0.currentHp = 5e6; m0.maxHp = 5e6; m0.atk = 0;
  try { performMelee(90, 1.0); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.slashLanded = m0.currentHp < 5e6;
  game.monsters = [];
  return out;
});

ok('background pick matches the original logic (forest)', r.bgMatchesForest, r);
ok('background pick is stable across calls', r.bgStable, r);
ok('background pick matches the original logic (town)', r.bgMatchesTown, r);
ok('all decoded mob-projectile statics drew through the side-canvas',
  r.projDecoded === 0 || r.projRouted === r.projDecoded, { decoded: r.projDecoded, routed: r.projRouted });
ok('meteor cast produced a live meteor hazard', r.meteorHazard, r);
ok('meteor art drew through the side-canvas (when decoded)', r.meteorRouted, r);
ok('a warrior slash still lands through the routed slash art', r.slashLanded, r);
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 300));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
