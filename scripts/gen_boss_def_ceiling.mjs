#!/usr/bin/env node
// Per user: "We may need to fine tune to boss def, reduce all the def
// moderately, the max should result in a 80% reduction by gravitos."
//
// THE TARGET. Damage taken is K/(K+DEF) with K=300, so an 80% reduction means
// 20% taken: 300/(300+DEF) = 0.20 -> DEF = 1200. Gravitos currently sits at
// 3,100, which is 91.2% reduction.
//
// WHY NOT A FLAT RESCALE. Scaling every boss by 1200/3100 = 0.387 would take
// King Krook from 587 to 227 - back under thornmaw's 257 - and undo the whole
// point of v0.30.220 one release later. The reduction has to squeeze the TOP,
// where the curve is saturating, and leave the middle alone.
//
// So: a knee. Below KNEE the value is untouched; above it, the excess is
// compressed by whatever factor lands the highest boss exactly on 1200.
//
//   DEF <= 600      unchanged        (the 40-50 band the tester complained
//                                     about keeps every point it just gained)
//   DEF >  600      600 + (def-600) x k,  k chosen so 3100 -> 1200
//
// HP IS PUT BACK. v0.30.220 cut each boss's HP by (K+oldDef)/(K+newDef) to stop
// the DEF rise lengthening the fight. Lowering DEF again without reversing that
// would leave those bosses both softer AND shorter - a double nerf nobody asked
// for. HP is scaled by the inverse of the DEF change here, so fight length
// stays where v0.30.220 put it.
//
//   node scripts/gen_boss_def_ceiling.mjs         # rewrite
//   node scripts/gen_boss_def_ceiling.mjs --dry   # preview
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'monster_stats.js');
const DRY = process.argv.includes('--dry');
const K = 300;
const REDUCTION = +((process.argv.find((a) => a.startsWith('--reduction=')) || '').split('=')[1] || 0.80);
const KNEE = 600;
const TOP_DEF = Math.round(K / (1 - REDUCTION) - K);   // 80% -> 1200

const src = readFileSync(FILE, 'utf8');
const ctx = { window: {} }; ctx.globalThis = ctx;
vm.createContext(ctx); vm.runInContext(src, ctx);
const T = ctx.window.LX_MONSTER_STATS;
const names = Object.keys(T);
const isBoss = (k) => { const e = T[k]; return e.hp > 0 && Math.abs(e.exp - e.hp * 0.055) / Math.max(1, e.exp) < 0.06; };
const bosses = names.filter(isBoss);
const maxDef = Math.max(...bosses.map((k) => T[k].def));
if (maxDef <= KNEE) { console.error('nothing above the knee — already under the ceiling'); process.exit(0); }
const kFactor = (TOP_DEF - KNEE) / (maxDef - KNEE);
const squash = (d) => (d <= KNEE ? d : Math.round(KNEE + (d - KNEE) * kFactor));

// TRASH GETS A CEILING TOO, and it is not optional. A regular mob at DEF 2026
// (ossuaryTyrant, Lv 79) is an 87.1% reduction - HARDER to hurt than the final
// boss is allowed to be under the 80% rule. Leaving it there would put nine
// bosses back under their own band on defence, which is the exact inversion
// v0.30.220 existed to remove. Trash is capped at TOP_DEF/1.75 so a boss can
// still sit the requested 1.75x above the toughest thing standing next to it.
const TRASH_TOP = Math.round(TOP_DEF / 1.75);
const TRASH_KNEE = 300;
const trashNames = names.filter((k) => !isBoss(k));
const maxTrash = Math.max(...trashNames.map((k) => T[k].def));
const tFactor = maxTrash > TRASH_KNEE ? (TRASH_TOP - TRASH_KNEE) / (maxTrash - TRASH_KNEE) : 1;
const squashTrash = (d) => (d <= TRASH_KNEE ? d : Math.round(TRASH_KNEE + (d - TRASH_KNEE) * tFactor));

const plan = {};
for (const k of trashNames) {
  const e = T[k];
  const nDef = squashTrash(e.def);
  if (nDef === e.def) continue;
  plan[k] = { nDef, nHp: Math.max(1, Math.round(e.hp * (K + e.def) / (K + nDef))), old: e, trash: true };
}
for (const b of bosses) {
  const e = T[b];
  const nDef = squash(e.def);
  if (nDef === e.def) continue;
  // Put back exactly the HP that v0.30.220 took out for this DEF.
  const nHp = Math.max(1, Math.round(e.hp * (K + e.def) / (K + nDef)));
  plan[b] = { nDef, nHp, old: e };
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
  return ind + name + p3 + lvS + p5 + fit(String(P.nHp), hpS) + p7 + atkS +
         p9 + fit(String(P.nDef), defS) + p11 + fit(String(Math.max(1, Math.round(P.nHp * expPerHp))), expS) +
         p13 + fit(String(Math.max(0, Math.round(P.nHp * coinPerHp))), coinS) + p15;
});

const red = (d) => ((1 - K / (K + d)) * 100).toFixed(1) + '%';
console.log('\n  ceiling: ' + (REDUCTION * 100).toFixed(0) + '% reduction = DEF ' + TOP_DEF +
            '   (knee ' + KNEE + ', excess compressed x' + kFactor.toFixed(3) + ')\n');
console.log('  ' + 'boss'.padEnd(24) + 'lv'.padStart(4) + '        def'.padStart(18) + '   reduction'.padStart(22) + '          hp'.padStart(26));
for (const b of Object.keys(plan).filter((k) => !plan[k].trash).sort((x, y) => plan[x].old.lv - plan[y].old.lv)) {
  const P = plan[b], e = P.old;
  console.log('  ' + b.padEnd(24) + String(e.lv).padStart(4) +
    (e.def + ' -> ' + P.nDef).padStart(18) +
    (red(e.def) + ' -> ' + red(P.nDef)).padStart(22) +
    (e.hp.toLocaleString() + ' -> ' + P.nHp.toLocaleString()).padStart(26));
}
console.log('\n  rewritten: ' + changed + '   (bosses at or below DEF ' + KNEE + ' are untouched)');

if (DRY) console.log('  --dry: nothing written.');
else {
  writeFileSync(FILE + '.tmp', outLines.join('\n'), 'utf8');
  renameSync(FILE + '.tmp', FILE);
  console.log('  wrote ' + FILE);
}
