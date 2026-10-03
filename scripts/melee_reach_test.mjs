// Static test: MELEE REACH FOLLOWS THE BOX.
//
// bigMelee.range is measured centre-to-centre (_bmDxAbs < bm.range), so it is
// coupled to m.w. v0.30.420 grew every box to the art it draws without moving
// the sprite, and each swinger's reach BEYOND ITS EDGE shrank by half the
// growth - Legosaurus (224 -> 388) and Blight Elder (130 -> 308) could only
// swing at a player already inside their box. The defs now carry per-type
// compensation; this pins every swinger's reach-beyond-edge to the value it
// had before the boxes grew (golden, from the last pre-v0.30.420 build).
//   node scripts/melee_reach_test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'mojiworld_game.html'), 'utf8');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// reach beyond the box edge (range - w/2) at 2da338dc, the last build before the boxes grew
const GOLDEN = { scorpion: 67, mummy: 81.5, nougatBear: 78, thornmaw: 76, elderbark: 75, forgewight: 75, smithgolem: 72,
  shardlich: 84, blightElder: 85, ossuaryTyrant: 105, tombKeeper: 104, echoKnight: 95, blockPopo: 57.5, blockHupo: 77.5,
  blockEle: 63, blockGary: 77.5, blockTigreal: 94, taiger: 91, willeo: 141,   // v0.30.1549: the reaches the mirror's copies of Kuro and the Taxi Uncle had
  deranged_kuro: 91,   // v0.30.1591 distorted-roster: Kuro is back in the mirror, at the reach he had before v0.30.1549
  young_confused_barnaby: 115, fatDragon: 65, sundered_smith: 100, goblinMauler: 85, boneGolem: 95, graveReaver: 110,
  towerArbiter: 290, towerSovereign: 72.5, legosaurus: 68 };

// single-line defs
const found = {};
for (const m of src.matchAll(/^  ([a-zA-Z_][a-zA-Z0-9_]*): *\{ name:'[^']*', *w:(\d+), h:(\d+)[^\n]*?bigMelee:\{([^}]*)\}/gm)) {
  const r = /range:(\d+)/.exec(m[4]); const a = /arcW:(\d+)/.exec(m[4]); const k = /kind:'(\w+)'/.exec(m[4]);
  if (r) found[m[1]] = { w: +m[2], range: +r[1], arcW: a ? +a[1] : 220, kind: k && k[1] };
}
// legosaurus: two-line def
{ const lw = /legosaurus:    \{ name:'Legosaurus, the Warped Tyrant', w:(\d+), h:/.exec(src);
  const lr = /bigMelee:\{ kind:'swing', dmgMul:2\.2, range:(\d+)/.exec(src);
  if (lw && lr) found.legosaurus = { w: +lw[1], range: +lr[1] }; }

const missing = Object.keys(GOLDEN).filter((t) => !found[t]);
ok('every golden swinger is still a bigMelee swinger in the defs', missing.length === 0, missing);
const off = [];
for (const t of Object.keys(GOLDEN)) { if (!found[t]) continue; const reach = found[t].range - found[t].w / 2;
  if (Math.abs(reach - GOLDEN[t]) > 1.01) off.push(t + ': reach ' + reach + ' vs golden ' + GOLDEN[t] + ' (w ' + found[t].w + ', range ' + found[t].range + ')'); }
ok('each swinger reaches exactly as far beyond its box edge as before the boxes grew (+/-1 px)', off.length === 0, off);
// v0.30.1424 smash-reach: a 'smash' fires a ground shock +-arcW/2 about the box CENTRE, so its reach beyond the edge
// (arcW/2 - w/2) shrank with every box that grew, exactly as the trigger's did - and nothing carried it over (Blight
// Elder's shock reached 10 px past a 240 px box while he started it from 119). Golden: 2da338dc again.
const SMASH_GOLDEN = { elderbark: 65, forgewight: 55, blightElder: 65, tombKeeper: 104, blockEle: 48, blockTigreal: 69,
  boneGolem: 75 };   // lady_honk left: a bowmaster since v0.30.1582, no smash
const smashers = Object.keys(found).filter((t) => found[t].kind === 'smash'); const sOff = [];
for (const t of smashers) { const reach = found[t].arcW / 2 - found[t].w / 2;
  if (!(t in SMASH_GOLDEN) || Math.abs(reach - SMASH_GOLDEN[t]) > 1.01) sOff.push(t + ': shock reaches ' + reach + ' past the edge vs golden ' + SMASH_GOLDEN[t] + ' (w ' + found[t].w + ', arcW ' + found[t].arcW + ')'); }
ok('each smash\'s ground shock reaches exactly as far beyond its box edge as before the boxes grew (+/-1 px)',
  sOff.length === 0 && smashers.length === Object.keys(SMASH_GOLDEN).length, sOff.concat(smashers.length === Object.keys(SMASH_GOLDEN).length ? [] : ['smashers: ' + smashers.join(',')]));
ok('the smash shock is still centred on the box (if this changes, the smash golden changes meaning)',
  /x: m\.x \+ m\.w\/2 - _arcW\/2,/.test(src), null);
const extra = Object.keys(found).filter((t) => !(t in GOLDEN));
ok('no swinger has appeared that this table does not pin (add its golden reach when one does)', extra.length === 0, extra);
ok('the zodiac swing signs carry their reach onto the new absolute box',
  /const _zSwingRange = 175 \+ Math\.round\(\(_zNewW - _zOldW\) \/ 2\);/.test(src) && /range:_zSwingRange/.test(src),
  null);
ok('the horizontal trigger is still centre-to-centre (if this changes, the golden table changes meaning)',
  /_bmDxAbs = Math\.abs\(_playerCx - \(m\.x \+ m\.w\/2\)\);[\s\S]{0,600}?const _bmInRange = _bmDxAbs < bm\.range/.test(src), null);
ok('the vertical gate is feet-to-feet, independent of box height (grounded targets always in range)',
  /const _bmInRange = _bmDxAbs < bm\.range && Math\.abs\(\(player\.y \+ player\.h\) - \(m\.y \+ m\.h\)\) < \(bm\.swingH \|\| 100\);/.test(src), null);

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
