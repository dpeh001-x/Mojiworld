// SPAWNS STAND ON THE FLOOR (the Weight-Bearer's Stair report, per user: "Entering the map the weight-bearer's stairs is buggy and
// seems to have random monsters spawning when it should not"). spawnFromMap's fallback stood a walker on the y = 480 line - the
// floor of a flat one-screen map only. Where raised ground covers x the feet began INSIDE it (13 maps, 20-77% of x; on the Stair's
// deep steps they stayed stuck), and on a tall map the walker began in the air and dropped onto the first surface below.
// One page, a god-mode hero, the real spawnFromMap on each map's own roster (walkers only; fliers spawn airborne by design):
//   [1] every map where the 480 line misses the floor (found at run time, >= 15 of them) spawns 40 walkers, none inside ground and
//       none more than 12 px above the surface below it;
//   [2] flat maps are unchanged: a fallback walker still stands on the 480 line (4 controls);
//   [3] the Weight-Bearer's Stair is a quiet road: entering it from the Sanctum spawns nothing, nothing respawns in 6 s, and it
//       rolls no world affix on any of 60 days (nor does any other map with no monsters);
//   [4] no page errors.
// The build before fails [1] and [3].   node scripts/spawn_surface_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11883);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof spawnFromMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = { maps: [], ctl: [] };
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 90; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player.maxHp = player.hp = 1e9; player._god = true; player.invulnerable = 1e9;
    const field = (id, m) => m && !m.isTown && !m.isBossArena && !m._expeditionMap && !m.monstersOnGround && id.indexOf('tower_b') !== 0 && id.indexOf('clockwork') !== 0;
    const walkers = (m) => (m.spawns || []).filter((s) => s && s.type && !s.boss && monsterTypes[s.type] && !monsterTypes[s.type].flies).map((s) => s.type);
    const misses = (m) => { let bad = 0, n = 0; const g = (m.platforms || []).filter((p) => p.type === 'ground');
      for (let x = 50; x < (m.worldWidth || 2000) - 50; x += 10) { n++; const u = g.filter((p) => x >= p.x && x <= p.x + p.w); if (!u.length) continue;
        if (u.some((p) => p.y < 474 && 480 < p.y + (p.h || 60))) bad++; else { const t = Math.min(...u.filter((p) => p.y >= 478).map((p) => p.y)); if (isFinite(t) && t - 480 > 40) bad++; } }
      return n ? bad / n : 0; };
    const ids = Object.keys(MAPS).filter((id) => field(id, MAPS[id]) && walkers(MAPS[id]).length);
    const target = ids.filter((id) => misses(MAPS[id]) > 0.2), flat = ids.filter((id) => misses(MAPS[id]) === 0 && MAPS[id].worldHeight == null).slice(0, 4);
    const measure = (m) => { const cx = m.x + m.w / 2, fy = m.y + m.h, P = game.mapData.platforms || [];
      const stone = P.some((p) => p.type === 'ground' && cx >= p.x && cx <= p.x + p.w && fy > p.y + 6 && fy < p.y + (p.h || 60));
      const below = P.filter((p) => cx >= p.x && cx <= p.x + p.w && p.y >= fy - 6).map((p) => p.y); const top = below.length ? Math.min(...below) : null;
      return { stone, air: top === null ? 0 : Math.max(0, top - fy), foot: Math.round(fy), cx: Math.round(cx) }; };
    for (const [list, into] of [[target, out.maps], [flat, out.ctl]]) for (const id of list) {
      loadMap(id, 100); await sleep(500); game.paused = false; game.monsters.length = 0;
      const types = walkers(game.mapData), got = [];
      for (let i = 0; i < 40; i++) { const before = new Set(game.monsters); spawnFromMap(types[i % types.length], false); for (const m of game.monsters) if (!before.has(m)) got.push(measure(m)); }
      into.push({ id, n: got.length, stone: got.filter((g) => g.stone).length, air: got.filter((g) => g.air > 12).length, feet480: got.filter((g) => g.foot === 480).length,
        worst: got.filter((g) => g.stone || g.air > 12).slice(0, 2).map((g) => g.cx + ',' + g.foot + (g.stone ? ' in stone' : ' +' + Math.round(g.air)).trim()) });
      game.monsters.length = 0;
    }
    // [3] the quiet road
    loadMap('zodiacHall', 1900); await sleep(700); game.paused = false;
    const door = game.mapData.portals.find((p) => p.dest === 'weightbearerStair'); player.x = door.x; player.y = (door.y || player.y) - 10;
    tryPortal(); await sleep(400);
    out.stair = { map: game.currentMap, atEntry: game.monsters.length };
    await sleep(6000); out.stair.after6s = game.monsters.length;
    const d0 = _worldAffixDay(), freeMaps = Object.keys(MAPS).filter((id) => { const m = MAPS[id]; return m && !m.isTown && !m.isBossArena && !(Array.isArray(m.spawns) && m.spawns.some((s) => s && s.type && (s.count == null || s.count > 0))); });
    out.affix = freeMaps.map((id) => [id, [...Array(60).keys()].filter((i) => _worldAffixFor(id, d0 + i).id !== 'none').length]).filter(([, n]) => n > 0);
    out.freeMaps = freeMaps.length; out.stairFree = freeMaps.includes('weightbearerStair');
    return out;
  });
  const bad = R.maps.filter((m) => m.stone || m.air);
  ok(`[1] ${R.maps.length} maps where the 480 line misses the floor: every spawned walker stands on a surface (none in the ground, none > 12 px up)`,
    R.maps.length >= 15 && R.maps.every((m) => m.n >= 40) && bad.length === 0, bad.length ? bad.slice(0, 6) : R.maps.map((m) => m.id).join(','));
  ok('[2] flat maps are unchanged: fallback walkers still stand on the 480 line', R.ctl.length === 4 && R.ctl.every((m) => m.n >= 40 && !m.stone && !m.air && m.feet480 > 0), R.ctl);
  ok('[3] the Weight-Bearer\'s Stair is a quiet road: nothing on entry from the Sanctum, nothing in 6 s, no world affix on any of 60 days (nor on any map with no monsters)',
    R.stair.map === 'weightbearerStair' && R.stair.atEntry === 0 && R.stair.after6s === 0 && R.stairFree && R.affix.length === 0, { stair: R.stair, affix: R.affix.slice(0, 4), free: R.freeMaps });
  ok('[4] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
