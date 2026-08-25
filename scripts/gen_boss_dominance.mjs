#!/usr/bin/env node
// Per user: "Make bosses stronger than the trash beside them please" ...
// "it should be at least 1.5-2x stronger".
//
// The audit found this is not a 40s problem, it is the whole roster: 22 of 25
// bosses have LOWER defence than the trash in their own level band, and most
// hit softer too. A boss's only advantage was its HP pool, which is why they
// read as long rather than hard.
//
// THE RULE. For each boss, look at the non-boss monsters within +/-6 levels
// (widening if that band is empty) and set:
//
//   DEF = 1.75x the toughest trash in the band
//   ATK = 1.75x the hardest-hitting trash in the band
//
// 1.75 is the middle of the 1.5-2x the user asked for. A boss is never LOWERED
// - the target is a floor, not an assignment - so the handful already above the
// band keep what they have.
//
// HP IS REDUCED TO COMPENSATE, which is the part that makes this a difficulty
// change rather than a length change. Raising DEF alone would multiply the
// fight: damage taken scales as K/(K+DEF), so tripling DEF nearly triples the
// number of hits. HP is scaled by (K+oldDef)/(K+newDef) so the fight stays
// about as long as it is today while every hit of the boss's own hurts far
// more. The tester's complaint was that bosses are easy, not that they are
// short.
//
// SKIPPED, deliberately:
//   lv <= 10   the tower pair and `king`. Their level is nominal (two Lv 1
//              bosses with 17k and 90k HP), so a level-band comparison is
//              meaningless for them, and the starter band was left alone by
//              the difficulty ramp for the same reason.
//   outliers   a boss whose ATK is under a quarter of its band's median is
//              deriving its damage somewhere other than this table -
//              mirrorSelf at Lv 20 lists atk 21 against a band median in the
//              hundreds - and rewriting it here would be guessing at a system
//              this script cannot see.
//
//   node scripts/gen_boss_dominance.mjs          # rewrite the table
//   node scripts/gen_boss_dominance.mjs --dry    # print, change nothing
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'monster_stats.js');
const DRY = process.argv.includes('--dry');
const MUL = +((process.argv.find((a) => a.startsWith('--mul=')) || '').split('=')[1] || 1.75);
const K = 300;               // the armour curve's constant: damage taken = K/(K+DEF)
const DEF_CAP = 3100;        // hitMonster documents DEF 3000 as the endgame tier (~9% taken).
                             // 3100, not 3000, so the four zodiac signs pinned to the cap still
                             // clear 1.5x their band (2026 x 1.5 = 3039) instead of landing at 1.48x.

const src = readFileSync(FILE, 'utf8');
const ctx = { window: {} }; ctx.globalThis = ctx;
vm.createContext(ctx); vm.runInContext(src, ctx);
const T = ctx.window.LX_MONSTER_STATS;
const names = Object.keys(T);

const isBoss = (k) => { const e = T[k]; return e.hp > 0 && Math.abs(e.exp - e.hp * 0.055) / Math.max(1, e.exp) < 0.06; };
const isLeg = (k) => /^octoLeg/.test(k);
const trashNames = names.filter((k) => !isBoss(k) && !isLeg(k));

// The band around a boss, widened until it actually contains something.
// +/-4 keeps "beside" honest. At +/-6 a Lv 50 boss was being measured against
// elderbark at 56, six levels and a whole zone away.
const bandFor = (lv) => {
  for (const w of [4, 6, 9]) {
    const near = trashNames.filter((k) => Math.abs(T[k].lv - lv) <= w);
    if (near.length >= 3) return near;
  }
  return null;                      // past the trash ceiling — handled below
};
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const plan = {};
const skipped = [];
const above = [];   // bosses past the top of the trash roster
for (const b of names.filter(isBoss)) {
  const e = T[b];
  if (e.lv <= 10) { skipped.push([b, 'lv ' + e.lv + ' — nominal level, no meaningful band']); continue; }
  const near = bandFor(e.lv);
  if (!near) { above.push(b); continue; }   // no trash at this level at all
  const maxDef = Math.max(...near.map((k) => T[k].def));
  const maxAtk = Math.max(...near.map((k) => T[k].atk));
  const medAtk = median(near.map((k) => T[k].atk));
  if (e.atk < medAtk * 0.25) { skipped.push([b, 'atk ' + e.atk + ' is under a quarter of the band median ' + medAtk + ' — stats come from elsewhere']); continue; }
  const nDef = Math.max(e.def, Math.round(maxDef * MUL));
  const nAtk = Math.max(e.atk, Math.round(maxAtk * MUL));
  // Hold the fight length: HP scales down by exactly the factor DEF raised it.
  const nHp = Math.max(1, Math.round(e.hp * (K + e.def) / (K + nDef)));
  plan[b] = { nHp, nAtk, nDef, old: e, maxDef, maxAtk };
}

