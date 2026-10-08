// Five new bridge maps (new-maps). Per spec, each old direct link A <-> B is replaced by A <-> N <-> B:
//   cadetsStrand      between town (Everdawn Central) and bastion
//   glimmerwood       between forest and azureAcademia
//   cloudstepIsles    between azureAcademia and skyGarden (the Lv 15 road)
//   starfallCrossing  Frozen Peak's two doors (floor 50 at x300 y10570, the summit at x400 y70) both lead here and pair,
//                     by x order, with its two doors back; it also has a door to cryptHollow and one to stardustAtrium
//   cinnabarCaves     between emeraldVillage and reachOfVermillion
// Held: [1] each is a real map (name, a BG_IMAGES backdrop, known monsters, fixedLayout, bridge, a world-map pin);
// [2] every new link has doors both ways and every replaced link is gone both ways; [3] every door touching a new map is
// WALKED both ways through the real tryPortal() and lands the hero beside the paired door back, on solid ground (Frozen
// Peak's floor-50 and summit doors pair index-for-index); [4] walking from town still reaches every map it reached
// before, plus the five; [5] no old map moves further from town or respawns at another town (a bridge costs 0 hops,
// so no monster is buffed by the rewire); [6] the W map draws the new nodes and lanes, not the old lanes, no overlapping
// discs, and the names and region icons; [7] the taxi offers the new maps and drives there; [8] the area card and the
// minimap; [9] each new map plays for 3 s; [10] no page errors. The baselines ([4], [5]) were read from main before the
// maps existed, so against main the new-map checks fail and the baseline checks pass.
//   node scripts/new_maps_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9951);
// MOJI_GAME_FILE can be a path on disk (serve.js reads it that way): request it by its path under ROOT
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');

// ---- the spec ---------------------------------------------------------------------------------------------------------
const NEW = ['cadetsStrand', 'glimmerwood', 'cloudstepIsles', 'starfallCrossing', 'cinnabarCaves'];
// every link the new maps make: [a, b, exact door count each way (0 = at least one)]
const LINKS = [
  ['town', 'cadetsStrand', 0], ['cadetsStrand', 'bastion', 0],
  ['forest', 'glimmerwood', 0], ['glimmerwood', 'azureAcademia', 0],
  ['azureAcademia', 'cloudstepIsles', 0], ['cloudstepIsles', 'skyGarden', 0],
  ['frozenPeak', 'starfallCrossing', 2], ['starfallCrossing', 'cryptHollow', 0], ['starfallCrossing', 'stardustAtrium', 0],
  ['emeraldVillage', 'cinnabarCaves', 0], ['cinnabarCaves', 'reachOfVermillion', 0],
];
// the direct links the new maps replace: gone, in both directions
const REMOVED = [['town', 'bastion'], ['forest', 'azureAcademia'], ['azureAcademia', 'skyGarden'],
  ['frozenPeak', 'cryptHollow'], ['frozenPeak', 'stardustAtrium'], ['emeraldVillage', 'reachOfVermillion']];
