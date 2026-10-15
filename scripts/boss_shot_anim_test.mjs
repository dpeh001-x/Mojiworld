// BOSS SHOTS THAT DID NOT MOVE NOW MOVE (per user: "Work on all at the same time" - the shots that still drew one frame). Each is fired
// the way its owner fires it, drawn through the real drawProjectiles, and every image handed to drawImage on the game canvas is traced
// back (through the _lxProjScaled bake) to the animation set _projAnimFrame served it from:
//   1. King Krook's shell, Barnaby's fist, Gravitos's bolt and shockwave (Mooma fires the same shock), Aries's ember (the Spire's fireball
//      shares it), the Ossuary Tyrant's bone spear and the holy beam each draw frames of their OWN new set, nine of them, all loading
//   2. the zodiac homing bolt borrows the zodiac bolt's frames (it is drawn from the same still)
//   3. the player's fireball (skill 'fire' too) still draws only its own loop - never the ember's frames
//   4. no new frame 404s, no page errors
//   node scripts/boss_shot_anim_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 9831);
const NEW = ['claw', 'barnFist', 'gravbolt', 'shock', 'fire', 'mgravebone', 'mholybeam'];
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + JSON.stringify(x).slice(0, 400))); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], miss = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  const re = new RegExp('projectiles/anim/(' + NEW.join('|') + ')_\\d');
  page.on('response', (r) => { if (r.status() >= 400 && re.test(r.url())) miss.push(r.url().replace(/^.*Sprites\//, '')); });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof _projAnimFrame === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const R = await page.evaluate(async (NEW) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(1200);
    player._god = true; player.invulnerable = 9e9; game.monsters.length = 0; game.paused = false;
    const okIm = (im) => !!(im && (im.tagName === 'CANVAS' || (im.complete && im.naturalWidth > 0)));
    const out = { loaded: {}, runs: {} };
    for (const k of [...NEW, 'zodiac', 'p_fireball']) _projAnimFrame(k);
    let t0 = performance.now(); while (performance.now() - t0 < 15000 && !NEW.every((k) => (PROJ_ANIM_FRAMES[k] || []).length === 9 && PROJ_ANIM_FRAMES[k].every(okIm))) await sleep(100);
    for (const k of NEW) { const F = PROJ_ANIM_FRAMES[k] || []; out.loaded[k] = F.filter(okIm).length + '/' + F.length; }
    // every frame _projAnimFrame serves is tagged with its set; bakes inherit the tag; only draws on the game canvas count
    const origin = new Map(), tag = (im, t) => { if (im && typeof im === 'object') origin.set(im, t); return im; };
    const PS = window._lxProjScaled, PA = window._projAnimFrame, P = CanvasRenderingContext2D.prototype, di = P.drawImage;
    window._lxProjScaled = function (img) { const r = PS.apply(this, arguments); if (img && origin.has(img)) tag(r, origin.get(img)); return r; };
    window._projAnimFrame = function (k) { const r = PA.apply(this, arguments); tag(r, 'set:' + k); return r; };
    const Z = { owner: 'enemy', _zodiacSign: 'aries', _zodiacAttacker: true };
    const SHOT = {
      claw: { skill: 'claw', owner: 'enemy', w: 40, h: 40, vx: -6, vy: 0, want: 'claw' },
      barnFist: { skill: 'barnFist', owner: 'enemy', w: 40, h: 40, vx: -6, vy: 0, want: 'barnFist' },
      gravbolt: { skill: 'gravbolt', owner: 'enemy', w: 40, h: 14, vx: -6, vy: 0, _srcType: 'gravitos', want: 'gravbolt' },
      shock: { skill: 'shock', owner: 'enemy', w: 30, h: 30, vx: -5, vy: 0, noGravity: true, want: 'shock' },
      ember: Object.assign({ skill: 'fire', w: 37, h: 39, vx: -5, vy: 0, color: '#ff6622', want: 'fire' }, Z),
      spireFire: { skill: 'fire', owner: 'enemy', w: 30, h: 30, vx: -5, vy: 0, want: 'fire' },
      zodiacHoming: Object.assign({ skill: 'zodiacHoming', w: 42, h: 22, vx: -5, vy: 0, want: 'zodiac' }, Z),
      mgravebone: { skill: 'mgravebone', owner: 'enemy', w: 30, h: 30, vx: -6, vy: 0, want: 'mgravebone' },
      mholybeam: { skill: 'mholybeam', owner: 'enemy', w: 30, h: 30, vx: -6, vy: 0, want: 'mholybeam' },
      playerFire: { skill: 'fire', owner: 'player', w: 28, h: 28, vx: 7, vy: 0, color: '#ff8833', want: null },
    };
    const seen = {};
    P.drawImage = function (im) { const t = (this === ctx) && im && origin.get(im); if (t && seen.cur) seen.cur[t] = (seen.cur[t] | 0) + 1; return di.apply(this, arguments); };
    try {
      for (const [name, s] of Object.entries(SHOT)) {
        game.projectiles.length = 0; seen.cur = {};
        const p = Object.assign({ x: player.x + 160, y: player.y - 120, life: 9e9, damage: 0 }, s); delete p.want;
        game.projectiles.push(p);
        const tt = performance.now(); while (performance.now() - tt < 450) { p.x = player.x + 160; p.y = player.y - 120; p.life = 9e9; await sleep(16); }
        out.runs[name] = { want: s.want, sets: seen.cur };
      }
    } finally { P.drawImage = di; window._lxProjScaled = PS; window._projAnimFrame = PA; seen.cur = null; game.projectiles.length = 0; }
    return out;
  }, NEW);
  for (const k of NEW) ok(`${k}: its nine new frames load`, R.loaded[k] === '9/9', R.loaded[k]);
  for (const [name, r] of Object.entries(R.runs)) {
    const sets = Object.keys(r.sets);
    if (r.want) ok(`${name} draws frames of the '${r.want}' set (and no other set)`, (r.sets['set:' + r.want] | 0) > 0 && sets.every((s) => s === 'set:' + r.want), r.sets);
    else ok(`${name} (the player's fireball) never draws the ember's frames`, !r.sets['set:fire'], r.sets);
  }
  ok('no new frame 404s', miss.length === 0, miss);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
