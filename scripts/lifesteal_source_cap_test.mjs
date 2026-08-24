#!/usr/bin/env node
// Per user: "max tier of lifesteal is at 1.5% each".
//
// The runtime ceiling is proved by lifesteal_cap_test.mjs (it drives real hits
// and measures healing against damage). This is the other half: no single
// EQUIPMENT or BOON source may DECLARE more than 1.5% in the first place, so
// the combined cap is a backstop rather than the only thing holding the line.
//
// Checked here: innate item stats, set bonuses, the random affix roll, the
// 'of Vampirism' suffix roll, and the skill-tree boon grants.
//
// Deliberately NOT checked, because the user scoped this to equipment and
// boons: job passives (JOB_ENHANCE knight/warlock) and the temp-fx ult windows.
// Those are listed at the end as an advisory so the omission is visible rather
// than silent.
//
//   node scripts/lifesteal_source_cap_test.mjs [file.html]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const src = readFileSync(path.join(ROOT, FILE), 'utf8');
const LIMIT = 0.015;
const over = [];
const notes = [];

// --- innate item stats -----------------------------------------------------
// Item entries are written `lifesteal:0.0x` with no space; job passives, ult
// windows, the set bonus and the suffix use a space. That spacing is the only
// thing separating the two families in the source, so it is asserted rather
// than assumed: if items ever gain a space this check would silently pass on
// zero rows, and the count guard below catches that.
const items = [...src.matchAll(/lifesteal:(\d*\.\d+)/g)].map((m) => +m[1]);
if (!items.length) { console.error('FAIL — found no innate item lifesteal stats; the pattern has drifted.'); process.exit(1); }
for (const v of items) if (v > LIMIT + 1e-9) over.push('item innate ' + (v * 100).toFixed(2) + '%');
notes.push('innate item stats checked: ' + items.length + ', max ' + (Math.max(...items) * 100).toFixed(2) + '%');

// --- set bonuses -----------------------------------------------------------
const sets = [...src.matchAll(/bonus[23]:\s*\{[^}]*lifesteal:\s*(\d*\.\d+)/g)].map((m) => +m[1]);
for (const v of sets) if (v > LIMIT + 1e-9) over.push('set bonus ' + (v * 100).toFixed(2) + '%');
notes.push('set bonuses checked: ' + sets.length + (sets.length ? ', max ' + (Math.max(...sets) * 100).toFixed(2) + '%' : ''));

// --- the random affix roll -------------------------------------------------
// Read min/max/scale straight out of the table entry and evaluate the top roll
// the same way the game does, so a change to either the band or the divisor is
// caught rather than just a change to the literal.
// Matched on the entry's LINE rather than with a brace-bounded pattern: the
// entry's own fmt is a template literal containing `${r}`, so a [^}] scan stops
// dead inside it.
const affixLine = src.split('\n').find((l) => l.includes("id:'ls',") && l.includes("stat:'lifesteal'"));
const affix = affixLine && affixLine.match(/min:(\d+),\s*max:(\d+),/);
const affixDiv = affixLine && affixLine.match(/scale:r=>r\/(\d+)/);
if (!affix || !affixDiv) { console.error("FAIL — could not read the id:'ls' affix entry; the table has changed shape."); process.exit(1); }
affix[3] = affixDiv[1];
const affixTop = (+affix[2]) / (+affix[3]);
if (affixTop > LIMIT + 1e-9) over.push('affix Lifesteal max roll ' + (affixTop * 100).toFixed(2) + '%');
notes.push('affix roll band: ' + affix[1] + '-' + affix[2] + ' / ' + affix[3] +
           '  =  ' + ((+affix[1]) / (+affix[3]) * 100).toFixed(1) + '%-' + (affixTop * 100).toFixed(1) + '%');

// --- the 'of Vampirism' suffix --------------------------------------------
const vamp = src.match(/vampirism:\s*\{[^}]*lifesteal:\s*(\d*\.\d+)\s*\+\s*Math\.random\(\)\s*\*\s*(\d*\.\d+)/);
if (!vamp) { console.error('FAIL — could not read the of Vampirism suffix roll.'); process.exit(1); }
const vampTop = (+vamp[1]) + (+vamp[2]);
if (vampTop > LIMIT + 1e-9) over.push('suffix of Vampirism max roll ' + (vampTop * 100).toFixed(2) + '%');
notes.push('of Vampirism roll: ' + ((+vamp[1]) * 100).toFixed(1) + '%-' + (vampTop * 100).toFixed(1) + '%');

// --- boon grants -----------------------------------------------------------
const boons = [...src.matchAll(/(?:p\.mods\.lifesteal\s*\+=\s*|M\.lifesteal\s*=\s*\(M\.lifesteal\s*\|\|\s*0\)\s*\+\s*)(\d*\.\d+)/g)].map((m) => +m[1]);
if (!boons.length) { console.error('FAIL — found no boon lifesteal grants; the pattern has drifted.'); process.exit(1); }
for (const v of boons) if (v > LIMIT + 1e-9) over.push('boon grant ' + (v * 100).toFixed(2) + '%');
notes.push('boon grants checked: ' + boons.length + ', max ' + (Math.max(...boons) * 100).toFixed(2) + '%');
if (new Set(boons).size !== 1) {
  over.push('the two Berserker grants disagree (' + boons.map((v) => (v * 100).toFixed(2) + '%').join(' vs ') +
            ') — the node apply() and the mods rebuild must match');
}

// --- the combined ceiling --------------------------------------------------
const cap = src.match(/const LX_LIFESTEAL_CAP = (\d*\.\d+);/);
if (!cap) { console.error('FAIL — LX_LIFESTEAL_CAP is missing from the build.'); process.exit(1); }
notes.push('combined cap: ' + (+cap[1] * 100).toFixed(0) + '%');

console.log('\n  ' + FILE);
for (const n of notes) console.log('    ' + n);
if (+cap[1] > 0.07 + 1e-9) over.push('combined cap is ' + (+cap[1] * 100).toFixed(0) + '%, expected 7%');

// --- advisory: what was deliberately left alone ---------------------------
const jobs = [...src.matchAll(/(\w+):\s*\{\s*basicDmg:[^}]*lifesteal:\s*(\d*\.\d+)/g)].map((m) => m[1] + ' ' + (+m[2] * 100).toFixed(0) + '%');
const ults = [...src.matchAll(/window:\s*\{[^}]*lifesteal:\s*(\d*\.\d+)/g)].map((m) => +m[1]);
console.log('\n  not in scope (skills, not equipment or boons) — still bounded by the ' + (+cap[1] * 100).toFixed(0) + '% combined cap:');
if (jobs.length) console.log('    job passives : ' + jobs.join(', '));
if (ults.length) console.log('    ult windows  : ' + ults.length + ' entries, ' +
  (Math.min(...ults) * 100).toFixed(0) + '%-' + (Math.max(...ults) * 100).toFixed(0) + '%');

if (over.length) {
  console.error('\n  OVER THE 1.5% PER-SOURCE CEILING:');
  for (const o of over.slice(0, 20)) console.error('    ' + o);
  if (over.length > 20) console.error('    (' + over.length + ' total)');
  console.error('\nFAIL');
  process.exit(1);
}
console.log('\nPASS — every equipment and boon lifesteal source is at or under 1.5%.');
