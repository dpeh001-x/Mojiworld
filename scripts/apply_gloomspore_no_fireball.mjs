// Gloomspore Verge drops fireballs on the player (gloomspore no fireball, 2026-10-22).
// ============================================================================
// Per user (with a screenshot of Gloomspore Verge, a big molten meteor falling in): "gloomspore maps should not have
// fireballs, remove it".
// Source: the map's own `ceilingHazards` entry (v0.26.x "bursting spore-pod" drizzle, every 4.5-7.5 s, 65 dmg, r 110).
// updateMapEvents turns any map's lavaEruptions / ceilingHazards into a `meteor_warn` hazard, and the meteor_warn draw
// paints the shared red meteor sprite (rock + six fire-trail copies) whatever the entry's `color` says, so the green
// "spore-pod" fell as a molten fireball. No mob, elite affix or level-band rule is involved: Gloomspore Verge is the only
// Gloomspore map and the hazard came from its own map table.
// Fix (Gloomspore Verge only): drop that entry, so nothing falls from the sky there. Its mobs (Meloncholy, Thornmaw,
// Pinechad, Elderbark), the Blight Elder (its green column strike is its own sprite, not a meteor), loot, quests, portals
// and art are untouched. Every other map keeps its own ceiling hazard.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('gloomspore-no-fireball')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const cnt = (a) => s.split(a).length - 1;
const TAG = 'v0.30.1861 gloomspore-no-fireball';

// 1) Gloomspore Verge's ceiling hazard block (comment + entry) -> one marker comment
{
  const MAP = 'MAPS.gloomsporeVerge = {';
  const START = '  // v0.26.x \u2014 signature hazard: a constant drizzle of bursting spore-pods';
  const LABEL = "    label: 'a bursting spore-pod',";
  if (cnt(MAP) !== 1) die('map anchor matched ' + cnt(MAP));
  if (cnt(START) !== 1) die('block start matched ' + cnt(START));
  if (cnt(LABEL) !== 1) die('label matched ' + cnt(LABEL));
  const m = s.indexOf(MAP), a = s.indexOf(START), l = s.indexOf(LABEL);
  if (!(m < a && a < l && a - m < 600)) die('block not inside the Gloomspore Verge table');
  // the label line is followed by the introToast line and the entry's closing brace
  const e1 = s.indexOf(EOL, l) + EOL.length;           // start of the introToast line
  const e2 = s.indexOf(EOL, e1) + EOL.length;          // start of the closing line
  const e3 = s.indexOf(EOL, e2);                       // end of the closing line
  if (!s.slice(e1, e2).startsWith('    introToast: ')) die('introToast line not where expected');
  if (s.slice(e2, e3) !== '  },') die('closing brace not where expected: ' + JSON.stringify(s.slice(e2, e3)));
  const block = s.slice(a, e3);
  if (!block.includes('  ceilingHazards: {') || block.split(EOL).length !== 9) die('block shape changed (' + block.split(EOL).length + ' lines)');
  s = s.slice(0, a) + J(
    '  // ' + TAG + ' - NO CEILING HAZARD HERE (per user: "gloomspore maps should not have fireballs, remove it"). The Verge had',
    '  // a ceilingHazards "bursting spore-pod" drizzle; every ceiling hazard is a meteor_warn and draws the red meteor sprite whatever',
    "  // its colour, so it fell as a molten fireball in a fungal swamp. Removed: nothing falls from the sky here; the mobs, the Blight",
    "  // Elder's green column strike, loot and quests are unchanged, and every other map keeps its own ceiling hazard.",
  ) + s.slice(e3);
}

if (cnt('gloomspore-no-fireball') !== 1) die('marker count ' + cnt('gloomspore-no-fireball'));
const grew = s.length - n0;
if (grew < -300 || grew > 400) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: gloomspore-no-fireball (' + (grew >= 0 ? '+' : '') + grew + ' chars)');
