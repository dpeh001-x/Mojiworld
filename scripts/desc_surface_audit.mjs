#!/usr/bin/env node
// Audit the NON-SKILL description surfaces against the code that implements them.
// =============================================================================
// scripts/skill_desc_audit.mjs covers the 72 skill cards. The game shows another
// ~270 descriptions across seventeen more tables, and the mechanical ones make
// hard numeric promises the code has to keep:
//
//   JOB_TALENTS      desc '+10% ATK'      fx { atkPct: 0.10 }        (inline)
//   SKILL_TREE       desc '+15% ATK ...'  treeHas('w_blood') ...     (elsewhere)
//   EDICTS           desc 'Enemy DEF +50%' _edictOn('ironVerdict') -> *1.5
//   TOWER_MODIFIERS  desc '+50% enemies'  mod.id === 'swarm' -> *1.5
//   BOON_SYNERGIES   desc '+25% crit dmg' _activeSynergies.lethalEye -> += 0.25
//
// Each table needs its own idiom for "where is this implemented", which is the
// whole reason a single generic matcher kept producing noise. Two traps are
// encoded here because both cost real time:
//   * a flat-number regex must not match the digits INSIDE a percentage —
//     /([+\-])\s*(\d+)(?!\s*%)/ happily reads "+10%" as "+1".
//   * comments must be stripped from implementations before matching, or a
//     stale comment reads as live behaviour.
//
//   node scripts/desc_surface_audit.mjs           # report mismatches
//   node scripts/desc_surface_audit.mjs --all     # include what passed
// =============================================================================
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_GAME_SRC || join(ROOT, 'mojiworld_game.html');
const raw = await readFile(SRC, 'utf8');
const html = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/gm, '$1 ');
const showAll = process.argv.includes('--all');

// ---- numbers a description states ------------------------------------------
function stated(desc) {
  const out = [];
  for (const m of desc.matchAll(/(\d+(?:\.\d+)?)\s*%/g)) out.push({ raw: m[0].trim(), pct: +m[1] });
  // a flat number, but NOT the digits of a percentage and NOT a ratio like 5:1
  for (const m of desc.matchAll(/([+\-−])\s*(\d+(?:\.\d+)?)(?!\s*[%:\d])/g))
    out.push({ raw: m[0].trim(), flat: +m[2] });
  for (const m of desc.matchAll(/(\d+(?:\.\d+)?)\s*×/g)) out.push({ raw: m[0].trim(), mul: +m[1] });
  return out;
}
// every value a stated number could legitimately appear as in code
function forms(s) {
  const out = [];
  if (s.pct != null) out.push(s.pct, s.pct / 100, 1 + s.pct / 100, 1 - s.pct / 100);
  if (s.flat != null) out.push(s.flat, s.flat / 100);
  if (s.mul != null) out.push(s.mul);
  return out;
}
const near = (a, b) => Math.abs(a - b) <= Math.max(0.0005, Math.abs(b) * 0.02);
const numsIn = (text) => [...new Set((text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number))];

// ---- pull `id`/`key` + `desc` pairs out of a table --------------------------
function table(name) {
  const at = html.indexOf('const ' + name);
  if (at < 0) return [];
  let d = 0, open = -1, close = -1;
  for (let i = at; i < html.length; i++) {
    const c = html[i];
    if (c === '{' || c === '[') { if (open < 0) open = i; d++; }
    else if (c === '}' || c === ']') { d--; if (!d) { close = i; break; } }
  }
  const body = html.slice(open, close + 1);
  const out = [];
  for (let k = 0; k < body.length; k++) {
    if (body[k] !== '{') continue;
    let dd = 0, e = k;
    for (; e < body.length; e++) { const c = body[e]; if (c === '{') dd++; else if (c === '}') { dd--; if (!dd) break; } }
    const chunk = body.slice(k, e + 1);
    const dm = /\bdesc\s*:\s*'((?:[^'\\]|\\.)*)'/.exec(chunk);
    if (dm && chunk.length < 4000) {
      const im = /\b(?:id|key)\s*:\s*'([^']+)'/.exec(chunk);
      out.push({ id: im ? im[1] : null, desc: dm[1].replace(/\\'/g, "'"), chunk });
      k = e;
    }
  }
  return out;
}

// ---- where each surface implements an entry --------------------------------
const SURFACES = [
  { name: 'JOB_TALENTS',     site: (e) => e.chunk },                       // fx is inline
  { name: 'SKILL_TREE',      site: (e) => e.chunk + ' ' + sitesFor(`treeHas\\(\\s*'${e.id}'\\s*\\)`) },
  { name: 'EDICTS',          site: (e) => sitesFor(`_edictOn\\(\\s*'${e.id}'\\s*\\)`) },
  { name: 'TOWER_MODIFIERS', site: (e) => sitesFor(`\\bid\\s*===?\\s*'${e.id}'`) },
  { name: 'BOON_SYNERGIES',  site: (e) => sitesFor(`_activeSynergies[.\\[]\\s*'?${e.id}`) + ' ' + sitesFor(`_syn\\.${e.id}\\b`) },
];
function sitesFor(pattern) {
  try {
    // The value is usually on the NEXT line — `if (..._syn.x) {` then
    // `d += 0.25;` — so the window must cross newlines, or every multi-line
    // effect reports as "the code uses no numbers".
    const re = new RegExp(pattern + '[\\s\\S]{0,220}', 'g');
    return (html.match(re) || []).join(' ');
  } catch (e) { return ''; }
}

let flagged = 0, checked = 0, noSite = 0;
for (const surface of SURFACES) {
  const list = table(surface.name);
  const bad = [];
  for (const e of list) {
    const claims = stated(e.desc);
    if (!claims.length) continue;                 // pure flavour text claims nothing
    checked++;
    const site = surface.site(e);
    if (!site.trim()) { noSite++; bad.push({ e, why: 'no implementation site found for this id' }); continue; }
    const nums = numsIn(site.replace(/desc\s*:\s*'(?:[^'\\]|\\.)*'/g, ' '));
    const missing = claims.filter((c) => !forms(c).some((v) => nums.some((n) => near(v, n))));
    if (missing.length) bad.push({ e, why: 'states ' + missing.map((m) => m.raw).join(', ')
      + ' — the code uses ' + (nums.slice(0, 10).join(', ') || 'no numbers') });
  }
  console.log(`\n=== ${surface.name}: ${list.length} entries, ${bad.length} to review ===`);
  for (const b of bad) { flagged++; console.log(`  ! ${b.e.id || '?'}: ${b.e.desc}`); console.log(`      ${b.why}`); }
  if (showAll && !bad.length) console.log('  all numeric claims matched');
}
console.log(`\n${flagged} to review out of ${checked} entries that state a number`
  + (noSite ? ` (${noSite} had no locatable implementation)` : ''));
