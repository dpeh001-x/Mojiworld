// TOWN LANDMARKS (v0.30.1510, per user: "redesign some of the towns to make them all look unique and special", then "add further more
// objects and rework the locations with no monsters - the frozen tower, the interdimensional tower and the zodiac region", then "the
// zodiac rooms can be even more grand"). Nine maps get curated ludo.ai set pieces, and three maps with no monsters get code-drawn
// ones (_lxSetPieces: a gate, statue and constellation for every Zodiac Sanctum portal and a hanging armillary sphere; icicles and
// floor markers on Frozen Peak; underglow, motes and rift rings on the Interdimensional Ascension). Pins:
//   ART      every new sprite is registered, has a bounds row, and loads (the zod_* art loads with the Sanctum: _LX_SP_ART)
//   PLACED   each placement of the nine maps stands on the ground or a ledge (within 2 px), inside it, and its drawn box touches
//            no other platform (props paint over slabs)
//   GLOW     every glow row carries colour, radius, strength and height
//   SANCTUM  a gate is minted for every portal, the 12 signs each have a statue and a constellation, and a frame draws cleanly
//   TOWERS   a frame of each tower draws cleanly at the base, mid-tower and the summit (no error kept by _lxSetPieces)
//   node scripts/town_landmarks_test.mjs      (PORT / MOJI_GAME_FILE override the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '11610'; const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const MAPS_UNDER_TEST = ['glasswindHamlet', 'fieryHideout', 'verdantHaven', 'hiddenPagoda', 'reachOfVermillion', 'jadeGrove', 'frozenPeak', 'interdimensionalAscension', 'azureAbode'];
const NEW_KEYS = ['frost_shard_obelisk', 'frost_street_lamp', 'frost_snowman', 'frost_shard_cart', 'fiery_forge_furnace', 'fiery_ember_cauldron', 'fiery_coal_cart', 'bloom_glow_mushroom', 'bloom_potion_stall', 'bloom_stump_tea',
  'pagoda_gong', 'pagoda_training_dummy', 'pagoda_bonsai', 'vermillion_war_drum', 'vermillion_arrow_barrel', 'vermillion_banner_pole', 'jade_rowboat', 'jade_stone_locks', 'jade_bamboo_fountain',
  'peak_base_tent', 'peak_supply_sled', 'peak_prayer_flags', 'peak_summit_shrine', 'ascend_void_altar', 'ascend_waystone', 'abode_crystal_ball', 'abode_book_stack', 'abode_telescope'];
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const ZOD_KEYS = ['zod_hanging_astrolabe', 'zod_crest_ascend', 'zod_crest_stair', ...SIGNS.map((s) => 'zod_statue_' + s)];
let bad = 0; const check = (ok, what, info) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// ART, from the files
check([...NEW_KEYS, ...ZOD_KEYS].every((k) => existsSync(path.join(ROOT, 'Sprites', 'objects', k + '.webp'))), 'all 43 new sprites are on disk', [...NEW_KEYS, ...ZOD_KEYS].filter((k) => !existsSync(path.join(ROOT, 'Sprites', 'objects', k + '.webp'))));
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS !== 'undefined' && typeof _lxSetPieces === 'function', null, { timeout: 150000 });
const r = await p.evaluate(async ({ MAPS_UNDER_TEST, NEW_KEYS, ZOD_KEYS, SIGNS }) => {
  for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
  window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 90; player.invulnerable = 999999;
  window._perfLowFx = () => false; window._perfVeryLowFx = () => false;
  try { for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true; } catch (e) {}
  (player._storyBeatsSeen = player._storyBeatsSeen || {}).everdawn_welcome = true;
  const s = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { placed: [], glow: [], loadFail: [], reg: [], bbox: [], towers: {}, sanctum: {} };
  const loaded = async (id, extra) => {
    try { _lxArt2WantMap(id, true); } catch (e) {}
    const t0 = performance.now();
    while (performance.now() - t0 < 60000) {
      const ks = [...(MAP_PROPS[id] || []).map((q) => q.key), ...(extra || [])];
      if (ks.every((k) => { const im = LX_OBJECTS[k]; return im && im.complete && im.naturalWidth; })) return true;
      await s(300);
    }
    return false;
  };
  for (const k of [...NEW_KEYS, ...ZOD_KEYS]) { if (!LX_OBJECTS_FILES.includes(k)) out.reg.push(k); if (!(window.LX_SPRITE_BBOX && LX_SPRITE_BBOX['objects/' + k + '.webp'])) out.bbox.push(k); }
  loadMap('town'); await s(2500);
  for (const id of MAPS_UNDER_TEST) {
    game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[id] = true; loadMap(id); await s(2200);
    if (!(await loaded(id))) out.loadFail.push(id);
    const m = game.mapData, plats = m.platforms;
    for (const pr of (MAP_PROPS[id] || [])) {
      if (pr.glow) { const g = pr.glow; if (!(typeof g.c === 'string' && g.r > 0 && g.a > 0 && g.a <= 1 && g.y >= 0 && g.y <= 1)) out.glow.push(id + ':' + pr.key); }
      if (!/^(frost_|fiery_|bloom_|pagoda_|vermillion_|jade_|peak_|ascend_|abode_)/.test(pr.key)) continue;   // only this pass's own placements
      const img = LX_OBJECTS[pr.key]; if (!(img && img.naturalWidth)) continue;
      const meta = LX_OBJECTS_META[pr.key] || { bboxTopY: 0, bboxBottomY: img.naturalHeight - 1 };
      const f = Math.max(0.7, Math.min(1.4, Math.max(img.naturalWidth, img.naturalHeight) / 512)), h = 80 * (pr.scale || 1) * f, w = h * img.naturalWidth / img.naturalHeight;
      const vis = h * ((meta.bboxBottomY - meta.bboxTopY + 1) / img.naturalHeight), left = pr.x - w / 2, right = pr.x + w / 2, top = pr.y - vis;
      const under = plats.filter((q) => Math.abs(q.y - pr.y) <= 2 && pr.x >= q.x && pr.x <= q.x + q.w);
      const hit = plats.filter((q) => !under.includes(q) && q.x < right && q.x + q.w > left && q.y < pr.y - 3 && q.y + (q.h || 12) > top + 3);
      const cover = hit.map((q) => { const ox = Math.min(right, q.x + q.w) - Math.max(left, q.x), oy = Math.min(pr.y, q.y + (q.h || 12)) - Math.max(top, q.y); return { at: q.x + ',' + q.y, r: +(Math.max(0, ox) * Math.max(0, oy) / (w * vis)).toFixed(3), ox: Math.round(ox), oy: Math.round(oy) }; });
      out.placed.push({ id, key: pr.key, stands: under.length > 0, hit: hit.map((q) => q.x + ',' + q.y), cover });
    }
  }
  // the Sanctum: art loads with the map, a gate per portal, a statue and a constellation per sign, a clean frame
  game.visitedMaps.zodiacHall = true; loadMap('zodiacHall'); await s(2200);
  out.sanctum.artLoaded = await loaded('zodiacHall', ZOD_KEYS);
  player.x = 1100; game.paused = false; await s(1200);
  const portals = game.mapData.portals; let gates = 0, withArt = 0, withCons = 0;
  for (const po of portals) { const gt = _lxZodGateFor(po); if (gt) { gates++; if (gt.g.art && LX_OBJECTS[gt.g.art] && LX_OBJECTS[gt.g.art].naturalWidth) withArt++; if (gt.cons) withCons++; } }
  out.sanctum.portals = portals.length; out.sanctum.gates = gates; out.sanctum.withArt = withArt; out.sanctum.withCons = withCons; out.sanctum.err = _LX_SP.err ? String(_LX_SP.err) : null;
  out.sanctum.signsHaveStars = SIGNS.every((sg) => typeof _LX_ZOD_STARS !== 'undefined' && _LX_ZOD_STARS[sg] && _LX_ZOD_STARS[sg].s.length > 2);
  // the towers at the base, mid-tower and the summit
  for (const id of ['frozenPeak', 'interdimensionalAscension']) {
    game.visitedMaps[id] = true; loadMap(id); await s(2200); await loaded(id); _LX_SP.err = null; out.towers[id] = [];
    for (const ty of [14070, 7070, 70]) {
      const pl = game.mapData.platforms.reduce((a, q) => Math.abs(q.y - ty) < Math.abs(a.y - ty) ? q : a);
      player.x = pl.x + pl.w / 2; player.y = pl.y - 50; player.vx = 0; player.vy = 0; game.paused = false; await s(1200);
      out.towers[id].push({ y: ty, err: _LX_SP.err ? String(_LX_SP.err) : null });
    }
    out.towers[id].push({ ice: Object.keys(_LX_SP.ice).length });
  }
  return out;
}, { MAPS_UNDER_TEST, NEW_KEYS, ZOD_KEYS, SIGNS });
check(r.reg.length === 0, 'every new sprite is registered in LX_OBJECTS_FILES', r.reg);
check(r.bbox.length === 0, 'every new sprite has a bounds row', r.bbox);
check(r.loadFail.length === 0, 'each of the nine maps loads all of its prop art', r.loadFail);
check(r.placed.length >= 28, `the nine maps carry their ${r.placed.length} new placements`, r.placed.length);
check(r.placed.every((q) => q.stands), 'every placement stands on the ground or a ledge', r.placed.filter((q) => !q.stands).map((q) => q.id + ':' + q.key));
check(r.placed.every((q) => q.hit.length === 0), 'no placement draws through another platform', r.placed.filter((q) => q.hit.length).map((q) => q.id + ':' + q.key + ' x ' + q.hit.join(' ')));
check(r.glow.length === 0, 'every glow row has colour, radius, strength and height', r.glow);
check(r.sanctum.artLoaded === true, 'the Sanctum loads its statues and ornament with the map (_LX_SP_ART)', r.sanctum);
check(r.sanctum.gates === r.sanctum.portals && r.sanctum.portals >= 13, 'a gate is minted for every portal', r.sanctum);
check(r.sanctum.withArt === r.sanctum.gates && r.sanctum.withCons === SIGNS.length, 'every gate has its statue; the 12 signs each have a constellation', r.sanctum);
check(r.sanctum.signsHaveStars && !r.sanctum.err, 'the Sanctum draws a frame with no error', r.sanctum);
for (const id of ['frozenPeak', 'interdimensionalAscension']) check(r.towers[id].slice(0, 3).every((q) => !q.err), `${id} draws cleanly at the base, mid-tower and the summit`, r.towers[id]);
check((r.towers.frozenPeak.slice(-1)[0].ice || 0) > 0, 'Frozen Peak minted its icicle strips', r.towers.frozenPeak);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `${bad} FAILED` : 'all passed');
await browser.close(); srv.kill(); process.exit(bad ? 1 : 0);
