// debug_class_skills.mjs — automated consistency + balance audit of the
// class/skill system in mojiworld_game.html. Read-only; prints a report.
//   node scripts/debug_class_skills.mjs
import fs from 'fs';

const SRC = new URL('../mojiworld_game.html', import.meta.url);
const html = fs.readFileSync(SRC, 'utf8');

// ---- extraction helpers -------------------------------------------------
function braceSlice(anchor) {
  const i = html.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + anchor);
  const open = html.indexOf('{', i);
  let d = 0, j = open, inStr = null, esc = false, lineC = false, blockC = false;
  for (; j < html.length; j++) {
    const c = html[j], n = html[j + 1];
    if (lineC) { if (c === '\n') lineC = false; continue; }
    if (blockC) { if (c === '*' && n === '/') { blockC = false; j++; } continue; }
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { lineC = true; j++; continue; }
    if (c === '/' && n === '*') { blockC = true; j++; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) break; }
  }
  return html.slice(open, j + 1);
}
function evalObj(anchor) {
  return new Function('return (' + braceSlice(anchor) + ')')();
}

// ---- load the data tables ----------------------------------------------
const SKILLS = evalObj('const SKILLS = {');
// replicate the runtime MP_MUL pass
const MP_MUL = 1.25, NO_MUL = new Set(['holyLight', 'celestialAurora']);
for (const id in SKILLS) {
  const s = SKILLS[id];
  if (s.slot === 'd') s.mp = 0;
  else if (!NO_MUL.has(id) && s.mp > 0) s.mp = Math.round(s.mp * MP_MUL);
}
const CLASSES = evalObj('const CLASSES = {');
const JOBS = evalObj('const JOBS = {');
const LV10 = evalObj('const SKILL_LV10_BONUS = {');
const LV5 = evalObj('const SKILL_LV5_BONUS = {');
const HIT_TAG = evalObj('const SKILL_HIT_TAG_TO_DEF_ID = {');
const TREE = evalObj('const SKILL_TREE = {');

