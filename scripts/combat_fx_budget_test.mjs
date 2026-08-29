// Live test: THE REMAINING COMBAT ARRAYS GRADUATE WITH LOAD, AND THE THREE
// PER-FRAME SHADOW/GRADIENT SITES DRAW FROM BAKES.
//
// Per user: "lets do 2, lets limit the shadowblur / gradient bakes as well" -
// i.e. graduate damage numbers / afterimages / smoothFx the way particles were
// (v0.30.306), and bake the per-frame shadowBlur + gradient sites (title glow,
// Hallowed Field halo, puzzle-chest badge).
//
// The shadowBlur claims are proven by SPYING ON THE SETTER, not by reading the
// code: a property spy records every value assigned during the draw, so "the
// title no longer sets shadowBlur" is an observation, not an intention.
//   node scripts/combat_fx_budget_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8871; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _damageNumberCap === 'function'
  && typeof _smoothFxCap === 'function' && typeof _lxTitleGlowLayer === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  if (typeof _lxIsSanctuary === 'function') { try { window._lxIsSanctuary = () => false; } catch (e) {} }
  if (!game.camera) game.camera = { x: 0, y: 0 };
  const out = {};
  const fresh = () => { game._lowFxCache = null; };
  const scene = (bosses, mobs) => {
    game.monsters = [];
    for (let i = 0; i < bosses; i++) spawnMonster(300 + i * 220, 300, 'zodiac_leo', true);
    for (let i = 0; i < mobs; i++) spawnMonster(150 + (i % 8) * 90, 250 + Math.floor(i / 8) * 100, 'sandhusk', false);
    game.time++; fresh();
    return { dmg: _damageNumberCap(), after: _afterImageCap(), smooth: _smoothFxCap() };
  };
  out.town = scene(0, 0);
  out.duel = scene(1, 0);
  out.arena = scene(3, 0);

  // smoothFx eviction: graduated cap enforced, sticky entries survive
  const mk = (sticky) => ({ x: 100, y: 100, life: 60, sticky });
  game.smoothFx = [];
  for (let i = 0; i < 12; i++) game.smoothFx.push(mk(false));
  for (let i = 0; i < 3; i++) game.smoothFx.push(mk(true));
  game.time++; fresh();
  if (typeof _trimVisualQueues === 'function') _trimVisualQueues();
  out.smoothTrim = { len: game.smoothFx.length, cap: _smoothFxCap(),
    stickySurvived: game.smoothFx.filter(f => f.sticky).length };
  game.smoothFx = [];

  // ---- shadowBlur SPY: proves the bakes removed the per-frame blur ----
  const proto = CanvasRenderingContext2D.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'shadowBlur');
  const spy = (fn) => {
    let maxSet = 0, sets = 0;
    Object.defineProperty(proto, 'shadowBlur', {
      configurable: true,
      get() { return desc.get.call(this); },
      set(v) { sets++; if (v > maxSet) maxSet = v; desc.set.call(this, v); },
    });
    try { fn(); } finally { Object.defineProperty(proto, 'shadowBlur', desc); }
    return { maxSet, sets };
  };

  // 1. the TITLE: bake blits, gradient live, zero blur on the main ctx
  player.equippedTitle = 'ASCENDANT';
  // First draw BAKES (the spy sits on the prototype, so the offscreen bake's
  // one shadowBlur=7 is counted); steady state is the second draw.
  out.titleFirst = spy(() => { _drawPlayerNameTag(400, 300); });
  out.titleDraw = spy(() => { _drawPlayerNameTag(400, 300); });
  out.titleCache = _lxTitleGlowCache.size;
  out.titleCacheStable = _lxTitleGlowCache.size === 1;
  player.equippedTitle = '';

  // 2. HALLOWED FIELD: unit gradient built once, then reused
  window._lxHallowedGrad = null;
  player.buffs = player.buffs || {}; player.buffs.hallowedField = 2;
  const px0 = player.x, py0 = player.y;
  player.x = 400; player.y = 300;
  try { drawPlayer(); } catch (e) { out.hallowedErr = String(e).slice(0, 90); }
  out.hallowedBuilt = !!window._lxHallowedGrad;
  const g1 = window._lxHallowedGrad;
  try { drawPlayer(); } catch (e) {}
  out.hallowedReused = window._lxHallowedGrad === g1;
  player.buffs.hallowedField = 0; player.x = px0; player.y = py0;

  // 3. PUZZLE-CHEST badge: baked once, blur only inside the one-time bake
  window._lxPzBadgeCv = null;
  game.chests = [];
  if (typeof spawnChest === 'function') spawnChest(380, 320, 'gold');
  if (game.chests[0]) { game.chests[0]._pqPuzzlePiece = true; game.chests[0].opened = false; }
  out.chestSpawned = game.chests.length;
  const chestSpy = spy(() => { try { drawChests(); } catch (e) { out.chestErr = String(e).slice(0, 90); } });
  out.chestFirst = { built: !!window._lxPzBadgeCv, blurSets: chestSpy.sets, maxBlur: chestSpy.maxSet };
  const chestSpy2 = spy(() => { try { drawChests(); } catch (e) {} });
  out.chestSteady = { blurSets: chestSpy2.sets, maxBlur: chestSpy2.maxSet };
  game.chests = [];
  game.monsters = [];
  return out;
});
await b.close(); srv.kill();

ok('caps graduate: town untouched, duel lower, arena lowest',
  r.town.dmg === 24 && r.town.after === 10 && r.town.smooth === 14
  && r.duel.dmg === 14 && r.duel.after === 4 && r.duel.smooth === 9
  && r.arena.dmg === 11 && r.arena.after === 4 && r.arena.smooth === 6,
  { town: r.town, duel: r.duel, arena: r.arena });
ok('smoothFx eviction honours the graduated cap AND the sticky protection',
  r.smoothTrim.len <= r.smoothTrim.cap && r.smoothTrim.stickySurvived === 3,
  r.smoothTrim);
ok('the TITLE sets shadowBlur once EVER (the bake), zero in steady state',
  r.titleFirst.sets <= 1 && r.titleDraw.sets === 0,
  { firstDraw: r.titleFirst, steadyDraw: r.titleDraw,
    note: 'was shadowBlur=7 per titled entity per frame; the halo now lives in the one-time bake' });
ok('...and the bake is cached, not rebuilt per frame',
  r.titleCache === 1 && r.titleCacheStable, { cacheSize: r.titleCache, stable: r.titleCacheStable });
ok('the Hallowed Field gradient is built once and reused',
  r.hallowedBuilt && r.hallowedReused && !r.hallowedErr,
  { built: r.hallowedBuilt, reused: r.hallowedReused, err: r.hallowedErr || null });
ok('the puzzle-chest badge bakes on first draw - blur happens only inside the bake',
  r.chestFirst.built && r.chestSteady.blurSets === 0,
  { first: r.chestFirst, steady: r.chestSteady,
    note: 'first draw may set blur ONCE (the offscreen bake); steady-state draws never touch it' });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
