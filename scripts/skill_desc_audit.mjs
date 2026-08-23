#!/usr/bin/env node
// Audit every skill DESCRIPTION in the UI against what the skill actually does.
// =============================================================================
// Card text is hand-written prose quoting hard numbers — "Cooldown 60s", "for
// 12s", "3 bolts", "Costs 3 MP" — and those drift the moment anyone retunes a
// skill. This pairs each SKILLS entry with its SKILL_FNS body and reports both
// the numbers the description CLAIMS and the numbers the code actually uses, so
// a human can see the disagreements.
//
//   node scripts/skill_desc_audit.mjs                # numeric mismatches only
//   node scripts/skill_desc_audit.mjs --pairs [n] [skip]   # desc vs impl facts
//   node scripts/skill_desc_audit.mjs --only <id>
// =============================================================================
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_GAME_SRC || join(ROOT, 'mojiworld_game.html');
const html = await readFile(SRC, 'utf8');

// ---- the SKILLS table ------------------------------------------------------
const start = html.indexOf('const SKILLS = {');
if (start < 0) { console.error('SKILLS table not found'); process.exit(1); }
const lines = html.slice(start).split(/\r?\n/);
const skills = [];
let depth = 0;
for (const line of lines) {
  for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  // a single-quoted JS string, escaped quotes included
  // a trailing // comment is common on these lines — strip one before matching,
  // or every commented entry silently drops out of the audit
  const bare = line.replace(/\}\s*,?\s*\/\/.*$/, '},');
  const m = /^\s{2,}([A-Za-z_][\w]*)\s*:\s*\{(.*)\}\s*,?\s*$/.exec(bare);
  if (m) {
    const body = m[2];
    const str = (k) => {
      const r = new RegExp(k + "\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'").exec(body);
      return r ? r[1].replace(/\\'/g, "'") : null;
    };
    const num = (k) => { const r = new RegExp(k + '\\s*:\\s*(-?[\\d.]+)').exec(body); return r ? +r[1] : null; };
    const desc = str('desc');
    if (desc != null) skills.push({ id: m[1], name: str('name'), cls: str('cls'), job: str('job'),
      master: str('master'), slot: str('slot'), mp: num('mp'), cd: num('cd'), desc });
  }
  if (depth <= 0 && skills.length) break;
}

// ---- the implementations ---------------------------------------------------
const fnStart = html.indexOf('const SKILL_FNS = {');
const impls = {};
if (fnStart >= 0) {
  const s = html.slice(fnStart);
  const re = /\n  ([A-Za-z_][\w]*)\s*:\s*(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(s))) {
    let i = m.index + m[0].length, d = 1;
    for (; i < s.length && d > 0; i++) { const c = s[i]; if (c === '{') d++; else if (c === '}') d--; }
    impls[m[1]] = s.slice(m.index, i);
  }
}

