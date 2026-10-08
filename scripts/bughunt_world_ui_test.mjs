// BUG HUNT 2026-10-02, cluster `world-ui` (world / systems / UI / engine / boot-data / clobber items). One browser page, direct function calls.
// Every check is written so a build WITHOUT the fix fails it; run the base page as the argument to see that:
//   [SERVE_ROOT=<dir with serve.js, data/, art>] [PORT=n] node scripts/bughunt_world_ui_test.mjs [page.html]
// world-1 Glass Hour / Dim Light apply (no game.tower gate), roll before the spawn loop, never in towns / arenas / empty maps
// world-2 taxi / W-map "back to" / devTeleport land clear of a door   world-3 the affix elite bonus is applied   world-7 arrival on the door's ledge
// systems-2 leaving an expedition drops the Bravo tray from player.mods   systems-4 the unreachable lv150 achievement is retired
// diff-b-1 locked cosmetic hairs are not offered   diff-b-3 _lxSpScale is stable across a camera punch
// ui-5 / 7 / 8 / 9 / 10 / 11 / 12, engine-1 / 3 / 4 / 5 / 6 / 8 / 9, bootdata-1 / 2 / 3 / 4 / 9, L2 dead guards, cisec-6, clobber-1 / 3
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn, spawnSync } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '14001';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const PAGE_FILE = cand ? path.resolve(SERVE_ROOT, cand) : path.join(SERVE_ROOT, 'mojiworld_game.html');
const SRC = readFileSync(PAGE_FILE, 'utf8');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined && d !== '' ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const URL = `http://localhost:${PORT}/mojiworld_game.html?dev=1`;
const errs = [];
async function newPage(init, errList) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(); page.on('pageerror', (e) => (errList || errs).push(String(e.message).slice(0, 160)));
  return { ctx, page };
}
async function boot(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && !!document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    player.level = 60; player.cls ||= 'warrior'; player._god = true; player.invulnerable = 9e9;
    try { player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true }); } catch (e) {}
    player._gravitosCineSeen = true; player._tutorialSeen = true;
    loadMap('forest', 300); game.paused = false; await sleep(700);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
  });
}
// the shared page-side helpers, injected into every evaluate as source text
const HELP = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const toasts = []; if (!window.__toastWrapped) { window.__toastWrapped = true; const _st = window.showToast; window.showToast = function (t) { (window.__toasts = window.__toasts || []).push(String(t)); return _st.apply(this, arguments); }; }
  window.__toasts = window.__toasts || [];
  const withRand = (v, fn) => { const o = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = o; } };
  const hit = (m, dmg) => { m.invulnerable = 0; m._lastHitAt = 0; game.time += 120; game.damageNumbers.length = 0; game.comboMult = 1; game.combo = 0; game.hitStop = 0; const h0 = m.currentHp; withRand(0.5, () => hitMonster(m, dmg, false, 'melee')); const loss = h0 - m.currentHp; m.currentHp = m.maxHp; return loss; };
  const dummy = () => { game.monsters.length = 0; const m = spawnMonster(player.x + 90, player.y, 'slime', false, false); m.evasion = 0; m.def = 0; m.mdef = 0; m.maxHp = m.currentHp = 1e9; m.isElite = false; return m; };
`;
const run = (page, body, arg) => page.evaluate(`(async (ARG) => { ${HELP} ${body} })(${J(arg === undefined ? null : arg)})`);
const group = async (name, fn) => { try { await fn(); } catch (e) { check(false, name + ' - harness error', String(e && e.message).slice(0, 220)); } };

let page;
try {
  ({ page } = await newPage()); await boot(page);
  console.log('build ' + await page.evaluate(() => GAME_VERSION) + '  page ' + path.relative(SERVE_ROOT, PAGE_FILE));
const WORLD = String.raw`
  const out = {};
  const frames = async (n) => { const t0 = game.time, w0 = performance.now(); while (game.time - t0 < n && performance.now() - w0 < 30000) await sleep(40); };
  // ---- world-1: Glass Hour lands harder, Dim Light is in force while the opening roster spawns, and the roll keeps out of towns / arenas / empty maps
  game._worldStateByMap = { forest: null }; loadMap('forest', 300); await sleep(500); game.paused = false;
  let m = dummy(); out.plain = hit(m, 1000);
  game._worldStateByMap = { forest: 'fragile' }; loadMap('forest', 300); await sleep(500); game.paused = false;
  out.stateId = game.worldState && game.worldState.id; out.takeMul = towerPlayerTakeMul();
  m = dummy(); out.glass = hit(m, 1000);
  const seen = []; const _sp = window.spawnMonster; window.spawnMonster = function () { seen.push(game._towerHpMul); return _sp.apply(this, arguments); };
  game._worldStateByMap = { forest: 'dim' }; loadMap('forest', 300); await sleep(400); window.spawnMonster = _sp; game.paused = false;
  out.dimSeen = seen.length; out.dimAll125 = seen.length > 0 && seen.every((v) => Math.abs(v - 1.25) < 1e-9); out.dimFirst = seen[0];
  const hp = () => withRand(0.99, () => { game.monsters.length = 0; return spawnMonster(player.x + 90, player.y, 'slime', false, false).maxHp; });
  out.dimHp = hp(); game._worldStateByMap = { forest: null }; loadMap('forest', 300); await sleep(300); game.paused = false; out.plainHp = hp();
  const keepMap = game.currentMap, keepMd = game.mapData; const excl = {}; const toastN0 = window.__toasts.length;
  for (const id of ['town', 'void', 'gravitosArena', 'zodiacHall', 'boss_rush', 'clockworkExpress', 'tower', 'tower_b3']) {
    if (!MAPS[id]) { excl[id] = 'absent'; continue; }
    game.currentMap = id; game.mapData = MAPS[id]; game._worldStateByMap = { [id]: 'fragile' }; game._towerPlayerDmgMul = 1; game._towerPlayerTakeMul = 1; game.worldState = null;
    try { _lxRollWorldState(); } catch (e) {}
    excl[id] = { state: game.worldState ? game.worldState.id : null, dmg: game._towerPlayerDmgMul };
  }
  out.exclToast = window.__toasts.slice(toastN0).filter((t) => /Glass Hour|Dim Light|Double Time|Vampiric/.test(t)).length;
  game.currentMap = 'glasswindSteppe'; game.mapData = MAPS.glasswindSteppe; game._worldStateByMap = { glasswindSteppe: 'dim' }; game._towerHpMul = 1; game.worldState = null; _lxRollWorldState(); out.fieldRolls = game.worldState && game.worldState.id;
  game.currentMap = keepMap; game.mapData = keepMd; game._worldStateByMap = {}; game.worldState = null; game._towerHpMul = 1; game._towerPlayerDmgMul = 1; game._towerPlayerTakeMul = 1;
  out.excl = excl;
  // ---- world-3: the affix elite bonus
  const rate = (aff) => { game._mapAffix = aff; let n = 0, e = 0; for (let i = 0; i < 3000; i++) { game.monsters.length = 0; const q = spawnMonster(player.x + 90, player.y, 'slime', false, false); if (q) { n++; if (q.isElite) e++; } } return e / Math.max(1, n); };
  out.eliteNone = rate(WORLD_AFFIXES.find((a) => a.id === 'none')); out.eliteTeeming = rate(WORLD_AFFIXES.find((a) => a.id === 'teeming'));
  game._mapAffix = WORLD_AFFIXES[0]; game.monsters.length = 0;
  return out;
