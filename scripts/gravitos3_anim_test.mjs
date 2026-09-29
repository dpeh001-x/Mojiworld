// GRAVITOS FORM 3, ONE BODY IN EVERY SET. Per user: "Gravitos 3rd form sprites is incredibly unsmooth, the size keeps
// changing causing the flow looks glitchy", "the calibration needs to be carefully considering the boss's head and body",
// "ensure that there are no cutoffs or the edges and the main head/torso size is consistent throughout the animations
// except the star form where it is a blown up enlarged version". All seven sets were redrawn from the new still and fitted
// by his head and torso; before, the sets drew him at 0.90-1.07x of idle and up to 57 px sideways (the laser's dx).
//   - FILES: 63 frames + 9 statics, 1214 px tall; each set on its own width, trimmed symmetrically (the game draws frames
//     centred) and never under 1640 px (the boss size factor is long edge / 1024, capped at 1.6); his still matches the
//     idle canvas (1656); no frame reaches within 13 px of the top or either side
//   - ONE SIZE: every set shares idle's calibration (s, dx, dy); only the star cast is bigger (s >= 1.2)
//   - IN GAME: each set's rest pose (frame 0), drawn by _drawBossSprite with the keys a fight uses, puts his chest core
//     within 6 px of idle's; the star cast puts it >= 15% higher (the enlarged form, scaled about his feet)
//   [PORT=13921] node scripts/gravitos3_anim_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core'); const sharp = require('sharp'); sharp.cache(false);
const PORT = process.env.PORT || '13921'; let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d) : '')); ok ? pass++ : fail++; };
const SETS = { idle: 'idle/gravitos3', walk: 'walk/gravitos3', attack: 'attack/gravitos3', laser: 'attack/gravitos3laser', punch: 'attack/gravitos3punch', soul: 'attack/gravitos3soul', star: 'attack/gravitos3star' };
// FILES
const files = [...Object.values(SETS).flatMap((p) => [...Array(9)].map((_, k) => `${p}_${k}.webp`)),
  'gravitos3.webp', 'gravitos3laser.webp', 'gravitos3punch.webp', 'gravitos3soul.webp', 'gravitos3star.webp', 'attack/gravitos3.webp', 'attack/gravitos3punch.webp', 'attack/gravitos3soul.webp', 'attack/gravitos3star.webp'];