// Frozen Peak's two doors to Starfall Crossing, in x order, and where on the tower they stand
const FP = 'frozenPeak', SC = 'starfallCrossing';
const FP_DOORS = [{ at: 'floor 50', x: 300, y: 10570 }, { at: 'the summit', x: 400, y: 70 }];
// Baselines, read from main (v0.30.1284, before the new maps) with the same BFS and the game's own functions.
// every map a hero can walk to from Everdawn Central (94 of 109)
const BASELINE_REACHABLE = [
  'abyssalTrench', 'ancient', 'azureAbode', 'azureAcademia', 'bastion', 'bastionRampart', 'bastionThrone',
  'blockland_apex', 'blockland_citadel', 'blockland_dunes', 'blockland_grove', 'blockland_meadow',
  'blockland_outpost', 'blockland_quarry', 'bloomhaven', 'boneGraveyard', 'boneGraveyard2', 'boneGraveyard3', 'boss',
  'boss_rush', 'bubbleGrotto', 'bubblegumSwamp', 'candyCanyon', 'celestialSpire', 'confusedVigil', 'coralReef',
  'cryptHollow', 'distortedThreshold', 'duneSands', 'emeraldVillage', 'everdawn_megamall', 'fieryHideout', 'forest',
  'fracturedReflection', 'frostbiteHollow', 'frozenPeak', 'glasswindHamlet', 'glasswindSteppe', 'glasswindSteppe2',
  'gloomsporeVerge', 'graniteBluffs', 'gravitosArena', 'hiddenPagoda', 'hollowSepulchre', 'hollowSepulchre2',
  'honeycombHollow', 'interdimensionalAscension', 'jadeGrove', 'kelpForest', 'krookThrone', 'lavaCavern',
  'magmaFoundry', 'magmaFoundry2', 'mushroom', 'octopusGrotto', 'ossuarySprawl', 'pearlBathhouse',
  'reachOfVermillion', 'sanctum', 'sauroSlope', 'shadowWovenHood', 'skyGarden', 'slimeCave', 'stardustAtrium',
  'stormCrest', 'sundered_forge', 'sunsetBeach', 'thornspireThicket', 'thunderPlateau', 'tidalLagoon',
  'tidepoolShoals', 'town', 'verdantHaven', 'verdantHollow', 'void', 'wayfarersLantern', 'wayfarersLantern1',
  'wayfarersLantern2', 'wildflowerPlains', 'witheringTide', 'witheringTide2', 'zod_aquarius', 'zod_aries',
  'zod_cancer', 'zod_capricorn', 'zod_gemini', 'zod_leo', 'zod_libra', 'zod_pisces', 'zod_sagittarius', 'zod_scorpio',
  'zod_taurus', 'zod_virgo', 'zodiacHall',
];
// _townDistance(id) per map: the portal hops from town that the monster-difficulty curve scales with (6 = unreachable)
const BASELINE_DIST = {
  abyssalTrench: 10, ancient: 4, azureAbode: 3, azureAcademia: 2, bastion: 1, bastionRampart: 2, bastionThrone: 2,
  blockland_apex: 15, blockland_citadel: 14, blockland_dunes: 11, blockland_grove: 10, blockland_meadow: 9,
  blockland_outpost: 13, blockland_quarry: 12, bloomhaven: 9, boneGraveyard: 7, boneGraveyard2: 8, boneGraveyard3: 9,
  boss: 5, boss_rush: 21, bubbleGrotto: 9, bubblegumSwamp: 6, candyCanyon: 5, celestialSpire: 7, clockworkExpress: 6,
  clockworkSpire: 6, clockworkUnderpassLobby: 6, confusedVigil: 8, coralReef: 7, cryptHollow: 6,
  distortedThreshold: 6, duneSands: 7, emeraldVillage: 4, everdawn_megamall: 1, fieryHideout: 10, forest: 1,
  fracturedReflection: 7, frostbiteHollow: 4, frozenPeak: 5, glasswindHamlet: 15, glasswindSteppe: 13,
  glasswindSteppe2: 14, gloomsporeVerge: 11, graniteBluffs: 8, gravitosArena: 22, hiddenPagoda: 5,
  hollowSepulchre: 15, hollowSepulchre2: 16, honeycombHollow: 7, innerDimension: 6, interdimensionalAscension: 20,
  jadeGrove: 3, kelpForest: 8, krookThrone: 10, lavaCavern: 8, magmaFoundry: 11, magmaFoundry2: 12, mushroom: 2,
  octopusGrotto: 11, ossuarySprawl: 16, pearlBathhouse: 5, reachOfVermillion: 5, sanctum: 8, sauroSlope: 9,
  shadowWovenHood: 4, skyGarden: 3, slimeCave: 5, stardustAtrium: 6, stormCrest: 9, sundered_forge: 9, sunsetBeach: 3,
  thornspireThicket: 10, thunderPlateau: 8, tidalLagoon: 4, tidepoolShoals: 6, tower: 6, tower_b1: 6, tower_b10: 6,
  tower_b2: 6, tower_b3: 6, tower_b4: 6, tower_b5: 6, tower_b6: 6, tower_b7: 6, tower_b8: 6, tower_b9: 6, town: 0,
  verdantHaven: 9, verdantHollow: 8, void: 22, wayfarersLantern: 17, wayfarersLantern1: 18, wayfarersLantern2: 19,
  wildflowerPlains: 3, witheringTide: 8, witheringTide2: 9, zod_aquarius: 22, zod_aries: 22, zod_cancer: 22,
  zod_capricorn: 22, zod_gemini: 22, zod_leo: 22, zod_libra: 22, zod_pisces: 22, zod_sagittarius: 22, zod_scorpio: 22,
  zod_taurus: 22, zod_virgo: 22, zodiacHall: 21,
};
// _nearestTownId(id) per map: the town a death there respawns the hero in
const BASELINE_NEAREST_TOWN = {
  abyssalTrench: 'verdantHaven', ancient: 'jadeGrove', azureAbode: 'azureAbode', azureAcademia: 'azureAcademia',
  bastion: 'bastion', bastionRampart: 'bastionRampart', bastionThrone: 'bastionThrone',
  blockland_apex: 'bastionRampart', blockland_citadel: 'bastionRampart', blockland_dunes: 'bastionRampart',
  blockland_grove: 'bastionRampart', blockland_meadow: 'bastionRampart', blockland_outpost: 'bastionRampart',
  blockland_quarry: 'bastionRampart', bloomhaven: 'verdantHaven', boneGraveyard: 'verdantHaven',
  boneGraveyard2: 'verdantHaven', boneGraveyard3: 'verdantHaven', boss: 'jadeGrove', boss_rush: 'void',
  bubbleGrotto: 'verdantHaven', bubblegumSwamp: 'bastionRampart', candyCanyon: 'bastionRampart',
  celestialSpire: 'azureAcademia', clockworkExpress: 'town', clockworkSpire: 'town', clockworkUnderpassLobby: 'town',
  confusedVigil: 'hiddenPagoda', coralReef: 'azureAcademia', cryptHollow: 'verdantHaven',
  distortedThreshold: 'hiddenPagoda', duneSands: 'fieryHideout', emeraldVillage: 'emeraldVillage',
  everdawn_megamall: 'everdawn_megamall', fieryHideout: 'fieryHideout', forest: 'azureAcademia',
  fracturedReflection: 'hiddenPagoda', frostbiteHollow: 'azureAcademia', frozenPeak: 'azureAcademia',
  glasswindHamlet: 'glasswindHamlet', glasswindSteppe: 'glasswindHamlet', glasswindSteppe2: 'glasswindHamlet',
  gloomsporeVerge: 'verdantHaven', graniteBluffs: 'bastionRampart', gravitosArena: 'void',
  hiddenPagoda: 'hiddenPagoda', hollowSepulchre: 'glasswindHamlet', hollowSepulchre2: 'glasswindHamlet',
  honeycombHollow: 'bastionRampart', innerDimension: 'town', interdimensionalAscension: 'void',
  jadeGrove: 'jadeGrove', kelpForest: 'azureAcademia', krookThrone: 'fieryHideout', lavaCavern: 'fieryHideout',
  magmaFoundry: 'fieryHideout', magmaFoundry2: 'glasswindHamlet', mushroom: 'jadeGrove',
  octopusGrotto: 'verdantHaven', ossuarySprawl: 'glasswindHamlet', pearlBathhouse: 'azureAcademia',
  reachOfVermillion: 'reachOfVermillion', sanctum: 'azureAcademia', sauroSlope: 'fieryHideout',
  shadowWovenHood: 'shadowWovenHood', skyGarden: 'azureAcademia', slimeCave: 'bastionRampart',
  stardustAtrium: 'azureAcademia', stormCrest: 'fieryHideout', sundered_forge: 'hiddenPagoda',
  sunsetBeach: 'bastionRampart', thornspireThicket: 'verdantHaven', thunderPlateau: 'fieryHideout',
  tidalLagoon: 'bastionRampart', tidepoolShoals: 'azureAcademia', tower: 'town', tower_b1: 'town', tower_b10: 'town',
  tower_b2: 'town', tower_b3: 'town', tower_b4: 'town', tower_b5: 'town', tower_b6: 'town', tower_b7: 'town',
  tower_b8: 'town', tower_b9: 'town', town: 'town', verdantHaven: 'verdantHaven', verdantHollow: 'verdantHaven',
  void: 'void', wayfarersLantern: 'glasswindHamlet', wayfarersLantern1: 'void', wayfarersLantern2: 'void',
  wildflowerPlains: 'jadeGrove', witheringTide: 'verdantHaven', witheringTide2: 'verdantHaven', zod_aquarius: 'void',
  zod_aries: 'void', zod_cancer: 'void', zod_capricorn: 'void', zod_gemini: 'void', zod_leo: 'void',
  zod_libra: 'void', zod_pisces: 'void', zod_sagittarius: 'void', zod_scorpio: 'void', zod_taurus: 'void',
  zod_virgo: 'void', zodiacHall: 'void',
};

