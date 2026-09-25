// Live test: Gravitos's WEIGHT WAVE rides the floor. Per user: "fix the gravitos weight wave too".
//
// The wave is his "horizontal shockwaves along ground", but the 'shock' tag carried a hard-coded
// vy += 0.3 a step that ignored its noGravity, so it sank through his floor ~12 steps out, still under
// his own 340 px body, and never reached anyone. Once it rides the floor it must be a fair jump in his
// 3x-gravity arena, where a held hop peaks at ~29 px: its lane now sits 8 px up (was 20).
//
// The change is the projectile's own physics, so this launches the EXACT literal his 'wave' pattern
// pushes - brace-matched out of the build's own bossAI source, so it cannot drift from the game - into
// his real arena with him parked and frozen, and grades it in sim steps (game.time).
//   node scripts/gravitos_weight_wave_test.mjs [file.html] [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const FILE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[3]; for (let p = 18821; p <= 18999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof bossAI === 'function' && typeof updateProjectiles === 'function', null, { timeout: 120000 });
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
const R = await page.evaluate(async () => {
  const raf = () => new Promise(res => requestAnimationFrame(res));
  const R = { ver: GAME_VERSION };
  try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._storyBeatsSeen = new Proxy({}, { get: () => true });
  player._gravitosCineSeen = true;
  window.updateMapEvents = () => {}; window.getEvasion = () => 0;
  // A fresh test character at Lv 90 has a naked, still-settling HP pool (379 -> 738 -> 1438 across three
  // runs), and his banded wave is an ABSOLUTE ~6,300: it overkilled that pool and left the player pinned at
  // 1 HP, after which nothing can hit them and every later "cleared" would be a lie. A fixed pool keeps
  // every run alive and hittable; the control run at the end proves it.
  window.getMaxHp = () => 50000;
  const src = String(bossAI), m0 = src.indexOf("} else if (m.patternState === 'wave') {");
  let lit = null;
  if (m0 > 0) { const a = src.indexOf('game.projectiles.push({', m0) + 'game.projectiles.push('.length; let d = 0, i = a;
    for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) break; } } lit = src.slice(a, i + 1); }
  R.literalFound = !!lit;
  if (!lit) return R;
  const make = new Function('m', 'dir', 'phase', '_gravHeavyBand', 'return (' + lit + ');');
  const now = () => game.time | 0;
  const waitSteps = async (n, each) => { const s0 = now(); let g = 0, ls = s0;
    while (now() - s0 < n && g++ < 60000) { await raf(); game.paused = false; if (now() !== ls) { ls = now(); if (each && each()) break; } } return now() - s0; };
  loadMap('gravitosArena');
  await waitSteps(140);
  const gv = game.monsters.find(m => m && m.type === 'gravitos');
  const G = game.mapData.platforms.find(p => p.type === 'ground').y; R.floorY = G; R.gravMul = gravMul();
  const park = () => { if (game.hazards) game.hazards.length = 0;
    if (gv) { gv.x = 40; gv.y = G - gv.h; gv._stagger = 1e12; gv.vx = 0; gv.vy = 0; gv._soulTimer = 1e12; } };
  const launch = (o) => {
    const fake = { x: 900 - 170, w: 340, atk: gv ? gv.atk : 1944, type: 'gravitos' };   // his centre at x 900
    const p = make(fake, 1, 1, (typeof _gravHeavyBand === 'function') ? _gravHeavyBand : () => null);
    if (o && o.strip) { delete p.noGravity; }
    game.projectiles.push(p); return p;
  };
  const run = async (o) => {
    park(); game.projectiles.length = 0;
    player.level = 90; player.x = 1400; player.y = G - player.h; player.vx = 0; player.vy = 0;
    await waitSteps(4, () => { park(); return false; });
    player.maxHp = getMaxHp(); player.hp = player.maxHp; player._downed = false; player.invulnerable = o.safe ? 9e9 : 0; player.hitStun = 0; player.stunTimer = 0; player._lastDamageSource = null;
    const p = launch(o); const y0 = p.y, ys = []; let hit = null, jumped = null; const s0 = now(); const hp0 = player.hp;
    game.keys = game.keys || {};
    await waitSteps(o.steps || 110, () => {
      park();
      if (game.projectiles.includes(p)) ys.push(Math.round(p.y));
      if (o.jumpAt != null && jumped == null && game.projectiles.includes(p)) {
        if ((player.x - (p.x + p.w)) / Math.max(1, p.vx) <= o.jumpAt) { game.keys[' '] = true; jumped = now() - s0; }
      }
      if (jumped != null && now() - s0 - jumped > 20) game.keys[' '] = false;
      if (hit == null && player.hp < hp0 - 0.5 && player._lastDamageSource === 'shock') hit = { at: now() - s0, dmg: Math.round(hp0 - player.hp), ofRefBar: +((hp0 - player.hp) / _refBarAtLv(100)).toFixed(3) };
      return false;
    });
    game.keys[' '] = false;
    return { y0, yMin: Math.min(...ys), yMax: Math.max(...ys), n: ys.length, hit };
  };
  R.ride = await run({ safe: true, steps: 90 });
  R.stand = await run({});
  R.jumps = [];
  for (const j of [2, 3, 4, 5, 6, 7]) R.jumps.push({ j, r: await run({ jumpAt: j }) });
  R.standAfter = await run({});                                      // control: still hittable after the jumps
  R.stripped = await run({ safe: true, strip: true, steps: 30 });   // the same shot WITHOUT noGravity still falls
  return R;
});
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const src = readFileSync(FILE, 'utf8');
ok('no page errors', errs.length === 0, errs);
ok("the 'wave' pattern's literal is found in bossAI", R.literalFound, '');
ok('the fall line honours noGravity', src.includes("if ((p.skill === 'splash' || p.skill === 'shock' || p.skill === 'spore') && !p.noGravity) p.vy += 0.3;"), '');
ok('co-op: a guest\'s mirrored wave carries noGravity too', src.includes("'_noEvasion', 'noGravity'];"), '');
ok('THE WAVE RIDES THE FLOOR: its height never changes over its run (it used to sink through by ~12 steps)',
  R.ride && R.ride.n >= 30 && R.ride.yMax - R.ride.yMin <= 1, R.ride);
ok('its lane is read off the floor, top 8 px up', R.ride && R.ride.y0 === R.floorY - 8, { y0: R.ride && R.ride.y0, floor: R.floorY });
ok('it reaches a player standing 500 px away and hits them', R.stand && R.stand.hit && R.stand.hit.dmg > 1000, R.stand && R.stand.hit);
ok('a held hop started 2-7 steps before contact clears it, in his 3x gravity',
  R.jumps && R.jumps.every(x => !x.r.hit), R.jumps && R.jumps.map(x => x.j + ':' + (x.r.hit ? x.r.hit.pct + '%' : 'clear')));
ok('CONTROL: the player is still hittable after the jump runs (so every clear above was a real clear)',
  R.standAfter && R.standAfter.hit && R.standAfter.hit.dmg > 1000, R.standAfter && R.standAfter.hit);
ok('scoped: the same shot WITHOUT noGravity still falls, as every other shock/splash/spore shot does',
  R.stripped && R.stripped.yMax > R.stripped.y0 + 20, R.stripped);
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