`;
await group('world-1/3', async () => {
  const r = await run(page, WORLD);
  check(r.stateId === 'fragile' && r.takeMul > 1.3, 'world-1: a map saved with Glass Hour rolls it, and the damage-taken multiplier is up', J({ id: r.stateId, take: r.takeMul }));
  check(r.plain > 0 && Math.abs(r.glass / r.plain - 1.35) < 0.04, 'world-1: a fixed 1000-damage hit lands 1.35x harder under Glass Hour (it dealt the same in every state)', J({ plain: r.plain, glass: r.glass }));
  check(!/if \(game\.tower\) dmg = Math\.ceil\(dmg \* towerPlayerTakeMul\(\)\)/.test(SRC) && !/skill !== 'thorns' && game\.tower\) finalDmg/.test(SRC) && !/game\.tower \? \(game\._towerHpMul/.test(SRC), 'world-1: none of the three readers is gated on game.tower any more');
  check(r.dimAll125 && r.dimSeen > 0, 'world-1: Dim Light is already in force (x1.25) for EVERY monster the map spawns on arrival (the roll used to run after the spawn loop)', J({ spawns: r.dimSeen, first: r.dimFirst }));
  check(r.plainHp > 0 && Math.abs(r.dimHp / r.plainHp - 1.25) < 0.02, 'world-1: a Dim Light monster has 1.25x the HP of the same monster without it', J({ dim: r.dimHp, plain: r.plainHp }));
  const bad = Object.entries(r.excl).filter(([, v]) => v !== 'absent' && (v.state !== null || v.dmg !== 1));
  check(bad.length === 0 && r.exclToast === 0, 'world-1: towns, the Void, boss arenas, the Zodiac Sanctum, Ticket Rush and tower maps roll NO world state and toast nothing', J({ bad, toasts: r.exclToast }));
  check(r.fieldRolls === 'dim', 'world-1: an ordinary hunting map still applies its state', String(r.fieldRolls));
  check(r.eliteNone < 0.06 && r.eliteTeeming > 0.10, 'world-3: Teeming (+14% elite) really raises the elite share of spawns (3.0% -> ~17%)', J({ none: +r.eliteNone.toFixed(3), teeming: +r.eliteTeeming.toFixed(3) }));
});
const DOORS = String.raw`
  const out = {};
  const frames = async (n) => { const t0 = game.time, w0 = performance.now(); while (game.time - t0 < n && performance.now() - w0 < 30000) await sleep(40); };
  const doorY = (po) => (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x);
  const inTrig = () => (game.portals || []).filter((po) => Math.abs(player.x + player.w / 2 - po.x) < 50 && Math.abs(player.y + player.h - doorY(po)) < 100).map((po) => po.dest + '@' + Math.round(po.x));
  const FOURTEEN = ['forest', 'mushroom', 'sunsetBeach', 'bastionRampart', 'azureAcademia', 'jadeGrove', 'emeraldVillage', 'reachOfVermillion', 'graniteBluffs', 'wildflowerPlains', 'coralReef', 'kelpForest', 'octopusGrotto', 'zodiacHall'];
  const clear = () => { try { closeAllModals(); } catch (e) {} game.paused = false; game.monsters.length = 0; };
  // world-2 (a): devTeleport (the same one-liner as the two UI paths)
  out.dev = {};
  for (const id of FOURTEEN) { if (!MAPS[id]) { out.dev[id] = 'absent'; continue; } clear(); devTeleport(id); await sleep(120); out.dev[id] = inTrig(); }
  // (b) the Taxi, and (c) the W-map "back to" row: the real UI paths, on four of the fourteen
  out.taxi = {}; out.recent = {};
  for (const id of ['forest', 'mushroom', 'coralReef', 'zodiacHall']) {
    if (!MAPS[id]) continue;
    clear(); loadMap('town', 600); await sleep(350); clear(); player.mojicoins = 1e7;
    game.visitedMaps = Object.assign(game.visitedMaps || {}, { [id]: true, town: true }); game.taxiCombatRecent = [id];
    openTaxi(); await sleep(150);
    const node = document.querySelector('#taxi-grid g[data-map-id="' + id + '"]');
    if (!node) { out.taxi[id] = 'no node'; } else { node.dispatchEvent(new MouseEvent('click', { bubbles: true })); await sleep(500); out.taxi[id] = { map: game.currentMap, trig: inTrig() }; }
    clear(); loadMap('town', 600); await sleep(350); clear(); player.mojicoins = 1e7;
    game.mapHistory = [id]; _wmRenderRecent();
    const b = document.querySelector('#worldmap-recent button[data-map-id="' + id + '"]');
    if (!b) { out.recent[id] = 'no button'; } else { b.click(); await sleep(500); out.recent[id] = { map: game.currentMap, trig: inTrig() }; }
  }
  clear(); loadMap('forest', 300); await sleep(300); clear();
  return out;
