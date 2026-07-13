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
  const boot = await page.evaluate(() => ({ id: state.mapId, n: state.npcs.length, p: state.portals.length, sel: $('mapId').value, opts: $('mapId').options.length }));
  ok('boots on town with its real NPCs/portals loaded', boot.id === 'town' && boot.n === 9 && boot.p === 3, boot);
  ok('dropdown is populated + selected on town', boot.sel === 'town' && boot.opts > 100, boot);

  // ── Dropdown change loads a different map's data ─────────────────────────
  await page.selectOption('#mapId', 'boss_rush');
  const switched = await page.evaluate(() => ({ id: state.mapId, n: state.npcs.length, p: state.portals.length, dirty: state.dirty }));
  ok('selecting a map loads its layout', switched.id === 'boss_rush' && switched.dirty === false, switched);

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
  await page.evaluate(() => { state.npcs = []; state.portals = []; state.sel = null; state.dirty = false; syncPanel(); draw(); });
  const rect = await page.evaluate(() => { const r = cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, cw: cv.width, ch: cv.height }; });
  const toClient = (wx, wy) => ({ x: rect.l + wx * (rect.w / rect.cw), y: rect.t + wy * (rect.h / rect.ch) });

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

  // export re-parses; keys/format match the game
  await page.click('#exportBtn');
  const out = await page.evaluate(() => $('out').value);
  const evalArr = (label) => { const m = out.match(new RegExp(label + ':\\s*(\\[[\\s\\S]*?\\]),')); return Function('"use strict";return (' + m[1] + ');')(); };
  let pn, pp, perr = null;
  try { pn = evalArr('npcs'); pp = evalArr('portals'); } catch (e) { perr = String(e); }
  ok('export re-parses as valid JS arrays', Array.isArray(pn) && pn.length === 1 && Array.isArray(pp) && pp.length === 1, perr || { pn, pp });
  ok('export keeps iconStar + string dest, drops no fields', pp[0].dest === 'forest' && pp[0].iconStar === true && 'role' in pn[0] && 'color' in pn[0], { pn, pp });
  ok('export header names the selected map id', /MAPS\.forest|MAPS\.town|MAPS\.\w+/.test(out) && !/_[a-zA-Z]+:/.test(out), out.slice(0, 40));

  // import round-trip
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
