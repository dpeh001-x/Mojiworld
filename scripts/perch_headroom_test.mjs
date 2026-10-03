// PERCHES WITH HEADROOM (v0.30.1595). spawnFromMap stands 60% of walkers on a perch at y = p.y - m.h, and nothing checked that
// against the top of the world: a tall walker on a high perch began with its head (or all of it) above y 0, where the camera never
// looks - Path's Bane (261 px) on the Vigil's Surface Entry (y 30) began at y -231. v0.30.1588 fixed the Blight Elder alone with a
// per-entry ground flag; 17 more map/type pairs on 11 maps could still do it in the layouts loadMap builds. Now the perch pool only
// holds perches with room for the whole box (q.y - m.h >= 0), and a walker no perch has room for takes the ground branch.
//   [1] static: the pool is filtered by headroom, the perch branch needs a perch in it, and the v0.30.1439 / v0.30.1588 lines stay
//   [2] the layouts still hold such perches: 200 built layouts per map (jitter, surprise perch, variants) give >= 12 pairs, with
//       Path's Bane on the Vigil and the Gate among them - so [3] tests the rule, not a lucky layout
//   [3] every pair, on a layout that holds a perch without headroom: 60 real spawnFromMap calls -> 60 spawns, every box at y >= 0
//   [4] they still perch where they can: a pair with a roomy perch stands some spawns on one; a pair with none stands all on the ground
//   [5] control: a walker with headroom everywhere still perches ~60% of the time (Gloomspore Verge)
//   [6] no page errors
// The build before fails [1] and [3]: 112-142 of its 1,020 spawns began above y 0 in three runs, down to y -231 (and [4] whenever the
// layout gives the Verge's pinechad / elderbark no roomy surprise perch, so they stand on the canopy).
//   node scripts/perch_headroom_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11937);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const src = readFileSync(path.resolve(ROOT, PAGE), 'utf8');
ok('[1] the perch pool keeps only perches with headroom, and the perch branch needs one; the fit and ground-entry lines stay',
  src.includes('const _perches = (_fits.length ? _fits : platList).filter((q) => q.y - m.h >= 0);')
  && src.includes('} else if (platList.length && !(opts && opts.ground) && Math.random() < 0.6 && _perches.length) {')
  && src.includes('const _fits = platList.filter((q) => q.w >= m.w);') && src.includes('ground: !!r.s.ground }'));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof spawnFromMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = { ver: GAME_VERSION, pairs: [], runs: [], ctl: null };
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 90; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player.maxHp = player.hp = 1e9; player._god = true; player.invulnerable = 1e9;
    // the pool spawnFromMap draws from, before headroom: perches it fits on, else (wider than all) every perch
    const pool = (plats, t) => { const P = plats.filter((q) => q && q.type === 'platform'), f = P.filter((q) => q.w >= t.w); return f.length ? f : P; };
    const layout = (id) => { const v = _variedMapData(id); try { _lxSpaceOutPlatforms(v, id); } catch (e) {} return v; };
    for (const id of Object.keys(MAPS)) {
      const md = MAPS[id]; if (!md || !Array.isArray(md.spawns) || md.monstersOnGround || md.isTown) continue;
      for (const s of md.spawns) {
        const t = s && monsterTypes[s.type]; if (!t || s.boss || s.platformLocked || s.ground || t.flies || out.pairs.some((p) => p.id === id && p.type === s.type)) continue;
        let hit = 0; for (let i = 0; i < 200; i++) if (pool(layout(id).platforms || [], t).some((q) => q.y - t.h < 0)) hit++;
        if (hit) out.pairs.push({ id, type: s.type, h: t.h, hit });
      }
    }
    const run = async (id, type, n, needBad) => {
      loadMap(id, 100); await sleep(400); game.paused = false; game.monsters.length = 0;
      const t = monsterTypes[type];
      if (needBad) for (let k = 0; k < 4000 && !pool(game.mapData.platforms, t).some((q) => q.y - t.h < 0); k++) game.mapData.platforms = layout(id).platforms;
      const P = game.mapData.platforms.filter((q) => q.type === 'platform'), pl = pool(game.mapData.platforms, t);
      const r = { id, type, n: 0, above: 0, perch: 0, minY: 1e9, bad: pl.filter((q) => q.y - t.h < 0).length, roomy: pl.filter((q) => q.y - t.h >= 0).length };
      for (let i = 0; i < n; i++) {
        if (game.monsters.length >= 20) game.monsters.length = 0;
        const before = new Set(game.monsters); spawnFromMap(type, false);
        for (const m of game.monsters) { if (before.has(m)) continue; r.n++; if (m.y < 0) r.above++; r.minY = Math.min(r.minY, Math.round(m.y));
          const cx = m.x + m.w / 2, fy = m.y + m.h; if (P.some((q) => Math.abs(fy - q.y) <= 1 && cx >= q.x - 1 && cx <= q.x + q.w + 1)) r.perch++; }
      }
      game.monsters.length = 0; return r;
    };
    for (const p of out.pairs) out.runs.push(await run(p.id, p.type, 60, true));
    out.ctl = await run('gloomsporeVerge', 'meloncholy', 120, false);
    return out;
  });
  console.log('build', R.ver, '| pairs:', R.pairs.map((p) => `${p.id}/${p.type} ${p.hit}/200`).join(', '));
  ok('[2] built layouts still hold perches without headroom for >= 12 map/type pairs (Path\'s Bane on the Vigil and the Gate among them)',
    R.pairs.length >= 12 && ['wayfarersLantern1', 'wayfarersLantern2'].every((id) => R.pairs.some((p) => p.id === id && p.type === 'pathsBane')), R.pairs.length);
  const bad = R.runs.filter((r) => r.n < 60 || r.above > 0 || r.bad === 0);
  ok(`[3] ${R.runs.length} pairs, each on a layout with such a perch: 60 of 60 spawn, every box starts inside the world (y >= 0)`,
    R.runs.length >= 12 && bad.length === 0, { above: R.runs.reduce((a, r) => a + r.above, 0) + '/' + R.runs.reduce((a, r) => a + r.n, 0), minY: Math.min(...R.runs.map((r) => r.minY)), worst: bad.slice(0, 5).map((r) => `${r.id}/${r.type} n${r.n} above${r.above} minY${r.minY} bad${r.bad}`) });
  const perchy = R.runs.filter((r) => r.roomy > 0), flat = R.runs.filter((r) => r.roomy === 0);
  ok('[4] where a perch has room they still perch; where none has, they all stand on the ground',
    perchy.length >= 8 && perchy.every((r) => r.perch > 0) && flat.every((r) => r.perch === 0), { perchy: perchy.map((r) => `${r.id}/${r.type} ${r.perch}/${r.n}`), ground: flat.map((r) => `${r.id}/${r.type}`) });
  ok('[5] control: a walker with headroom on every perch still perches ~60% of the time', R.ctl.n === 120 && R.ctl.bad === 0 && R.ctl.perch >= 50 && R.ctl.perch <= 92 && R.ctl.above === 0, R.ctl);
  ok('[6] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
