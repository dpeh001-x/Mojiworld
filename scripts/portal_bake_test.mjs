// Portal hardbake (Ctrl-editor export) for skyGarden / forest / ancient /
// mushroom.
//
// Reads the LIVE MAPS object after every push, filter and the hardbake blob
// have run — the four maps carry ~30 accreted mutations between them, so the
// only truthful check is the final state, not the source text.
// Also walks the world graph the portals form, because a portal edit is a
// graph edit: a wrong dest, an overlapping pair (the exact bug the forest bake
// comment records), or a severed link can strand a whole biome.
//   node scripts/portal_bake_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const WANT = {
  skyGarden: [
    { x: 100, dest: 'azureAcademia', name: '◀ The Azure Academia' },
    { x: 2184, dest: 'frostbiteHollow', name: '◀ Frostbite Hollow', y: 337 },
  ],
  forest: [
    { x: 211, y: 480, dest: 'town', name: '▶ Everdawn Central' },
    { x: 1939, dest: 'mushroom', name: '◀ Fungal Hollow', y: 476 },
    { x: 3014, y: 480, dest: 'azureAcademia', name: '◀ The Azure Academia' },
  ],
  ancient: [
    { x: 2600, dest: 'wildflowerPlains', name: '▶ Wildflower Plains' },
    { x: 1519, dest: 'boss', name: "▶ Queen's Hollow", y: 149 },
  ],
  mushroom: [
    { x: 260, dest: 'forest', name: '◀ Emerald Thicket', y: 480 },
    { x: 654, dest: 'jadeGrove', name: '◀ The Jade Grove', y: 337 },
    { x: 2160, dest: 'wildflowerPlains', name: '▶ Wildflower Plains', y: 480 },
  ],
};

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof MAPS === 'object' && MAPS.town, { timeout: 120000 });

const r = await page.evaluate((WANT) => {
  const out = { live: {}, graph: {} };
  for (const id of Object.keys(WANT)) {
    out.live[id] = (MAPS[id] && MAPS[id].portals || []).map(p => ({ x: p.x, y: p.y, dest: p.dest, name: p.name }));
  }
  // --- graph-wide integrity -------------------------------------------------
  const ids = Object.keys(MAPS);
  const deadDest = [], overlaps = [], oneWay = [];
  for (const id of ids) {
    const ps = (MAPS[id] && MAPS[id].portals) || [];
    for (const p of ps) {
      if (p.dest && !MAPS[p.dest]) deadDest.push(id + ' -> ' + p.dest);
    }
    // two portals within 80px on the same map are effectively unusable
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      if (Math.abs((ps[i].x | 0) - (ps[j].x | 0)) < 80) {
        overlaps.push(id + ': ' + ps[i].dest + ' @' + ps[i].x + ' vs ' + ps[j].dest + ' @' + ps[j].x);
      }
    }
  }
  // reachability from town over the portal graph
  const seen = new Set(['town']); const q = ['town'];
  while (q.length) {
    const cur = q.shift();
    for (const p of ((MAPS[cur] && MAPS[cur].portals) || [])) {
      if (p.dest && MAPS[p.dest] && !seen.has(p.dest)) { seen.add(p.dest); q.push(p.dest); }
    }
  }
  // one-way links AMONG THE FOUR EDITED MAPS (their neighbours should link back)
  for (const id of Object.keys(WANT)) {
    for (const p of ((MAPS[id] && MAPS[id].portals) || [])) {
      const back = ((MAPS[p.dest] && MAPS[p.dest].portals) || []).some(q2 => q2.dest === id);
      if (!back) oneWay.push(id + ' -> ' + p.dest + ' (no return portal)');
    }
  }
  out.graph = {
    totalMaps: ids.length, reachable: seen.size,
    unreachable: ids.filter(i => !seen.has(i)),
    deadDest, overlaps, oneWay,
  };
  return out;
}, WANT);
await b.close(); try { srv.kill(); } catch (e) {}

// ORDER-INSENSITIVE by design: a MAPS-wide normalizer runs after the bake
// (dedup -> sort by x -> nudge -> right-edge clamp), so the live array is
// x-ascending whatever order the editor exported. Comparing order would fail
// on `ancient` for a reason that is not a defect. Coordinates and names are
// compared exactly — a nudge or clamp WOULD move x, and that must be caught.
const norm = (a) => JSON.stringify([...a]
  .sort((p, q) => (p.x | 0) - (q.x | 0))
  .map(p => ({ x: p.x, y: p.y === undefined ? null : p.y, dest: p.dest, name: p.name })));
for (const id of Object.keys(WANT)) {
  console.log(`${id}:`, JSON.stringify(r.live[id]));
  ok(`${id} portals survive the normalizer unchanged (coords + names exact)`,
     norm(r.live[id]) === norm(WANT[id]), { want: WANT[id], got: r.live[id] });
}
console.log('\ngraph:', JSON.stringify({ ...r.graph, unreachable: r.graph.unreachable.length }));

// Pre-existing world state, measured on the unpatched build for comparison:
// 15 maps sit off the portal graph (tower / clockwork tiers are entered via
// the expedition + taxi systems, not portals) and 3 maps carry crowded portal
// pairs. Neither is this edit's doing, so the assertions below test that the
// edit does not make either worse — an absolute zero would be asserting a
// world state that never existed.
const PRE_UNREACHABLE = 15;
const PRE_OVERLAP_MAPS = ['interdimensionalAscension', 'abyssalTrench', 'boneGraveyard'];
const EDITED = ['skyGarden', 'forest', 'ancient', 'mushroom'];

ok('every portal destination is a real map (whole world, not just the four)',
   r.graph.deadDest.length === 0, r.graph.deadDest.slice(0, 6));
ok('none of the FOUR EDITED maps has a crowded portal pair',
   r.graph.overlaps.every(o => !EDITED.some(id => o.startsWith(id + ':'))),
   r.graph.overlaps.filter(o => EDITED.some(id => o.startsWith(id + ':'))));
ok('the edit introduces no NEW crowded pair elsewhere (3 pre-existing, untouched maps)',
   r.graph.overlaps.length <= PRE_OVERLAP_MAPS.length
   && r.graph.overlaps.every(o => PRE_OVERLAP_MAPS.some(id => o.startsWith(id + ':'))),
   r.graph.overlaps);
ok('the four edited maps are all still reachable from town',
   EDITED.every(i => !r.graph.unreachable.includes(i)),
   { unreachable: r.graph.unreachable.slice(0, 8) });
ok('the edit strands no ADDITIONAL map (pre-existing off-graph count unchanged)',
   r.graph.unreachable.length <= PRE_UNREACHABLE,
   { now: r.graph.unreachable.length, preExisting: PRE_UNREACHABLE });
ok('every link out of an edited map has a return portal (no one-way traps)',
   r.graph.oneWay.length === 0, r.graph.oneWay);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
