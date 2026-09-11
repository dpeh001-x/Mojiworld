// Fliers stop sitting on the floor - the two source facts behind the fix, asserted.
//
// Per user, with a recording of B1: "the flying monsters behave strangely, after they seem rooted
// to the ground". Thirty Spirelings hovered on entry and sat in a row on the floor line a few
// seconds into the fight. Two independent faults, each of which is a one-line regression away:
//
//   1. flier DESTINATIONS are picked around the player's centre, and a player on the floor has half
//      of that circle underground; since v0.29.397 stops a flier AT the floor, such a destination
//      pins it there. Fix: hold the destination above the slab under it (_lxFlierFloorY).
//   2. the walk-latch drift-kill zeroed any vx under 35% of speed every tick; a flier's vx ramps
//      from zero through a 16% lerp, so it could never accelerate. Fix: grounded mobs only.
//
// The in-engine harness that produced the before/after numbers lives in the commit message; this
// file guards the source so a rebuild from a stale base cannot silently drop either line.
//   node scripts/flier_ground_test.mjs [path/to/mojiworld_game.html]
import { readFileSync } from 'node:fs';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const GAME = process.argv[2] || 'mojiworld_game.html';
const src = readFileSync(GAME, 'utf8');

ok('the Spireling (towerWisp) is a flier', /towerWisp:\s*\{[^}]*flies:true/.test(src), {});
ok('_lxFlierFloorY exists and reads the same ground-slab cache as the physics clamp',
   /function _lxFlierFloorY\(x\)[\s\S]{0,600}md\._lxGroundSlabsSrc !== plats/.test(src), {});
ok('every flier destination is held above the floor under it (applied once, after all the pickers, before the steer)',
   /if \(m\._flyDestY > _ceilY\) m\._flyDestY = _ceilY;[\s\S]{0,400}\/\/ Steer toward destination/.test(src), {});
ok('...with a hover height that scales with the mob', /const _hoverMin = Math\.max\(28, m\.h \* 0\.75\);/.test(src), {});
ok('...and a ceiling as well, so a clamp cannot push a destination off the top', /if \(m\._flyDestY < 10 \+ m\.h \/ 2\) m\._flyDestY = 10 \+ m\.h \/ 2;/.test(src), {});
ok('the physics floor clamp from v0.29.397 is still there (fliers may not sink through the floor either)',
   /if \(m\.y \+ m\.h > _flyLimit\) \{ m\.y = _flyLimit - m\.h; m\.vy = Math\.min\(0, m\.vy\); \}/.test(src), {});
ok('the walk-latch drift-kill is gated to grounded mobs', /else if \(!m\.flies && typeof _mobWalking === 'function' && !_mobWalking\(m\)/.test(src), {});
ok('...and still applies to grounded mobs (the kill itself was not removed)', /&& Math\.abs\(m\.vx \|\| 0\) < _lxMobWalkOn\(m\)\) m\.vx = 0;/.test(src), {});
ok('the cast-plant (vx = 0 while casting) still covers fliers - that one is intentional', /if \(typeof _mobCasting === 'function' && _mobCasting\(m\)\) m\.vx = 0;/.test(src), {});

const fails = results.filter((r) => !r.pass);
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);