// ---- harness ----------------------------------------------------------------------------------------------------------
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${c ? '' : JSON.stringify(x).slice(0, 260)}`); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: ['ignore', 'ignore', 'pipe'], cwd: ROOT });
let srvErr = ''; server.stderr.on('data', (d) => { srvErr += d; });
let browser = null;
const cleanup = async () => { const b = browser; browser = null; if (b) await b.close().catch(() => {}); try { server.kill(); } catch (e) {} };
// the ceiling on the whole run: every wait below is bounded on its own, this is the net under all of them
const WATCHDOG = setTimeout(async () => {
  ok('the run finishes inside 12 minutes', false, { watchdog: '12 min' }); await cleanup(); console.log(`FAIL(${fails})`); process.exit(1);
}, 12 * 60 * 1000);
// why a walk failed ('' = it held): it must take the door, land in the destination beside the paired door back (within
// 110 px across; on a vertical tower also on that door's floor), on a surface, inside the world
const why = (w) => w.err ? w.err
  : !w.went ? 'tryPortal() took no door'
  : w.map !== w.t ? 'ended in ' + w.map
  : !(w.backs > 0) ? 'no door back to ' + w.f
  : w.dx > 110 ? `${w.dx}px from the door back (x${w.ret.x}), hero at x${w.cx}`
  : !w.pair ? `another door back is nearer than the paired one (x${w.ret.x} y${w.ret.y})`
  : (w.tower && w.dy > 100) ? `wrong floor: feet ${w.feet}, the door back is at y${w.ret.y}`
  : !w.inWorld ? `out of the world (x${w.cx}, feet ${w.feet})`
  : !(w.gnd && Math.abs(w.vy) < 1.5) ? `not standing on anything (vy ${w.vy}, onGround ${w.gnd})`
  : w.ran < 30 ? `the sim ran only ${w.ran} frames`
  : '';

// ---- in the page ------------------------------------------------------------------------------------------------------
// Installed once as window.__nm. Waits count the game's own 60 Hz step counter (game.time) under a wall-clock cap rather
// than sleeping: headless can run at ~11 fps on a loaded machine. game.time ticks even while the game is paused, so the
// waits that need physics keep the sim unpaused as they go (settle).
function installHelpers() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const H = window.__nm = { sleep };
  H.frames = async (n, each) => {
    const t0 = game.time, w0 = performance.now(), cap = 3000 + n * 150;
    while (game.time - t0 < n && performance.now() - w0 < cap) { if (each) { try { each(); } catch (e) {} } await sleep(40); }
    return game.time - t0;
  };
  // anything that would pause the sim goes: panels, dialogs, story beats, a boss intro, the Everdawn welcome
  H.unblock = () => {
    try { closeAllModals(); } catch (e) {}
    try { if (typeof closeDialog === 'function') closeDialog(); } catch (e) {}
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    const w = document.getElementById('everdawn-welcome-overlay'); if (w) w.remove();
    window._prologueActive = false; game.paused = false;
  };
  // the hero cannot be hurt or shoved, and no monster stands between the hero and a door
  H.calm = () => { player._god = true; player.invulnerable = 999999; if (Array.isArray(game.monsters)) game.monsters.length = 0; };
  H.settle = () => { H.unblock(); H.calm(); };
  H.doorY = (po) => (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x);
  // the doors on the CURRENT map that lead to dest - the runtime copies the hero touches - in x order
  H.doorsTo = (dest) => (game.portals || []).filter((q) => q && q.dest === dest).sort((a, b) => (a.x || 0) - (b.x || 0));
  H.ww = () => (game.mapData && game.mapData.worldWidth) || 2000;
  H.wh = () => (game.mapData && game.mapData.worldHeight) || 560;
  // inside the world: across it, not below its floor (worldHeight), not flung far above it
  H.inWorld = (cx, feet, top) => cx >= 0 && cx <= H.ww() && feet <= H.wh() + 2 && top > -400;
  H.allVisited = () => { game.visitedMaps = Object.fromEntries(Object.keys(MAPS).map((k) => [k, true])); };
  H.goTown = async () => { H.settle(); if (game.currentMap !== 'town') { loadMap('town'); await H.frames(10, H.settle); } H.settle(); };
  // [3] Stand on door k (x order) of src that leads to dest and press Up: the real tryPortal(), a boss-arena confirm
  // accepted by clicking its first button. Let the hero land, then read where they stand against the door back - the
  // one with the same x-order index among dest's doors to src (tryPortal's own pairing), non-retreat doors first.
  H.walk = async (src, dest, k) => {
    H.settle();
    if (!MAPS[src] || !MAPS[dest]) return { err: 'no map ' + (MAPS[src] ? dest : src) };
    loadMap(src); await H.frames(12, H.settle);
    if (game.currentMap !== src) return { err: 'loadMap(' + src + ') left the hero in ' + game.currentMap };
    const doors = H.doorsTo(dest), po = doors[k];
    if (!po) return { err: `no door #${k} at runtime (${doors.length} there)` };
    const from = { x: Math.round(po.x), y: Math.round(H.doorY(po)) };
    player.x = po.x - player.w / 2; player.y = H.doorY(po) - player.h; player.vx = 0; player.vy = 0;
    const went = tryPortal();
    if (game.currentMap === src) {
      const b = document.querySelector('#dialog-options button'), d = document.getElementById('dialog');
      if (b && d && getComputedStyle(d).display !== 'none') b.click();
    }
    player.onGround = false;   // from here on only a real physics step can set it again
    const ran = await H.frames(45, H.settle);
    const cx = player.x + player.w / 2, feet = player.y + player.h;
    const out = { went: !!went, map: game.currentMap, ran, from, cx: Math.round(cx), feet: Math.round(feet), vy: +(+player.vy || 0).toFixed(2),
      gnd: !!player.onGround, inWorld: H.inWorld(cx, feet, player.y), tower: !!(game.mapData && game.mapData.isVerticalTower) };
    if (game.currentMap !== dest) return out;
    const all = H.doorsTo(src), pri = all.filter((q) => !q._retreat), backs = pri.length ? pri : all;
    out.backs = backs.length;
    if (!backs.length) return out;
    const ret = backs[Math.min(k, backs.length - 1)], dist = (q) => Math.hypot(cx - q.x, feet - H.doorY(q));
    out.ret = { x: Math.round(ret.x), y: Math.round(H.doorY(ret)) };
    out.dx = Math.round(Math.abs(cx - ret.x)); out.dy = Math.round(Math.abs(feet - H.doorY(ret)));
    out.pair = backs.every((q) => q === ret || dist(q) > dist(ret));   // no other door back is nearer than the paired one
    return out;
  };
  // [6] The W map with every place walked (so each node is named and lit), opened and closed by toggleWorldMap().
  H.worldMap = async (ids, lanesWant, lanesGone) => {
    await H.goTown(); H.allVisited();
    try { _wmFilterMode = 'all'; } catch (e) {}   // the filter strip can hide whole groups of places
    toggleWorldMap();
    await sleep(1000);   // the 0.45 s zoom-in (0.65 s fallback) and the fit pass
    const modal = document.getElementById('worldmap-modal'), grid = document.getElementById('worldmap-grid');
    const res = { open: !!(modal && modal.style.display === 'flex'), nodes: {}, lanes: {}, gone: {}, overlaps: [], names: {}, icons: {} };
    const node = (id) => grid && grid.querySelector(`g.wm-node[data-map-id="${id}"]`);
    const lane = (a, b) => !!(grid && grid.querySelector(`path.wm-lane[data-a="${a}"][data-b="${b}"]`));
    for (const id of ids) res.nodes[id] = !!node(id);
    for (const [a, b] of lanesWant) res.lanes[a + '|' + b] = lane(a, b);
    for (const [a, b] of lanesGone) res.gone[a + '|' + b] = !lane(a, b);
    // every pair of node discs: centre distance at least 0.8 x the sum of the radii
    const discs = [...(grid ? grid.querySelectorAll('g.wm-node') : [])].map((g) => {
      const c = g.querySelector('circle.wm-disc'); if (!c) return null;
      const r = c.getBoundingClientRect();
      return (r.width > 0) ? { id: g.getAttribute('data-map-id'), x: r.left + r.width / 2, y: r.top + r.height / 2, r: (r.width + r.height) / 4 } : null;
    }).filter(Boolean);
    res.discs = discs.length;
    for (let i = 0; i < discs.length; i++) for (let j = i + 1; j < discs.length; j++) {
      const a = discs[i], b = discs[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 0.8 * (a.r + b.r)) res.overlaps.push(`${a.id}~${b.id} ${(d / (a.r + b.r)).toFixed(2)}`);
    }
    for (const id of ids) {
      const g = node(id), href = 'Sprites/world/regions/' + id + '.webp';
      const lbl = g && g.querySelector('text.wm-node-label'), want = String((MAPS[id] && MAPS[id].name) || '').split(/\s+/)[0];
      res.names[id] = !!(lbl && want && lbl.textContent.includes(want));
      const img = g && [...g.querySelectorAll('image')].find((im) => (im.getAttribute('href') || im.getAttributeNS('http://www.w3.org/1999/xlink', 'href')) === href);
      const loads = await new Promise((done) => {
        const im = new Image(), t = setTimeout(() => done(false), 8000);
        im.onload = () => { clearTimeout(t); done(im.naturalWidth > 0); }; im.onerror = () => { clearTimeout(t); done(false); };
        im.src = href;
      });
      res.icons[id] = (img ? 'drawn' : 'not drawn') + ', file ' + (loads ? 'loads' : 'does not load');
    }
    if (modal && modal.style.display === 'flex') toggleWorldMap();   // W again closes it
    res.closed = !(modal && modal.style.display === 'flex');
    H.unblock();
    return res;
  };
  // [7] The taxi, opened from town. It only drives to monster maps the hero walked lately (renderTaxi's
  // game.taxiCombatRecent), so the new maps are those. The ride is the node's own click (renderTaxi's onPick).
  H.taxi = async (ids) => {
    await H.goTown(); H.allVisited();
    game.taxiCombatRecent = ids.filter((id) => MAPS[id]);
    player.mojicoins = Math.max(player.mojicoins || 0, 1e6);   // the fare
    game.paused = false;
    openTaxi();
    await sleep(500);
    const modal = document.getElementById('taxi-modal'), grid = document.getElementById('taxi-grid');
    const res = { open: !!(modal && modal.style.display === 'flex'), nodes: {} };
    const node = (id) => grid && grid.querySelector(`g.wm-node[data-map-id="${id}"]`);
    for (const id of ids) { const g = node(id); res.nodes[id] = !g ? 'none' : (g.getAttribute('data-wm-pick') === '1') ? 'pick' : 'locked'; }
    res.to = ids.find((id) => res.nodes[id] === 'pick') || null;
    if (res.to) {
      node(res.to).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const w0 = performance.now(); while (game.currentMap !== res.to && performance.now() - w0 < 5000) await sleep(50);
      res.arrived = game.currentMap;
    }
    if (modal && modal.style.display !== 'none') { try { closeAllModals(); } catch (e) {} }
    res.closed = !(modal && modal.style.display === 'flex');
    H.unblock();
    return res;
  };
  // [8] The area card on entry names the place (the part before a ' . ' style separator, as the card splits it) and
  // shows its region icon, which must decode (a missing file is swapped for an emoji on its error event); then the minimap.
  H.areaCard = async (id) => {
    H.settle();
    if (!MAPS[id]) return { err: 'not in MAPS' };
    const el = document.getElementById('area-title');
    if (!el) return { err: 'no #area-title' };
    const nm0 = el.querySelector('.at-name'); if (nm0) nm0.textContent = '';
    game._lastAreaCard = null;   // the card skips the map it announced last
    const toks = String(MAPS[id].name || '').split(' ');
    const cut = toks.findIndex((w) => w.length === 1 && [0xB7, 0x2014, 0x2013].includes(w.charCodeAt(0)));
    const part = (cut > 0 ? toks.slice(0, cut) : toks).join(' '), want = 'Sprites/world/regions/' + id + '.webp';
    loadMap(id);
    let name = '', src = '', img = null;
    for (const w0 = performance.now(); performance.now() - w0 < 1500; await sleep(50)) {
      name = (el.querySelector('.at-name') || {}).textContent || '';
      img = el.querySelector('.at-icon img'); src = img ? (img.getAttribute('src') || '') : '';
      if (part && name.includes(part) && src.endsWith(want)) break;
    }
    for (const w1 = performance.now(); img && img.isConnected && !(img.complete && img.naturalWidth > 0) && performance.now() - w1 < 3000;) await sleep(50);
    const loaded = !!(img && img.isConnected && img.complete && img.naturalWidth > 0);
    let mini = null; try { drawMinimap(); } catch (e) { mini = String((e && e.message) || e).slice(0, 120); }
    return { map: game.currentMap, part, name, src, loaded, mini };
  };
  // [9] Three real seconds on the map: monsters spawn and stay inside the world, and so does the hero. A monster read
  // mid-fall is left to the game's own below-world rescue: only one still outside 0.4 s later counts.
  H.play = async (id, ms) => {
    H.settle();
    if (!MAPS[id]) return { err: 'not in MAPS' };
    loadMap(id);
    const spawned = (game.monsters || []).length, t0 = game.time;
    const keep = () => { H.unblock(); player._god = true; player.invulnerable = 999999; };
    const out = () => (game.monsters || []).filter((m) => m && !H.inWorld(m.x + (m.w || 0) / 2, m.y + (m.h || 0), m.y));
    for (const w0 = performance.now(); performance.now() - w0 < ms - 400; await sleep(100)) keep();
    const first = new Set(out());
    for (const w0 = performance.now(); performance.now() - w0 < 400; await sleep(100)) keep();
    const cx = player.x + player.w / 2, feet = player.y + player.h;
    return { map: game.currentMap, frames: game.time - t0, spawned, now: (game.monsters || []).length, world: [H.ww(), H.wh()],
      hero: [Math.round(cx), Math.round(feet)], heroIn: H.inWorld(cx, feet, player.y),
      outside: out().filter((m) => first.has(m)).map((m) => `${m.type}@${Math.round(m.x)},${Math.round(m.y)}`).slice(0, 5) };
  };
  return true;
}

