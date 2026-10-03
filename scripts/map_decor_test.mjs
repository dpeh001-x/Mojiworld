// Hunting-map decor (per user: "sparsely but strategically put the props"). In the running game, after each map's load-time
// platform relayout, for every map in DECOR_MAPS:
//   - SPARSE: one to five props, 500+ px apart (one to three until the bland-maps pass gave the blandest maps a landmark on each long
//     empty stretch)
//   - FLOOR: each stands on a ground platform (its y within 2 px of the ground top, 72+ px inside the segment's ends) and its
//     visible bottom row draws on that line (the bbox anchor drawWorldProps uses)
//   - CLEAR: 110+ px from a door, 150+ px from an NPC or a launch pad, 100+ px from a pothole's rim, and its drawn box touches no
//     other platform (props paint over slabs)
//   - LOW: no prop draws taller than 85 px. Maps re-roll their platforms on every load (height jitter, layout variants, and on half
//     the loads a surprise platform whose underside is never lower than y 391, 89 px above the floor): the spots were chosen clear in
//     ten sampled loads plus every variant, and the cap keeps any prop under the lowest surprise platform
//   - ART: every key is registered and its image loads; the new art is a 768 canvas with its floor row at 766 and 24 px of side margin
//   Cadet's Strand (a bridge map, dressed by an earlier pass) has only the bland-maps sandcastle checked by the per-prop rules.
//   node scripts/map_decor_test.mjs          (PORT / MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const sharp = require('sharp');
const PORT = Number(process.env.PORT || 10233); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const DECOR_MAPS = ['ancient', 'forest', 'cryptHollow', 'wildflowerPlains', 'mushroom', 'verdantHollow', 'bloomhaven', 'thornspireThicket', 'gloomsporeVerge',
  'coralReef', 'kelpForest', 'abyssalTrench', 'bubbleGrotto', 'pearlBathhouse', 'witheringTide', 'witheringTide2', 'sunsetBeach', 'lavaCavern',
  'magmaFoundry', 'magmaFoundry2', 'sauroSlope', 'frostbiteHollow', 'glasswindSteppe', 'glasswindSteppe2', 'boneGraveyard', 'boneGraveyard2',
  'boneGraveyard3', 'hollowSepulchre', 'hollowSepulchre2', 'ossuarySprawl', 'candyCanyon', 'bubblegumSwamp', 'skyGarden', 'thunderPlateau',
  'stormCrest', 'graniteBluffs', 'stardustAtrium', 'duneSands', 'wayfarersLantern', 'wayfarersLantern1', 'wayfarersLantern2',
  'tidepoolShoals',   // bland-maps 5
  'fracturedReflection', 'distortedThreshold'];   // bland-maps 3: the Distorted Portal
const NEW_ART = ['forest_mossy_stump', 'forest_hollow_log', 'fungal_glowcap_cluster', 'jungle_glowbloom', 'jungle_vine_ruin', 'reef_amphora', 'wreck_anchor',
  'wreck_ship_wheel', 'foundry_ore_cart', 'sauro_egg_nest', 'ice_crystal_cluster', 'ice_frozen_sled', 'grave_tombstone', 'grave_iron_lantern',
  'candy_lollipop', 'candy_gumdrop_pile', 'storm_lightning_rod', 'atrium_marble_urn', 'bluff_stone_cairn', 'desert_cactus', 'temple_stone_lantern',
  // bland-maps
  'bluff_windswept_pine', 'bluff_pickaxe_boulder', 'glasswind_chime_post', 'steppe_snowy_pine', 'atrium_armillary', 'atrium_star_brazier',
  'grave_candle_altar', 'beach_sandcastle', 'catacomb_bone_urn',
  // bland-maps 3
  'rift_cracked_mirror', 'rift_stone_lantern', 'rift_withered_pine'];
