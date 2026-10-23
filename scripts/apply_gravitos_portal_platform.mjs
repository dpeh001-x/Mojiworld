// Gravitos's arena: the platform under the exit door never collapses (per user: "ensure that the platform on the portal does not
// disappear in form 2 and 3 as players might exit midway").
// ============================================================================
// What the player saw: the Singularity's one door (to the Weight-Bearer's Stair) stands at x 416 on the LEFT y:180 perch - the map
// bake (_lxHardbakeMapLayouts, "B") moved it there from the floor. _lxGravCollapse drops the y:180 pair as form 2 lands
// (_LX_GRAV_COLLAPSE[2]), so for the rest of the fight - form 2 and form 3, and since v0.30.1875 every echo fight too - the door hung
// in the air 300 px above the floor with nothing to stand on: Up below it is out of its 100 px reach, and the vent at x 240 now
// throws you past an empty sky. Nobody could leave mid-fight once he changed form. (The comment in the collapse still says every
// portal stands on the ground slab - true before the bake, not since.)
// What changes: a platform that carries a door is skipped by the collapse (_lxGravPortalHost: a door whose floor is within 24 px of
// the platform's authored top and whose x is over its authored span, widened by its drift swing). Read off the live doors, so it
// holds wherever the door is moved to later. Nothing else changes: the perch keeps its form-1 place, size, drift, collision and
// art; the right y:180 perch still falls in form 2 and the y:320 pair (and their vents) in form 3, with the same cracks, shake,
// debris and "THE ARENA IS COLLAPSING" toast; the door keeps its "Leave the fight?" prompt; a co-op guest runs the same collapse.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxGravPortalHost(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => {
  const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n);
  if (/[^\x09\x0a\x0d\x20-\x7e]/.test(b.split(a).join(''))) die(what + ': non-ASCII in the insert');
  s = s.replace(a, () => b);
};
const T = 'v0.30.1877 gravitos-portal-platform';

// (1) the helper, just above the collapse's own comment block
{
  const A = "// Mark this form's platforms as doomed. They stay SOLID through the telegraph:";
  once(A, J(
    `// ${T} - per user: "ensure that the platform on the portal does not disappear in form 2 and 3 as players might exit midway".`,
    '// The arena\'s door (the Weight-Bearer\'s Stair) has stood on the LEFT y:180 perch since the map bake moved it off the floor, and form 2',
    '// dropped that perch: the door hung in the air for the rest of the fight. A platform that carries a door now never collapses. Read off',
    '// the live doors (floor within 24 px of the platform\'s authored top, x over its authored span widened by its drift swing).',
    `function _lxGravPortalHost(q) {   // ${T}`,
    '  try {',
    '    if (!q || q.type === \'ground\') return false;',
    '    const bx = (q._driftBaseX != null) ? q._driftBaseX : q.x, by = (q._driftBaseY != null) ? q._driftBaseY : q.y, ax = Math.abs(q._driftAx || 0);',
    '    for (const po of ((typeof game !== \'undefined\' && game && game.portals) || [])) {',
    '      if (!po || typeof po.x !== \'number\') continue;',
    '      const py = (typeof po.y === \'number\') ? po.y : ((typeof _defaultPortalY === \'function\') ? _defaultPortalY(po.x) : 480);',
    '      if (Math.abs(py - by) <= 24 && po.x >= bx - ax && po.x <= bx + (q.w || 0) + ax) return true;',
    '    }',
    '  } catch (e) {}',
    '  return false;',
    '}',
    A), 'collapse comment');
}
// (2) the collapse skips it
{
  const A = "        (q) => q && q.type !== 'ground' && (q._driftBaseX != null ? q._driftBaseX : q.x) === t.x && (q._driftBaseY != null ? q._driftBaseY : q.y) === t.y && !q._lxDoomed);";
  once(A, A.slice(0, -2) + ` && !_lxGravPortalHost(q));   // ${T} - never the platform a door stands on`, 'collapse match');
}

const grew = s.length - n0;
if (grew < 1000 || grew > 2600) die('size moved ' + grew);
const marks = [...s.matchAll(/v0\.30\.(?:x|\d+) gravitos-portal-platform/g)].length;   // the ship chain retags x to the real version, here and in this file
if (marks !== 3) die('markers ' + marks);
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
console.log('applied: gravitos-portal-platform (+' + grew + ' chars, ' + marks + ' marks)');