try {
  await new Promise((r) => setTimeout(r, 1500));
  if (server.exitCode !== null) throw new Error(`serve.js exited (port ${PORT} taken?): ${srvErr.slice(0, 160)}`);
  browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof MAPS === 'object' && typeof loadMap === 'function' && typeof tryPortal === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  // every page call is bounded: a wedged page fails its check instead of hanging the run
  const ev = (fn, arg, ms = 90000) => {
    let t; const late = new Promise((_, no) => { t = setTimeout(() => no(new Error(`page call timed out (${ms} ms)`)), ms); });
    return Promise.race([page.evaluate(fn, arg), late]).finally(() => clearTimeout(t));
  };
  const safe = async (fn, arg, ms) => { try { return await ev(fn, arg, ms); } catch (e) { return { err: String((e && e.message) || e).slice(0, 160) }; } };
  await ev(installHelpers);

  // [0] into the world: overlays down, the boot gate open, no prologue, a Lv 60 hero (over every gate on these roads,
  // the Sky Garden's Lv 15 one included) in god mode, every story beat already seen, the sim running in Everdawn Central
  const boot = await safe(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    window._prologueActive = false; window._lxBootGateDone = true;
    if (!player.cls) player.cls = 'warrior';   // the W map and the taxi refuse a hero with no class
    player.level = 60; player._god = true; player.invulnerable = 999999;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true, tutorial_intro: true });
    try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    loadMap('town');
    const frames = await __nm.frames(30, __nm.settle);
    return { map: game.currentMap, frames, paused: game.paused };
  }, undefined, 60000);
  ok('[0] the game boots into Everdawn Central and its loop steps', boot.map === 'town' && boot.frames >= 30, boot);

  // the map data, read once: the new maps, the door counts, the walking graph and the two baselines' live values
  const data = await ev(({ NEW, LINKS, REMOVED, FP, SC, IDS }) => {
    const doors = (a, b) => ((MAPS[a] && MAPS[a].portals) || []).filter((p) => p && p.dest === b);
    const maps = {};
    for (const id of NEW) {
      const m = MAPS[id];
      if (!m) { maps[id] = null; continue; }
      const types = (m.spawns || []).map((s) => s && s.type);
      maps[id] = { name: m.name || null, bg: m.bg || null, bgImage: !!(m.bg && typeof BG_IMAGES !== 'undefined' && BG_IMAGES[m.bg]), spawns: types.length,
        unknownMonsters: types.filter((t) => !t || !monsterTypes[t]), fixedLayout: m.fixedLayout === true, bridge: m.bridge === true, wmX: m.wmX, wmY: m.wmY };
    }
    const links = LINKS.map(([a, b, n]) => ({ a, b, n, ab: doors(a, b).length, ba: doors(b, a).length }));
    const removed = REMOVED.map(([a, b]) => ({ a, b, ab: doors(a, b).length, ba: doors(b, a).length }));
    // [4] breadth-first over every door from Everdawn Central
    const seen = new Set(['town']), q = ['town'];
    while (q.length) { const id = q.shift(); for (const p of ((MAPS[id] && MAPS[id].portals) || [])) if (p && p.dest && MAPS[p.dest] && !seen.has(p.dest)) { seen.add(p.dest); q.push(p.dest); } }
    // [5] the game's own answers, from a cold cache (it is built once per session)
    try { _MAP_TOWN_DISTANCE_CACHE = null; } catch (e) {}
    const dist = {}, near = {};
    for (const id of IDS) {
      dist[id] = !MAPS[id] ? 'gone' : (typeof _townDistance === 'function') ? _townDistance(id) : 'no _townDistance';
      near[id] = !MAPS[id] ? 'gone' : (typeof _nearestTownId === 'function') ? _nearestTownId(id) : 'no _nearestTownId';
    }
    // [3] every door that touches a new map, as [src, dest, how many]
    const touch = [];
    for (const src of Object.keys(MAPS)) {
      const by = {};
      for (const p of (MAPS[src].portals || [])) if (p && p.dest && (NEW.includes(src) || NEW.includes(p.dest))) by[p.dest] = (by[p.dest] || 0) + 1;
      for (const d of Object.keys(by)) touch.push([src, d, by[d]]);
    }
    const fp = doors(FP, SC).map((p) => ({ x: p.x, y: p.y })).sort((a, b) => a.x - b.x);
    return { maps, links, removed, reachable: [...seen], dist, near, touch, fp };
  }, { NEW, LINKS, REMOVED, FP, SC, IDS: Object.keys(BASELINE_DIST) });

  // [1] each new map is a real, finished map
  for (const id of NEW) {
    const m = data.maps[id];
    const good = !!m && !!m.name && m.bgImage && m.spawns > 0 && m.unknownMonsters.length === 0 && m.fixedLayout && m.bridge
      && typeof m.wmX === 'number' && typeof m.wmY === 'number' && isFinite(m.wmX) && isFinite(m.wmY);
    ok(`[1] ${id}: a name, a BG_IMAGES backdrop, known monsters, fixedLayout, bridge, a world-map pin`, good, m || { missing: 'not in MAPS' });
  }
  // [2] the graph: the new links, both ways (Frozen Peak <-> Starfall Crossing: exactly two doors each way), and the
  // replaced direct links gone, both ways
  const badLinks = data.links.filter((l) => l.ab < 1 || l.ba < 1 || (l.n && (l.ab !== l.n || l.ba !== l.n)))
    .map((l) => `${l.a}->${l.b} x${l.ab}, ${l.b}->${l.a} x${l.ba}${l.n ? ' (want ' + l.n + ')' : ''}`);
  ok(`[2] every new link has a door both ways (${FP} <-> ${SC}: exactly 2 each way)`, badLinks.length === 0, badLinks);
  const survivors = data.removed.filter((l) => l.ab || l.ba).map((l) => `${l.a}->${l.b} x${l.ab}, ${l.b}->${l.a} x${l.ba}`);
  ok('[2] every direct link a new map replaces is gone, both ways', survivors.length === 0, survivors);

  // [3] WALK EVERY DOOR, BOTH WAYS. One line per pair of maps: every link in the spec (a missing door fails it) and any
  // other door a new map has, or that leads to one. Each door is walked on its own, by its x-order index.
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const groups = new Map();
  for (const [a, b] of LINKS) groups.set(pairKey(a, b), { a, b, listed: true, dirs: { [a + '>' + b]: 0, [b + '>' + a]: 0 } });
  for (const [s, d, c] of data.touch) {
    const k = pairKey(s, d);
    if (!groups.has(k)) groups.set(k, { a: s, b: d, listed: false, dirs: { [s + '>' + d]: 0, [d + '>' + s]: 0 } });
    groups.get(k).dirs[s + '>' + d] = c;
  }
  const walks = [];
  for (const g of groups.values()) {
    const bad = [];
    for (const [dir, count] of Object.entries(g.dirs)) {
      const [s, d] = dir.split('>');
      if (!count) { bad.push(`${s}->${d}: no door`); continue; }
      for (let k = 0; k < count; k++) {
        const w = await safe(([s, d, k]) => __nm.walk(s, d, k), [s, d, k], 120000);
        Object.assign(w, { f: s, t: d, k }); walks.push(w);
        const y = why(w); if (y) bad.push(`${s}->${d}#${k}: ${y}`);
      }
    }
    ok(`[3] walk ${g.a} <-> ${g.b}: every door, both ways, lands beside its paired door on solid ground${g.listed ? '' : ' (a door the spec does not list)'}`, bad.length === 0, bad);
  }
  // Frozen Peak: in x order its first door (floor 50) pairs with Starfall Crossing's lower-x door back and its second (the
  // summit) with the higher-x one, whichever way you walk. The walks above hold the landings; this reads them as pairs.
  {
    const bad = [], fp = data.fp, at = (p, q) => Math.abs(p.x - q.x) <= 40 && Math.abs(p.y - q.y) <= 60;
    if (fp.length !== 2) bad.push(`${FP} has ${fp.length} doors to ${SC} (want 2)`);
    else if (!at(fp[0], FP_DOORS[0]) || !at(fp[1], FP_DOORS[1])) bad.push(`${FP}'s doors in x order: ${JSON.stringify(fp)}, want floor 50 (x300 y10570) then the summit (x400 y70)`);
    else {
      for (const [f, t, k, what] of [[FP, SC, 0, 'floor 50 -> the lower-x door'], [FP, SC, 1, 'the summit -> the higher-x door'],
        [SC, FP, 0, 'the lower-x door -> floor 50'], [SC, FP, 1, 'the higher-x door -> the summit']]) {
        const w = walks.find((q) => q.f === f && q.t === t && q.k === k);
        if (!w) bad.push(`${what}: not walked`);
        else if (why(w) || !w.pair || (t === FP && !(w.dy <= 100))) bad.push(`${what}: ${why(w) || 'landed by the other door'}`);
      }
    }
    ok(`[3] ${FP}'s floor-50 door pairs with ${SC}'s lower-x door and its summit door with the higher-x one, both ways`, bad.length === 0, bad);
  }

  // [4] reachability: walking from Everdawn Central reaches the five and everything it reached before
  const reach = new Set(data.reachable);
  const lost = [...BASELINE_REACHABLE, ...NEW].filter((id) => !reach.has(id) && id !== 'sanctum');   // v0.30.1647: the Sanctum opens from the Last Step only once she falls (per user); a boss arena, so the distance curve never applies there
  ok(`[4] walking from Everdawn Central reaches all ${NEW.length} new maps and all ${BASELINE_REACHABLE.length} maps it reached before`, lost.length === 0, { unreachable: lost });
  // [5] no monster buff from the rewire: every old map is as many hops from town as before (stepping OUT of a bridge
  // costs nothing), and a death there respawns the hero in the same town
  const moved = Object.keys(BASELINE_DIST).filter((id) => id !== 'sanctum' && data.dist[id] !== BASELINE_DIST[id]).map((id) => `${id} ${BASELINE_DIST[id]}->${data.dist[id]}`);
  ok('[5] every old map keeps its _townDistance (the new maps are 0-hop bridges: no monster buff)', moved.length === 0, moved);
  const rehomed = Object.keys(BASELINE_NEAREST_TOWN).filter((id) => id !== 'sanctum' && data.near[id] !== BASELINE_NEAREST_TOWN[id]).map((id) => `${id} ${BASELINE_NEAREST_TOWN[id]}->${data.near[id]}`);
  ok('[5] every old map keeps its _nearestTownId (the town a death respawns you in)', rehomed.length === 0, rehomed);

  // [6] the world map (W). Lanes are keyed by their two map ids sorted with JS '<' (data-a < data-b).
  const sorted = ([a, b]) => (a < b ? [a, b] : [b, a]);
  const wm = await safe((a) => __nm.worldMap(...a), [NEW, LINKS.map(sorted), REMOVED.map(sorted)], 120000);
  const wmOpen = !wm.err && wm.open && wm.closed;
  ok('[6] the world map opens with W and closes with W', wmOpen, wm.err ? wm : { open: wm.open, closed: wm.closed });
  const noNode = NEW.filter((id) => !(wm.nodes && wm.nodes[id]));
  ok('[6] the world map has a node for each new map', wmOpen && noNode.length === 0, { missing: noNode });
  const noLane = Object.keys(wm.lanes || {}).filter((k) => !wm.lanes[k]);
  ok('[6] the world map draws a lane for every new link', wmOpen && noLane.length === 0, { missing: noLane });
  const oldLane = Object.keys(wm.gone || {}).filter((k) => !wm.gone[k]);
  ok('[6] the world map draws no lane for a replaced direct link', wmOpen && oldLane.length === 0, { still: oldLane });
  ok('[6] no two world-map node discs overlap (centres >= 0.8 x the sum of the radii)', wmOpen && wm.discs > 0 && wm.overlaps.length === 0, { discs: wm.discs, overlaps: wm.overlaps });
  const noName = NEW.filter((id) => !(wm.names && wm.names[id]));
  ok("[6] each new node, once visited, shows its map's name", wmOpen && noName.length === 0, { unnamed: noName });
  const badIcon = NEW.filter((id) => !(wm.icons && wm.icons[id] === 'drawn, file loads')).map((id) => `${id}: ${(wm.icons && wm.icons[id]) || 'no node'}`);
  ok('[6] each new node wears its region icon, Sprites/world/regions/<id>.webp, and the file loads', wmOpen && badIcon.length === 0, badIcon);

  // [7] the taxi lists every new map as a destination, and drives to one
  const tx = await safe((ids) => __nm.taxi(ids), NEW, 60000);
  const notOffered = NEW.filter((id) => !(tx.nodes && tx.nodes[id] === 'pick')).map((id) => `${id}: ${(tx.nodes && tx.nodes[id]) || '?'}`);
  ok('[7] the taxi offers every new map as a ride', !tx.err && tx.open && notOffered.length === 0, tx.err ? tx : { open: tx.open, notOffered });
  ok('[7] the taxi drives to a new map and closes behind the hero', !tx.err && !!tx.to && tx.arrived === tx.to && tx.closed, tx.err ? tx : { to: tx.to, arrived: tx.arrived, closed: tx.closed });

  // [8] the area card and the minimap, on entering each new map
  for (const id of NEW) {
    const r = await safe((id) => __nm.areaCard(id), id, 30000);
    const good = !r.err && r.map === id && !!r.part && r.name.includes(r.part) && r.src.endsWith(`Sprites/world/regions/${id}.webp`) && r.loaded && r.mini === null;
    ok(`[8] ${id}: the area card names it and shows its region icon, and drawMinimap() does not throw`, good, r);
  }

  // [9] each new map plays for 3 s of real time
  for (const id of NEW) {
    const e0 = errs.length;
    const r = await safe((a) => __nm.play(...a), [id, 3000], 30000);
    r.errors = errs.slice(e0, e0 + 2);
    const good = !r.err && r.map === id && r.frames >= 20 && r.spawned > 0 && r.now > 0 && r.heroIn && r.outside.length === 0 && errs.length === e0;
    ok(`[9] ${id} plays for 3 s: monsters spawn and stay inside the world, the hero stays in it, no page errors`, good, r);
  }

  // [10]
  ok('[10] no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) {
  ok('the harness runs to the end', false, String((e && e.message) || e).slice(0, 200));
} finally { clearTimeout(WATCHDOG); await cleanup(); }
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