// THE LADDER PASS. Two problems the band rule cannot solve on its own, and one
// mechanism fixes both:
//
//   FLATTENING. The trash roster thins out badly above 70 — six zodiac signs
//   from Cancer to Sagittarius all resolve to the SAME band, so all six landed
//   on an identical DEF 3546 / ATK 15360 and the progression from Aries to
//   Pisces disappeared.
//
//   THE CEILING. There is no trash at all above Lv 86, so Aquarius, Pisces and
//   Gravitos had no band and were being dropped from the rewrite entirely —
//   silently, which is worse than being wrong loudly.
//
// So after the band targets are set, walk the bosses in level order and require
// each to exceed the one below it, scaled by the distance between them. A boss
// past the trash ceiling simply keeps climbing the ladder its predecessors set.
{
  const GROWTH = 0.045;             // per level of separation, compounding
  const ordered = names.filter(isBoss).filter((b) => T[b].lv > 10).sort((x, y) => T[x].lv - T[y].lv);
  let prev = null;
  for (const b of ordered) {
    const e = T[b];
    if (skipped.some(([n]) => n === b)) continue;
    let P = plan[b];
    if (!P) {                       // above the trash ceiling: ladder only
      P = plan[b] = { nDef: e.def, nAtk: e.atk, nHp: e.hp, old: e, viaLadder: true };
    }
    if (prev) {
      const gap = Math.max(1, e.lv - prev.old.lv);
      const step = Math.pow(1 + GROWTH, gap);
      P.nDef = Math.max(P.nDef, Math.round(prev.nDef * step));
      P.nAtk = Math.max(P.nAtk, Math.round(prev.nAtk * step));
    }
    // DEF is CAPPED, because the armour curve is non-linear and the ladder ran
    // away past the top of it: Gravitos reached DEF 10,196, which is 97% damage
    // reduction, and the HP compensation then cut it from 60.6M to 3.0M. The
    // fight stays the same length on paper and reads as chipping a wall.
    // hitMonster's own table calls DEF 3000 the endgame tier (9.1% taken), so
    // that is the ceiling. Several top bosses land on it together; ATK is left
    // uncapped and carries the difference between them from there.
    P.nDef = Math.min(P.nDef, DEF_CAP);
    // HP recompensated LAST, against the DEF this boss finally landed on, so a
    // ladder bump cannot quietly lengthen the fight it was meant to leave alone.
    P.nHp = Math.max(1, Math.round(e.hp * (K + e.def) / (K + P.nDef)));
    prev = P;
  }
}

const LINE = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:\s*\{\s*lv:\s*)(\d+)(,\s*hp:\s*)(\d+)(,\s*atk:\s*)(\d+)(,\s*def:\s*)(\d+)(,\s*exp:\s*)(\d+)(,\s*coin:\s*)(\d+)(\s*\},?\s*)$/;
const fit = (n, o) => (n.length >= o.length ? n : ' '.repeat(o.length - n.length) + n);
let changed = 0;
const outLines = src.split('\n').map((line) => {
  const m = line.match(LINE);
  if (!m) return line;
  const [, ind, name, p3, lvS, p5, hpS, p7, atkS, p9, defS, p11, expS, p13, coinS, p15] = m;
  const P = plan[name];
  if (!P) return line;
  const e = P.old;
  const expPerHp = e.hp > 0 ? e.exp / e.hp : 0;
  const coinPerHp = e.hp > 0 ? e.coin / e.hp : 0;
  changed++;
  return ind + name + p3 + lvS + p5 + fit(String(P.nHp), hpS) + p7 + fit(String(P.nAtk), atkS) +
         p9 + fit(String(P.nDef), defS) + p11 + fit(String(Math.max(1, Math.round(P.nHp * expPerHp))), expS) +
         p13 + fit(String(Math.max(0, Math.round(P.nHp * coinPerHp))), coinS) + p15;
});

console.log('\n  target: DEF and ATK at ' + MUL + 'x the toughest / hardest-hitting trash within the band\n');
console.log('  ' + 'boss'.padEnd(24) + 'lv'.padStart(4) + '        hp'.padStart(24) + '   atk'.padStart(17) + '   def'.padStart(15));
for (const b of Object.keys(plan).sort((x, y) => plan[x].old.lv - plan[y].old.lv)) {
  const P = plan[b], e = P.old;
  console.log('  ' + b.padEnd(24) + String(e.lv).padStart(4) +
    (e.hp.toLocaleString() + ' -> ' + P.nHp.toLocaleString()).padStart(24) +
    (e.atk + ' -> ' + P.nAtk).padStart(17) + (e.def + ' -> ' + P.nDef).padStart(15));
}
console.log('\n  rewritten: ' + changed);
if (skipped.length) { console.log('  skipped:'); for (const [b, why] of skipped) console.log('    ' + b.padEnd(22) + why); }

if (DRY) console.log('\n  --dry: nothing written.');
else {
  writeFileSync(FILE + '.tmp', outLines.join('\n'), 'utf8');
  renameSync(FILE + '.tmp', FILE);
  console.log('\n  wrote ' + FILE);
}