`;
await group('world-2', async () => {
  const r = await run(page, DOORS);
  const badDev = Object.entries(r.dev).filter(([, v]) => Array.isArray(v) && v.length);
  check(Object.keys(r.dev).length === 14 && badDev.length === 0, 'world-2: devTeleport lands clear of every door on all 14 maps that had a door within reach of x 200 (was: inside the trigger on 14)', J(badDev));
  const bt = Object.entries(r.taxi).filter(([id, v]) => typeof v === 'string' || v.map !== id || v.trig.length);
  check(Object.keys(r.taxi).length === 4 && bt.length === 0, 'world-2: the Taxi sets the hero down clear of the door on Forest, Mushroom, Coral Reef and the Zodiac Hall', J(r.taxi));
  const br = Object.entries(r.recent).filter(([id, v]) => typeof v === 'string' || v.map !== id || v.trig.length);
  check(Object.keys(r.recent).length === 4 && br.length === 0, 'world-2: the W-map "back to" row does the same', J(r.recent));
  check(!/loadMap\((id|mapId), 200\)/.test(SRC), 'world-2: no fast-travel path still hands loadMap a hard-coded x 200');
});
const LEDGE = String.raw`
  const out = {};
  const frames = async (n) => { const t0 = game.time, w0 = performance.now(); while (game.time - t0 < n && performance.now() - w0 < 30000) await sleep(40); };
  const doorY = (po) => (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x);
  const clear = () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} game.paused = false; };
  // walk through the real door: stand on it in src, press Up, wait for the landing, report where the feet are against the door that leads back
  const walk = async (src, dest) => {
    clear(); loadMap(src, 300); await frames(14); clear(); player.invulnerable = 9e9; game.monsters.length = 0;
    const po = (game.portals || []).find((q) => q.dest === dest);
    if (!po) return { err: 'no door', have: (game.portals || []).map((q) => q.dest) };
    player.x = po.x - player.w / 2; player.y = doorY(po) - player.h; player.vx = 0; player.vy = 0;
    const went = tryPortal();
    if (game.currentMap === src) { const b = document.querySelector('#dialog-options button'); const d = document.getElementById('dialog'); if (b && d && getComputedStyle(d).display !== 'none') b.click(); }
    await frames(70); game.monsters.length = 0;
    const back = (game.portals || []).find((q) => q.dest === src);
    const feet = player.y + player.h;
    return { went, map: game.currentMap, cx: Math.round(player.x + player.w / 2), feet: Math.round(feet), doorX: back && Math.round(back.x), doorY: back && Math.round(doorY(back)), onGround: !!player.onGround,
      dist: back ? Math.round(Math.abs(player.x + player.w / 2 - back.x)) : null };
  };
  out.walks = {};
  for (const [src, dest] of [['celestialSpire', 'stardustAtrium'], ['azureAbode', 'azureAcademia'], ['town', 'forest']])   /* v0.30.1647: the Spire has no Sanctum door now (per user) */ out.walks[dest] = await walk(src, dest);
  // the generic rule, over the authored layout of every door that stands on a ledge: only the arrivals that stood in mid-air move
  out.sweep = (typeof _lxLedgeArrivalX === 'function') ? (() => {
    const keep = { mapData: game.mapData, portals: game.portals }; const moved = []; let n = 0;
    for (const id in MAPS) {
      const md = MAPS[id]; if (!md || !Array.isArray(md.portals) || !Array.isArray(md.platforms)) continue;
      game.mapData = md; game.portals = md.portals;
      for (const back of md.portals) {
        if (!back || typeof back.y !== 'number') continue; n++;
        const off = 50 + player.w / 2 + 6, ww = md.worldWidth || 2000;
        const x0 = Math.max(8, Math.min(ww - player.w - 8, back.x + (back.x < ww / 2 ? off : -off)));
        const x1 = _lxLedgeArrivalX(x0, back.y);
        if (x1 !== x0) moved.push(id + '<-' + back.dest + ' ' + Math.round(x0) + '->' + Math.round(x1));
      }
    }
    game.mapData = keep.mapData; game.portals = keep.portals; return { n, moved };
  })() : 'absent';
  clear(); loadMap('forest', 300); await sleep(300); clear();
  return out;
