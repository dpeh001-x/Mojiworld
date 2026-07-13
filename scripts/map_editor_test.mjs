// Standalone map_editor.html certification: map dropdown + load, prev/next
// cycling, W-key world-map overlay (click node → load), click-to-place,
// drag-to-move, property edits, export format (matches the game's _lxSeFmt),
// and import. Data is baked from the live game (scripts/extract_map_data.mjs).
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'file:///home/user/Mojiworld/map_editor.html';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
try {
  const page = await browser.newContext().then(c => c.newPage());
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  page.on('dialog', d => d.accept());
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof state === 'object' && state.npcs && typeof MAP_DATA === 'object', null, { timeout: 10000 });

  // ── Baked data + boot loads town ────────────────────────────────────────
  const md = await page.evaluate(() => ({ maps: Object.keys(MAP_DATA.maps).length, town: !!MAP_DATA.maps.town, W: MAP_DATA.W }));
  ok('map data baked in (100+ maps)', md.maps > 100 && md.town, md);
  const boot = await page.evaluate(() => ({ id: state.mapId, n: state.npcs.length, p: state.portals.length, pl: state.platforms.length, sel: $('mapId').value, opts: $('mapId').options.length }));
  ok('boots on town with its real platforms/NPCs/portals loaded', boot.id === 'town' && boot.n === 9 && boot.p === 3 && boot.pl === 21, boot);
  ok('dropdown is populated + selected on town', boot.sel === 'town' && boot.opts > 100, boot);
  ok('town platforms are captured + rendered', await page.evaluate(() => MAP_DATA.maps.town.platforms.length === 21 && state.platforms.every(p => 'w' in p && 'h' in p && 'type' in p)), boot);

  // ── Dropdown change loads a different map's data ─────────────────────────
  await page.selectOption('#mapId', 'boss_rush');
  const switched = await page.evaluate(() => ({ id: state.mapId, n: state.npcs.length, p: state.portals.length, dirty: state.dirty }));
  ok('selecting a map loads its layout', switched.id === 'boss_rush' && switched.dirty === false, switched);

  // ── Undefined-y portals: snapped to platform + visible ──────────────────
  // 173 MAPS portals carry no y (the game grounds them via _defaultPortalY).
  // The editor must fill the same y at load so they render + list + export.
  await page.selectOption('#mapId', 'town');
  const undef = await page.evaluate(() => {
    const src = MAP_DATA.maps.town.portals;                       // baked data (some without y)
    const srcNoY = src.filter(p => typeof p.y !== 'number').length;
    const loaded = state.portals;
    const g = state.platforms.find(p => p.type === 'ground');
    return {
      srcNoY,
      allNumeric: loaded.every(p => typeof p.y === 'number' && isFinite(p.y)),
      groundedOk: loaded.filter((p, i) => typeof src[i].y !== 'number').every(p => p.y === g.y),
      listHasUndefined: $('list').textContent.includes('undefined'),
    };
  });
  ok('town source has y-less portals (fixture is real)', undef.srcNoY > 0, undef);
  ok('loaded portals ALL have a numeric y (visible on canvas)', undef.allNumeric, undef);
  ok('y-less portals snapped to the ground platform (game rule)', undef.groundedOk, undef);
  ok('placed list shows no "undefined" labels', !undef.listHasUndefined, undef);
  const undefExport = await page.evaluate(() => {
    const t = buildExport();
    const m = t.match(/portals:\s*(\[[\s\S]*?\]),/);
    const arr = Function('"use strict";return (' + m[1] + ');')();
    return { allY: arr.every(p => typeof p.y === 'number') };
  });
  ok('export hardbakes an explicit y on every portal', undefExport.allY, undefExport);
  await page.evaluate(() => { state.dirty = false; });

  // ── Tall underwater maps express their FULL vertical height ─────────────
  await page.selectOption('#mapId', 'coralReef');
  const tall = await page.evaluate(() => ({
    wh: +$('worldH').value, cvH: cv.height,
    deepPlats: state.platforms.filter(p => p.y > 560).length,
    bottomGround: state.platforms.some(p => p.type === 'ground' && p.y >= 2000),
  }));
  ok('coralReef loads its 2200px world height into the canvas', tall.wh === 2200 && tall.cvH === 2200, tall);
  ok('coralReef deep platforms (y>560) are present + renderable', tall.deepPlats > 15 && tall.bottomGround, tall);
  // place an NPC DEEP (y=1800) — previously clamped to 540
  const deepPlace = await page.evaluate(() => { place('npc', 700, 1800); const o = state.npcs[state.npcs.length - 1]; return { y: o.y }; });
  ok('placement works below the old 540px clamp (y=1800 sticks)', deepPlace.y === 1800, deepPlace);
  const deepExport = await page.evaluate(() => { const t = buildExport(); return { hasWH: /worldHeight: 2200,/.test(t), hasTowerNote: /isVerticalTower/.test(t) }; });
  ok('export carries worldHeight + isVerticalTower note for tall maps', deepExport.hasWH && deepExport.hasTowerNote, deepExport);
  // frozenPeak (14400px) also loads full-height without error
  await page.evaluate(() => { state.dirty = false; });
  await page.selectOption('#mapId', 'frozenPeak');
  const fp = await page.evaluate(() => ({ cvH: cv.height, plats: state.platforms.length }));
  ok('frozenPeak loads its full 14400px height', fp.cvH === 14400 && fp.plats > 50, fp);
  await page.evaluate(() => { state.dirty = false; });
  await page.selectOption('#mapId', 'boss_rush');
  const flat = await page.evaluate(() => ({ cvH: cv.height }));
  ok('flat maps stay at standard 560px height', flat.cvH === 560, flat);

  // ── prev/next cycling ───────────────────────────────────────────────────
  const cyc = await page.evaluate(() => {
    const before = state.mapId; cycleMap(1); const after1 = state.mapId; cycleMap(-1); const back = state.mapId;
    return { before, after1, back };
  });
  ok('next then prev returns to the same map', cyc.before === cyc.back && cyc.after1 !== cyc.before, cyc);
  ok('[ / ] map IDs are ordered (cycle moved)', cyc.after1 !== cyc.before, cyc);

  // ── World-map overlay: opens, has nodes + chips, clicking a node loads ───
  await page.click('#worldMapBtn');
  const wm = await page.evaluate(() => ({ open: $('wmOverlay').style.display === 'block', nodes: $('wmStar').children.length, chips: $('wmMore').children.length }));
  ok('world map opens with star nodes', wm.open && wm.nodes > 50, wm);
  ok('world map lists unpinned maps as chips', wm.chips > 0, wm);
  // search filters
  await page.fill('#wmSearch', 'forest');
  const filtered = await page.evaluate(() => {
    const vis = [...$('wmStar').children].filter(e => !e.classList.contains('dim')).map(e => e._id);
    return { vis };
  });
  ok('world-map search filters nodes', filtered.vis.length > 0 && filtered.vis.every(id => id.toLowerCase().includes('forest') || (MAP_DATA.maps[id].name || '').toLowerCase().includes('forest')), filtered);
  // click a node → loads that map + closes overlay
  await page.fill('#wmSearch', '');
  const clicked = await page.evaluate(() => {
    const node = [...$('wmStar').children].find(e => e._id === 'town') || $('wmStar').children[0];
    const id = node._id; node.click();
    return { id, loaded: state.mapId, open: $('wmOverlay').style.display === 'block' };
  });
  ok('clicking a world-map node loads that map + closes overlay', clicked.loaded === clicked.id && clicked.open === false, clicked);

  // ── W key toggles the overlay (not while typing) ────────────────────────
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('w');
  const wOpen = await page.evaluate(() => $('wmOverlay').style.display === 'block');
  await page.keyboard.press('Escape');
  const wClosed = await page.evaluate(() => $('wmOverlay').style.display === 'block');
  ok('W opens the world map, Esc closes it', wOpen === true && wClosed === false, { wOpen, wClosed });

  // ── Clean slate for placement tests ─────────────────────────────────────
  await page.evaluate(() => { state.platforms = []; state.npcs = []; state.portals = []; state.sel = null; state.dirty = false; syncPanel(); draw(); });
  const rect = await page.evaluate(() => { const r = cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, cw: cv.width, ch: cv.height }; });
  const toClient = (wx, wy) => ({ x: rect.l + wx * (rect.w / rect.cw), y: rect.t + wy * (rect.h / rect.ch) });

  // ── Platform: place, drag, resize (gold corner handle), edit ────────────
  await page.click('#addPlat');
  let cp = toClient(600, 350);
  await page.mouse.click(cp.x, cp.y);
  const plPlaced = await page.evaluate(() => ({ n: state.platforms.length, o: state.platforms[0], sel: state.sel && state.sel.kind }));
  ok('platform tool places a 200×20 platform (centered on click)', plPlaced.n === 1 && plPlaced.o.w === 200 && plPlaced.o.h === 20 && plPlaced.sel === 'platform', plPlaced);
  ok('placed platform is centered around click-x (~600)', Math.abs((plPlaced.o.x + plPlaced.o.w / 2) - 600) <= 25, plPlaced.o);
  // drag the platform body
  const pFrom = toClient(plPlaced.o.x + 100, plPlaced.o.y + 10);
  const pTo = toClient(plPlaced.o.x + 300, plPlaced.o.y + 60);
  await page.mouse.move(pFrom.x, pFrom.y); await page.mouse.down(); await page.mouse.move(pTo.x, pTo.y, { steps: 6 }); await page.mouse.up();
  const plMoved = await page.evaluate(() => state.platforms[0]);
  ok('platform drags to a new position (moved ~200px right)', plMoved.x > plPlaced.o.x + 150, { before: plPlaced.o.x, after: plMoved.x });
  // resize via the bottom-right handle
  const hFrom = toClient(plMoved.x + plMoved.w, plMoved.y + plMoved.h);
  const hTo = toClient(plMoved.x + 360, plMoved.y + 48);
  await page.mouse.move(hFrom.x, hFrom.y); await page.mouse.down(); await page.mouse.move(hTo.x, hTo.y, { steps: 6 }); await page.mouse.up();
  const plResized = await page.evaluate(() => state.platforms[0]);
  ok('dragging the gold corner resizes w & h', plResized.w > 300 && plResized.h > 30, plResized);
  // edit type via property editor
  await page.selectOption('#ftype', 'ground');
  const plType = await page.evaluate(() => state.platforms[0].type);
  ok('platform type edit applies', plType === 'ground', { plType });
  // clean the platform before marker tests so export assertions stay simple
  await page.evaluate(() => { state.platforms = []; state.sel = null; syncPanel(); draw(); });

  // place NPC via tool
  await page.click('#addNpc');
  let c = toClient(700, 300);
  await page.mouse.click(c.x, c.y);
  const afterPlace = await page.evaluate(() => ({ n: state.npcs.length, last: state.npcs[state.npcs.length - 1], mode: state.mode, dirty: state.dirty }));
  ok('click places an NPC near the click (x~700) + marks dirty', afterPlace.n === 1 && Math.abs(afterPlace.last.x - 700) <= 20 && afterPlace.mode === null && afterPlace.dirty, afterPlace);

  // drag it
  const from = toClient(afterPlace.last.x, afterPlace.last.y);
  const to = toClient(1000, 260);
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 6 }); await page.mouse.up();
  const afterDrag = await page.evaluate(() => state.npcs[0]);
  ok('drag moves the NPC to the drop point (x~1000)', Math.abs(afterDrag.x - 1000) <= 25, afterDrag);

  // place + edit a portal
  await page.click('#addPortal');
  c = toClient(500, 420); await page.mouse.click(c.x, c.y);
  await page.fill('#fdest', 'forest'); await page.fill('#fname', '▶ Whisperwood'); await page.check('#fstar');
  const edited = await page.evaluate(() => state.portals[0]);
  ok('portal dest/name/star edits apply', edited.dest === 'forest' && edited.name === '▶ Whisperwood' && edited.iconStar === true, edited);

  // import a platform (round-trip) so export carries all three arrays
  await page.fill('#imp', "platforms: [ {x:0, y:480, w:1600, h:60, type:'ground'} ]");
  await page.click('#impPlat');
  const plImp = await page.evaluate(() => state.platforms);
  ok('import adds a platform from a pasted array', plImp.length === 1 && plImp[0].type === 'ground' && plImp[0].w === 1600, plImp);

  // export re-parses; keys/format/order match the game (platforms → npcs → portals)
  await page.click('#exportBtn');
  const out = await page.evaluate(() => $('out').value);
  const evalArr = (label) => { const m = out.match(new RegExp(label + ':\\s*(\\[[\\s\\S]*?\\]),')); return Function('"use strict";return (' + m[1] + ');')(); };
  let ppl, pn, pp, perr = null;
  try { ppl = evalArr('platforms'); pn = evalArr('npcs'); pp = evalArr('portals'); } catch (e) { perr = String(e); }
  ok('export re-parses platforms + npcs + portals as valid JS', Array.isArray(ppl) && ppl.length === 1 && Array.isArray(pn) && pn.length === 1 && Array.isArray(pp) && pp.length === 1, perr || { ppl, pn, pp });
  ok('export orders platforms → npcs → portals (matches MAPS)', out.indexOf('platforms:') < out.indexOf('npcs:') && out.indexOf('npcs:') < out.indexOf('portals:'), { pi: out.indexOf('platforms:'), ni: out.indexOf('npcs:'), poi: out.indexOf('portals:') });
  ok('exported platform keeps w/h/type', ppl[0].w === 1600 && ppl[0].h === 60 && ppl[0].type === 'ground', ppl[0]);
  ok('export keeps iconStar + string dest, drops no fields', pp[0].dest === 'forest' && pp[0].iconStar === true && 'role' in pn[0] && 'color' in pn[0], { pn, pp });
  ok('export header names the selected map id, no _-keys', /MAPS\.\w+/.test(out) && !/\b_[a-zA-Z]+:/.test(out), out.slice(0, 40));

  // NPC import round-trip
  await page.fill('#imp', "npcs: [ {x:200, y:434, name:'Milo', role:'usher', color:'#4a8acc'} ]");
  await page.click('#impNpc');
  const imp = await page.evaluate(() => state.npcs.map(n => n.name));
  ok('import adds an NPC from a pasted array', imp.includes('Milo'), imp);

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
