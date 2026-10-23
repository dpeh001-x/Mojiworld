// gravitos-portal-platform - the two older arena tests follow the collapse's new rule: the left y:180 perch carries the exit door
// (since the map bake), so form 2 now drops only the right one. gravitos_floor_drift_test's "every portal stands on the ground slab" read
// the door's floor with _defaultPortalY(x) (the ground) and never its own y, which is how the door's perch fell unnoticed; it now
// reads the door's real floor and checks that floor outlives both collapses. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const ROOT = 'C:/Users/dpeh0/Mojiworld/scripts/';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
function patch(name, marker, pairs) {
  const F = ROOT + (process.env.LX_TEST_PREFIX || '') + name;   // LX_TEST_PREFIX: patch scratch copies (e.g. _port_) instead
  let s = readFileSync(F, 'utf8');
  if (s.includes(marker)) { console.log('already applied: ' + name); return; }
  const crlf = s.includes('\r\n');
  if (crlf) s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) { const n = s.split(a).length - 1; if (n !== 1) die(name + ': anchor matched ' + n + ': ' + a.slice(0, 60)); s = s.replace(a, () => b); }
  if (!s.includes(marker)) die(name + ': marker missing after patch');
  if (crlf) s = s.replace(/\n/g, '\r\n');
  writeFileSync(F + '.tmp', s, 'utf8'); renameSync(F + '.tmp', F);
  console.log('applied: ' + name);
}
const T = 'gravitos-portal-platform';
patch('gravitos_arena_test.mjs', 'keeps the door', [
  ["  const at = (x, y) => (game.mapData.platforms || []).some((p) => p.x === x && p.y === y);",
   `  const at = (x, y) => (game.mapData.platforms || []).some((p) => (p._driftBaseX != null ? p._driftBaseX : p.x) === x && p.y === y);   // ${T}: authored x (the perches drift)`],
  ["  ok('form 2 drops the two high perches (7 -> 5)', p2 === 5, `floating ${p2}`);\n  ok('...and it was the y:180 pair', !at(340, 180) && !at(1700, 180));",
   `  ok('form 2 drops the right high perch (7 -> 6)', p2 === 6, \`floating \${p2}\`);   // ${T}\n  ok('...the right y:180 perch fell; the left one keeps the door standing (the exit, per user)', at(340, 180) && !at(1700, 180));`],
  ["  ok('form 3 drops the y:320 pair (5 -> 3)', p3 === 3, `floating ${p3}`);",
   `  ok('form 3 drops the y:320 pair (6 -> 4)', p3 === 4, \`floating \${p3}\`);   // ${T}`],
  ["  ok('SAFETY: arena is still traversable (ground + 3 floating + 3 pads)',\n     p3 === 3 && g.length === 1 && pad3 === 3);",
   `  ok('SAFETY: arena is still traversable (ground + 4 floating + 3 pads)',   // ${T}\n     p3 === 4 && g.length === 1 && pad3 === 3);`],
]);
patch('gravitos_floor_drift_test.mjs', 'the platform the door stands on', [
  ["    const floorOf = (x) => { const y = _defaultPortalY(x); const p = (game.mapData.platforms || []).find((q) => q.y === y && x >= q.x && x <= q.x + q.w); return p ? { x: p.x, y: p.y, type: p.type } : null; };",
   `    // ${T}: a door's floor at its OWN y (the exit stands on the left y:180 perch since the map bake), matched on the authored x\n` +
   "    const floorOf = (po) => { const y = (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x); const p = (game.mapData.platforms || []).find((q) => { const bx = q._driftBaseX != null ? q._driftBaseX : q.x, ax = Math.abs(q._driftAx || 0); return Math.abs(q.y - y) <= 24 && po.x >= bx - ax && po.x <= bx + q.w + ax; }); return p ? { x: p._driftBaseX != null ? p._driftBaseX : p.x, y: p.y, type: p.type } : null; };"],
  ["out.portals = (game.mapData.portals || []).map((po) => ({ x: po.x, dest: po.dest, y: _defaultPortalY(po.x), floor: floorOf(po.x) }));",
   "out.portals = (game.mapData.portals || []).map((po) => ({ x: po.x, dest: po.dest, y: (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x), floor: floorOf(po) }));"],
  ["    out.portalsAfter = (game.mapData.portals || []).map((po) => ({ x: po.x, y: _defaultPortalY(po.x), floor: floorOf(po.x) }));",
   "    out.portalsAfter = (game.mapData.portals || []).map((po) => ({ x: po.x, y: (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x), floor: floorOf(po) }));"],
  ["  ok('every portal stands on the ground slab', r.portals.length >= 1 && r.portals.every((po) => po.floor && po.floor.type === 'ground'), r.portals);",
   "  ok('every portal stands on a floor (the exit: the platform the door stands on, the left y:180 perch)', r.portals.length >= 1 && r.portals.every((po) => po.floor), r.portals);"],
  ["  ok('form 2 drops the y:180 perches (mid-swing)', !has(r.after2, 340, 180) && !has(r.after2, 1700, 180) && r.after2.length === 6, r.after2.length);",
   "  ok('form 2 drops the right y:180 perch and keeps the door\\'s (mid-swing)', has(r.after2, 340, 180) && !has(r.after2, 1700, 180) && r.after2.length === 7, r.after2.length);"],
  ["  ok('form 3 drops the y:320 pair (mid-swing)', !has(r.after3, 500, 320) && !has(r.after3, 1500, 320) && r.after3.length === 4, r.after3.length);",
   "  ok('form 3 drops the y:320 pair (mid-swing)', !has(r.after3, 500, 320) && !has(r.after3, 1500, 320) && r.after3.length === 5, r.after3.length);"],
  ["  ok(\"every portal's floor is untouched after both collapses\", r.portalsAfter.every((po, i) => po.floor && po.floor.type === 'ground' && po.y === r.portals[i].y), r.portalsAfter);",
   "  ok(\"every portal's floor is untouched after both collapses\", r.portalsAfter.every((po, i) => po.floor && r.portals[i].floor && po.floor.x === r.portals[i].floor.x && po.floor.y === r.portals[i].floor.y && po.y === r.portals[i].y), r.portalsAfter);"],
]);
