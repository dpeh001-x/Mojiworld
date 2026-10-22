// THE GRINNING ORB FACES WHERE IT FLIES (v0.30.1858, per user: "ensure this projectile sprite is when the projectile is flying westward
// and flip horizontally when flying eastward"). mdark (Spook, Bone Wraith, ...) is drawn facing west; an eastward shot is mirrored.
//   1. a Spook to the hero's RIGHT fires west: every draw of the orb is unmirrored
//   2. a Spook to the hero's LEFT fires east: every draw is mirrored
//   3. a shot that turns all but vertical keeps the side it had (no flicker); turned back west it unmirrors
//   4. no page errors
//   node scripts/mdark_facing_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11904), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 5000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof fireMonsterProjectile === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._tutorialSeen = true; player._gravitosCineSeen = true; window._lxAutoPause = () => {};
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    // a new hero is walked into the Void intro a few seconds after boot (it pauses the world): let it come, then settle the scene
    // again before every shot - map, overlays, pause - so a late intro cannot swallow the second shot
    await sleep(6000); player.level = 40; player._god = true;
    const settle = async () => {
      for (const el of document.querySelectorAll('[id$="-cine"], #story-beat-overlay, #void-intro-overlay')) { el.classList.remove('on', 'show'); el.style.display = 'none'; }
      try { closeAllModals(); } catch (e) {}
      if (game.currentMap !== 'forest') { loadMap('forest', 600); await sleep(2000); }
      player.x = 600; game.paused = false; await sleep(300);
    };
    loadMap('forest', 600); await sleep(2500); await settle();
    for (let i = 0; i < 50 && !_lxMobProjReady(LX_MOB_PROJ.mdark); i++) await sleep(100);
    // every image the orb is drawn from (the still, its loop frames) and every scaled copy made of them
    // the flying orb only: its still and its loop frames (not the muzzle flash, projectiles/cast/mdark.webp, drawn at the shooter).
    // The art is 768 px, so the game draws _lxProjScaled copies, cached on each source image (img._lxProjCache): a draw is the orb's
    // when its image is one of those sources or one of their cached copies. Only draws on the on-screen canvas count (the scaler's
    // own bake onto a detached canvas is not a frame of the shot).
    // The loop frames decode lazily, so the set is re-collected (at most every 100 ms) whenever a draw is not recognised.
    const srcs = new Set([LX_MOB_PROJ.mdark]); let lastC = 0;
    const collect = () => { lastC = performance.now(); for (let t = 0; t < 1500; t += 40) { const f = _projAnimFrame('mdark', t); if (f) srcs.add(f); } };
    const known = (im) => { if (srcs.has(im)) return true; for (const s of srcs) { const c = s._lxProjCache; if (c && c.get) for (const v of c.values()) if (v === im) return true; } return false; };
    const isMd = (im) => { if (!im) return false; if (known(im)) return true; if (performance.now() - lastC > 100) { collect(); return known(im); } return false; };
    collect();
    // the game's own context carries an instance drawImage (the HD pin wrapper holds the prototype's), so wrap THAT one
    let draws = []; const _di = ctx.drawImage;
    ctx.drawImage = function (im) { if (isMd(im)) draws.push(ctx.getTransform().a < 0 ? 'M' : 'n'); return _di.apply(this, arguments); };
    out.frames = srcs.size;
    const clear = () => { for (const m of [...game.monsters]) { const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1); } game.projectiles.length = 0; };
    const shoot = async (dx) => {
      await settle(); clear(); draws = [];
      const m = spawnMonster(player.x + dx, player.y - 30, 'wraith', false); m.shootCd = 1e9; m.attackCooldown = 1e9;
      fireMonsterProjectile(m);
      const p = game.projectiles.find((q) => q.skill === 'mdark');
      const life = []; for (let k = 0; k < 7; k++) { await sleep(50); life.push(p && game.projectiles.includes(p) ? Math.round(p.x - player.x) : 'gone'); }
      return { p, vx: p ? +p.vx.toFixed(2) : null, draws: draws.slice(), life, paused: !!game.paused, map: game.currentMap };
    };
    const w = await shoot(320); out.west = { life: w.life, vx: w.vx, n: w.draws.length, mirrored: w.draws.filter((d) => d === 'M').length };
    const e = await shoot(-320); out.east = { life: e.life, paused: e.paused, map: e.map, vx: e.vx, n: e.draws.length, mirrored: e.draws.filter((d) => d === 'M').length };
    // 3. the eastward shot turns all but vertical, then west
    if (e.p && game.projectiles.includes(e.p)) {
      e.p.vx = 0.01; e.p.vy = 4; draws = []; await sleep(200); out.vertical = { n: draws.length, mirrored: draws.filter((d) => d === 'M').length };
      e.p.vx = -4; e.p.vy = 0; draws = []; await sleep(200); out.back = { n: draws.length, mirrored: draws.filter((d) => d === 'M').length };
    }
    ctx.drawImage = _di;
    return out;
  });
  ok('1. a Spook to the right fires WEST, and the orb is drawn as authored (never mirrored)', R.west.vx < 0 && R.west.n >= 2 && R.west.mirrored === 0, R.west);
  ok('2. a Spook to the left fires EAST, and the orb is mirrored on every draw', R.east.vx > 0 && R.east.n >= 2 && R.east.mirrored === R.east.n, R.east);
  ok('3a. turned all but vertical, it keeps the side it had (no flicker)', R.vertical && R.vertical.n >= 2 && R.vertical.mirrored === R.vertical.n, R.vertical);
  ok('3b. turned back west, it is drawn as authored again', R.back && R.back.n >= 2 && R.back.mirrored === 0, R.back);
  ok('4. no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