`;
await group('world-7', async () => {
  const r = await run(page, LEDGE);
  const w = r.walks;
  const ok = (x, name) => x && x.map === name && x.feet != null && Math.abs(x.feet - x.doorY) <= 45;
  check(ok(w.stardustAtrium, 'stardustAtrium') && ok(w.azureAcademia, 'azureAcademia'),
    'world-7: arriving at Stardust Atrium (from the Spire) and Azure Academia (from the Abode) puts the hero on the back door\'s own ledge, not on the floor below it', J(w));
  check(['stardustAtrium', 'azureAcademia'].every((k) => w[k] && w[k].dist >= 50), 'world-7: ...and outside that door\'s 50 px trigger, so a stray Up does not walk straight back', J(['stardustAtrium', 'azureAcademia'].map((k) => w[k] && w[k].dist)));
  check(w.forest && w.forest.map === 'forest' && w.forest.onGround && w.forest.dist >= 50, 'world-7: an ordinary door pair still lands beside its door (Everdawn -> Forest)', J(w.forest));
  const mv = r.sweep === 'absent' ? null : r.sweep.moved.map((s) => s.split(' ')[0]).sort();
  check(!!mv && J(mv) === J(['azureAcademia<-azureAbode']), 'world-7: over every door that stands on a ledge, exactly the one arrival that stood in mid-air moves (the Sanctum -> Spire one went with its door) (Stardust\'s ledge was widened instead)', J(r.sweep));
});
const SYS = String.raw`
  const out = {};
  // systems-2: leave a Tower run by loadMap (W-map / Taxi) and read player.mods with NO masking recompute afterwards
  const ids = POWERUPS.map((x) => x.id);
  game.expedition = { active: false, floor: 0 }; player.level = Math.max(player.level | 0, 80); player.boons = []; player.boonsEquipped = [];
  for (let i = 0; i < 5; i++) { const b = rollBoonInstance(ids[i]); if (b) player.boons.push(b); }
  equipBoon(0); equipBoon(1); equipBoon(2); _applyEquippedBoons();
  const modsOf = () => JSON.stringify(player.mods), synOf = () => JSON.stringify(player._activeSynergies || null); const modsTown = modsOf();
  game.expedition = { active: true, floor: 9, snapshot: _expeditionSnapshotPlayer(), _baselineBoonCount: player.boons.length, _baselineEquipCount: 3 };
  for (let i = 5; i < 8; i++) _lxExpBoons().push(rollBoonInstance(ids[i]));
  _applyEquippedBoons(); out.rose = modsOf() !== modsTown;
  loadMap('forest', 300); await sleep(700);
  out.leftActive = game.expedition.active; out.leaveModsBack = modsOf() === modsTown;
  // systems-4: the achievement list and the Steam manifest agree and nothing needs a level above the cap
  out.ach = ACHIEVEMENTS.map((a) => a.id); out.cap = PRESTIGE_LEVEL; out.lvTests = ACHIEVEMENTS.filter((a) => /level\s*>=\s*(\d+)/.test(String(a.test))).map((a) => [a.id, +(String(a.test).match(/level\s*>=\s*(\d+)/)[1])]);
  // diff-b-1: the creation screen's hair list
  const keepLook = JSON.parse(JSON.stringify(player.lookCustom || {})), keepCos = player.cosmetics; player.cosmetics = { hair: {}, cape: {}, weapon: {} };
  _buildCsLookPickers();
  const lockedIds = HERO_VEC_HAIR_OPTIONS.filter((h) => h.cos).map((h) => h.id);
  const offered = () => Array.from(document.getElementById('cs-dd-hair').options).map((o) => o.value);
  out.lockedOffered = lockedIds.filter((i) => offered().includes(i)); out.hairCount = offered().length; out.hairFree = HERO_VEC_HAIR_OPTIONS.filter((h) => !h.cos).length;
  let landed = 0; for (let i = 0; i < 200; i++) { try { _csRandomizeLook(); } catch (e) {} if (lockedIds.includes(player.lookCustom && player.lookCustom.hairId)) landed++; }
  out.diceLanded = landed;
  player.cosmetics.hair.flame = true; _buildCsLookPickers(); out.earnedOffered = offered().includes('flameTips');
  player.cosmetics = keepCos; player.lookCustom = keepLook; _buildCsLookPickers();
  // diff-b-3: the set-piece bake scale is the device-pixel ratio, not the live (zoomed) transform
  ctx.save(); ctx.setTransform(1.06 * _LX_DPR, 0, 0, 1.06 * _LX_DPR, 0, 0); const sZoom = _lxSpScale(); ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); const sRest = _lxSpScale(); ctx.restore();
  out.spScale = [sZoom, sRest, _lxMallDpr()];
  return out;
`;
await group('systems/diff-b', async () => {
  const r = await run(page, SYS);
  check(r.rose && r.leftActive === false && r.leaveModsBack, 'systems-2: leaving a Tower run by the W-map / Taxi puts player.mods back to the town values (the tray\'s god-roll boons stayed applied)', J({ rose: r.rose, active: r.leftActive, back: r.leaveModsBack }));
  const man = JSON.parse(readFileSync(path.join(SERVE_ROOT, 'steam', 'achievements_manifest.json'), 'utf8')).achievements.map((a) => a.apiname);
  check(!r.ach.includes('lv150') && r.lvTests.every(([, n]) => n <= r.cap), 'systems-4: no achievement needs a level above the cap (lv150 "Mythic" was unobtainable)', J({ cap: r.cap, bad: r.lvTests.filter(([, n]) => n > r.cap) }));
  check(J(man) === J(r.ach), 'systems-4: the Steam manifest lists exactly the game\'s achievements (40, same order)', J({ game: r.ach.length, manifest: man.length }));
  check(!/lv150/.test(readFileSync(path.join(SERVE_ROOT, 'steam', 'ACHIEVEMENTS_STEAM.md'), 'utf8')) && !/lv150/.test(readFileSync(path.join(SERVE_ROOT, 'scripts', 'gen_achievement_icons.mjs'), 'utf8')), 'systems-4: ...and the Steam table and the icon generator no longer name it');
  check(r.lockedOffered.length === 0 && r.hairCount === r.hairFree && r.diceLanded === 0, 'diff-b-1: the creation screen offers none of the four locked cosmetic hairs, and the dice never lands on one in 200 rolls', J({ offered: r.lockedOffered, n: r.hairCount, free: r.hairFree, dice: r.diceLanded }));
  check(r.earnedOffered === true, 'diff-b-1: ...and an earned one is offered', String(r.earnedOffered));
  check(r.spScale[0] === r.spScale[1] && r.spScale[1] === Math.max(1, Math.min(2, r.spScale[2])), 'diff-b-3: the Zodiac Hall / Frozen Peak bake scale does not change with the camera-punch zoom', J(r.spScale));
});
const UI = String.raw`
  const out = {};
  const clear = () => { try { closeAllModals(); } catch (e) {} game.paused = false; };
  // ui-5: a held key (auto-repeat) must not respawn; a real press does
  game.dying = 1e9; game._dyingStartTime = performance.now() - 5000;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true })); out.afterRepeat = game.dying > 0;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: false, bubbles: true })); await sleep(250); out.afterPress = game.dying > 0;
  game.dying = 0; clear(); loadMap('forest', 300); await sleep(500); clear(); player.hp = getMaxHp();
  // ui-7: cosmetic unlock hints name the monsters the player sees
  out.desc = { flame: COSMETICS.hair[0].desc, mint: COSMETICS.hair[1].desc, twilight: COSMETICS.hair[2].desc, shadow: COSMETICS.cape[0].desc, ember: COSMETICS.cape[1].desc, royal: COSMETICS.hair[3].desc };
  // ui-8: the Compendium search keeps its own input
  _renderLoreTab('bestiary'); const body = document.getElementById('lore-body');
  const q = document.getElementById('cdx-dex-q'); out.hasInput = !!q;
  if (q) {
    const grid0 = document.getElementById('cdx-dex-grid');
    q.focus(); q.value = 'sl'; q.dispatchEvent(new Event('input')); out.sameNode = document.getElementById('cdx-dex-q') === q; out.sameGrid = document.getElementById('cdx-dex-grid') === grid0; out.keepsValue = document.getElementById('cdx-dex-q').value === 'sl'; out.keepsFocus = document.activeElement === q;
    q.value = 'zzzqq'; q.dispatchEvent(new Event('input')); out.gridFollows = /Nothing here yet/.test(document.getElementById('cdx-dex-grid').textContent);
    q.value = ''; q.dispatchEvent(new Event('input'));
    window._cdxDex.q = '&lt;b&amp; "c'; _cdxRenderDex(body); out.escaped = document.getElementById('cdx-dex-q').value; window._cdxDex.q = ''; _cdxRenderDex(body);
  }
  // ui-9: the rotate nag
  const root = document.documentElement;
  for (const k of ['requestFullscreen', 'webkitRequestFullscreen']) Object.defineProperty(root, k, { value: undefined, configurable: true, writable: true });
  const n0 = window.__toasts.length; document.body.classList.add('nag-portrait'); _lxMobileFullscreen(true);
  out.nagToast = window.__toasts.slice(n0).some((t) => /Add to Home Screen/.test(t));
  const keepNag = document.body.dataset.nagDismissed;
  try { localStorage.removeItem('_mobile_nagDismissed'); } catch (e) {}
  document.querySelector('#rotate-nag .nag-fs').click(); out.afterFs = localStorage.getItem('_mobile_nagDismissed');
  [...document.querySelectorAll('#rotate-nag button')].find((b) => !b.classList.contains('nag-fs')).click(); out.afterPortrait = localStorage.getItem('_mobile_nagDismissed');
  for (const k of ['requestFullscreen', 'webkitRequestFullscreen']) delete root[k];
  localStorage.removeItem('_mobile_nagDismissed'); if (keepNag == null) delete document.body.dataset.nagDismissed; else document.body.dataset.nagDismissed = keepNag; document.body.classList.remove('nag-portrait');
  // ui-10: the hint words follow the live key, and say "tap" on a phone
  out.hint = typeof _lxKeyHint === 'function' ? {} : null;
  if (out.hint) {
    out.hint.def = [_lxKeyHint('attributesU', 'BAG'), _lxKeyHint('worldMap', 'MAP', true), _lxKeyHint('mail', null, true)];
    _kbAssign('attributesU', 'o'); _kbAssign('worldMap', 'j'); out.hint.rebound = [_lxKeyHint('attributesU', 'BAG'), _lxKeyHint('worldMap', 'MAP', true)];
    const tt = window._lxTouchHints; window._lxTouchHints = () => true; out.hint.touch = [_lxKeyHint('attributesU', 'BAG'), _lxKeyHint('worldMap', 'MAP', true), _lxKeyHint('mail', null, true)]; window._lxTouchHints = tt;
    _kbAssign('attributesU', 'u'); _kbAssign('worldMap', 'w'); out.hint.back = [_lxKeyHint('attributesU', 'BAG'), _lxKeyHint('worldMap', 'MAP', true)];
  }
  // ui-11: a corner HUD button does not keep keyboard focus after a click
  const sb = document.getElementById('settings-btn'); sb.focus(); out.focusedBefore = document.activeElement === sb; sb.click(); await sleep(80); out.focusedAfter = document.activeElement === sb; clear();
  // ui-12: an Enter that commits an IME composition does not send the chat line
  const cap = []; const capFn = (e) => cap.push([e.key, e.target && e.target.id, e.isComposing, e.keyCode]); window.addEventListener('keydown', capFn, true); out.preChatOpen = !!net.chatOpen; if (net.chatOpen) _mpCloseChat(false);
  const sends = []; const _ms = window._mpSendChat; window._mpSendChat = function (t) { sends.push(String(t)); };
  _mpOpenChat(); const inp = document.getElementById('mp-chat-input'); inp.value = 'half typed';
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: true, bubbles: true })); out.sendsAfterIme = sends.length; out.chatOpenAfterIme = !!net.chatOpen;
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); out.sendsAfterEnter = sends.length; out.chatClosedAfterEnter = !net.chatOpen;
  window._mpSendChat = _ms; window.removeEventListener('keydown', capFn, true); out.chatCap = cap; out.inpInForm = !!inp.closest('form'); if (net.chatOpen) _mpCloseChat(false);
  return out;
