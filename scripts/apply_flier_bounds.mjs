// Fliers keep their destination inside the world, so they stop pinning
// themselves against the map edge.
// =============================================================================
// Per user (screenshot of B1, Spirelings sitting against the right edge):
// "monsters are stuck at the side after attacking (B1 expedition)".
//
// MEASURED FIRST (flier_wall_test: tower_b1 reloaded fresh per position, 30
// Spirelings, 1200 px, a god-mode player held still): with the player at
// x 1080, 27% of flier samples were pressed against a wall, 22 pinnings lasted
// over 2 s and 11 of 30 fliers were pinned at the end; at x 100, 19% / 15 / 8.
// Every pinned flier was in aggro mode with its destination OUTSIDE the map
// (3,922 samples across the run, e.g. x -71 on the left).
//
// WHY. The flier AI (v0.25.771) picks an aggro destination 180-320 px from the
// target at a random angle (strafers 220-400 px to one side, dive-bombers
// +-140), and nothing held it inside the world. Near a wall a large share
// landed past it; the flier steered into the wall, the physics clamp stopped
// it there, and a point outside the map can never be reached, so the 50 px
// arrival check never fired - it sat pinned until the 1.2-2.4 s timer
// re-rolled, and near a wall about half the re-rolls landed outside again.
// The dash was ruled out: it fires before the seek in the same frame, and the
// seek's speed cap clips it straight back to cruising speed.
//
// FIX. After the destination is picked (and every frame after, so nothing
// stale survives), a point outside the flyable span is MIRRORED across the
// target - the pass swings over the player instead of into the wall - and
// then clamped to the span a flier's centre can occupy (24 px inside each
// edge). Idle destinations were already inside the map and are only clamped.
// This is the one shared flier seek, so every flier near any wall benefits,
// not only B1's Spirelings.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('v0.30.x flier-bounds') || /v0\.30\.\d+ flier-bounds/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

const ANCHOR = '        // v0.30.569 \u2014 AIM ABOVE THE FLOOR (per user: "the flying monsters behave strangely, after they';
sub('dest bounds', ANCHOR,
  J('        // v0.30.612 flier-bounds - KEEP THE DESTINATION INSIDE THE WORLD (per user: "monsters are stuck',
    '        // at the side after attacking (B1 expedition)"). Aggro destinations are picked 180-320 px from',
    '        // the target at a random angle (strafers 220-400 px to one side) and nothing held them inside',
    '        // the map: near a wall a large share landed past it, the flier steered into the wall, the world',
    '        // clamp stopped it there, and since a point outside the map can never be reached the arrival',
    '        // check never fired - it sat pinned until the 1.2-2.4 s timer re-rolled, and near a wall about',
    '        // half the re-rolls landed outside again. Measured on B1 (30 Spirelings, 1200 px, player at',
    '        // x 1080): 27% of flier samples pressed against a wall, 11 of 30 pinned at the end. A point',
    '        // outside the flyable span is now mirrored across the target, so the pass swings over the',
    '        // player instead of into the wall, then clamped to where a flier\'s centre can be. Idle',
    '        // destinations were already inside the map; they are only clamped. Runs every frame, so a',
    '        // destination picked before a map change cannot survive it either.',
    '        if (m._flyDestX != null && game.mapData && game.mapData.worldWidth > 0) {',
    '          const _fbMin = m.w / 2 + 24, _fbMax = game.mapData.worldWidth - m.w / 2 - 24;',
    '          if (_fbMax > _fbMin && (m._flyDestX < _fbMin || m._flyDestX > _fbMax)) {',
    "            const _fbMir = (m._flyMode === 'a') ? 2 * _tgtX - m._flyDestX : NaN;",
    '            m._flyDestX = (_fbMir >= _fbMin && _fbMir <= _fbMax) ? _fbMir : Math.max(_fbMin, Math.min(_fbMax, m._flyDestX));',
    '          }',
    '        }',
    ANCHOR));

const grew = s.length - n0;
if (grew < 1000 || grew > 3500) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: flier bounds - destinations mirrored + clamped inside the world (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
