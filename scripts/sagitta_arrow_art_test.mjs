// SAGITTA'S ARROW RAIN IS HER OWN (per user: "yes start with sagitta's arrows" -> A1 "but bigger", 1.5x). Her rain (skill 'arrowRain')
// drew p_arrow.webp - the PLAYER archer's arrow. It now draws her own starfall arrow (p_sagarrow.webp + nine frames) half again as long,
// on the same hitbox; her Trajectory Shot / Hunt Mark (skill 'arrow') drew the player's arrow too and now draw hers. Volleys of each,
// and of the player's Arrow Rain (skill 'rainArrow') and plain arrow, are drawn in a live game and every image each hands to drawImage
// is recorded:
//   1. her arrows draw only her art (still or frames) - never the player's arrow - at 1.5x the old length; the hitbox is unchanged
//   2. her Trajectory Shot / Hunt Mark (skill 'arrow') draw her arrow too, never the player's
//   3. the player's Arrow Rain and plain arrow still draw the player's arrow - never hers
//   4. the new files are served (no 404) and her fight's prefetch row asks for the frames
//   node scripts/sagitta_arrow_art_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 9829);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + JSON.stringify(x).slice(0, 400))); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], miss = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 400 && /p_sagarrow|anim\/arrowRain_/.test(r.url())) miss.push(r.url().replace(/^.*Sprites\//, '')); });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof _projAnimFrame === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(1200);
    player._god = true; player.invulnerable = 9e9; game.monsters.length = 0; game.paused = false;
    const out = { prefetch: (typeof _LX_FX_BOSS !== 'undefined' && _LX_FX_BOSS.zodiac_sagittarius) || '', src: String((LX_MOB_PROJ.arrowRain && LX_MOB_PROJ.arrowRain.src) || '') };
    const okIm = (im) => !!(im && (im.tagName === 'CANVAS' || (im.complete && im.naturalWidth > 0)));
    _projAnimFrame('arrowRain'); _lxMobProjReady(LX_MOB_PROJ.arrowRain); _lxPlayerProjReady(LX_PLAYER_PROJ.arrow);   // mob and player shots load lazily on first ask
    const FR = PROJ_ANIM_FRAMES.arrowRain || [];
    let t0 = performance.now(); while (performance.now() - t0 < 12000 && !(FR.length === 9 && FR.every(okIm) && okIm(LX_MOB_PROJ.arrowRain) && okIm(LX_PLAYER_PROJ.arrow))) await sleep(100);
    out.loaded = { frames: FR.filter(okIm).length + '/' + FR.length, still: okIm(LX_MOB_PROJ.arrowRain) };
    // her rain, her Trajectory Shot / Hunt Mark (skill 'arrow', fired sideways), the player's Arrow Rain and the player's plain arrow
    const SHOT = {
      rain: (i) => ({ x: player.x + 80 + i * 40, y: player.y - 200, vx: 0, vy: 10, w: 8, h: 20, owner: 'enemy', _zodiacSign: 'sagittarius', _zodiacAttacker: true, skill: 'arrowRain', color: '#ffcc88' }),
      shot: (i) => ({ x: player.x + 80 + i * 40, y: player.y - 200 + i * 12, vx: -8, vy: 0, w: 29, h: 7, owner: 'enemy', _zodiacSign: 'sagittarius', _zodiacAttacker: true, skill: 'arrow', color: '#ffd27a' }),
      pRain: (i) => ({ x: player.x + 80 + i * 40, y: player.y - 200, vx: 0, vy: 10, w: 8, h: 20, owner: 'player', skill: 'rainArrow', color: '#66ccff', _msHandled: true }),
      pArrow: (i) => ({ x: player.x + 80 + i * 40, y: player.y - 200 + i * 12, vx: 9, vy: 0, w: 16, h: 6, owner: 'player', skill: 'arrow', color: '#ffdd88' }),
    };
    const run = async (kind) => {
      game.projectiles.length = 0;
      const ps = [];
      for (let i = 0; i < 6; i++) { const p = Object.assign(SHOT[kind](i), { life: 9e9, damage: 0 }); ps.push(p); game.projectiles.push(p); }
      const y0 = ps.map((p) => [p.x, p.y]);
      const seen = { hers: 0, playerArrow: 0, len: [] };
      // the draw hands drawImage a BAKED copy (_lxProjScaled) of a still or of an animation frame, so every image is traced back to
      // where it came from: her still, a frame served for 'arrowRain', or the player's arrow
      const origin = new Map(), tag = (im, t) => { if (im && typeof im === 'object') origin.set(im, t); return im; };
      tag(LX_MOB_PROJ.arrowRain, 'hers'); tag(LX_PLAYER_PROJ.arrow, 'playerArrow'); for (const f of FR) tag(f, 'hers');
      const PS = window._lxProjScaled, PA = window._projAnimFrame;
      window._lxProjScaled = function (img) { const r = PS.apply(this, arguments); if (img && origin.has(img)) tag(r, origin.get(img)); return r; };
      window._projAnimFrame = function (k) { const r = PA.apply(this, arguments); if (k === 'arrowRain') tag(r, 'hers'); return r; };
      const P = CanvasRenderingContext2D.prototype, di = P.drawImage;
      P.drawImage = function (im) {
        const t = (this === ctx) && im && origin.get(im);   // the game canvas only: a bake drawing the source onto its own canvas is not a draw
        if (t === 'hers') { seen.hers++; if (arguments.length === 5) seen.len.push(Math.round(arguments[3])); else if (arguments.length === 9) seen.len.push(Math.round(arguments[7])); }
        else if (t === 'playerArrow') seen.playerArrow++;
        return di.apply(this, arguments);
      };
      try { const tt = performance.now(); while (performance.now() - tt < 400) { ps.forEach((p, i) => { p.x = y0[i][0]; p.y = y0[i][1]; p.life = 9e9; }); await sleep(16); } }
      finally { P.drawImage = di; window._lxProjScaled = PS; window._projAnimFrame = PA; }
      seen.box = ps[0].w + 'x' + ps[0].h;
      game.projectiles.length = 0;
      return seen;
    };
    out.sag = await run('rain'); out.shot = await run('shot'); out.player = await run('pRain'); out.pArrow = await run('pArrow');
    return out;
  });
  ok("Sagitta's fight prefetches her rain frames (pa:arrowRain)", /\bpa:arrowRain\b/.test(R.prefetch), R.prefetch);
  ok('her rain is her own file, not the player arrow', /p_sagarrow\.webp/.test(R.src), R.src);
  ok('her arrow and its nine frames load', R.loaded.frames === '9/9' && R.loaded.still, R.loaded);
  ok("her rain draws only her art - never the player's arrow", R.sag.hers > 0 && R.sag.playerArrow === 0, R.sag);
  const L = R.sag.len.length ? Math.max(...R.sag.len) : 0;
  ok('her arrow draws 1.5x the old length (~74 px against ~49) per user', L >= 70 && L <= 78, { len: L });
  ok('her hitbox is unchanged (8x20 grown 1.3x by the zodiac size table)', R.sag.box === '10x26', R.sag.box);
  ok("her Trajectory Shot / Hunt Mark (skill 'arrow') draw her arrow too - never the player's", R.shot.hers > 0 && R.shot.playerArrow === 0, R.shot);
  ok("the player's Arrow Rain still draws the player's arrow - never hers", R.player.playerArrow > 0 && R.player.hers === 0, R.player);
  ok("the player's own arrow (skill 'arrow') still draws the player's arrow - never hers", R.pArrow.playerArrow > 0 && R.pArrow.hers === 0, R.pArrow);
  ok('no new arrow file 404s', miss.length === 0, miss);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
