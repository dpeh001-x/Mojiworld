#!/usr/bin/env node
// _frameIsAttack must describe the FRAME, not the intent.
// ============================================================================
// Per user: "weird bug in which forgewight and smithgolem suddenly have frames
// in which the subject monster becomes significantly large", and then, when the
// first diagnosis went after the art: "there are certain times that the frames
// become 2x larger than expected, its not simple drift".
//
// Seven mob types author their swing frames inside a PADDED canvas, and the
// renderer compensates with _ATK_FRAME_SCALE - a per-type box multiplier of
// 1.6x to 2.3x applied whenever m._frameIsAttack is set. It is only ever safe
// on an ATTACK frame, because only those frames are padded.
//
// The flag was assigned from the INTENT:
//
//     m._frameIsAttack = !!attacking;
//     ...
//     if (attacking && !_mobWalking(m)) return ...set.attack...;
//     if (_mobWalking(m))               return ...set.walk...;    <- returned
//
// The frame that comes back needs more than `attacking`: the "walk outranks the
// incidental attack pose" rule hands back a WALK frame when the mob is moving,
// and walk frames are authored at full size. So the padding multiplier landed
// on art that never needed it.
//
// Measured end to end - the content height of the frame actually returned,
// times the multiplier the renderer would apply, which is proportional to the
// character's on-screen height:
//
//                    largest / median drawn size
//     forgewight     2.58x   ->   1.19x
//     smithgolem     1.51x   ->   1.39x
//
// The residue is the separate, much smaller art-scale drift in the attack sets
// (9-20% across a set, against 0.1-5% for the same mobs' idle and walk art).
// That is a real but different problem and is deliberately not asserted here.
//
//   node scripts/mob_attack_flag_test.mjs [build.html]
// ============================================================================
import { readFileSync } from 'node:fs';
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

// ---- the flag ---------------------------------------------------------------
const assigns = s.match(/m\._frameIsAttack\s*=\s*[^;]+;/g) || [];
ok('the flag is assigned in exactly one place', assigns.length === 1,
  `${assigns.length} assignments — two writers could disagree`);
const assign = assigns[0] || '';
ok('the flag is gated on NOT walking', /_mobWalking\(m\)/.test(assign),
  `assignment reads: ${assign.trim().slice(0, 90)}`);
ok('...and gated the right way round', /!!attacking\s*&&\s*!\(/.test(assign),
  'it must be "attacking AND NOT walking", not the reverse');

// ---- it has to match the branch that picks the frame ------------------------
// If these two conditions ever differ again, the flag and the frame disagree
// and the multiplier lands on unpadded art.
const branch = s.match(/if \(attacking && !\(typeof _mobWalking === 'function' && _mobWalking\(m\)\)\) \{/);
ok('the attack-frame branch still guards on !walking', !!branch);
const sameShape = branch && /attacking\s*&&\s*!\(typeof _mobWalking === 'function' && _mobWalking\(m\)\)/.test(assign);
ok('the flag uses the SAME condition as the branch', !!sameShape,
  'they must be one expression apart, or this bug comes straight back');

// ---- the consumer that made it visible --------------------------------------
ok('the padding multiplier still keys off the flag',
  /const _atkScale = \(m\._frameIsAttack && _ATK_FRAME_SCALE\[m\.type\]\) \|\| 1;/.test(s),
  'this is the line that turned the mismatch into a doubled monster');

console.log(`\n${pass}/${pass + fail} checks passed`);
const types = (s.match(/const _ATK_FRAME_SCALE = Object\.assign\(Object\.create\(null\), \{([\s\S]*?)\}\);/) || [])[1] || '';
const n = (types.match(/^\s*\w+:\s*[\d.]+/gm) || []).length;
console.log(`note: ${n} mob types take the padding multiplier — all of them were affected, not just the two reported`);
process.exit(fail ? 1 : 0);