// Strip comments so a stale COMMENT never reads as live behaviour.
const code = (src) => (src || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

// ---- what the code actually does -------------------------------------------
function facts(id) {
  const src = code(impls[id]);
  if (!src) return null;
  const f = {};
  const uniq = (a) => [...new Set(a)];
  const all = (re, pick = (m) => m[1]) => { const o = []; let m; const r = new RegExp(re, 'g');
    while ((m = r.exec(src))) o.push(pick(m)); return uniq(o); };
  f.loops = all('for\\s*\\(\\s*(?:let|var)\\s+\\w+\\s*=\\s*0\\s*;\\s*\\w+\\s*<\\s*(\\d+)');
  f.atkMul = all('getAtk\\(\\)\\s*\\*\\s*([\\d.]+)');
  f.buffs = all('player\\.buffs\\.(\\w+)\\s*=\\s*(\\d+)', (m) => m[1] + '=' + m[2] + 'ms');
  f.timers = all('scheduleSkillTimer\\([\\s\\S]{0,400}?,\\s*(\\d+)\\s*\\)');
  f.projectiles = (src.match(/game\.projectiles\.push/g) || []).length;
  f.hazards = (src.match(/game\.hazards\.push/g) || []).length;
  f.summons = (src.match(/spawnSummon|game\.minions\.push|LX_SUMMON/g) || []).length;
  f.heals = (src.match(/player\.hp\s*=\s*Math\.min|healPlayer/g) || []).length;
  f.invuln = all('player\\.invulnerable\\s*=\\s*Math\\.max\\([^,]*,\\s*(\\d+)');
  f.perform = all('perform(?:Around|Slash|Cleave)\\(\\s*([\\d.]+)');
  return f;
}

// ---- claims the description makes ------------------------------------------
function claims(d) {
  const c = {};
  const one = (re) => { const m = re.exec(d); return m ? m[1] : null; };
  c.cooldownS = one(/Cooldown\s+([\d.]+)\s*s/i) || one(/([\d.]+)\s*s\s+cooldown/i);
  c.recastS = one(/([\d.]+)\s*s\s+recast/i);
  c.mp = one(/Costs?\s+(\d+)\s*MP/i) || one(/(\d+)\s*MP\s+per\s+cast/i);
  c.durations = [...d.matchAll(/(?:for|lasts?|over)\s+([\d.]+)\s*s\b/gi)].map((m) => m[1]);
  c.counts = [...d.matchAll(/\b(\d+)\s+(bolts?|projectiles?|arrows?|strikes?|hits?|slashes?|skeletons?|clones?|orbs?|shards?|spears?|meteors?|waves?|jumps?|targets?|enemies)\b/gi)]
    .map((m) => m[1] + ' ' + m[2].toLowerCase());
  c.percents = [...d.matchAll(/(\d+)\s*%/g)].map((m) => m[1] + '%');
  return c;
}

const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const list = only ? skills.filter((s) => s.id === only) : skills;

// ---- does the code back up what the text promises? -------------------------
// Each rule is (what the description says) -> (what the implementation must
// contain for that to be true). Deliberately loose: a hit here means "read
// this one", not "this is broken".
const RULES = [
  { say: /\bpierc/i, want: /pierce(Left)?\s*:|pierceAdd|_csPierce|_pierce/i, label: 'pierces' },
  { say: /\bstun/i, want: /stun|_stunUntil|freeze/i, label: 'stuns' },
  { say: /\bheal|restores? .*\bHP\b/i, want: /player\.hp\s*=|healPlayer|lifesteal|drainHeal|_heal|healParty|hpRegen/i, label: 'heals' },
  { say: /\bsummon|\braise|skeleton|undead|thrall|clone|minion/i,
    want: /raiseMinion|_mojimonSummon|spawnSummon|game\.minions|LX_SUMMON|_shade|_soulOrb|_clones?\b/i, label: 'summons' },
  { say: /(?<!no longer fully )\binvulnerab|\bi-frames?\b|\buntouchable/i, want: /invulnerable/i, label: 'invulnerability' },
  { say: /\bteleport|\bblink\b/i, want: /player\.x\s*=|_blink|teleport/i, label: 'teleports' },
  { say: /\bknock(back|s|ing)?\b/i, want: /kb\s*[:=]|knock|\.vx\s*\+?=/i, label: 'knockback' },
  { say: /\bburn|\bignite|\bon fire\b/i, want: /burn|ignite|_dot|dot\s*:/i, label: 'burn' },
  { say: /\bslow(s|ed|ing)\b(?!\s+but)/i, want: /slow|_slowUntil|chill/i, label: 'slow' },
  { say: /\bshield|\babsorb|\bbarrier/i, want: /shield|absorb|barrier|buffs\.\w*[Ss]hield/i, label: 'shield' },
];

function reviewFlags(sk) {
  const src = code(impls[sk.id]);
  const out = [];
  if (!src) return out;
  for (const r of RULES) {
    if (r.say.test(sk.desc) && !r.want.test(src)) out.push('says it ' + r.label + ', no sign of it in the code');
  }
  // counts: "5 undead" vs the loop bounds / projectile pushes the code uses
  const c = claims(sk.desc), f = facts(sk.id);
  for (const cnt of c.counts) {
    const n = +cnt.split(' ')[0];
    if (n < 2) continue;
    const seen = [...(f.loops || []).map(Number), f.projectiles, f.hazards].filter(Boolean);
    if (seen.length && !seen.includes(n)) out.push('claims "' + cnt + '" but the code loops/spawns ' + seen.join('/'));
  }
  // durations: "for 12s" vs the ms values the code sets
  for (const d of c.durations) {
    const ms = Math.round(+d * 1000);
    const seen = [...(f.buffs || []).map((b) => +b.split('=')[1].replace('ms', '')),
                  ...(f.timers || []).map(Number)].filter(Boolean);
    if (seen.length && !seen.some((v) => Math.abs(v - ms) <= Math.max(150, ms * 0.06)))
      out.push('claims "for ' + d + 's" but the code sets ' + seen.join('/') + 'ms');
  }
  return out;
}

if (argv.includes('--claims')) {
  let n = 0;
  for (const sk of list) {
    const flags = reviewFlags(sk);
    if (!flags.length) continue;
    n++;
    console.log('\n### ' + sk.id + '  "' + sk.name + '"');
    console.log('  DESC: ' + sk.desc);
    for (const f of flags) console.log('  ! ' + f);
  }
  console.log('\n' + n + ' of ' + list.length + ' skills flagged for review');
  process.exit(0);
}


if (argv.includes('--pairs')) {
  const n = +(argv[argv.indexOf('--pairs') + 1] || 12);
  const skip = +(argv[argv.indexOf('--pairs') + 2] || 0);
  for (const sk of list.slice(skip, skip + n)) {
    const f = facts(sk.id), c = claims(sk.desc);
    console.log(`\n### ${sk.id}  "${sk.name}"  [${sk.cls}${sk.job ? '/' + sk.job : ''}${sk.master ? '/' + sk.master : ''} ${sk.slot}]  cd=${sk.cd}ms mp=${sk.mp}`);
    console.log(`  DESC: ${sk.desc}`);
    const cl = Object.entries(c).filter(([, v]) => v && v.length).map(([k, v]) => k + '=' + (Array.isArray(v) ? v.join('/') : v));
    console.log(`  CLAIMS: ${cl.join('  ') || '(no hard numbers)'}`);
    if (!f) { console.log('  IMPL: (no SKILL_FNS entry)'); continue; }
    const fl = Object.entries(f).filter(([, v]) => (Array.isArray(v) ? v.length : v))
      .map(([k, v]) => k + '=' + (Array.isArray(v) ? v.join('/') : v));
    console.log(`  IMPL: ${fl.join('  ') || '(nothing extracted)'}`);
  }
  console.log(`\n(${list.length} skills total)`);
  process.exit(0);
}

// default: the hard numeric checks
const findings = [];
for (const sk of list) {
  const c = claims(sk.desc);
  if (c.cooldownS && sk.cd != null && Math.abs(+c.cooldownS - sk.cd / 1000) > 0.05)
    findings.push([sk, 'cooldown', c.cooldownS + 's', sk.cd / 1000 + 's']);
  if (c.recastS && sk.cd != null && Math.abs(+c.recastS - sk.cd / 1000) > 0.05)
    findings.push([sk, 'recast', c.recastS + 's', sk.cd / 1000 + 's']);
  if (c.mp && sk.mp != null && +c.mp !== sk.mp)
    findings.push([sk, 'mp', c.mp + ' MP', sk.mp + ' MP']);
}
console.log(`skills: ${list.length}   implementations: ${Object.keys(impls).length}`);
console.log(`numeric mismatches: ${findings.length}`);
for (const [sk, kind, said, real] of findings)
  console.log(`  ${sk.id} — ${kind}: says ${said}, is ${real}`);
export {};
