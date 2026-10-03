// SENTRIES STAY SENTRIES WHEN THEY RESPAWN (v0.30.1600). Six maps author `platformLocked: true` entries - perched mobs that patrol
// one perch and never leave it (Mushroom Hollow's caps, Crypt Hollow's skeleton slabs and wraith shelves, Sky Garden's island
// wisps, Lava Cavern's fire-spitters, the willeos of the Fractured Reflection and the Usurpers' Court). loadMap's spawn pass
// passed the flag to spawnFromMap, but the respawn drip and the Storm Pact wave called spawnFromMap(type, false), so every
// sentry that came back after a kill was an ordinary walker: 40% on the ground, the rest on any perch, never locked.
//   [1] static: the drip and the Storm Pact wave pass the picked entry's own flags (platformLocked, ground)
//   [2] the drip, through the real kill path: on the four maps with an all-sentry type (Mushroom Hollow, Crypt Hollow, the
//       Reflection, the Court) every respawn of it comes back locked - on a perch, its _lockedPlatform that perch, jump 0
//   [3] a type authored both ways (Lava Cavern: 2 perched emberlings + 5 roaming; Sky Garden: 3 + 5 skywisps) comes back both ways
//   [4] the Storm Pact wave (Crypt Hollow): its sentries come back locked too
//   [5] controls: load-pass sentries are locked; free types never are (Crypt Hollow's zombies, Mushroom Hollow's mushpups)
//   [6] no page errors
// A flying sentry is not judged: spawnFromMap's flier branch returns before the lock, at load as on respawn (Crypt Hollow's
// wraiths, flies: true, have never been locked); the test logs them.
// The build before fails [1] to [4] (two runs: 53 of 53 respawned mushrooms loose, 57 of 57 Lava Cavern emberlings roaming).   node scripts/sentry_respawn_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11971);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const src = readFileSync(path.resolve(ROOT, PAGE), 'utf8');
ok('[1] the drip and the Storm Pact wave pass the picked entry\'s flags',
  src.includes('spawnFromMap(_sp.type, false, { platformLocked: !!_sp.platformLocked, ground: !!_sp.ground });')
  && src.includes('spawnFromMap(pick.type, false, { platformLocked: !!pick.platformLocked, ground: !!pick.ground });'));
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
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = { ver: GAME_VERSION, maps: {}, wave: null };
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 90; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player.maxHp = player.hp = 1e9; player._god = true; player.invulnerable = 1e9;
    // what one monster is: locked (flag + a real perch under its feet + jump 0), or not
    const look = (m) => { const P = game.mapData.platforms.filter((q) => q.type === 'platform'), lp = m._lockedPlatform, fy = m.y + m.h;
      const perch = !!lp && P.some((q) => q.x === lp.x && q.y === lp.y && q.w === lp.w) && Math.abs(fy - lp.y) <= 2;
      return { type: m.type, locked: !!m.platformLocked, perch, jump0: m.jump === 0, flies: !!m.flies }; };
    const regs = () => game.monsters.filter((x) => x && !x.isBoss && !x.isMiniBoss && x.currentHp > 0 && !x._sovShardOf);
    for (const id of ['mushroom', 'cryptHollow', 'skyGarden', 'lavaCavern', 'fracturedReflection', 'usurpersCourt']) {
      loadMap(id, 100); await sleep(900); game.paused = false;
      const sp = MAPS[id].spawns.filter((s) => s && !s.boss && s.spawnChance == null && s.type);
      const kinds = {}; for (const s of sp) if (!(monsterTypes[s.type] || {}).flies) (kinds[s.type] = kinds[s.type] || new Set()).add(!!s.platformLocked);
      const r = out.maps[id] = { load: regs().map(look), back: [], fly: sp.filter((s) => s.platformLocked && (monsterTypes[s.type] || {}).flies).map((s) => s.type), kinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, [...v].sort().join('/')])) };
      // three rounds: kill every regular through the real kill path, then let the drip refill
      for (let round = 0; round < 3; round++) {
        const seen = new Set(game.monsters);
        for (const m of regs()) killMonster(m);
        for (let t = 0; t < 40; t++) { await sleep(250); if (t > 14 && regs().length >= r.load.length * 0.8) break; }
        for (const m of game.monsters) if (!seen.has(m) && !m.isBoss && !m.isMiniBoss) r.back.push(look(m));
      }
    }
    // the Storm Pact wave fills the field up to the cap from the same pool
    loadMap('cryptHollow', 100); await sleep(900); game.paused = false;
    for (const m of regs()) { const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1); }
    const seen = new Set(game.monsters), need = _lxStormPactWave(); await sleep(need * 90 + 700);
    out.wave = { need, back: game.monsters.filter((m) => !seen.has(m)).map(look) };
    return out;
  });
  const allLocked = (r, t) => r.kinds[t] === 'true', mixed = (r, t) => r.kinds[t] === 'false/true';
  const badBack = [], counts = {};
  for (const [id, r] of Object.entries(R.maps)) for (const b of r.back) {
    if (allLocked(r, b.type)) { counts[id] = (counts[id] || 0) + 1; if (!(b.locked && b.perch && b.jump0)) badBack.push(id + '/' + b.type + ' ' + JSON.stringify(b)); } }
  console.log('build', R.ver, '| respawned sentries per map:', JSON.stringify(counts), '| kinds:', JSON.stringify(Object.fromEntries(Object.entries(R.maps).map(([k, r]) => [k, r.kinds]))));
  ok('[2] the drip on the four maps with an all-sentry type: every respawned sentry comes back locked to the perch it stands on (jump 0)',
    ['mushroom', 'cryptHollow', 'fracturedReflection', 'usurpersCourt'].every((id) => (counts[id] || 0) >= 2) && badBack.length === 0, badBack.length ? badBack.slice(0, 4) : counts);
  const mix = [['lavaCavern', 'emberling'], ['skyGarden', 'skywisp']].map(([id, t]) => { const b = R.maps[id].back.filter((x) => x.type === t);
    return { id, t, mixed: mixed(R.maps[id], t), locked: b.filter((x) => x.locked).length, roaming: b.filter((x) => !x.locked).length, off: b.filter((x) => x.locked && !(x.perch && x.jump0)).length }; });
  ok('[3] a type authored both ways comes back both ways, the perched ones on their perch (Lava Cavern emberlings, Sky Garden skywisps)',
    mix.every((x) => x.mixed && x.locked > 0 && x.roaming > 0 && x.off === 0), mix);
  console.log('info: flying sentries (not judged):', JSON.stringify(Object.fromEntries(Object.entries(R.maps).filter(([, r]) => r.fly.length).map(([id, r]) => [id, { types: r.fly,
    lockedAtLoad: r.load.filter((b) => r.fly.includes(b.type) && b.locked).length, lockedOnRespawn: r.back.filter((b) => r.fly.includes(b.type) && b.locked).length }]))));
  const wl = R.wave.back.filter((b) => allLocked(R.maps.cryptHollow, b.type));
  ok('[4] the Storm Pact wave (Crypt Hollow): its sentries come back locked too', R.wave.need >= 6 && wl.length >= 2 && wl.every((b) => b.locked && b.perch && b.jump0),
    { need: R.wave.need, sentries: wl.length, unlocked: wl.filter((b) => !b.locked).length });
  const loadBad = [], freeBad = [];
  for (const [id, r] of Object.entries(R.maps)) for (const b of [...r.load, ...r.back]) {
    if (r.kinds[b.type] === 'false' && b.locked) freeBad.push(id + '/' + b.type); }
  for (const [id, r] of Object.entries(R.maps)) for (const b of r.load) if (allLocked(r, b.type) && !(b.locked && b.perch)) loadBad.push(id + '/' + b.type);
  const zomb = R.maps.cryptHollow.back.filter((b) => R.maps.cryptHollow.kinds[b.type] === 'false').length;
  ok('[5] controls: load-pass sentries are locked; free types are never locked, at load or on respawn', loadBad.length === 0 && freeBad.length === 0 && zomb > 0,
    { loadBad: loadBad.slice(0, 3), freeBad: freeBad.slice(0, 3), freeRespawnsCrypt: zomb });
  ok('[6] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