// SKILL_FNS: keys + body text (functions reference game state; no eval)
const fnsBlock = braceSlice('const SKILL_FNS = {');
const FN_BODIES = {};
{
  let d = 0, key = null, start = 0, inStr = null, esc = false, lineC = false, blockC = false;
  for (let i = 0; i < fnsBlock.length; i++) {
    const c = fnsBlock[i], n = fnsBlock[i + 1];
    if (lineC) { if (c === '\n') lineC = false; else continue; }
    else if (blockC) { if (c === '*' && n === '/') { blockC = false; i++; } continue; }
    else if (esc) { esc = false; continue; }
    else if (inStr) {
      if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    else if (c === '/' && n === '/') { lineC = true; i++; continue; }
    else if (c === '/' && n === '*') { blockC = true; i++; continue; }
    else if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    else if (c === '{') d++;
    else if (c === '}') d--;
    if (d === 1 && c === '\n') {
      const m = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(fnsBlock.slice(i + 1, i + 80));
      if (m) {
        if (key) FN_BODIES[key] = fnsBlock.slice(start, i);
        key = m[1]; start = i + 1;
      }
    }
  }
  if (key) FN_BODIES[key] = fnsBlock.slice(start);
}

// ---- consistency checks -------------------------------------------------
const issues = [], warns = [];
const skillIds = Object.keys(SKILLS), fnIds = Object.keys(FN_BODIES);
for (const id of skillIds) if (!FN_BODIES[id]) issues.push(`SKILLS.${id} has NO implementation in SKILL_FNS`);
for (const id of fnIds) if (!SKILLS[id]) warns.push(`SKILL_FNS.${id} has no SKILLS entry (dead/helper fn?)`);
for (const id of Object.keys(LV10)) if (!SKILLS[id]) issues.push(`SKILL_LV10_BONUS.${id} references unknown skill`);
for (const id of Object.keys(LV5)) if (!SKILLS[id]) issues.push(`SKILL_LV5_BONUS.${id} references unknown skill`);
for (const [tag, id] of Object.entries(HIT_TAG)) if (!SKILLS[id]) issues.push(`SKILL_HIT_TAG_TO_DEF_ID.${tag} -> unknown skill '${id}'`);
for (const [cls, c] of Object.entries(CLASSES)) for (const j of c.jobs) if (!JOBS[j]) issues.push(`CLASSES.${cls}.jobs lists unknown job '${j}'`);
for (const [j, job] of Object.entries(JOBS)) if (!CLASSES[job.cls]) issues.push(`JOBS.${j}.cls -> unknown class '${job.cls}'`);
for (const [cls, nodes] of Object.entries(TREE)) {
  const ids = new Set(nodes.map(n => n.id));
  for (const n of nodes) {
    if (n.prereq && !ids.has(n.prereq)) issues.push(`SKILL_TREE.${cls}.${n.id} prereq '${n.prereq}' missing`);
    if (n.apply) {
      const p = { mods: new Proxy({}, { get: (t, k) => t[k] || 0, set: (t, k, v) => (t[k] = v, true) }), tree: {}, maxHp: 100, hp: 100, maxMp: 50, mp: 50 };
      try { n.apply(p); } catch (e) { issues.push(`SKILL_TREE.${cls}.${n.id}.apply throws: ${e.message}`); }
    }
  }
}
// masters present in SKILLS but their job/cls links valid?
const masters = new Set();
for (const [id, s] of Object.entries(SKILLS)) {
  if (s.master) masters.add(s.master);
  if (s.job && !JOBS[s.job]) issues.push(`SKILLS.${id}.job -> unknown job '${s.job}'`);
  if (!CLASSES[s.cls]) issues.push(`SKILLS.${id}.cls -> unknown class '${s.cls}'`);
}

// ---- loadout / slot-collision audit --------------------------------------
function loadout(cls, job, master) {
  const out = {};
  for (const [id, s] of Object.entries(SKILLS)) {
    if (s.cls !== cls) continue;
    if (s.job && s.job !== job) continue;
    if (s.master && s.master !== master) continue;
    (out[s.slot] = out[s.slot] || []).push(id);
  }
  return out;
}
const MASTERS_BY_JOB = {};
for (const [id, s] of Object.entries(SKILLS)) if (s.master && s.job) (MASTERS_BY_JOB[s.job] = MASTERS_BY_JOB[s.job] || new Set()).add(s.master);
for (const [cls, c] of Object.entries(CLASSES)) {
  for (const job of c.jobs) {
    for (const master of [...(MASTERS_BY_JOB[job] || [null])]) {
      const lo = loadout(cls, job, master);
      for (const [slot, ids] of Object.entries(lo)) if (ids.length > 1) issues.push(`SLOT COLLISION ${cls}/${job}/${master || '-'} slot '${slot}': ${ids.join(', ')}`);
      for (const slot of ['d', 's', 'a', 'e', 'w', 'q', 'c']) if (!lo[slot]) issues.push(`MISSING SLOT ${cls}/${job}/${master || '-'}: no '${slot}' skill`);
      if (master && !lo.x) issues.push(`MISSING SLOT ${cls}/${job}/${master}: no 'x' master signature`);
      if (master && !lo.b) issues.push(`MISSING SLOT ${cls}/${job}/${master}: no 'b' ultimate`);
    }
  }
}

// ---- balance metrics ------------------------------------------------------
// Static extraction of per-hit ATK multipliers from each SKILL_FNS body.
// Approximate by design (loops/conditionals aren't simulated) — the point is
// comparative: outliers across classes stand out and get hand-verified.
function extractMults(body) {
  if (!body) return [];
  const out = [];
  let m;
  const melee = /performMelee\(\s*[\d.]+\s*,\s*([\d.]+)/g;
  while ((m = melee.exec(body))) out.push({ v: +m[1], k: 'melee' });
  const atk = /getAtk\(\)\s*\*\s*([\d.]+)/g;
  while ((m = atk.exec(body))) out.push({ v: +m[1], k: 'atk' });
  const atkPre = /([\d.]+)\s*\*\s*getAtk\(\)/g;
  while ((m = atkPre.exec(body))) out.push({ v: +m[1], k: 'atk' });
  return out;
}
function fmt(n, w = 6) { return String(n).padStart(w); }
console.log('\n=== BALANCE — base class kits (slots d/s/a/e/w) ===');
console.log('per-skill: extracted ATK multipliers (sum≈full cast, max=biggest hit), cd, mp');
const kitRows = {};
for (const cls of Object.keys(CLASSES)) {
  console.log(`\n▶ ${cls.toUpperCase()}  stats=${JSON.stringify(CLASSES[cls].stats)}`);
  let basicDps = 0, kitSum = 0, kitMp = 0;
  for (const [id, s] of Object.entries(SKILLS)) {
    if (s.cls !== cls || s.job || s.master) continue;
    const mults = extractMults(FN_BODIES[id]);
    const sum = mults.reduce((a, b) => a + b.v, 0);
    const max = mults.reduce((a, b) => Math.max(a, b.v), 0);
    if (s.slot === 'd') basicDps = max / (s.cd / 1000);
    else { kitSum += sum; kitMp += s.mp; }
    console.log(`  [${s.slot}] ${id.padEnd(14)} cd=${fmt(s.cd, 5)}ms mp=${fmt(s.mp, 3)}  mults(${mults.length}): sum=${sum.toFixed(2)} max=${max.toFixed(2)}`);
  }
  const st = CLASSES[cls].stats;
  kitRows[cls] = { basicDps, kitSum, kitMp, atk: st.atk, hp: st.hp, mp: st.mp, ehp: st.hp * (1 + st.def / 20) };
}
console.log('\n=== CLASS PARITY SUMMARY ===');
console.log('class     baseATK  basicMul/s  basicDPS(xATK*atk)  kitSumMul  kitMPcost  HP   MP');
for (const [cls, r] of Object.entries(kitRows)) {
  console.log(`${cls.padEnd(9)} ${fmt(r.atk, 6)} ${fmt(r.basicDps.toFixed(2), 10)} ${fmt((r.basicDps * r.atk).toFixed(1), 15)} ${fmt(r.kitSum.toFixed(1), 11)} ${fmt(r.kitMp, 9)} ${fmt(r.hp, 5)} ${fmt(r.mp, 4)}`);
}
console.log('\n=== JOB/MASTER TIER (q/c/x/b) mult sums per line ===');
for (const cls of Object.keys(CLASSES)) {
  for (const job of CLASSES[cls].jobs) {
    for (const master of [...(MASTERS_BY_JOB[job] || [])]) {
      let line = `${cls}/${job}/${master}:`;
      for (const [id, s] of Object.entries(SKILLS)) {
        if (s.cls !== cls) continue;
        if (s.job && s.job !== job) continue;
        if (s.master && s.master !== master) continue;
        if (!'qcxb'.includes(s.slot)) continue;
        const mults = extractMults(FN_BODIES[id]);
        const sum = mults.reduce((a, b) => a + b.v, 0);
        line += `  [${s.slot}]${id}=${sum.toFixed(1)}/${(s.cd / 1000)}s`;
      }
      console.log(line);
    }
  }
}

console.log('\n=== SKILL SYSTEM DEBUG ===');
console.log(`skills: ${skillIds.length} | fns: ${fnIds.length} | classes: ${Object.keys(CLASSES).length} | jobs: ${Object.keys(JOBS).length} | masters: ${masters.size}`);
console.log(`\n--- ISSUES (${issues.length}) ---`);
issues.forEach(s => console.log('  ✗ ' + s));
console.log(`\n--- WARNINGS (${warns.length}) ---`);
warns.forEach(s => console.log('  ⚠ ' + s));

export { SKILLS, CLASSES, JOBS, FN_BODIES, loadout, MASTERS_BY_JOB };
