// Test: no boss attack set is a PING-PONG — a mirrored sequence pretending to
// be nine frames of animation.
//
// The defect: f0 f1 f2 f3 f3 f3 f2 f1 f0 — four unique images, a three-frame
// freeze in the middle, and a back half that is the front half reversed, so the
// attack visibly rewinds into its own wind-up. It is not a rendering bug
// (_bossLoopFrame is a plain forward `% n`); it comes from a salvage path in
// generate_gravitos_attack_anim.mjs that pads a short roll with
//     [...run, ...Array(holds).fill(peak), ...run.slice(0, -1).reverse()]
// That fallback beats crashing, but a mirrored set must never ship silently —
// which is what this test is for.
//   node scripts/boss_anim_pingpong_test.mjs
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// Sets still awaiting art. Six ludo.ai rolls for the punch came back filling the
// whole frame with fire (2,244-2,746 px of opaque edge bleed against a shipped
// standard of ZERO), so the generator refused them and left the old art in
// place: a rewinding animation beats a blast that hides the boss. Remove a key
// from here the moment its art is regenerated — the test then holds the line.
const KNOWN_UNFIXED = new Set(['gravitos3punch', 'gravitos3soul', 'gravitos2soul']);

const sets = {};
for (const sub of ['attack', 'idle', 'walk']) {
  const d = join(ROOT, 'Sprites', 'bosses', sub);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d)) {
    const m = f.match(/^(.*)_([0-8])\.webp$/);
    if (!m) continue;
    const k = sub + '|' + m[1];
    (sets[k] = sets[k] || [])[+m[2]] = join(d, f);
  }
}
const mirrored = [], scanned = [];
for (const [k, arr] of Object.entries(sets)) {
  if (arr.filter(Boolean).length !== 9) continue;
  const h = arr.map((p) => createHash('md5').update(readFileSync(p)).digest('hex'));
  scanned.push(k);
  if ([[8, 0], [7, 1], [6, 2], [5, 3]].every(([a, b]) => h[a] === h[b])) {
    mirrored.push({ set: k.split('|')[1], where: k.split('|')[0], unique: new Set(h).size });
  }
}
ok('the roster actually got scanned', scanned.length > 40, { sets: scanned.length });

const unexpected = mirrored.filter((m) => !KNOWN_UNFIXED.has(m.set));
ok('no NEW ping-ponged boss set has appeared', unexpected.length === 0, unexpected);

const fixedButListed = [...KNOWN_UNFIXED].filter((k) => !mirrored.some((m) => m.set === k));
ok('the known-unfixed list has no stale entries (remove a key once its art lands)',
   fixedButListed.length === 0, { staleEntries: fixedButListed });

// The one that WAS regenerated must stay forward-only.
{
  const f = [];
  for (let i = 0; i < 9; i++) f.push(join(ROOT, 'Sprites/bosses/attack', `gravitos3laser_${i}.webp`));
  const h = f.map((p) => createHash('md5').update(readFileSync(p)).digest('hex'));
  const uniq = new Set(h).size;
  const isMirror = [[8, 0], [7, 1], [6, 2], [5, 3]].every(([a, b]) => h[a] === h[b]);
  ok('gravitos3laser is nine distinct frames that never rewind',
     uniq === 9 && !isMirror && h[8] !== h[0], { unique: uniq, mirrored: isMirror });
}

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
if (mirrored.length) console.log('still mirrored (tracked): ' + mirrored.map((m) => m.set).join(', '));
process.exit(results.every((q) => q.pass) ? 0 : 1);
