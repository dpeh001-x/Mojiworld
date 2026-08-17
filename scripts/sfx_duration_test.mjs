// SFX BUDGET - every regenerated clip must be a real MP3 under 1 second.
// =============================================================================
// The ludo /audio/sound-effect `duration` field is a HINT, not a contract:
// during this pass a requested 0.9 s came back as 1.80 s. So the bar is checked
// against each file's own MPEG frame headers, never against what was asked for.
//   1. PRESENT   every clip exists and decodes as MP3
//   2. UNDER 1s  measured from frame headers
//   3. WIRED     the game can actually reach each one
// Run: node scripts/sfx_duration_test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX = 1.0;

const CLIPS = [
  'audio/npc/npc_captain_plum.mp3',
  'audio/boss/boss_octobaby.mp3',
  'audio/monster/mob_octobaby_hit.mp3',
  'audio/monster/mob_octobaby_die.mp3',
  ...['Freeze', 'Poison', 'SkillLock', 'Stun'].flatMap(l => ([
    `audio/monster/mob_octoLeg${l}_hit.mp3`,
    `audio/monster/mob_octoLeg${l}_die.mp3`,
  ])),
  // Rotter (monster id `zombie`) — regenerated after "sounds like a animal
  // squeak"; both takes overshot the bar on their own (1.6-2.0 s) and are
  // faded to fit, so they belong under this guard permanently.
  'audio/monster/mob_zombie_hit.mp3',
  'audio/monster/mob_zombie_die.mp3',
  'audio/monster/mob_bonebosn_die.mp3',
  'audio/monster/mob_drownedCur_die.mp3',
  'audio/monster/mob_spectreCannoneer_die.mp3',
  'audio/monster/mob_brinekraken_die.mp3',
];

const RATES = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
const SR = [44100, 48000, 32000, 0];
function measure(file) {
  const b = fs.readFileSync(file);
  let p = 0;
  if (b.subarray(0, 3).toString('latin1') === 'ID3') {
    const sz = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
    p = 10 + sz;
  }
  let dur = 0, frames = 0;
  while (p + 4 < b.length) {
    if (b[p] !== 0xff || (b[p + 1] & 0xe0) !== 0xe0) { p++; continue; }
    const br = RATES[(b[p + 2] >> 4) & 0x0f] * 1000;
    const sr = SR[(b[p + 2] >> 2) & 0x03];
    if (!br || !sr) { p++; continue; }
    dur += 1152 / sr; frames++;
    p += Math.floor(144 * br / sr) + ((b[p + 2] >> 1) & 1);
  }
  return { dur, frames, bytes: b.length };
}

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

let worst = 0, worstFile = '';
for (const rel of CLIPS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { ok(`${rel} exists`, false, 'missing'); continue; }
  const m = measure(abs);
  ok(`${path.basename(rel)} is a decodable MP3 under ${MAX}s`,
     m.frames > 0 && m.dur > 0 && m.dur < MAX,
     `${m.dur.toFixed(2)}s, ${m.frames} frames, ${(m.bytes / 1024).toFixed(0)} KB`);
  if (m.dur > worst) { worst = m.dur; worstFile = path.basename(rel); }
}
ok(`the longest clip is comfortably under ${MAX}s`, worst < MAX, `${worstFile} at ${worst.toFixed(2)}s`);

// Wiring: the two explicit paths must be referenced by the game; the mob_*
// clips are probed by convention from the monster type id, so assert the types
// exist rather than looking for a literal path that is never written out.
const src = fs.readFileSync(path.join(ROOT, process.env.MOJI_GAME_FILE || 'mojiworld_game.html'), 'utf8');
// NPC voices are loaded BY CONVENTION -- `new Audio('audio/npc/npc_' + k + '.mp3')`
// where k = _npcTalkKey(npc.name) -- so the filename never appears in source.
// Checking for the literal path would fail on a perfectly wired clip, so
// reproduce the key derivation and confirm it lands on the file we wrote.
{
  const conv = /new Audio\('audio\/npc\/npc_' \+ k \+ '\.mp3'\)/.test(src);
  ok('NPC voices are loaded by the npc_<key>.mp3 convention', conv);
  const key = 'Captain Plum'.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  ok('the Captain Plum clip is reachable under its derived key',
     conv && key === 'captain_plum' && fs.existsSync(path.join(ROOT, `audio/npc/npc_${key}.mp3`)),
     `key "${key}"`);
  ok('an NPC named "Captain Plum" exists to trigger it', /name\s*:\s*'Captain Plum'/.test(src));
}
ok('the Octobaby boss sting is referenced by the game', src.includes('boss_octobaby.mp3'));
for (const t of ['octobaby', 'octoLegFreeze', 'octoLegPoison', 'octoLegSkillLock', 'octoLegStun',
                 'bonebosn', 'drownedCur', 'spectreCannoneer', 'brinekraken',
                 'zombie']) {   // the Rotter
  ok(`monster type "${t}" exists for its clip to be probed`, new RegExp(`\\b${t}\\s*:\\s*\\{`).test(src));
}

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
