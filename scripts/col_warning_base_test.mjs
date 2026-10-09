// COLUMN WARNINGS STAND ON THE FLOOR, FLAT, SEEN FROM THE SIDE. Per user: "the bottom of the warning pillar can look
// more flat 2d, the current angle looks wrong for a side scroller". All seventeen tg_col_* warnings stood in a rune
// ring seen from above at three-quarters (its front half 24-52 px deep under a 512 px pillar), and the zone drew them
// down to the SCREEN's bottom edge - 80 px below the floor, in the dirt behind the skill bar.
//   - FILES: every warning's base is flat (scripts/flatten_tg_col_base.mjs finds no 3/4 ring - a front half under 3% of
//     the frame) and is still a real base band (its bottom rows span >= 60% of the width)
//   - IN GAME: a column caster's zone keeps its full-height hit rect (the pillar that fires is the zone drawn) and
//     carries the floor under its lane; the warning art is drawn down to that floor, not the screen's edge
//   - NO GROUND: a lane with no floor under it keeps the full height
//   [PORT=13887] node scripts/col_warning_base_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core'); const sharp = require('sharp');
const PORT = process.env.PORT || '13887'; let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d) : '')); ok ? pass++ : fail++; };
// FILES
const { flatten } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'flatten_tg_col_base.mjs')).href);
const FX = path.join(ROOT, 'Sprites', 'fx');
const files = fs.readdirSync(FX).filter((n) => /^tg_col_.*\.webp$/.test(n)).sort();
const ringed = [], bandless = [];
// v0.30.1627 mira-fallen: tg_col_miraFallen's base is a SWORD EMBLEM, not a 3/4 rune ring - the flattener reads its blade as
// a ring's front half and would cut the sword off. The game also draws its animated frames (Sprites/fx/anim/
// tg_col_miraFallen_N, an _FX_ANIM_KEYS set), never this still in play. Exempt from the ring check only.
const RING_EXEMPT = new Set(['tg_col_miraFallen.webp']);
for (const n of files) {
  const buf = fs.readFileSync(path.join(FX, n));
  const r = await flatten(buf);
  if (!r.skipped && !RING_EXEMPT.has(n)) ringed.push(`${n} (front half ${r.yB - r.yC} px)`);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let yB = H - 1, wide = 0;
  const drawn = (y) => { let n2 = 0; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) n2++; return n2; };
  while (yB > 0 && drawn(yB) === 0) yB--;
  for (let y = yB; y > yB - H * 0.04; y--) wide = Math.max(wide, drawn(y));
  if (wide < W * 0.6) bandless.push(`${n} (${wide}/${W})`);
}
check(files.length >= 17 && ringed.length === 0, `FILES: all ${files.length} warnings stand on a flat base, no 3/4 ring`, ringed);
check(bandless.length === 0, 'FILES: each still ends in a real base band (>= 60% of the width)', bandless);
// IN GAME
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxAttackZones === 'function' && typeof LX_FX !== 'undefined', null, { timeout: 180000 });
const R = await page.evaluate(async () => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  player._tutorialSeen = true; applyClass('warrior'); player.level = 90;
  try { _lxBootHold.release('menu'); } catch (e) {}
  loadMap('forest', 300); await W8(1500); try { closeAllModals(); } catch (e) {} game.paused = false;
  player._god = true; player.invulnerable = 9e9; game.monsters.length = 0;
  try { _lxFxWant('fx:tg_col_pathsBane', true); } catch (e) {}
  for (let i = 0; i < 80 && !_lxFxReady(LX_FX.tg_col_pathsBane); i++) await W8(100);
  // record where the warning art is drawn: the drawImage call that paints LX_FX.tg_col_pathsBane
  const P = CanvasRenderingContext2D.prototype, orig = P.drawImage; let drawn = null;
  P.drawImage = function (img, ...a) { if (img === LX_FX.tg_col_pathsBane && a.length === 4) drawn = { y: a[1], h: a[3] }; return orig.call(this, img, ...a); };
  const m = spawnMonster(player.x + 300, player.y - 100, 'pathsBane', false);
  if (m.traits.bigMelee) m.traits.bigMelee = Object.assign({}, m.traits.bigMelee, { cdMs: 9e9 }); m._bmCd = 9e9;
  if (m.traits.hourglassCharge) m._hgCd = 9e9; m.shootTimer = -9e9; m._columnCd = 0;
  let zone = null, seen = null; const t0 = performance.now();
  while (performance.now() - t0 < 15000 && !(zone && seen)) {
    await new Promise((r) => requestAnimationFrame(r));
    const z = _lxAttackZones().find((q) => q.kind === 'column');
    if (z && !zone) { zone = { y: z.y, h: z.h, floorY: z.floorY, lane: z.x + z.w / 2 }; drawn = null; }
    if (zone && drawn) seen = drawn;
  }
  const camY = (game.camera && game.camera.y) || 0;
  const ground = (zone && typeof _lxColFloorY === 'function') ? _lxColFloorY(zone.lane) : null;
  // NO GROUND: the same art in a lane with nothing under it
  const realZones = window._lxAttackZones; drawn = null;
  window._lxAttackZones = () => [{ kind: 'column', x: player.x, y: camY, w: 120, h: H, prog: 0.9, color: '#fff', dir: 'up', tg: 'tg_col_pathsBane', floorY: null }];
  for (let i = 0; i < 10 && !drawn; i++) await new Promise((r) => requestAnimationFrame(r));
  const noGround = drawn; window._lxAttackZones = realZones; P.drawImage = orig;
  return { zone, seen, ground, camY, H, noGround };
});
console.log(JSON.stringify(R));
check(!!R.zone && R.zone.h === R.H && R.zone.y === R.camY, 'IN GAME: the zone keeps its full-height hit rect (the pillar that fires is the zone drawn)', R.zone);
check(!!R.zone && R.zone.floorY != null && R.zone.floorY === R.ground, 'it carries the floor under its lane', { floorY: R.zone && R.zone.floorY, ground: R.ground });
check(!!R.seen && R.zone && Math.abs((R.seen.y + R.seen.h) - (R.zone.floorY + 4 - R.camY)) <= 1 && R.seen.y + R.seen.h < R.H - 20,
  'the warning art is drawn down to that floor, not the screen\'s bottom edge', { artBottom: R.seen && R.seen.y + R.seen.h, floorOnScreen: R.zone && R.zone.floorY - R.camY, screenH: R.H });
check(!!R.noGround && Math.abs(R.noGround.h - R.H) <= 1, 'NO GROUND: a lane with no floor under it keeps the full height', R.noGround);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
