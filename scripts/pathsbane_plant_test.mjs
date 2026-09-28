// PATH'S BANE STANDS ON THE FLOOR THROUGH HIS WHOLE ATTACK. Per user: "Pathbane seems to be pushed vertically down too
// much down the floor, please push him upwards". Drawn through the game's own _drawMonsterSprite on a flat canvas, his
// idle sat 6 px into the floor (the house plant) and every attack frame 26 px: a stale calib dy (0.075) sank the set
// ~20 px, and the per-frame plant (v0.29.509) put each frame's LOWEST pixel on the floor - in his strike frames that is
// the scythe blade, 22-27 px under his boots, so his body rose there. Measured (+ = into the floor):
//   - REST: attack frames 0 and 8 sit where his idle does (within 2 px)
//   - NO BLADE BELOW: frames 1-3 and 7 too - their lowest pixels are his boots
//   - NOT LIFTED: in frames 4-6 the blade reaches >= 10 px below where his boots stand, i.e. the body stayed down and the
//     blade dips under the floor (planting on the blade would put it at the idle depth)
//   [PORT=13901] node scripts/pathsbane_plant_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '13901'; let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d) : '')); ok ? pass++ : fail++; };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _drawMonsterSprite === 'function', null, { timeout: 180000 });
const R = await page.evaluate(async () => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  document.documentElement.classList.remove('lx-nobackdrop');
  player._god = true; loadMap('forest', 300); await W8(2500); game.paused = true;
  const m = spawnMonster(player.x + 120, player.y - 100, 'pathsBane', false);
  const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1);
  m.facing = 1; m.vx = 0; m.vy = 0; m.freezeTimer = m.burnTimer = m.stunTimer = 0;
  const set = _monsterFramesFor('pathsBane'), ready = (im) => im && (im.naturalWidth || im.width);
  for (let t = 0; t < 120 && !(ready(MONSTER_SPRITES.pathsBane) && ['idle', 'attack'].every((s) => set[s] && set[s].length === 9 && set[s].every(ready))); t++) await W8(250);
  const cv = document.querySelector('canvas'), c2 = cv.getContext('2d'), W = cv.width, H = cv.height;
  const sx = Math.round(W / 2 - m.w / 2), sy = Math.round(H - 140 - m.h), lineY = sy + m.h, orig = window._monsterStateFrame;
  const bury = (img, isAtk) => {   // lowest drawn pixel vs the foot line, on a flat green field
    window._monsterStateFrame = () => { m._frameIsAttack = !!isAtk; return img; };
    m._frameIsAttack = !!isAtk;
    c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.fillStyle = '#00ff00'; c2.fillRect(0, 0, W, H);
    _drawMonsterSprite(m, sx, sy); c2.restore();
    const d = c2.getImageData(0, 0, W, H).data; let bot = -1;
    for (let y = H - 1; y >= 0 && bot < 0; y--) for (let x = 0; x < W; x += 2) { const k = (y * W + x) * 4; if (d[k] + Math.abs(d[k + 1] - 255) + d[k + 2] > 90) { bot = y; break; } }
    return bot - lineY + 1;
  };
  const idle = bury(set.idle[0], false), atk = set.attack.map((im) => bury(im, true));
  window._monsterStateFrame = orig;
  return { idle, atk, ready: set.attack.every(ready) };
});
console.log(JSON.stringify(R));
const near = (v) => Math.abs(v - R.idle) <= 2;
check(R.ready && near(R.atk[0]) && near(R.atk[8]), 'REST: his attack starts and ends where his idle stands (within 2 px)', { idle: R.idle, frame0: R.atk[0], frame8: R.atk[8] });
check([1, 2, 3, 7].every((k) => near(R.atk[k])), 'NO BLADE BELOW: frames 1-3 and 7 stand at his idle depth too', [1, 2, 3, 7].map((k) => R.atk[k]));
check([4, 5, 6].every((k) => R.atk[k] >= R.idle + 10), 'NOT LIFTED: in the strike frames the blade dips below the floor while his body stays down', [4, 5, 6].map((k) => R.atk[k]));
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
