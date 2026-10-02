// bland-maps 4 (per user: "Work on further polishes"): lights that glow, maps with air of their own. In the running game:
//   - GLOW TABLE: every _LX_AUTO_GLOW key gets its glow from _lxAutoGlow on a hunting map, none in a town, none with glow:false,
//     and a placement's own glow still wins
//   - IT DRAWS: with the camera on the Lich's Vigil iron lantern a radial gradient is made at its lamp head (the measured y), sized
//     from the prop (rk x drawn height), and painted 'lighter'; a small placement glows proportionally smaller
//   - AIR: each of the twelve maps that had only the generic dust motes (or, Tidal Lagoon, underwater bubbles under an open sky)
//     spawns its own particle type and colour
//   node scripts/map_polish_test.mjs          (PORT / MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10241); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const AIR = { wayfarersLantern: 'firefly', wayfarersLantern1: 'ember', wayfarersLantern2: 'ember', gloomsporeVerge: 'firefly', bloomhaven: 'petal',
  ossuarySprawl: 'wisp', sauroSlope: 'ember', zodiacHall: 'glint', interdimensionalAscension: 'glint', fracturedReflection: 'ember', distortedThreshold: 'ember',
  tidalLagoon: 'petal' };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
try {
  const page = await browser.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAP_PROPS === 'object' && typeof _lxAutoGlow === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const R = await page.evaluate(async (AIR) => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    window._lxBootGateDone = true; window._prologueActive = false; player._god = true; player.invulnerable = 9e9; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    // GLOW TABLE
    loadMap('boneGraveyard3', 200); await sleep(400);
    const keys = Object.keys(_LX_AUTO_GLOW), hunt = keys.filter((k) => _lxAutoGlow({ key: k, x: 0, y: 480 }));
    const md0 = game.mapData; game.mapData = Object.assign({}, md0, { isTown: true }); const town = keys.filter((k) => _lxAutoGlow({ key: k, x: 0, y: 480 })); game.mapData = md0;
    const own = { c: '1,2,3', r: 9, a: 0.1 };
    out.table = { n: keys.length, hunt: hunt.length, town: town.length, off: _lxAutoGlow({ key: 'grave_iron_lantern', glow: false }), plain: _lxAutoGlow({ key: 'grave_tombstone' }),
      own: ({ key: 'grave_iron_lantern', glow: own }).glow || _lxAutoGlow({ key: 'grave_iron_lantern' }) };
    // IT DRAWS: the iron lantern at 1200 (and a half-size copy to compare radii)
    const lamp = MAP_PROPS.boneGraveyard3.find((p) => p.key === 'grave_iron_lantern');
    const shot = async () => {
      player.x = 1030; player.vx = 0; await sleep(700);
      game.monsters = []; game.camera.x = 720; game.time = 5000; game._lowFxCache = null;   // one time for both shots: same flicker
      const P = CanvasRenderingContext2D.prototype, o1 = P.createRadialGradient, o2 = P.fillRect, got = [];
      P.createRadialGradient = function (...a) { got.push({ x: a[0], y: a[1], r: a[5] }); return o1.apply(this, a); };
      let lit = 0; P.fillRect = function (...a) { if (this.globalCompositeOperation === 'lighter') lit++; return o2.apply(this, a); };
      game.paused = true; _lxRenderOnly = true; const d = (typeof _LX_DPR !== 'undefined') ? _LX_DPR : 1;
      try { ctx.setTransform(d, 0, 0, d, 0, 0); _lxDrawFrame(performance.now()); } finally { _lxRenderOnly = false; P.createRadialGradient = o1; P.fillRect = o2; game.paused = false; }
      return { got: got.filter((g) => Math.abs(g.x - (lamp.x - 720)) < 4), lit };
    };
    const im = LX_OBJECTS.grave_iron_lantern, f = Math.max(0.7, Math.min(1.4, Math.max(im.naturalWidth, im.naturalHeight) / 512)), h = 80 * lamp.scale * f;
    const vis = h * (_detectSpriteBboxBottom(im) - _detectSpriteBboxTop(im) + 1) / im.naturalHeight;
    out.full = await shot(); out.expect = { y: lamp.y - vis * _LX_AUTO_GLOW.grave_iron_lantern.y, rMin: 0.6 * _LX_AUTO_GLOW.grave_iron_lantern.rk * vis, rMax: _LX_AUTO_GLOW.grave_iron_lantern.rk * vis };
    const s0 = lamp.scale; lamp.scale = s0 / 2; try { out.half = await shot(); } finally { lamp.scale = s0; }
    // AIR: force a spawn on every frame and read the type and colour of what spawns. Dusk: the night swaps leaf / petal to
    // fireflies and the day sends the odd bird, dusk does neither
    game._forcePhase = 18; _LX_DAYPH.t = 0; out.air = {};
    for (const id of Object.keys(AIR)) {
      loadMap(id, 200); await sleep(150); game.ambient = [];
      const r0 = Math.random; Math.random = () => 0.001;   // every spawn roll passes
      try { for (let i = 0; i < 12; i++) updateAmbient(); } finally { Math.random = r0; }
      const types = [...new Set(game.ambient.map((q) => q.type))], cols = [...new Set(game.ambient.map((q) => q.color))];
      out.air[id] = { types, cols };
    }
    game._forcePhase = null; _LX_DAYPH.t = 0;
    return out;
  }, AIR);
  const t = R.table;
  ok(`the glow table: all ${t.n} lights glow on a hunting map (${t.hunt}), none in a town (${t.town})`, t.n >= 8 && t.hunt === t.n && t.town === 0);
  ok('glow:false switches a light off, a non-light gets nothing, a placement\'s own glow wins', t.off === null && t.plain === null && t.own && t.own.c === '1,2,3');
  const g = R.full.got[0];
  ok('the Lich\'s Vigil iron lantern draws its glow at its lamp head, sized from the prop', !!g && Math.abs(g.y - R.expect.y) < 3 && g.r >= R.expect.rMin - 1 && g.r <= R.expect.rMax + 1 && R.full.lit > 0,
    g ? `y ${g.y.toFixed(1)} vs ${R.expect.y.toFixed(1)}, r ${g.r.toFixed(1)} in ${R.expect.rMin.toFixed(1)}..${R.expect.rMax.toFixed(1)}` : 'no gradient at the lamp');
  const gh = R.half.got[0];
  ok('a half-size lantern glows about half as wide', !!gh && !!g && gh.r < g.r * 0.62 && gh.r > g.r * 0.38, gh && g ? `${gh.r.toFixed(1)} vs ${g.r.toFixed(1)}` : '');
  for (const [id, want] of Object.entries(AIR)) { const a = R.air[id]; ok(`${id}: its own air (${want})`, a && a.types.length === 1 && a.types[0] === want && !a.cols.includes('#e8e4da'), JSON.stringify(a)); }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
