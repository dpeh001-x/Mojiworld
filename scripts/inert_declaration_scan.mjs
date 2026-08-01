// INERT DECLARATION SCAN — the highest-yield audit for this codebase.
//
// Three real defects this session came from the same shape: a config key
// declared in a data table that NOTHING reads. It parses, it looks wired, and
// it silently does nothing:
//   - 10 monster traits (armorShield, groundSpikes, packCall, ...) sat dead
//     for months until v0.29.320 implemented them
//   - `enrageSelf` written as a trait when it is a MONSTER_SKILLS kind
//   - `dashCharge` the same
//
// This generalises the check across every keyed table: for each declared key,
// is there ANY consumer outside the table's own data block?
// Run: node scripts/inert_declaration_scan.mjs [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const VERBOSE = process.argv.includes('--verbose');

const blockOf = (startRe, endTok) => {
  const s = html.search(startRe);
  if (s < 0) return null;
  const e = html.indexOf(endTok, s);
  return e < 0 ? null : { s, e, text: html.slice(s, e) };
};
const stripComments = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// Each check: pull keys from a data block, then look for a consumer elsewhere.
// Extract only the TOP-LEVEL keys of each `traits:{...}` object. A naive
// `[^}]*` match spans into nested config objects and reports their
// sub-properties (arcW, cdMs, range, swingW...) as if they were trait names —
// they are parameters of bigMelee/columnStrike, not traits.
const topLevelTraitKeys = (text) => {
  const out = new Set();
  const src = stripComments(text);
  let i = 0;
  while ((i = src.indexOf('traits:', i)) >= 0) {
    let j = src.indexOf('{', i);
    if (j < 0) break;
    let depth = 0, end = j;
    for (; end < src.length; end++) {
      const ch = src[end];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) break; }
    }
    const body = src.slice(j + 1, end);
    // walk the body, recording keys only at brace depth 0
    let d = 0, tokenStart = 0;
    for (let k = 0; k < body.length; k++) {
      const ch = body[k];
      if (ch === '{') d++;
      else if (ch === '}') d--;
      else if (ch === ':' && d === 0) {
        const key = body.slice(tokenStart, k).replace(/^[\s,]+/, '').trim();
        if (/^[a-zA-Z_]+$/.test(key)) out.add(key);
      } else if (ch === ',' && d === 0) tokenStart = k + 1;
    }
    i = end + 1;
  }
  return out;
};

