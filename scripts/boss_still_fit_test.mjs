// A BOSS'S STILL DRAWS LIKE THE FRAMES IT STANDS IN FOR. Per user: "fix the Aetherion glitch too". For the moment after a
// boss spawns, before its frames decode, the game draws its still picture. Aetherion's took his idle calibration (s 1.58,
// dy 0.168), made for idle frames that fill only 34% of their canvas against the still's 58%: 466 px tall (frames ~280)
// and 95 px into the floor, then a snap. Drawn through the game's own _drawBossSprite on a flat canvas, per boss:
//   - AETHERION: his still is within 10% of his idle frame 0's height and within 8 px of its plant
//   - CONTROLS: King Krook and the Tower Sovereign, whose stills fill their canvas like their frames, keep drawing like
//     them too (their calibration fits the still, so it must still apply)
//   [PORT=13903] node scripts/boss_still_fit_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '13903'; let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d) : '')); ok ? pass++ : fail++; };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _drawBossSprite === 'function', null, { timeout: 180000 });
const R = await page.evaluate(async () => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  document.documentElement.classList.remove('lx-nobackdrop');
  player._god = true; player._gravitosCineSeen = true; loadMap('forest', 300); await W8(2500);
  const out = {};
  for (const type of ['aetherion', 'kingKrook', 'towerSovereign']) {
    game.paused = false; game.monsters.length = 0;
    const m = spawnMonster(player.x + 420, player.y - 200, type, true);
    const ready = (im) => im && (im.naturalWidth || im.width);
    for (let t = 0; t < 120 && !(ready(BOSS_SPRITES[type]) && BOSS_IDLE_FRAMES[type] && ready(BOSS_IDLE_FRAMES[type][0])); t++) await W8(250);
    await W8(1500);   // let the idle set bake so frame 0 is what the game really draws
    game.paused = true; const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1);
    m.vx = 0; m.vy = 0; m.patternState = 'idle'; m.facing = 1; m.onGround = true;
    const cv = document.querySelector('canvas'), c2 = cv.getContext('2d'), W = cv.width, H = cv.height;
    const sx = Math.round(W / 2 - m.w / 2), sy = Math.round(H - 160 - m.h), lineY = sy + m.h;
    const draw = (img, anim) => {
      c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.fillStyle = '#00ff00'; c2.fillRect(0, 0, W, H);
      _drawBossSprite(img, m, sx, sy, false, anim); c2.restore();
      const d = c2.getImageData(0, 0, W, H).data; let top = -1, bot = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 2) { const k = (y * W + x) * 4; if (d[k] + Math.abs(d[k + 1] - 255) + d[k + 2] > 90) { if (top < 0) top = y; bot = y; break; } }
      return { h: bot - top + 1, bury: bot - lineY + 1 };
    };
    out[type] = { still: draw(BOSS_SPRITES[type], undefined), frame: draw(BOSS_IDLE_FRAMES[type][0], true) };
  }
  return out;
});
console.log(JSON.stringify(R));
const fits = (r) => r && Math.abs(r.still.h / r.frame.h - 1) <= 0.1 && Math.abs(r.still.bury - r.frame.bury) <= 8;
check(fits(R.aetherion), 'AETHERION: his still draws within 10% of his idle frame\'s height and 8 px of its plant (was 466 px tall, 95 px into the floor)', R.aetherion);
check(fits(R.kingKrook), 'CONTROL: King Krook\'s still keeps drawing like his frames', R.kingKrook);
check(fits(R.towerSovereign) || Math.abs(R.towerSovereign.still.bury - R.towerSovereign.frame.bury) <= 8, 'CONTROL: the Tower Sovereign\'s still keeps its frames\' plant', R.towerSovereign);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
