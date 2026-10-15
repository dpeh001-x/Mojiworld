// THE PLAYER'S METEOR IS HIS OWN (per user: "for player's meteor make them look distinct from the monster's / boss fireball by generating a
// new one from ludo.ai" -> red-and-gold spellfire round a gold rune medallion, animated, with its own landing rune). Every meteor_warn drew
// the same red lava rock over the same spiky red rune. A player's meteor (performMeteor's hazard: no owner) and a boss's (owner:'enemy') are
// dropped side by side in a live game, and every image each one hands to drawImage is recorded:
//   1. the player's meteor draws its own frames (meteor_player) and its own rune (meteor_marker_player) - never the red rock or red rune
//   2. a boss's meteor still draws the red rock frames and the red rune - unchanged
//   3. the new files are served (no 404) and the Meteor skill asks for them; the rune is animated too (nine frames)
//   node scripts/player_meteor_art_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 9827);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + JSON.stringify(x).slice(0, 400))); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], miss = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 400 && /meteor_(player|marker_player)/.test(r.url())) miss.push(r.url().replace(/^.*Sprites\//, '')); });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof _projAnimFrame === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(1200);
    player._god = true; player.invulnerable = 9e9; game.monsters.length = 0; game.paused = false;
    const out = { prefetch: (typeof _LX_FX_SKILL !== 'undefined' && _LX_FX_SKILL.meteor) || '' };
    const okIm = (im) => !!(im && (im.tagName === 'CANVAS' || (im.complete && im.naturalWidth > 0)));
    // the art arrives (the skill's own prefetch row asks for it; the test asks too, so a cold cache cannot fail it)
    const pf = _projAnimFrame('meteor_player'), rf = _projAnimFrame('meteor');
    if (typeof _lxFxReady === 'function') { _lxFxReady(LX_FX.meteor_marker_player); _lxFxReady(LX_FX.meteor_marker); }
    if (typeof _lxPlayerProjReady === 'function') { _lxPlayerProjReady(LX_PLAYER_PROJ.meteor_player); _lxPlayerProjReady(LX_PLAYER_PROJ.meteor); }   // the still is asked for on its first draw; ask now so the load check is fair
    const RU = (typeof _fxAnimFrames === 'function' && _fxAnimFrames('meteor_marker_player')) || [];
    const PA = PROJ_ANIM_FRAMES.meteor_player || [], RA = PROJ_ANIM_FRAMES.meteor || [];
    let t0 = performance.now(); while (performance.now() - t0 < 12000 && !(PA.length === 9 && PA.every(okIm) && RA.every(okIm) && okIm(LX_FX.meteor_marker_player) && okIm(LX_FX.meteor_marker) && okIm(LX_PLAYER_PROJ.meteor_player) && RU.length === 9 && RU.every(okIm))) await sleep(100);
    out.loaded = { runeFrames: RU.filter(okIm).length + '/' + RU.length, frames: PA.filter(okIm).length + '/' + PA.length, still: okIm(LX_PLAYER_PROJ.meteor_player), rune: okIm(LX_FX.meteor_marker_player) };
    const H = (typeof H_PLAY !== 'undefined') ? H_PLAY : 560;
    const run = async (owner) => {
      game.hazards.length = 0;
      const cx = player.x + player.w / 2 + 120;
      const h = { x: cx - 180, y: 0, w: 360, h: H, type: 'meteor_warn', life: 50, maxLife: 50, fireAt: 50, cx, radius: 180 };
      if (owner) h.owner = owner;
      game.hazards.push(h);
      const seen = { mine: 0, red: 0, runeMine: 0, runeRed: 0 };
      const P = CanvasRenderingContext2D.prototype, di = P.drawImage;
      P.drawImage = function (im) {
        if (im) {
          if (im === LX_FX.meteor_marker_player || (FX_ANIM_FRAMES.meteor_marker_player || []).indexOf(im) >= 0) seen.runeMine++; else if (im === LX_FX.meteor_marker) seen.runeRed++;
          else if ((PROJ_ANIM_FRAMES.meteor_player || []).indexOf(im) >= 0 || im === LX_PLAYER_PROJ.meteor_player) seen.mine++;
          else if ((PROJ_ANIM_FRAMES.meteor || []).indexOf(im) >= 0 || im === LX_PLAYER_PROJ.meteor) seen.red++;
        }
        return di.apply(this, arguments);
      };
      try { const tt = performance.now(); while (performance.now() - tt < 500) { h.life = Math.max(10, h.life); await sleep(16); } } finally { P.drawImage = di; game.hazards.length = 0; }
      return seen;
    };
    out.player = await run(null);
    out.enemy = await run('enemy');
    return out;
  });
  ok('the Meteor skill asks for the new art (its prefetch row names the frames, the still and the rune)', /pa:meteor_player/.test(R.prefetch) && /pp:meteor_player/.test(R.prefetch) && /fx:meteor_marker_player/.test(R.prefetch) && /fa:meteor_marker_player/.test(R.prefetch), R.prefetch);
  ok('the new art loads: nine meteor frames, the still, the rune and its nine frames (per user: "animate Q1 as well")', R.loaded.frames === '9/9' && R.loaded.still && R.loaded.rune && R.loaded.runeFrames === '9/9', R.loaded);
  ok("a player's meteor draws its own red-and-gold frames and its own rune - never the boss rock or the red rune", R.player.mine > 0 && R.player.runeMine > 0 && R.player.red === 0 && R.player.runeRed === 0, R.player);
  ok("a boss's meteor still draws the red rock and the red rune (unchanged)", R.enemy.red > 0 && R.enemy.runeRed > 0 && R.enemy.mine === 0 && R.enemy.runeMine === 0, R.enemy);
  ok('no new meteor file 404s', miss.length === 0, miss);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