`;
await group('ui', async () => {
  const r = await run(page, UI);
  check(r.afterRepeat === true && r.afterPress === false, 'ui-5: a held Space (auto-repeat keydown) does not respawn the hero past the 1.1 s grace; a real press does', J({ afterRepeat: r.afterRepeat, afterPress: r.afterPress }));
  check(/Jell/.test(r.desc.mint) && /Shroom/.test(r.desc.flame) && /Spook/.test(r.desc.twilight) && /Horncap/.test(r.desc.shadow) && /Pincer/.test(r.desc.ember) && !/slime|mushroom|wraith|scorpion/i.test(Object.values(r.desc).join(' ')),
    'ui-7: the cosmetic unlock hints name the monsters the player sees (Jelly, Shroom, Spook, Horncap, Pincer)', J(r.desc));
  check(r.hasInput && r.sameNode && r.sameGrid && r.keepsValue && r.gridFollows, 'ui-8: typing in the Compendium search keeps the same <input> node (so its caret, focus and IME composition survive) and the same grid, and still filters it', J({ node: r.sameNode, grid: r.sameGrid, value: r.keepsValue, filters: r.gridFollows }));
  check(r.escaped === '&lt;b&amp; "c', 'ui-8: a search that contains HTML entities (&lt; &amp;) survives a full re-render untouched (the value attribute decoded them)', J(r.escaped));
  check(r.nagToast === true, 'ui-9: the rotate nag\'s Fullscreen button says how to get full screen on an iPhone (it did nothing)', String(r.nagToast));
  check(r.afterFs === null && r.afterPortrait === '1', 'ui-9: only "Play in portrait anyway" persists the nag dismissal', J({ afterFs: r.afterFs, afterPortrait: r.afterPortrait }));
  check(!!r.hint && r.hint.def[0] === 'press U' && r.hint.def[1] === 'Press W' && r.hint.rebound[0] === 'press O' && r.hint.rebound[1] === 'Press J' && r.hint.touch[0] === 'tap BAG' && r.hint.touch[1] === 'Tap MAP' && /^Press /.test(r.hint.touch[2]) && r.hint.back[0] === 'press U',
    'ui-10: the key hints name the LIVE key after a rebind, and "tap BAG / MAP" on a phone', J(r.hint));
  check(!/press U\)`/.test(SRC) && !/press U to equip/.test(SRC) && !/Press W to view the world map/.test(SRC) && !/Press P anywhere to call me/.test(SRC) && !/press P to collect/.test(SRC), 'ui-10: no typed "press U / W / P" is left in a toast, a footnote or the Wisp\'s line');
  check(r.focusedBefore === true && r.focusedAfter === false, 'ui-11 (unverified on Firefox): the Settings corner button lets go of keyboard focus after a click', J({ before: r.focusedBefore, after: r.focusedAfter }));
  check(r.sendsAfterIme === 0 && r.chatOpenAfterIme === true && r.sendsAfterEnter === 1 && r.chatClosedAfterEnter === true, 'ui-12: an Enter that commits an IME composition (isComposing / 229) sends nothing and leaves the chat bar open; a plain Enter still sends', J({ sendsAfterIme: r.sendsAfterIme, openAfterIme: r.chatOpenAfterIme, sendsAfterEnter: r.sendsAfterEnter, closed: r.chatClosedAfterEnter, pre: r.preChatOpen, cap: r.chatCap, inForm: r.inpInForm }));
});
const ENG = String.raw`
  const out = {};
  const frames = async (n) => { const t0 = game.time, w0 = performance.now(); while (game.time - t0 < n && performance.now() - w0 < 30000) await sleep(40); };
  const clear = () => { try { closeAllModals(); } catch (e) {} game.paused = false; };
  // engine-3: evicting a per-monster custom clip must leave the slot "unprobed", not "no custom file"
  { const RealAudio = window.Audio, made = [];
    class FakeAudio { constructor(src) { this._src = src; this._l = {}; this.volume = 1; this.muted = false; made.push(this); }
      addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }
      set src(v) { this._src = v; if (v === '') queueMicrotask(() => (this._l.error || []).forEach((f) => f({}))); }
      get src() { return this._src; } pause() {} play() { return Promise.resolve(); } load() {} }
    window.Audio = FakeAudio;
    try {
      for (let i = 0; i < 30; i++) { _probeMonsterCustomSfx('bhx' + i, 'hit'); const a = made[made.length - 1]; (a._l.canplaythrough || []).forEach((f) => f({})); }
      await sleep(80);
      out.evictedSlot = String(_monsterCustomSfx['bhx0_hit']); out.liveSlot = typeof _monsterCustomSfx['bhx29_hit'];
      _probeMonsterCustomSfx('bhx0', 'hit'); out.reprobe = _monsterCustomSfx['bhx0_hit'] === 'probing';
    } finally { window.Audio = RealAudio; for (let i = 0; i < 30; i++) delete _monsterCustomSfx['bhx' + i + '_hit']; _monsterCustomSfxReady.length = 0; }
  }
  // engine-4: _applySettings touches only AUDIBLE music elements (an idle one sits at 0 so the fade can ramp it in)
  { const s0 = _lxGetSettings(); _bgmBossEl.volume = 0; const was = _bgmBossEl.paused;
    _applySettings(Object.assign({}, s0, { bgm: 50 })); out.bossIdleVol = _bgmBossEl.volume; out.bossWasPaused = was;
    Object.defineProperty(_bgmEl, 'paused', { get: () => false, configurable: true }); const v0 = _bgmEl.volume, ft0 = _bgmEl._fadeTarget; _bgmEl._fadeTarget = 0.5; _bgmEl.volume = 0.01;
    _applySettings(Object.assign({}, s0, { bgm: 50 })); out.audibleVol = _bgmEl.volume; delete _bgmEl.paused; _bgmEl.volume = v0; _bgmEl._fadeTarget = ft0;
    _applySettings(s0); }
  // engine-5: a cinematic's rival fade-out is not restarted by every 250 ms pass
  { const calls = []; const _f = window._bgmFade; window._bgmFade = function (el, t, d) { calls.push(el === _bgmEl ? 'bgm' : 'other'); el._fadeTarget = t; };
    Object.defineProperty(_bgmEl, 'paused', { get: () => false, configurable: true }); const v0 = _bgmEl.volume; _bgmEl.volume = 0.4;
    _cineSilenceRivals(); _cineSilenceRivals(); _cineSilenceRivals(); out.rivalFades = calls.filter((c) => c === 'bgm').length;
    window._bgmFade = _f; delete _bgmEl.paused; delete _bgmEl._fadeTarget; delete _bgmEl._cineFadeAt; _bgmEl.volume = v0; }
  // engine-6: mute pools and the hidden-tab sting
  { const st = _lxStingEl('victory'); _lxApplyMediaMuted(true); out.menuMuted = _menuBgm.muted === true; out.stingMuted = st.muted === true;
    _lxApplyMediaMuted(false); out.menuUnmuted = _menuBgm.muted === false; out.stingUnmuted = st.muted === false;
    const co = _cineOwnsMix; _cineOwnsMix = false;   // a cinematic that holds the mix (this harness has one) refuses every sting
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); out.hiddenSting = _lxPlaySting('victory', 0, 900, 0); delete document.hidden;
    out.visibleSting = _lxPlaySting('victory', 0, 900, 0); out.stingWhy = { hidden: document.hidden, audioMuted: !!(audio && audio.muted), vol: _bgmTargetVol(), cine: typeof _cineOwnsMix !== 'undefined' ? _cineOwnsMix : null }; try { st.pause(); } catch (e) {} _cineOwnsMix = co; }
  // engine-8: a frame that throws inside a clip / filter scope leaves nothing behind
  { const real = window.drawBackground; let thrown = 0;
    window.drawBackground = function () { if (!thrown) { thrown = 1; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 10, 10); ctx.clip(); ctx.filter = 'blur(3px)'; throw new Error('bughunt engine-8 test throw'); } return real.apply(this, arguments); };
    await frames(6); window.drawBackground = real; await frames(30);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ff00ff'; ctx.fillRect(700, 400, 4, 4); const px = ctx.getImageData(702, 402, 1, 1).data; out.filter = ctx.filter; ctx.restore();
    out.thrown = thrown; out.px = [px[0], px[1], px[2]]; out.clipClean = px[0] > 250 && px[1] < 5 && px[2] > 250; }
  // engine-9: the resume from a lost-focus veil must not unpause beneath a modal that opened meanwhile
  { clear(); const okp = _lxAutoPause('focus'); out.autoPaused = !!okp && game.paused === true;
    const sb = document.getElementById('story-beat-overlay'); sb.classList.add('on'); _lxAutoResume(false); out.pausedUnderBeat = game.paused; sb.classList.remove('on');
    clear(); _lxAutoPause('focus'); _lxAutoResume(false); out.pausedPlain = game.paused; clear(); }
  // L2a: the tracker's key labels re-label on a keyboard / pad flip
  { let n = 0; const _r = window.renderQuestTracker; window.renderQuestTracker = function () { n++; }; _lxRefreshPrompts(); window.renderQuestTracker = _r; out.trackerCalls = n; }
  // L2f: the dev-only stray-mob toast
  { _LX_STRAY.at = 0; _LX_STRAY.seen = Object.create(null); game.monsters.length = 0; spawnMonster(player.x + 300, player.y, 'wraith', false, false);
    const n0 = window.__toasts.length; _lxMobStrayCheck(); out.strayToasts = window.__toasts.slice(n0).filter((t) => /stray/i.test(t)).length; game.monsters.length = 0; }
  // bootdata-9: one #eq-weapon, and the studio's own builder leaves the inventory slot alone
  { out.eqWeaponIds = document.querySelectorAll('[id="eq-weapon"]').length; const slot = document.getElementById('eq-weapon'); const had = !!slot.querySelector('.label');
    buildCharStudioEquipPicker('weapon'); out.invSlotIntact = had && !!document.getElementById('eq-weapon').querySelector('.label'); const cs = document.getElementById('cs-eq-weapon'); out.studioFilled = !!cs && cs.querySelectorAll('button').length > 1; }
  // engine-1b: a store that refuses a write must not abort _applySettings half way
  { const si = Storage.prototype.setItem; const ri = Storage.prototype.removeItem; const bad = (k) => k === 'LX_LOW_FX' || k === 'LX_DEBUG_SCALE';
    Storage.prototype.setItem = function (k) { if (bad(k)) throw new DOMException('quota', 'QuotaExceededError'); return si.apply(this, arguments); };
    Storage.prototype.removeItem = function (k) { if (bad(k)) throw new DOMException('quota', 'QuotaExceededError'); return ri.apply(this, arguments); };
    const s0 = _lxGetSettings(); document.body.classList.remove('force-desktop');
    try { _applySettings(Object.assign({}, s0, { lowfx: true, fdesk: true })); } catch (e) { out.applyThrew = String(e && e.message).slice(0, 60); }
    const a1 = document.body.classList.contains('force-desktop'); document.body.classList.remove('force-desktop');
    try { _applySettings(Object.assign({}, s0, { lowfx: false, debug: false, fdesk: true })); } catch (e) { out.applyThrew2 = String(e && e.message).slice(0, 60); }
    out.reachedLaterSteps = a1 && document.body.classList.contains('force-desktop');
    Storage.prototype.setItem = si; Storage.prototype.removeItem = ri; try { _applySettings(s0); } catch (e) {} document.body.classList.remove('force-desktop'); }
  clear(); game.dying = 0; loadMap('forest', 300); await sleep(300); clear();
  return out;
`;
await group('engine/misc', async () => {
  const r = await run(page, ENG);
  check(r.evictedSlot === 'undefined' && r.reprobe === true && r.liveSlot === 'object', 'engine-3: an evicted custom monster clip goes back to "unprobed" and is fetched again (its own error event used to write null after the delete)', J({ evicted: r.evictedSlot, reprobe: r.reprobe, live: r.liveSlot }));
  check(r.bossIdleVol === 0 && r.audibleVol > 0.25, 'engine-4: _applySettings leaves an idle music element at volume 0 (so its fade-in ramps) and still moves an audible one', J({ idleBoss: r.bossIdleVol, audible: r.audibleVol }));
  check(r.rivalFades === 1, 'engine-5: three 250 ms passes of the cinematic rival-silencer start ONE fade-out per track, not three', String(r.rivalFades));
  check(r.menuMuted && r.stingMuted && r.menuUnmuted && r.stingUnmuted, 'engine-6: the background / M-key mute reaches the title music and the victory sting, and unmuting gives them back', J({ menu: [r.menuMuted, r.menuUnmuted], sting: [r.stingMuted, r.stingUnmuted] }));
  check(r.hiddenSting === false && r.visibleSting === true, 'engine-6: a hidden tab plays no victory sting (a visible one still does)', J({ hidden: r.hiddenSting, visible: r.visibleSting, why: r.stingWhy }));
  check(r.thrown === 1 && r.clipClean && r.filter === 'none', 'engine-8: a frame that threw inside a clip + filter scope leaves no clip or filter on the canvas afterwards', J({ px: r.px, filter: r.filter }));
  check(r.autoPaused && r.pausedUnderBeat === true && r.pausedPlain === false, 'engine-9: resuming from the lost-focus veil keeps the world paused under a story beat that opened meanwhile, and unpauses when nothing is open', J({ autoPaused: r.autoPaused, underBeat: r.pausedUnderBeat, plain: r.pausedPlain }));
  check(r.trackerCalls === 1, 'L2a: a keyboard / pad flip re-renders the quest tracker (the guard named a function that does not exist)', String(r.trackerCalls));
  check(r.strayToasts === 1, 'L2f: the dev-only "stray mob" toast shows on a developer surface (its guard read a const that lives inside another function)', String(r.strayToasts));
  check(r.eqWeaponIds === 1 && r.invSlotIntact && r.studioFilled, 'bootdata-9: there is one #eq-weapon, and the char studio builds its weapon picker into its own container', J({ ids: r.eqWeaponIds, inv: r.invSlotIntact, studio: r.studioFilled }));
  check(r.reachedLaterSteps === true, 'engine-1: a store that refuses LX_LOW_FX / LX_DEBUG_SCALE writes no longer stops _applySettings before its later steps', J({ later: r.reachedLaterSteps, threw: r.applyThrew }));
});
const SYS2 = String.raw`
  const out = {}; const ids = POWERUPS.map((x) => x.id);
  game.expedition = { active: false, floor: 0 }; player.level = Math.max(player.level | 0, 80); player.boons = []; player.boonsEquipped = [];
  for (let i = 0; i < 5; i++) { const b = rollBoonInstance(ids[i]); if (b) player.boons.push(b); }
  equipBoon(0); equipBoon(1); equipBoon(2); _applyEquippedBoons();
  const modsOf = () => JSON.stringify(player.mods); const modsTown = modsOf();
  // systems-2, the loadState branch (kept last: loading a save lands in Everdawn, whose welcome clip eats the next key press): a save made mid-run, loaded back, must not carry the tray's mods into town
  game.expedition = { active: false, floor: 0 }; player.boons = player.boons.slice(0, 5); player.boonsEquipped = [0, 1, 2]; _applyEquippedBoons();
  game.expedition = { active: true, floor: 9, snapshot: _expeditionSnapshotPlayer(), _baselineBoonCount: player.boons.length, _baselineEquipCount: 3 };
  for (let i = 5; i < 8; i++) _lxExpBoons().push(rollBoonInstance(ids[i]));
  _applyEquippedBoons(); const inRun2 = modsOf();
  try { _flushSaveStateNow(); } catch (e) { out.saveErr = String(e && e.message).slice(0, 100); }
  await sleep(300);
  try { loadState(); } catch (e) { out.loadErr = String(e && e.message).slice(0, 120); }
  await sleep(700); game.paused = false; player._god = true; player.invulnerable = 9e9;
  out.loadActive = game.expedition && game.expedition.active; out.loadModsBack = modsOf() === modsTown; out.inRun2Differs = inRun2 !== modsTown;
  game.expedition = { active: false, floor: 0 }; loadMap('forest', 300); await sleep(300); game.paused = false;
  return out;
`;
await group('systems-2 reload', async () => {
  const r = await run(page, SYS2);
  check(r.inRun2Differs && r.loadActive === false && r.loadModsBack, 'systems-2: a save loaded mid-run lands in town with the town mods, not the tray\'s', J({ active: r.loadActive, back: r.loadModsBack, err: r.loadErr }));
});
await group('static', async () => {
  const gen = (script) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), '--check'], { cwd: ROOT, encoding: 'utf8' });
  const g1 = gen('gen_attack_timing.mjs'), g2 = gen('gen_assets_manifest.mjs');
  check(g1.status === 0, 'bootdata-3: gen_attack_timing --check passes (every attack set has its strike pick and baked timing)', (g1.stdout + g1.stderr).trim().split('\n').slice(-2).join(' | '));
  check(g2.status === 0, 'bootdata-4: gen_assets_manifest --check passes (data/assets_manifest.json is the generator\'s sorted list)', (g2.stdout + g2.stderr).trim().split('\n')[0]);
  const man = JSON.parse(readFileSync(path.join(ROOT, 'data', 'assets_manifest.json'), 'utf8'));
  check(J(man) === J([...man].sort()), 'bootdata-4: the manifest is in code-unit order (the resume cursor of the warm pass keeps its meaning)');
  check(!/adv-guide-line/.test(SRC), 'bootdata-2: the dead #adv-guide-line blocks are gone');
  check(!/_refreshHud/.test(SRC) && !/_lxBossPip/.test(SRC) && !/typeof _renderQuestTracker/.test(SRC) && !/typeof LX_DEV_TOOLS/.test(SRC), 'L2: the dead guards (_refreshHud, _lxBossPip, _renderQuestTracker, typeof LX_DEV_TOOLS) are gone');
  check(/background-image', 'url\("' \+ SRC \+ '"\)'/.test(SRC) && !/background-image', 'url\("' \+ A\.src/.test(SRC), 'cisec-6: the CSS-pseudo emoji tiles use the resolved atlas URL like the other sinks');
  check(!/Xenon/.test(SRC), 'clobber-3: no collaborator\'s local path ships in the game file');
  const e = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'emoji_atlas_coverage_test.mjs'), PAGE_FILE], { cwd: ROOT, encoding: 'utf8' });
  check(e.status === 0, 'bootdata-1: every pictograph in the game\'s strings is an emoji-atlas key (scripts/emoji_atlas_coverage_test.mjs)', (e.stdout || '').trim().split('\n').slice(-2).join(' | '));
});
// ---- fresh pages: engine-1 (site data blocked) and clobber-1 (a stale resume handoff)
await group('engine-1', async () => {
  const blockedErrs = []; const { ctx, page: p2 } = await newPage(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); }, configurable: true }); }, blockedErrs);
  try {
    await p2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p2.waitForFunction(() => typeof loadMap === 'function', null, { timeout: 120000 }); await p2.waitForTimeout(2500);
    const r = await p2.evaluate(() => { const t = (f) => { try { f(); return 'ok'; } catch (e) { return String(e && e.name); } };
      return { art: t(() => _ART_PACK), charStyle: t(() => _CHAR_STYLE), studio: t(() => CHAR_STUDIO), menu: !!document.getElementById('lo-menu') }; });
    check(r.art === 'ok' && r.charStyle === 'ok' && r.studio === 'ok', 'engine-1: with site data blocked (localStorage throws) the main script and the character-studio script still run to the end', J(r));
    console.log('  info: ' + blockedErrs.length + ' further page error(s) with storage blocked (handlers outside boot): ' + J([...new Set(blockedErrs)].slice(0, 3)));
  } finally { await ctx.close(); }
});
await group('clobber-1', async () => {
  const { ctx, page: p3 } = await newPage(() => { try { const ri = Storage.prototype.removeItem; Storage.prototype.removeItem = function (k) { if (k === 'lx_resume' && window.__resumeClaimedIn === undefined) window.__resumeClaimedIn = document.readyState; return ri.apply(this, arguments); }; sessionStorage.setItem('lx_resume', JSON.stringify({ name: 'Tester', kind: 'character' })); } catch (e) {} });
  try {
    await p3.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p3.waitForTimeout(1500);
    const left = await p3.evaluate(() => ({ key: (() => { try { return sessionStorage.getItem('lx_resume'); } catch (e) { return 'err'; } })(), claimedWhile: window.__resumeClaimedIn }));
    check(left.key === null && left.claimedWhile === 'loading', 'clobber-1: the lx_resume handoff is claimed when the page PARSES, so a reload interrupted during the decode gate cannot leave it for a later refresh', J(left));
  } finally { await ctx.close(); }
});
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} catch (e) { check(false, 'harness crashed', String(e && e.stack).slice(0, 400)); }
finally { await browser.close().catch(() => {}); server.kill(); }
console.log(fail ? `\n${fail} of ${pass + fail} FAILED` : `\nall ${pass + fail} passed`);
process.exit(fail ? 1 : 0);