const EXTRA_MAPS = ['cadetsStrand'], EXTRA_KEYS = new Set(['beach_sandcastle']);
// the props this pass placed (the new art + eight existing props reused); older placements on these maps (Emerald Thicket's signpost,
// a Prop Editor hardbake) are the user's and are only counted, not checked
const DECOR_KEYS = new Set([...NEW_ART, 'coral_brain', 'pearl_clamshell_bench', 'tidepool_starfish_pile', 'lava_crystal_cluster', 'forge_anvil_iron', 'glasswind_weather_vane', 'crypt_skull_pillar', 'town_stone_planter',
  'celestial_arcane_glyph_stone', 'crypt_sarcophagus_cracked', 'well_stone', 'crate_stack']);   // bland-maps reuses the glyph stone in the Stardust
  // Atrium; bland-maps 2 the sarcophagus, the well and the crates (and its short pieces under the ledges are held to the same rules)
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
// ART, from the files
{ const bad = [];
  for (const k of NEW_ART) {
    try { const f = path.join(SERVE_ROOT, 'Sprites', 'objects', k + '.webp'); const m = await sharp(f).metadata(); const { info } = await sharp(f).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
      const L = -info.trimOffsetLeft, T = -info.trimOffsetTop, B = T + info.height - 1, R = L + info.width - 1;
      if (m.width !== 768 || m.height !== 768 || Math.abs(B - 766) > 2 || L < 24 || R > 743) bad.push(`${k} ${m.width}x${m.height} L${L} R${R} B${B}`);
    } catch (e) { bad.push(k + ' ' + e.message.slice(0, 40)); }
  }
  ok(`the ${NEW_ART.length} new props are 768 canvases, floor row 766, 24 px side margins`, !bad.length, bad.slice(0, 4).join(' | ')); }
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = []; let page = null;
// a fresh page every 10 maps, one evaluate per map: loading all 41 maps in one evaluate crashed the renderer
const boot = async () => { if (page) await page.close(); page = await browser.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAP_PROPS === 'object' && typeof LX_OBJECTS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(4000); };
try {
  const R = {};
  const RL = {};   // map -> [rows per load]
  const ALL = [...DECOR_MAPS, ...EXTRA_MAPS];
  for (let i = 0; i < ALL.length; i++) { if (i % 10 === 0) await boot(); for (let L = 0; L < 3; L++) { const one = await page.evaluate(async (maps) => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    window._lxBootGateDone = true; window._prologueActive = false; player._god = true; player.invulnerable = 9e9; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    const load = (im) => new Promise((res) => { if (im.complete && im.naturalWidth) return res(true); const t = setTimeout(() => res(false), 20000); im.addEventListener('load', () => { clearTimeout(t); res(true); }); im.addEventListener('error', () => { clearTimeout(t); res(false); }); });
    const out = {};
    for (const id of maps) {
      loadMap(id, 200); await new Promise((r) => setTimeout(r, 200));
      const md = game.mapData, pl = md.platforms || [], list = MAP_PROPS[id] || [], rows = [];
      for (const p of list) {
        const im = LX_OBJECTS[p.key]; const loaded = !!im && await load(im);
        if (!loaded) { rows.push({ key: p.key, x: p.x, loaded: false, hang: p.anchor === 'hang' }); continue; }
        const f = Math.max(0.7, Math.min(1.4, Math.max(im.naturalWidth, im.naturalHeight) / 512)), h = 80 * (p.scale || 1) * f, w = h * im.naturalWidth / im.naturalHeight;
        const top = _detectSpriteBboxTop(im), bot = _detectSpriteBboxBottom(im), sy = p.y - h * ((bot + 1) / im.naturalHeight) + 1;
        const box = { x0: p.x - w / 2, x1: p.x + w / 2, y0: sy + h * (top / im.naturalHeight), y1: p.y };
        const g = pl.filter((q) => q.type === 'ground' && p.x >= q.x + 72 && p.x <= q.x + q.w - 72 && Math.abs(q.y - p.y) <= 2);
        const hits = pl.filter((q) => q.type !== 'ground' && q.x < box.x1 - 6 && q.x + q.w > box.x0 + 6 && q.y < box.y1 - 2 && q.y + (q.h || 12) > box.y0).map((q) => `${q.x},${q.y}`);
        const door = Math.min(9999, ...(md.portals || []).map((d) => Math.abs(d.x + (d.w || 0) / 2 - p.x)));
        const npc = Math.min(9999, ...(md.npcs || []).map((n) => Math.abs(n.x - p.x)), ...(md.launchPads || []).map((l) => Math.abs(l.x + (l.w || 0) / 2 - p.x)));
        const pit = Math.min(9999, ...(md.potholes || []).map((h) => Math.abs(h.x + (h.w || 0) / 2 - p.x) - (h.w || 0) / 2));
        if (p.anchor === 'hang') { rows.push({ key: p.key, x: p.x, loaded: true, hang: true }); continue; }   // ledge dressing (distorted_dressing_test)
        rows.push({ key: p.key, x: p.x, loaded: true, ground: g.length > 0, hits, door: Math.round(door), npc: Math.round(npc), pit: Math.round(pit), drawnBottom: Math.round(sy + h * ((bot + 1) / im.naturalHeight) - 1) - p.y, ch: Math.round(h * (bot - top + 1) / im.naturalHeight) });
      }
      out[id] = rows;
    }
    return out;
  }, [ALL[i]]); (RL[ALL[i]] = RL[ALL[i]] || []).push(one[ALL[i]]); } R[ALL[i]] = RL[ALL[i]][0]; }
  for (const id of DECOR_MAPS) {
    const rows = (R[id] || []).filter((r) => !r.hang), xs = rows.map((r) => r.x).sort((a, b) => a - b), gaps = xs.slice(1).map((x, i) => x - xs[i]);
    ok(`${id}: ${rows.length} prop(s), sparse (1-5, 500+ px apart)`, rows.length >= 1 && rows.length <= 5 && gaps.every((g) => g >= 500), xs.join(','));
    const bad = (RL[id] || []).flat().filter((r) => DECOR_KEYS.has(r.key) && (!r.loaded || !r.ground || r.hits.length || r.door < 110 || r.npc < 150 || r.pit < 100 || r.ch > 86 || Math.abs(r.drawnBottom) > 2));
    ok(`${id}: every prop loads, stands on the floor, clear of doors, NPCs, pads, pits and platforms in 3 re-rolled layouts, 85 px max`, !bad.length, JSON.stringify(bad).slice(0, 300));
  }
  for (const id of EXTRA_MAPS) {
    const rows = (RL[id] || []).flat().filter((r) => EXTRA_KEYS.has(r.key));
    const bad = rows.filter((r) => !r.loaded || !r.ground || r.hits.length || r.door < 110 || r.npc < 150 || r.pit < 100 || r.ch > 86 || Math.abs(r.drawnBottom) > 2);
    ok(`${id}: the bland-maps prop loads, stands on the floor, clear of doors, NPCs, pads, pits and platforms in 3 re-rolled layouts, 85 px max`, rows.length === 3 && !bad.length, JSON.stringify(bad).slice(0, 300));
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
