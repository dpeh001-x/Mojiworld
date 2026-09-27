// Live test: the zodiac domains as final-boss stages (per user: "improving the zodiac maps to making it look like a
// more final boss kind of stage"). All twelve zod_* arenas get a back layer (grade, constellation, sigil ring),
// a floor layer (rim light, floor sigil, platform underglow) and a front layer (motes, phase vignette), all from
// the sign's own data; nothing leaks onto other boss arenas or the Zodiac hub.
//   node scripts/zodiac_stage_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxZodStageBack === 'function', null, { timeout: 120000 });
  // the boss arenas' backdrops queue behind the boot flood on localhost; let it finish first
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    try { _lxBootGateDone = true; } catch (e) {}
    ['loading-overlay', 'lo-menu'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    const calls = { back: 0, floor: 0, front: 0 };
    for (const k of ['back', 'floor', 'front']) { const fn = '_lxZodStage' + k[0].toUpperCase() + k.slice(1), o = window[fn]; window[fn] = function () { calls[k]++; return o.apply(this, arguments); }; }
    const draw = () => { for (const k in calls) calls[k] = 0; _lxDrawFrame(performance.now()); return Object.assign({}, calls); };
    // mean colour of a region of the game canvas (the backdrop band above the platforms)
    const mean = (x, y, w, h) => { const d = ctx.getImageData(x, y, w, h).data; let r = 0, g = 0, bl = 0, n = 0; for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; } return [r / n, g / n, bl / n]; };
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const out = { signs: {} };
    try { LX_PERF.veryLowFx = false; } catch (e) {}
    for (const z of ZODIAC_SIGNS) {
      loadMap('zod_' + z.id); await wait(1500);
      game.paused = true;
      const c = draw();
      const d = _LX_ZOD_STARS[z.id];
      out.signs[z.id] = { calls: c, minted: _LX_ZOD.sign === z.id && !!_LX_ZOD.cons && !!_LX_ZOD.ring, element: z.element,
        stars: d.s.length, edgesOk: d.e.every(([a, q]) => a < d.s.length && q < d.s.length),
        pal: _MAP_FLOOR_PAL['zod_' + z.id], band: mean(0, Math.round(ch * 0.2), cw, Math.round(ch * 0.25)) };
    }
    // phase escalation on one sign: the corners darken from phase 1 to phase 3
    loadMap('zod_aries'); await wait(1500); game.paused = true;
    const boss = game.monsters.find((m) => m && m.zodiacSign === 'aries');
    const corner = () => { const a = mean(0, 0, Math.round(cw * 0.12), Math.round(ch * 0.2)), q = mean(Math.round(cw * 0.88), Math.round(ch * 0.8), Math.round(cw * 0.12), Math.round(ch * 0.2)); return (a[0] + a[1] + a[2] + q[0] + q[1] + q[2]) / 6; };
    if (boss) { boss.phase = 1; draw(); out.p1 = corner(); boss.phase = 3; draw(); out.p3 = corner(); boss.phase = 1; }
    // cost of the three layers + motes, per frame
    const t0 = performance.now(); for (let i = 0; i < 120; i++) { _lxZodStageBack(ctx, game.camera.x, 0, W, H); _lxZodStageFloor(ctx, game.camera.x, 480); _lxZodMotes(ctx, W, H); _lxZodStageFront(ctx, W, H); }
    out.ms = (performance.now() - t0) / 120;
    // very-low-fx: no motes are spawned
    try { LX_PERF.veryLowFx = true; _LX_ZOD.motes.length = 0; draw(); out.lowMotes = _LX_ZOD.motes.length; LX_PERF.veryLowFx = false; } catch (e) { out.lowErr = String(e); }
    // no leak: another boss arena and the Zodiac hub draw none of it
    for (const id of ['octopusGrotto', 'zodiacHall']) { if (!MAPS[id]) continue; loadMap(id); await wait(1200); game.paused = true; out[id] = draw(); }
    return out;
  });
  for (const [id, s] of Object.entries(r.signs)) {
    ok(`${id}: back, floor and front layers draw`, s.calls.back >= 1 && s.calls.floor >= 1 && s.calls.front >= 1, s.calls);
    ok(`${id}: its constellation and sigil are minted`, s.minted && s.stars >= 4 && s.edgesOk, { stars: s.stars, edgesOk: s.edgesOk });
  }
  const pals = Object.values(r.signs).map((s) => JSON.stringify(s.pal));
  ok('twelve distinct platform palettes (they were four shared blue-greys)', new Set(pals).size === 12, pals);
  const warm = (id) => { const [R, , B] = r.signs[id].band; return R > B * 1.15; }, cool = (id) => { const [R, , B] = r.signs[id].band; return B > R * 1.1; };
  ok('fire signs read warm: Aries and Leo are red/gold, not blue', warm('aries') && warm('leo'), { aries: r.signs.aries.band, leo: r.signs.leo.band });
  ok('cold signs read cool: Capricorn and Aquarius are blue', cool('capricorn') && cool('aquarius'), { cap: r.signs.capricorn.band, aqu: r.signs.aquarius.band });
  ok('the stage closes in as the boss drops a phase (corners darker at phase 3)', r.p3 < r.p1 - 3, { p1: r.p1, p3: r.p3 });
  ok('very-low-fx spawns no motes', r.lowMotes === 0, r.lowMotes ?? r.lowErr);
  for (const id of ['octopusGrotto', 'zodiacHall']) if (r[id]) ok(`${id}: none of the zodiac stage draws there`, r[id].back === 0 && r[id].floor === 0 && r[id].front === 0, r[id]);
  ok(`the layers cost little per frame (${r.ms.toFixed(2)} ms)`, r.ms < 5, r.ms);
  ok('no page errors', errs.length === 0, errs);
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== ZODIAC FINAL-BOSS STAGES ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
