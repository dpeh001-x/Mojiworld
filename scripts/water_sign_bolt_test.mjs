// THE WATER SIGNS FIRE THEIR OWN BOLT (per user: "caprikor aqua and pisces should have a blue coloured aquatic/ ice projectile replacing
// this, use ludo.ai to generate sprite and animation and replace"). Every sign fires the same bolt (skill 'zodiac', and 'zodiacHoming'
// for the astral volley), drawn as a FLAMING ram-horn arrow. For Capricorn, Aquarius and Pisces it now draws the ice shard
// (p_zodiacfrost.webp + nine frames). Volleys are drawn in a live game and every image handed to drawImage is traced to its source:
//   (v0.30.1864 drew a tide comet; per user the three now fire a glacier-spike ice shard, "a powerful looking animation" - p_zodiacfrost.webp + nine frames)
//   1. the three water signs' bolt and homing bolt draw only the ice shard - never the fire bolt - at the fire bolt's length
//   2. every other sign (Aries, Leo, Scorpio) still draws the fire bolt, never the ice shard
//   3. art only: a water sign's shot has the same hitbox as Aries's, and its key is unchanged
//   4. the files are served (no 404), the frame index has nine frames, and the three fights prefetch them
//   5. a water sign's OTHER shots (Pisces's dark orb, Aquarius's droplet) are untouched
//   node scripts/water_sign_bolt_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 9831);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + JSON.stringify(x).slice(0, 400))); };
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], miss = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 400 && /p_zodiacfrost|anim\/zodiacFrost_/.test(r.url())) miss.push(r.url().replace(/^.*Sprites\//, '')); });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof _lxZodAnimFrame === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(1200);
    player._god = true; player.invulnerable = 9e9; game.monsters.length = 0; game.paused = false;
    const out = { prefetch: ['zodiac_capricorn', 'zodiac_aquarius', 'zodiac_pisces', 'zodiac_aries'].map((k) => _LX_FX_BOSS[k] || ''),
      src: String((LX_MOB_PROJ.zodiacFrost && LX_MOB_PROJ.zodiacFrost.src) || ''), index: (LX_SPRITE_FRAME_INDEX.frames['projectiles/anim'] || {}).zodiacFrost };
    const okIm = (im) => !!(im && (im.tagName === 'CANVAS' || (im.complete && im.naturalWidth > 0)));
    _projAnimFrame('zodiacFrost'); _projAnimFrame('zodiac'); _lxMobProjReady(LX_MOB_PROJ.zodiacFrost); _lxMobProjReady(LX_MOB_PROJ.zodiac);   // shots load lazily on first ask
    _projAnimFrame('mdark'); _lxMobProjReady(LX_MOB_PROJ.mdark); _projAnimFrame('droplet'); _lxMobProjReady(LX_MOB_PROJ.droplet);
    const TF = () => PROJ_ANIM_FRAMES.zodiacFrost || [], ZF = () => PROJ_ANIM_FRAMES.zodiac || [];
    let t0 = performance.now(); while (performance.now() - t0 < 15000 && !(TF().length === 9 && TF().every(okIm) && ZF().every(okIm) && okIm(LX_MOB_PROJ.zodiacFrost) && okIm(LX_MOB_PROJ.zodiac))) await sleep(100);
    out.loaded = { frames: TF().filter(okIm).length + '/' + TF().length, still: okIm(LX_MOB_PROJ.zodiacFrost) };
    const run = async (sign, skill) => {
      game.projectiles.length = 0;
      const ps = [];
      for (let i = 0; i < 5; i++) {
        const p = { x: player.x + 90 + i * 60, y: player.y - 180 + i * 14, vx: 3 - i * 1.5, vy: -1 + i * 0.5, w: skill === 'zodiacHoming' ? 22 : 14, h: skill === 'zodiacHoming' ? 22 : 14,
          owner: 'enemy', skill, color: '#88ccff', _zodiacAttacker: true, _zodiacSign: sign, noGravity: true, life: 9e9, damage: 0 };
        if (skill === 'zodiacHoming') p.homing = true;
        ps.push(p); game.projectiles.push(p);
      }
      const at = ps.map((p) => [p.x, p.y, p.vx, p.vy]);
      const seen = { frost: 0, fire: 0, other: 0, len: [] };
      const origin = new Map(), tag = (im, t) => { if (im && typeof im === 'object') origin.set(im, t); return im; };
      tag(LX_MOB_PROJ.zodiacFrost, 'frost'); tag(LX_MOB_PROJ.zodiac, 'fire'); tag(LX_MOB_PROJ.zodiacHoming, 'fire');
      for (const f of TF()) tag(f, 'frost'); for (const f of ZF()) tag(f, 'fire');
      const PS = window._lxProjScaled, PA = window._projAnimFrame;
      window._lxProjScaled = function (img) { const r = PS.apply(this, arguments); if (img && origin.has(img)) tag(r, origin.get(img)); return r; };
      window._projAnimFrame = function (k) { const r = PA.apply(this, arguments); if (k === 'zodiacFrost') tag(r, 'frost'); else if (k === 'zodiac') tag(r, 'fire'); return r; };
      const P = CanvasRenderingContext2D.prototype, di = P.drawImage;
      P.drawImage = function (im) {
        if (this === ctx && im) {   // the game canvas only: a bake drawing its source onto its own canvas is not a draw
          const t = origin.get(im);
          if (t === 'frost' || t === 'fire') { seen[t]++; const w = arguments.length === 5 ? arguments[3] : arguments.length === 9 ? arguments[7] : 0; if (w) seen.len.push(Math.round(w)); }
        }
        return di.apply(this, arguments);
      };
      try { const tt = performance.now(); while (performance.now() - tt < 700) { ps.forEach((p, i) => { p.x = at[i][0]; p.y = at[i][1]; p.vx = at[i][2]; p.vy = at[i][3]; p.life = 9e9; }); await sleep(16); } }
      finally { P.drawImage = di; window._lxProjScaled = PS; window._projAnimFrame = PA; }
      seen.box = ps[0].w + 'x' + ps[0].h; seen.skill = ps[0].skill;
      seen.len = seen.len.length ? seen.len.sort((a, b) => a - b)[seen.len.length >> 1] : 0;
      game.projectiles.length = 0;
      return seen;
    };
    await run('capricorn', 'zodiac'); await run('aries', 'zodiac');   // warm-up: the first draws bake the frames at their drawn size, and are not counted
    out.runs = {};
    for (const sign of ['capricorn', 'aquarius', 'pisces', 'aries', 'leo', 'scorpio']) for (const sk of ['zodiac', 'zodiacHoming']) out.runs[sign + ':' + sk] = await run(sign, sk);
    // a water sign's other shots keep their own art
    out.own = { mdark: _lxZodArtKey({ skill: 'mdark', _zodiacSign: 'pisces' }), droplet: _lxZodArtKey({ skill: 'droplet', _zodiacSign: 'aquarius' }), ice: _lxZodArtKey({ skill: 'ice', _zodiacSign: 'capricorn' }) };
    return out;
  });
  const W = ['capricorn', 'aquarius', 'pisces'], O = ['aries', 'leo', 'scorpio'];
  ok('the ice shard and its nine frames load, and the frame index lists nine', R.loaded.frames === '9/9' && R.loaded.still && R.index === 9 && /p_zodiacfrost\.webp/.test(R.src), [R.loaded, R.index, R.src]);
  ok("1. the water signs' bolt and homing bolt draw only the ice shard, never the fire bolt",
    W.every((s) => ['zodiac', 'zodiacHoming'].every((k) => { const r = R.runs[s + ':' + k]; return r.frost >= 3 && r.fire === 0; })), W.map((s) => [s, R.runs[s + ':zodiac'], R.runs[s + ':zodiacHoming']]));
  ok('1. ...at the fire bolt\'s drawn length (within 10%)',
    W.every((s) => ['zodiac', 'zodiacHoming'].every((k) => { const a = R.runs[s + ':' + k].len, b = R.runs['aries:' + k].len; return a > 0 && b > 0 && Math.abs(a - b) / b <= 0.1; })), Object.fromEntries(Object.entries(R.runs).map(([k, v]) => [k, v.len])));
  ok('2. every other sign still draws the fire bolt, never the ice shard',
    O.every((s) => ['zodiac', 'zodiacHoming'].every((k) => { const r = R.runs[s + ':' + k]; return r.fire >= 3 && r.frost === 0; })), O.map((s) => [s, R.runs[s + ':zodiac']]));
  ok('3. art only: the same hitbox and the same shot key as Aries',
    W.every((s) => ['zodiac', 'zodiacHoming'].every((k) => R.runs[s + ':' + k].box === R.runs['aries:' + k].box && R.runs[s + ':' + k].skill === k)), Object.fromEntries(Object.entries(R.runs).map(([k, v]) => [k, v.box])));
  ok('4. the three water fights prefetch the ice shard and its frames; Aries does not', R.prefetch.slice(0, 3).every((t) => /\bmp:zodiacFrost\b/.test(t) && /\bpa:zodiacFrost\b/.test(t)) && !/zodiacFrost/.test(R.prefetch[3]), R.prefetch);
  ok('4. the new files are served (no 404)', miss.length === 0, miss);
  ok("5. a water sign's other shots keep their own art (Pisces's dark orb, Aquarius's droplet, Capricorn's ice)", R.own.mdark === 'mdark' && R.own.droplet === 'droplet' && R.own.ice === 'ice', R.own);
  ok('no page errors', errs.length === 0, errs);
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
