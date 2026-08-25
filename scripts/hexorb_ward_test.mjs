#!/usr/bin/env node
// Grand Hex ward orbs — three seekers, three strikes each, walking the room.
// ============================================================================
// Per user: "for grand hex skill add in a similar mechanics to soul siphon orbs
// whereby there are orbs that get summoned, up to 3, these special orbs can
// hoam after hitting 1 monster (up to 3 times)", then: "the orbs should hoam
// when it catches monster in sight, from one monster to the next up to 3 times
// like a seeking homing missile".
//
// Three of these checks exist because the first builds failed them, and all
// three failures looked completely fine in the code:
//
//   * SIGHT TRAVELS WITH THE SEEKER. Copying the Soul Ward meant measuring the
//     acquisition radius from the PLAYER. After a strike the orb is standing on
//     its victim across the room, so player-centred sight makes it blind to the
//     monster beside it.
//   * IT MUST NOT GO HOME TO RE-ARM. Drifting back to the orbit between strikes
//     put the orb next to the caster by the time it could look again, so it
//     re-picked the nearest body: measured, nine strikes on two monsters.
//   * EXCLUDE EVERY VICTIM, NOT JUST THE LAST. From A the nearest not-A is B;
//     from B the nearest not-B is A. Excluding only the last one measured a
//     ping-pong, not a chain.
//
//   node scripts/hexorb_ward_test.mjs [build.html]
// ============================================================================
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || join(root, 'mojiworld_game.html');
const s = readFileSync(file, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};

// ---- the art ---------------------------------------------------------------
ok('p_hexmaster_hexorb.webp on disk', existsSync(join(root, 'Sprites', 'projectiles', 'p_hexmaster_hexorb.webp')));
let frames = 0;
for (let i = 0; i < 9; i++) if (existsSync(join(root, 'Sprites', 'projectiles', 'anim', `p_hexmaster_hexorb_${i}.webp`))) frames++;
ok('9-frame loop on disk', frames === 9, `${frames} found`);
const idx = existsSync(join(root, 'data', 'sprite_frame_index.js'))
  ? readFileSync(join(root, 'data', 'sprite_frame_index.js'), 'utf8') : '';
ok('the frame index knows the loop', /"p_hexmaster_hexorb":\s*9/.test(idx),
  'a set missing from the index is art the game never asks for');
ok('registered in LX_BULT_PROJ', /hexmaster_hexorb:\s*'p_hexmaster_hexorb\.webp'/.test(s));
ok('registered as an animated key', /'p_hexmaster_hexorb',/.test(s));
// It is a distinct sprite from the class's OTHER orb, not a reuse.
ok('it is not just Pandemic Hex\'s orb again',
  /hexmaster_hexorb:\s*'p_hexmaster_hexorb\.webp'/.test(s) && /bult_hexorb:\s*'p_ult_hexorb\.webp'/.test(s));

// ---- summoned by the cast, capped at three ---------------------------------
const cast = s.match(/hexmaster_grandhex: \(\) => \{[\s\S]*?\n  \},/);
ok('the Grand Hex cast was found', !!cast);
const C = cast ? cast[0] : '';
ok('the cast summons the ward', /player\._hexOrbs = _hw;/.test(C));
ok('"up to 3" is a cap, not an addition', /while \(_hw\.orbs\.length < LX_HEXORB_COUNT\)/.test(C),
  'a recast must top up to three, not stack six');
ok('a recast refreshes the timer', /_hw\.life = LX_HEXORB_LIFE_MS;/.test(C));
const count = Number((s.match(/LX_HEXORB_COUNT = (\d+)/) || [])[1] || 0);
const hits = Number((s.match(/LX_HEXORB_HITS = (\d+)/) || [])[1] || 0);
ok('three orbs', count === 3, `LX_HEXORB_COUNT=${count}`);
ok('three strikes each', hits === 3, `LX_HEXORB_HITS=${hits}`);

// ---- the engine ------------------------------------------------------------
const eng = s.match(/if \(player\._hexOrbs\) \{[\s\S]*?\n  \}\n/);
ok('the ward engine was found', !!eng);
const E = eng ? eng[0] : '';
ok('it homes with steering, not hitscan', /const sp = LX_HEXORB_SPEED \* \(dt \/ 16\.67\);/.test(E));
ok('contact lands damage AND a hex stack', /hitMonster\(m, _dmg, _c, 'hexorb'\)/.test(E) && /_hexAdd\(m, 1\)/.test(E));
ok('an orb burns out after its last strike', /if \(orb\.hits >= LX_HEXORB_HITS\) \{ hw\.orbs\.splice\(oi, 1\); continue; \}/.test(E));
ok('the ward clears when every orb is spent', /if \(!hw\.orbs\.length\) player\._hexOrbs = null;/.test(E));

// THE THREE TRAPS.
ok('sight is measured from the ORB, not the player',
  /const dx = \(m\.x \+ m\.w \/ 2\) - orb\.x, dy = \(m\.y \+ m\.h \/ 2\) - orb\.y;/.test(E),
  'a player-centred radius blinds the orb to whatever is next to it after a strike');
ok('it holds position while re-arming instead of going home',
  /if \(orb\.rearm > 0\) \{[\s\S]{0,600}?orb\.x \+= \(orb\.rvx \|\| 0\)/.test(E),
  'drifting back to the orbit makes it re-pick the nearest body every time');
ok('the chain excludes EVERY victim, not just the last',
  /orb\.seen && orb\.seen\.indexOf\(m\) >= 0/.test(E) && /orb\.tgt = fresh \|\| older \|\| lastOne;/.test(E));
ok('a lone target is still re-engaged', /lastOne/.test(E),
  'a boss fight has exactly one monster; refusing to re-engage would be dead weight');
ok('the re-arm gives the orb time to leave', /LX_HEXORB_REARM_MS = (\d+)/.test(s)
  && Number(s.match(/LX_HEXORB_REARM_MS = (\d+)/)[1]) >= 150,
  'without it three strikes land in one body inside a tenth of a second');
ok('the orbit is a drift, never a snap', /orb\.x \+= \(_ox - orb\.x\) \* k;/.test(E));

// ---- drawn, and cleaned up -------------------------------------------------
ok('drawHexOrbs exists', /function drawHexOrbs\(\) \{/.test(s));
ok('...and is actually called', /drawHexOrbs\(\);/.test(s));
ok('it plays the loop, staggered per orb',
  /_projAnimFrame\('p_hexmaster_hexorb', \(orb\.phase \|\| 0\) \* 69\)/.test(s));
ok('the orb is drawn UPRIGHT', !/drawHexOrbs\(\)[\s\S]{0,1400}?ctx\.rotate/.test(s),
  'an eye that tumbles reads as debris, not as something watching');
ok('the ward dies with its caster', (s.match(/player\._hexOrbs = null;\s+\/\/ v0\.30\.x/g) || []).length >= 2,
  'both cleanup sites, or a respawn inherits orbs from the corpse');

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