const badSize = [], edge = [], SIZES = {};
for (const f of files) {
  const { data: d, info } = await sharp(fs.readFileSync(path.join(ROOT, 'Sprites', 'bosses', f))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; if (W < 1640 || H !== 1214) badSize.push(f + ' ' + W + 'x' + H);
  const setKey = f.replace(/_\d+\.webp$/, '');   // 'idle/gravitos3', 'attack/gravitos3laser', or a static's own name
  SIZES[setKey] = (SIZES[setKey] || new Set()).add(W);
  let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x < 13 || x >= W - 13 || y < 13) && d[(y * W + x) * 4 + 3] > 16) n++;
  if (n) edge.push(f + ' ' + n);
}
const mixed = Object.entries(SIZES).filter(([, v]) => v.size > 1).map(([k]) => k);
check(files.length === 72 && badSize.length === 0 && mixed.length === 0, 'FILES: 72 files, 1214 px tall, >= 1640 wide, one width per set', { badSize, mixed });
check([...(SIZES['idle/gravitos3'] || [])][0] === [...(SIZES['gravitos3.webp'] || [])][0], 'FILES: his still matches the idle canvas (the manifest rule)', { idle: [...(SIZES['idle/gravitos3'] || [])], still: [...(SIZES['gravitos3.webp'] || [])] });
check(edge.length === 0, 'FILES: no frame reaches within 13 px of the top or either side (nothing cut off)', edge);
// ONE SIZE
const cs = fs.readFileSync(path.join(ROOT, 'data', 'anim_calib.js'), 'utf8').replace(/\r\n/g, '\n'), pre = 'window.LX_ANIM_CALIB = ', ci = cs.indexOf(pre);
const CAL = JSON.parse(cs.slice(ci + pre.length, cs.indexOf('\n};', ci) + 2)), ref = CAL.gravitos3.idle, same = (e) => e && e.s === ref.s && (e.dx || 0) === (ref.dx || 0) && e.dy === ref.dy;
const states = [['gravitos3', 'walk'], ['gravitos3', 'attack'], ['gravitos3laser', 'attack'], ['gravitos3punch', 'attack'], ['gravitos3soul', 'attack'], ['gravitos3star', 'idle'], ['gravitos3star', 'walk']];
const off = states.filter(([k, st]) => !same(CAL[k] && CAL[k][st]) || (CAL[k][st].fs && CAL[k][st].fs.some((v) => v !== 1)));
check(off.length === 0, 'ONE SIZE: every form-3 set shares idle\'s calibration, no per-frame scale', { idle: ref, off: off.map((q) => q.join('.')) });
check(CAL.gravitos3star.attack.s >= 1.2 && (CAL.gravitos3star.attack.dx || 0) === 0, 'ONE SIZE: only the star cast is enlarged', CAL.gravitos3star.attack);
// IN GAME
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _drawBossSprite === 'function', null, { timeout: 180000 });
const R = await page.evaluate(async () => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._god = true; player._gravitosCineSeen = true; loadMap('forest', 300); await W8(2500);
  const m = spawnMonster(player.x + 420, player.y - 200, 'gravitos', true); await W8(1000);
  game.paused = true; const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1);
  m._phaseSprite = 'gravitos3'; m.vx = 0; m.vy = 0; m.patternState = 'idle'; m.facing = 1;
  const S = [['idle', () => BOSS_IDLE_FRAMES.gravitos3, null, false], ['walk', () => BOSS_WALK_FRAMES.gravitos3, null, false], ['attack', () => BOSS_ATTACK_FRAMES.gravitos3, null, true],
    ['laser', () => BOSS_ATTACK_FRAMES.gravitos3laser, 'gravitos3laser', true], ['punch', () => BOSS_ATTACK_FRAMES.gravitos3punch, 'gravitos3punch', true],
    ['soul', () => BOSS_ATTACK_FRAMES.gravitos3soul, 'gravitos3soul', true], ['star', () => BOSS_ATTACK_FRAMES.gravitos3star, 'gravitos3star', true]];
  const ok = (im) => im && ((im.complete && im.naturalWidth > 0) || im.tagName === 'CANVAS');
  for (let t = 0; t < 200 && !S.every(([, f]) => f() && f()[0] && ok(f()[0])); t++) await W8(250);
  const cv = document.querySelector('canvas'), c2 = cv.getContext('2d'), W = cv.width, H = cv.height, sx = Math.round(W / 2 - m.w / 2), sy = Math.round(H - 120 - m.h), foot = sy + m.h, out = {};
  for (const [name, f, key, atk] of S) {
    const set = f(); if (!set || !ok(set[0])) { out[name] = null; continue; }
    set._lxStandInOff = true; m._gravStarKey = key; m._lxCalE = null;
    c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.fillStyle = '#00ff00'; c2.fillRect(0, 0, W, H); _drawBossSprite(set[0], m, sx, sy, atk, true); c2.restore();
    // the chest core: the 40 brightest pixels in the torso window (it is the hottest thing on him; its colour varies by set).
    // Idle and the star search the whole torso; every other set searches +-50 px round idle's core, because a set whose
    // core glows dim orange (the fire beam's rest pose) would otherwise pick the flame crown over his head.
    const I0 = out.idle, near = I0 && I0.n && name !== 'star';
    const yA = near ? foot - I0.up - 50 : foot - 900, yB = near ? foot - I0.up + 50 : foot - 120, xA = near ? I0.x - 50 : sx + m.w / 2 - 260, xB = near ? I0.x + 50 : sx + m.w / 2 + 260;
    const d = c2.getImageData(0, 0, W, H).data, px = [];
    for (let y = Math.max(0, yA); y < Math.min(H, yB); y++) for (let x = Math.max(0, xA); x < Math.min(W, xB); x++) {
      const k = (y * W + x) * 4; if (d[k + 1] > 200 && d[k] < 60 && d[k + 2] < 60) continue; px.push([0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2], x, y]); }
    px.sort((p, q) => q[0] - p[0]); const top = px.slice(0, 40), n = top.length, ax = top.reduce((a2, p) => a2 + p[1], 0), ay = top.reduce((a2, p) => a2 + p[2], 0);
    out[name] = n ? { x: Math.round(ax / n), up: Math.round(foot - ay / n), n, lum: Math.round(top[n - 1][0]) } : { n: 0 };
  }
  return out;
});
console.log(JSON.stringify(R));
const I = R.idle, near = ['walk', 'attack', 'laser', 'punch', 'soul'].filter((k) => !(R[k] && R[k].n && I && Math.abs(R[k].x - I.x) <= 6 && Math.abs(R[k].up - I.up) <= 6));
check(!!(I && I.n) && near.length === 0, 'IN GAME: every set\'s rest pose puts his chest core within 6 px of idle\'s (one body)', { idle: I, off: near.map((k) => ({ k, ...R[k] })) });
check(!!(R.star && R.star.n && I && I.n) && R.star.up >= I.up * 1.15, 'IN GAME: the star cast draws him enlarged (core >= 15% higher above his feet)', { idle: I && I.up, star: R.star && R.star.up });
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