const CHECKS = [
  {
    name: 'monster traits',
    block: () => blockOf(/const monsterTypes\s*=\s*\{/, '\n};'),
    keys: (t) => topLevelTraitKeys(t),
  },
  {
    // Tower / expedition mobs are MERGED into monsterTypes later via
    // Object.assign(monsterTypes, {...}) — they sit OUTSIDE the literal
    // `const monsterTypes = {}` block, so scanning only that block missed
    // them entirely (that gap hid a dead enrageSelf trait on towerShardling).
    name: 'tower/expedition monster traits (Object.assign block)',
    block: () => blockOf(/Object\.assign\(monsterTypes,\s*\{/, '\n});'),
    keys: (t) => topLevelTraitKeys(t),
  },
  {
    name: 'MONSTER_SKILLS kinds',
    block: () => blockOf(/const MONSTER_SKILLS\s*=\s*\{/, '\n};'),
    keys: (t) => new Set([...stripComments(t).matchAll(/kind:\s*'([a-zA-Z_]+)'/g)].map((m) => m[1])),
    // a kind is live if MONSTER_SKILL_FNS implements it
    live: (k) => new RegExp(`^\\s{2}${k}\\s*\\(`, 'm').test(html) || new RegExp(`${k}\\s*:\\s*function|${k}\\s*\\(m\\)`).test(html),
  },
  {
    name: 'boon stats (POWERUPS)',
    block: () => blockOf(/const POWERUPS\s*=\s*\[/, '\n];'),
    keys: (t) => new Set([...stripComments(t).matchAll(/stat:\s*'([a-zA-Z_]+)'/g)].map((m) => m[1])),
  },
];

// LIVENESS: does the key appear ANYWHERE outside its own data block?
// Property-path matching (mods.<key>, .traits.<key>) produced false positives
// because the code aliases the container — `const M = player.mods` then
// `M.dashFlame`, and `const t = m.traits`. Presence-outside-the-block is
// coarser but has no such blind spot; a key that appears only inside its own
// table is provably unread.
const liveOutside = (key, block) => {
  const rest = html.slice(0, block.s) + html.slice(block.e);
  const re = new RegExp(`\\b${key}\\b`, 'g');
  return (stripComments(rest).match(re) || []).length > 0;
};

let totalDead = 0;
const report = [];
for (const c of CHECKS) {
  const b = c.block();
  if (!b) { report.push({ name: c.name, err: 'block not found' }); continue; }
  const keys = [...c.keys(b.text)].sort();
  const dead = keys.filter((k) => (c.live ? !c.live(k) : !liveOutside(k, b)));
  totalDead += dead.length;
  report.push({ name: c.name, total: keys.length, dead, keys });
}

// NAMESPACE CONFUSION — the specific bug that bit twice (enrageSelf, then
// dashCharge): a key written as `traits:{ foo:… }` when `foo` is actually a
// MONSTER_SKILLS *kind*. It parses, and does nothing, and the coarse presence
// test above can't see it (the key IS live — just in the other namespace).
const skillsBlock = blockOf(/const MONSTER_SKILLS\s*=\s*\{/, '\n};');
const skillKinds = skillsBlock
  ? new Set([...stripComments(skillsBlock.text).matchAll(/kind:\s*'([a-zA-Z_]+)'/g)].map((m) => m[1]))
  : new Set();
const traitBlocks = [
  blockOf(/const monsterTypes\s*=\s*\{/, '\n};'),
  blockOf(/Object\.assign\(monsterTypes,\s*\{/, '\n});'),
].filter(Boolean);
const confused = [];
for (const b of traitBlocks) {
  for (const k of topLevelTraitKeys(b.text)) if (skillKinds.has(k)) confused.push(k);
}

// BOSS DISPATCH GATE — MONSTER_SKILLS is ticked under `if (!m.isBoss …)`, so
// an entry for a monster defined with `boss:true` never runs. Caught during
// the v0.29.371 audit: the "fix" for two inert boss traits was a MONSTER_SKILLS
// entry that would have been equally dead, and a harness spawning them with
// isBoss=false made it look wired.
const bossIds = new Set();
for (const b of traitBlocks) {
  for (const m of stripComments(b.text).matchAll(/^\s{2}([a-zA-Z_]+)\s*:\s*\{([\s\S]*?)(?=\n\s{2}[a-zA-Z_]+\s*:\s*\{|\n\};|\n\}\);)/gm)) {
    if (/\bboss\s*:\s*true/.test(m[2])) bossIds.add(m[1]);
  }
}
const bossSkills = skillsBlock
  ? [...stripComments(skillsBlock.text).matchAll(/^\s{2}([a-zA-Z_]+)\s*:\s*\{\s*kind:/gm)]
      .map((m) => m[1]).filter((id) => bossIds.has(id))
  : [];

console.log('=== INERT DECLARATION SCAN ===\n');
if (bossSkills.length) {
  console.log('BOSS DISPATCH GATE (MONSTER_SKILLS entry on a boss — dispatch skips bosses):');
  for (const id of bossSkills) console.log(`    INERT  MONSTER_SKILLS.${id}  ->  bosses need a trait reader with an activeBoss opt-in`);
  console.log('');
}
if (confused.length) {
  console.log('NAMESPACE CONFUSION (declared as a TRAIT but is a MONSTER_SKILLS kind):');
  for (const k of [...new Set(confused)]) console.log(`    INERT  traits:{ ${k}: … }  ->  belongs in MONSTER_SKILLS as { kind:'${k}' }`);
  console.log('');
}
for (const r of report) {
  if (r.err) { console.log(`${r.name}: ${r.err}\n`); continue; }
  const status = r.dead.length ? `${r.dead.length} DEAD` : 'all live';
  console.log(`${r.name}: ${r.total} declared — ${status}`);
  if (r.dead.length) for (const d of r.dead) console.log(`    DEAD  ${d}  (declared in the table, no consumer found)`);
  if (VERBOSE && !r.dead.length) console.log(`    ${r.keys.join(', ')}`);
  console.log('');
}
const problems = totalDead + confused.length;
console.log(problems === 0
  ? 'No inert declarations. Every declared key has a consumer in the right namespace.'
  : `${problems} inert declaration(s) — each parses fine and does NOTHING at runtime.`);
process.exit(problems ? 1 : 0);
