#!/usr/bin/env node
// Virga the Seraph — walk to flight, and shooting from altitude.
// ============================================================================
// Per user: "Virga should be able to transit from walking to flying mode as
// well and shoot."
//
// Two of these checks exist because of traps that are invisible in review:
//
//   * ORDER. The flight arc sits ABOVE the Banishment branch, and that branch
//     returns. Below it, every channel would freeze her mid-ascent.
//   * SELF-DRIVEN X. _noGravity makes the physics block skip her entirely, and
//     `m.x += m.vx` lives inside the branch that no longer runs — so flight has
//     to integrate x itself or she hangs motionless in the air.
//
// Both are the kind of thing that looks fine, ships, and reads as "the boss is
// stuck". They are asserted structurally rather than described in a comment.
//
//   node scripts/virga_flight_test.mjs [build.html]
// ============================================================================
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

// ---- the art exists, and the loader is allowed to know about it ------------
const flyDir = join(root, 'Sprites', 'bosses', 'zodiac', 'fly');
const flyFiles = existsSync(flyDir) ? readdirSync(flyDir).filter((f) => /^virgo_\d\.webp$/.test(f)) : [];
ok('9 flight frames on disk', flyFiles.length === 9, `${flyFiles.length} found`);
const idx = existsSync(join(root, 'data', 'sprite_frame_index.js'))
  ? readFileSync(join(root, 'data', 'sprite_frame_index.js'), 'utf8') : '';
ok('the frame index knows the flight set', /"bosses\/zodiac\/fly":\s*\{\s*"virgo":\s*9/.test(idx),
  'a dir missing from the index means art on disk the game never asks for');
const gen = readFileSync(join(root, 'scripts', 'gen_sprite_frame_index.mjs'), 'utf8');
ok('the index GENERATOR lists the flight dir', /'bosses\/zodiac\/fly'/.test(gen),
  'otherwise the next regenerate silently drops it again');

// ---- the state is wired through every picker -------------------------------
ok('ZODIAC_FLY_FRAMES declared', /const ZODIAC_FLY_FRAMES = Object\.create\(null\)/.test(s));
ok('flight frames are loaded', /_loadBossFrames\(ZODIAC_FLY_FRAMES, 'zodiac\/fly', ZODIAC_SPRITE_TYPES\)/.test(s));
ok("_zodiacFrame has a 'fly' branch", /state === 'fly'\)\s*return _bossLoopFrame\(ZODIAC_FLY_FRAMES\[sign\]/.test(s));
ok("_zodiacStateImg has a 'fly' branch", /state === 'fly'\)\s*return _zodiacRelFrame\(ZODIAC_FLY_FRAMES\[sign\]/.test(s));
ok('the state machine can select fly', /_flying \? 'fly'/.test(s));
ok('fly is gated on the frames existing', /m\._zFlying && typeof ZODIAC_FLY_FRAMES !== 'undefined'/.test(s),
  'a sign with no flight art must fall through untouched');
// Ranking: pounce and charge are brief committed motions and win; flight is a
// sustained mode and beats attack.
const rank = s.match(/const st = _charging \? 'charge'[\s\S]{0,320}?;/);
ok('fly ranks under pounce and over attack', !!rank
  && rank[0].indexOf("'pounce'") < rank[0].indexOf("_flying ? 'fly'")
  && rank[0].indexOf("_flying ? 'fly'") < rank[0].indexOf("atk ? 'attack'"));

// ---- the AI: take off, hold, land ------------------------------------------
const ai = s.match(/\n  virgo\(m, dt, dist, phase, z\) \{[\s\S]*?\n  \},\n/);
ok('the virgo AI block was found', !!ai);
const V = ai ? ai[0] : '';
ok('she takes off on a phase-scaled cycle', /_vFlyEvery = phase === 1 \? \d+ : phase === 2 \? \d+ : \d+/.test(V));
ok('flight sets _noGravity', /m\._noGravity = true;/.test(V) && /m\._zFlying = true/.test(V));
ok('flight captures a ground y to land on', /m\._zFlyGroundY = m\.y;/.test(V)
  && /m\.y = m\._zFlyGroundY; m\._zFlyCd/.test(V));
ok('landing clears _noGravity', /m\._zFlying = false; m\._noGravity = false;/.test(V));
ok('takeoff is blocked mid-channel and mid-Judgment',
  /!\(m\._virgoChannel > 0\) && !m\._virgoExecuteFiring/.test(V));

// THE TRAP: _noGravity skips the physics block, so `m.x += m.vx` never runs.
ok('flight steps x itself', /m\.x \+= _vStep;/.test(V), 'else she hangs motionless in the air');
// And a second, subtler one. Accumulating into m.vx the way her grounded gait
// does was MEASURED at 30 px of chase in four seconds against a player 567 px
// away: something downstream zeroes a _noGravity boss's vx every frame, so only
// the current frame's acceleration ever survives to be applied.
ok('the chase is a position step, not a vx accumulation',
  !/m\.vx \+= dir \* 0\.09/.test(V) && /_vStep = \(Math\.abs\(_vdx\) > 40\)/.test(V));
ok('flight clamps to the world', /if \(m\.x \+ m\.w > _vWw\) m\.x = _vWw - m\.w;/.test(V));

// THE OTHER TRAP: the Banishment branch returns.
const iFly = V.indexOf('m._zFlying = true');
const iChannel = V.indexOf('if (m._virgoChannel > 0) {');
ok('the flight arc runs BEFORE the returning channel branch', iFly > 0 && iChannel > 0 && iFly < iChannel,
  `fly@${iFly} channel@${iChannel} — below it, every channel freezes her mid-ascent`);

// ---- and she shoots from up there ------------------------------------------
ok('the column cadence tightens at altitude', /if \(m\._columnCd > \d+\) m\._columnCd = \d+;/.test(V));
ok('the tighten is a CLAMP, not an assignment', /if \(m\._columnCd > (\d+)\) m\._columnCd = \1;/.test(V),
  'assigning would re-arm a strike that just fired');

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
