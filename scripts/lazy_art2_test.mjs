// Monster, NPC, tile and prop art loads for the map you are on and its portal neighbours (v0.30.x lazy-art2).
//   node scripts/lazy_art2_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Pre-launch audits 2026-09-26 (asset #2, perf #2), second half of lazy-art: with boss frames and far backdrops lazy the
// title came after ~60 MB, but ~250 MB still streamed right behind it - every monster sheet, every NPC sheet, every tile
// (twice) and every prop - and in play the world streamer walked every map and every monster type. Part A boots a fresh
// profile to the title and logs every request for 20 s; part B plays: the streamer's reach, twelve maps entered cold, a
// monster from another map summoned and one pushed in without spawnMonster, and the dex portraits.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11345';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
// origin cd2639d9 (v0.30.1203, lazy-art on it), this harness: title + 20 s = 1,334 files / 252.9 MB (title after 244 / 62.4 MB)
const LA_FILES = 1334, LA_MB = 252.9;
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// files the (possibly stale) working copy lacks are served from origin/main, like the font route
const MISSING = new Set();
try { for (const f of execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main'], { cwd: ROOT, maxBuffer: 1 << 26 }).toString().split('\n')) if (f && !existsSync(path.join(ROOT, f))) MISSING.add(f); } catch (e) {}
const routes = (p) => p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname) || MISSING.has(decodeURIComponent(u.pathname).replace(/^[/]/, '')), async (r) => {
  const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
  if (existsSync(path.join(ROOT, rel))) return r.continue();
  try { r.fulfill({ status: 200, contentType: /\.woff2$/.test(rel) ? 'font/woff2' : undefined, body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 }) }); } catch (e) { r.continue(); }
});
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
try {
  // ---- A: a cold boot (fresh profile, no cache) to the title, then 20 s on it -------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push('A ' + String(e).slice(0, 160)));
    const reqs = []; p.on('requestfinished', async (r) => { const t = Date.now(); let n = 0; try { n = (await r.sizes()).responseBodySize; } catch (e) {} reqs.push({ u: decodeURIComponent(new URL(r.url()).pathname), t, n }); });
    await routes(p);
    const t0 = Date.now();
    await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p.waitForFunction(() => { const o = document.getElementById('loading-overlay'), m = document.getElementById('lo-menu'); return !!(o && o.classList.contains('menu-up') && m && m.offsetParent !== null); }, null, { timeout: 180000, polling: 100 });
    const tTitle = Date.now();
    await p.waitForTimeout(20000);
    // the map-tied files a fresh player may have fetched by now: the start map's (the Void) and its portal neighbour's
    // (Everdawn Central), the title's own town gate (BAZAAR: the town NPCs, the grass tiles, the central floor) and the
    // props that stay eager (chests, potholes, launch pads, the zodiac pillar)
    const allow = await p.evaluate(() => {
      const start = 'void', maps = [start].concat((MAPS[start].portals || []).map((q) => q.dest).filter((d) => MAPS[d]));
      const files = new Set(), themes = new Set(), mons = new Set(); const add = (x) => { if (x) files.add('/' + x); };
      for (const id of maps) {
        const md = MAPS[id]; const cm = game.currentMap; try { game.currentMap = id; themes.add(_pickFloorTheme(md)); } finally { game.currentMap = cm; }
        const fo = MAP_FLOOR_OVERRIDES[id]; if (fo && LX_FLOOR_PER_MAP_FILES[fo]) add('Sprites/floors/' + LX_FLOOR_PER_MAP_FILES[fo]);
        const po = MAP_PLATFORM_OVERRIDES[id]; if (po) for (const k of [po.default].concat(Object.values(po.byTag || {}))) if (LX_PLATFORM_PER_MAP_FILES[k]) add('Sprites/platforms/' + LX_PLATFORM_PER_MAP_FILES[k]);
        for (const n of (md.npcs || [])) if (NPC_SPRITE_FILES[n.name]) add('Sprites/npc/' + NPC_SPRITE_FILES[n.name]);
        for (const sp of (md.spawns || [])) if (sp && sp.type) mons.add(sp.type);
        for (const pr of (MAP_PROPS[id] || [])) add('Sprites/objects/' + pr.key + '.webp');
        for (const L of ((md.storybook && md.storybook.landmarks) || [])) add('Sprites/objects/' + L.key + '.webp');   // a town's own landmarks (town-storybook), asked for with the map
      }
      for (const k in LX_OBJECTS_FILES_EXPLICIT) add('Sprites/objects/' + LX_OBJECTS_FILES_EXPLICIT[k]);
      for (const f of ['Sprites/objects/column_pillar.webp', 'backgrounds/tiles/floor_grass_v5.webp', 'backgrounds/tiles/platform_grass_v4.webp', 'Sprites/floors/everdawn_central.webp']) add(f);
      for (const f of ['elspeth', 'brok', 'amnesiac', 'sage_mira', 'old_arlen', 'taxi_uncle', 'fashionista', 'Taiga', 'kuro', 'ren', 'will', 'elena', 'barnaby', 'hera', 'auron', 'lyra', 'Lady Hong', 'Master Shen', 'yun']) add('Sprites/npc/' + f + '.webp');
      return { files: [...files], themes: [...themes], mons: [...mons], npcFiles: Object.values(NPC_SPRITE_FILES).map((f) => '/Sprites/npc/' + f) };
    });
    const okSet = new Set(allow.files), themeRx = new RegExp('^/backgrounds/tiles/(?:floor|platform)_(?:' + allow.themes.join('|') + ')_');
    const npcSet = new Set(allow.npcFiles);   // a sheet the world draws (not a UI picture that lives in the same folder)
    const isMapArt = (u) => /^\/Sprites\/monsters\/[^/]+\.webp$/.test(u) || npcSet.has(u) || /^\/backgrounds\/tiles\//.test(u) || /^\/Sprites\/(floors|platforms|objects)\//.test(u);
    const allowed = (u) => okSet.has(u) || themeRx.test(u) || (/^\/Sprites\/monsters\//.test(u) && allow.mons.indexOf(u.replace(/^.*[/]|[.]webp$/g, '')) >= 0);
    const stray = [...new Set(reqs.filter((r) => isMapArt(r.u) && !allowed(r.u)).map((r) => r.u))];
    const pre = reqs.filter((r) => r.t <= tTitle), sum = (a) => a.reduce((s, r) => s + r.n, 0) / 1e6;
    const info = { titleMs: tTitle - t0, preFiles: pre.length, preMb: +sum(pre).toFixed(1), files: reqs.length, mb: +sum(reqs).toFixed(1), laFiles: LA_FILES, laMb: LA_MB,
      monsterSheets: reqs.filter((r) => /^\/Sprites\/monsters\/[^/]+\.webp$/.test(r.u)).length, stray: stray.length, straySample: stray.slice(0, 6) };
    console.log('cold boot: ' + JSON.stringify(info));
    console.log(`BYTES title+20s: ${info.files} files / ${info.mb} MB  (origin + lazy-art: ${LA_FILES} / ${LA_MB} MB)  |  before the title: ${info.preFiles} / ${info.preMb} MB at ${info.titleMs} ms`);
    check(info.mb <= LA_MB * 0.8 && info.files <= LA_FILES * 0.9, `title + 20 s fetches at most 80% of the bytes and 90% of the files it did with lazy-art alone (${info.mb} MB / ${info.files} files vs ${LA_MB} / ${LA_FILES})`, info);
    check(info.stray === 0, 'no monster sheet, and no NPC sheet, tile or prop outside the start map and its portal neighbour, is fetched by title + 20 s', info);
    check(info.preMb <= 75, `the title still comes after at most 75 MB (${info.preMb} MB, ${info.titleMs} ms)`, info);
    await ctx.close();
  }
  // ---- B: play (the harness boot recipe) ---------------------------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push('B ' + String(e).slice(0, 160)));
  await routes(p);
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof openMojidex === 'function' && typeof _lxStreamWorld === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player._gravitosCineSeen = true;
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999;
    window.__veil = () => !!(game._mapFadeEl && game._mapFadeEl.classList.contains('on'));
    window.__frames = async (n, capMs) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < capMs) await new Promise((r) => setTimeout(r, 50)); return (game.time | 0) - g0; };
    window.__until = async (fn, capMs) => { const t0 = performance.now(); while (performance.now() - t0 < capMs) { try { if (fn()) return true; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); } return false; };
    window.__raf = () => new Promise((r) => requestAnimationFrame(r));
    window.__lazy = (typeof _lxArt2Want === 'function');
    window.__parked = (key) => (typeof _LX_ART2 !== 'undefined') && (_LX_ART2.reg[key] || []).some((im) => _lxParked(im));
    window.__monReady = (t) => { const s = MONSTER_SPRITES[t]; return !!(s && (s.naturalWidth || s.width) > 0); };
    window.__npcReady = (n) => { const s = NPC_SPRITES[n]; return !!(s && (s.naturalWidth || s.width) > 0); };
    window.__sheet = new Set(MONSTER_SPRITE_TYPES);
    window.__near = (id) => { const s = new Set(); for (const m of [id].concat(_lxMapNeighbors(id))) for (const sp of (MAPS[m].spawns || [])) if (sp && sp.type) s.add(sp.type); return s; };
    window.__sprDraws = Object.create(null);   // which types drew from their own sheet
    const O = _drawMonsterSprite; window._drawMonsterSprite = function (m) { try { __sprDraws[m.type] = (__sprDraws[m.type] | 0) + 1; } catch (e) {} return O.apply(this, arguments); };
  });
  // the world streamer (started 8 s after the world opens) - which maps does it warm? (_lxWarmMap stubbed to a recorder)
  const st = await p.evaluate(async () => {
    loadMap('forest'); await __frames(20, 8000);
    const here = game.currentMap, nbs = _lxMapNeighbors(here), asked = [], O = { w: window._lxWarmMap, m: window._lxStreamMonWorld };
    let sweep = false;
    window._lxWarmMap = (id) => { asked.push(id); return Promise.resolve(0); };
    window._lxStreamMonWorld = () => { sweep = true; };
    window._lxWorldStreamed = false;
    _lxStreamWorld();
    let last = -1, same = 0; const t0 = performance.now();
    while (performance.now() - t0 < 45000 && !sweep && same < 25) { await new Promise((r) => setTimeout(r, 100)); if (asked.length === last) same++; else { same = 0; last = asked.length; } }
    window._lxWarmMap = O.w; window._lxStreamMonWorld = O.m;
    const ok = new Set([here].concat(nbs));
    return { here, neighbours: nbs.length, asked: asked.length, outside: asked.filter((id) => !ok.has(id)).length, monsterSweep: sweep, nbs, outsideIds: asked.filter((id) => !ok.has(id)), nowOn: game.currentMap };
  });
  console.log('streamer: ' + JSON.stringify(st));
  check(st.asked > 0 && st.outside === 0 && !st.monsterSweep, `the world streamer warms only this map and its ${st.neighbours} portal neighbours (asked ${st.asked}, ${st.outside} beyond; every-monster sweep: ${st.monsterSweep})`, st);
  // twelve field maps across the level range, entered cold (none next door to the one before): every monster and NPC on the
  // map has its own sheet loaded when the veil lifts, or within a few frames
  // (nine field maps spaced by their monsters' level, then the three hubs with the most NPCs)
  const MAPS12 = await p.evaluate(() => {
    const lv = (id) => _mapGearLevel(MAPS[id]);   // the toughest non-boss spawn's natural level (levelReq is swept to 1)
    const plain = (id) => { const md = MAPS[id]; return !md.isBossArena && !md.isVoid && !md.isZodiac && !md.isZodiacHub && !md.sanctum && !/^tower|^boss/.test(id); };
    const c = Object.keys(MAPS).filter((id) => plain(id) && !MAPS[id].isTown && (MAPS[id].spawns || []).some((sp) => sp && sp.type && !sp.boss && __sheet.has(sp.type)))
      .map((id) => [id, lv(id)]).sort((a, b) => (a[1] - b[1]) || (a[0] < b[0] ? -1 : 1)).map((x) => x[0]);
    const hubs = Object.keys(MAPS).filter((id) => plain(id) && id !== 'town' && (MAPS[id].npcs || []).filter((n) => NPC_SPRITE_FILES[n.name]).length >= 3)
      .sort((a, b) => (MAPS[b].npcs.length - MAPS[a].npcs.length) || (a < b ? -1 : 1));
    const out = [], near = new Set(['forest', 'mushroom', 'town', 'void'].concat(_lxMapNeighbors('forest'), _lxMapNeighbors('mushroom')));
    const take = (list, j) => { for (let d = 0; d < list.length; d++) { const id = list[(j + d) % list.length]; if (out.indexOf(id) >= 0 || near.has(id)) continue; out.push(id); for (const n of _lxMapNeighbors(id)) near.add(n); return; } };
    for (let k = 0; k < 9; k++) take(c, Math.round(k * (c.length - 1) / 8));
    for (let k = 0; k < 3; k++) take(hubs, 0);
    return out;
  });
  const maps = [];
  for (const id of MAPS12) {
    maps.push(await p.evaluate(async (id) => {
      const md = MAPS[id];
      const types = [...new Set((md.spawns || []).filter((sp) => sp && sp.type && !sp.boss && __sheet.has(sp.type)).map((sp) => sp.type))];
      const names = (md.npcs || []).map((n) => n.name).filter((n) => NPC_SPRITE_FILES[n]);
      const cold = types.filter((t) => __parked('mon:' + t)).length + names.filter((n) => __parked('npc:' + n)).length;
      loadMap(id);
      const t0 = performance.now();
      await __raf(); while (__veil() && performance.now() - t0 < 20000) await __raf();
      const veilMs = Math.round(performance.now() - t0);
      const miss = () => {
        const ms = game.monsters.filter((m) => m && !m.isBoss && !m.ally && !m.isSummon && __sheet.has(m.type)), ns = (game.npcs || []).filter((n) => n && NPC_SPRITE_FILES[n.name]);
        return { m: [...new Set(ms.filter((m) => !__monReady(m.type)).map((m) => m.type))], n: ns.filter((n) => !__npcReady(n.name)).map((n) => n.name), nm: ms.length, nn: ns.length };
      };
      const at = miss(); const g0 = game.time | 0, t1 = performance.now();
      while (performance.now() - t1 < 15000) { const x = miss(); if (!x.m.length && !x.n.length) break; await __raf(); }
      const after = (at.m.length || at.n.length) ? (game.time | 0) - g0 : 0;
      await __frames(60, 10000);   // and whatever spawns after the veil (a map on a spawn timer)
      const later = miss();
      return { id, lv: _mapGearLevel(md), cold, veilMs, mons: Math.max(at.nm, later.nm), npcs: at.nn, missingAtVeil: at.m.concat(at.n), framesAfter: after, missingLater: later.m.concat(later.n) };
    }, id));
  }
  console.log('maps: ' + maps.map((m) => `${m.id}(L${m.lv}${m.cold ? ', ' + m.cold + ' cold' : ''}) veil ${m.veilMs} ms, ${m.mons} mobs / ${m.npcs} NPCs` + (m.missingAtVeil.length ? ` +${m.framesAfter}f for ${m.missingAtVeil.join('/')}` : '')).join(' | '));
  const lazyBuild = await p.evaluate(() => __lazy);
  const mapBad = maps.filter((m) => m.framesAfter > 30 || m.missingLater.length || m.veilMs > 8000);
  const nMobs = maps.reduce((s, m) => s + m.mons, 0), nNpcs = maps.reduce((s, m) => s + m.npcs, 0), nCold = maps.filter((m) => m.cold > 0).length;
  check(maps.length === 12 && !mapBad.length && nMobs >= 20 && nNpcs >= 8 && (!lazyBuild || nCold >= 8),
    `12 maps (Lv ${Math.min(...maps.map((m) => m.lv))}-${Math.max(...maps.map((m) => m.lv))}): every monster (${nMobs}) and NPC (${nNpcs}) has its sheet when the veil lifts or within 30 frames (${nCold} maps entered with parked art)`, mapBad.length ? mapBad : maps);
  // a monster from another map's list, summoned here (spawnMonster: summons, event and boss adds, co-op mirrors), and one
  // pushed into the list without spawnMonster (as the Octobaby's arms and the gummy's split are): both get their art
  const sm = await p.evaluate(async () => {
    loadMap('forest'); await __frames(30, 8000); await __until(() => !__veil(), 8000);
    const near = __near(game.currentMap);
    const elsewhere = (t) => Object.keys(MAPS).some((id) => (MAPS[id].spawns || []).some((sp) => sp && sp.type === t));
    const pool = MONSTER_SPRITE_TYPES.filter((t) => monsterTypes[t] && !near.has(t) && elsewhere(t) && !/^octoLeg/.test(t));
    const cold = pool.filter((t) => !__monReady(t));
    const [A, B] = cold.length >= 2 ? cold : pool;
    const out = { A, B, parkedA: __parked('mon:' + A), parkedB: __parked('mon:' + B) };
    game.monsters.length = 0; __sprDraws[A] = 0; __sprDraws[B] = 0;
    const m = spawnMonster(player.x + 260, player.y - 40, A, false, false);
    let g0 = game.time | 0;
    out.loadedA = await __until(() => __monReady(A), 15000); out.framesA = (game.time | 0) - g0;
    await __frames(30, 8000); out.drawsA = __sprDraws[A] | 0;
    // the push: a live monster of a type on this map, re-typed to B without asking for B's art
    const host = spawnMonster(player.x - 260, player.y - 40, [...near].find((t) => __sheet.has(t) && monsterTypes[t]) || 'snail', false, false);
    if (host) { host.type = B; host.name = monsterTypes[B].name; }
    g0 = game.time | 0;
    out.loadedB = await __until(() => __monReady(B), 15000); out.framesB = (game.time | 0) - g0;
    await __frames(30, 8000); out.drawsB = __sprDraws[B] | 0;
    game.monsters.length = 0;
    out.spawned = !!m && !!host;
    return out;
  });
  console.log('summon: ' + JSON.stringify(sm));
  check(sm.spawned && sm.loadedA && sm.drawsA > 0 && (!lazyBuild || sm.parkedA), `${sm.A} (another map's monster) summoned here asks for its sheet and draws from it (${sm.framesA} frames; parked before: ${sm.parkedA})`, sm);
  check(sm.spawned && sm.loadedB && sm.drawsB > 0 && (!lazyBuild || sm.parkedB), `${sm.B} put on the map without spawnMonster asks for its sheet on its first draw and draws from it (${sm.framesB} frames; parked before: ${sm.parkedB})`, sm);
  // the dex: six monsters seen elsewhere, their sheets never asked for; the MojiDex list thumbs, its portrait and the Ledger panels
  const dx = await p.evaluate(async () => {
    const near = __near(game.currentMap), all = _mjxAllTypes();
    const pool = all.filter((k) => __sheet.has(k) && !near.has(k) && !/^octoLeg/.test(k));
    const ks = pool.filter((k) => !__monReady(k)).slice(0, 6); for (const k of pool) if (ks.length < 6 && ks.indexOf(k) < 0) ks.push(k);
    const out = { ks, parked: ks.filter((k) => __parked('mon:' + k)).length };
    for (const k of ks) game.bestiary[k] = Math.max(game.bestiary[k] | 0, 3);
    _MJX.filter = 'all'; _MJX.q = '';
    openMojidex();
    const img = (k) => document.querySelector('#mojidex-modal .mjx-dot img[data-mk="' + k + '"]');
    out.withImg = ks.filter((k) => img(k)).length;
    for (const k of ks) { const im = img(k); if (im) { im.scrollIntoView({ block: 'center' }); await __raf(); await __raf(); } }
    out.thumbs = await __until(() => ks.every((k) => { const im = img(k); return im && im.complete && im.naturalWidth > 0 && im.classList.contains('mjx-in'); }), 20000);
    out.thumbsIn = ks.filter((k) => { const im = img(k); return im && im.classList.contains('mjx-in'); }).length;
    _mjxSelect(ks[0]);
    out.portrait = await __until(() => { const im = document.querySelector('#mojidex-modal .mjx-pimg'); return !!(im && im.src && im.complete && im.naturalWidth > 0 && im.classList.contains('mjx-in')); }, 15000);
    try { closeAllModals(); } catch (e) {} game.paused = false;
    out.ledger = ks.filter((k) => /<img[^>]+src="[^"]+"/.test(_cdxDexPanel(k) || '')).length;
    return out;
  });
  console.log('dex: ' + JSON.stringify(dx));
  check(dx.ks.length === 6 && dx.withImg === 6 && dx.thumbs && dx.portrait && dx.ledger === 6 && (!lazyBuild || dx.parked >= 4),
    `the MojiDex shows a loaded picture for 6 monsters met elsewhere (${dx.parked} parked when it opened): list thumbs ${dx.thumbsIn}/6, portrait ${dx.portrait}, Ledger panels ${dx.ledger}/6`, dx);
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
