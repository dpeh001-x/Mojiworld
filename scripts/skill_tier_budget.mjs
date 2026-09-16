// Tier budgets -> exact literal edits. Reads the measured tabulation (docs/reports/skill_tabulation.json,
// or per-class runs) and the game source, gives every damage skill a target as a % of its class's
// basic hit by TIER and COOLDOWN, and writes the edits that land it as an LX_SKILL_PATCH:2 blob for
// scripts/apply_skill_patch.mjs - the same patch tools/skill_tuner.html would produce by hand - plus a
// markdown proposal. Nothing is written to the game here.
//   node scripts/skill_tier_budget.mjs [--tab=a.json,b.json] [--game=mojiworld_game.html] [--out=patch.json] [--md=proposal.md] [--tol=0.10]
//
// THE MODEL (per user: three tiers of damage, the last ~1000% or more of a basic; consider the number
// of attacks and the cooldown):
//   base kit  (slots d/s/a/e/w)  target = 100 + 30 x cd_s, capped 100..400  - the Z basic itself is the
//                                denominator and is never edited
//   job tier  (slots q/c)        target = 350 + 25 x cd_s, capped 500..900
//   master    (slots x/b)        target = 1000, Bastion of Dawn 2500 (charged); DOTs are 1000 over 10 s
// A skill keeps its shape: every ATK multiplier and flat on its lines is scaled by the same ratio, so a
// 12-line skill stays 12 lines at 1/12 each; only the total moves. Counts (orbs, lines, waves) are never
// touched. Buff / utility rows (0 damage) are skipped. A row already within --tol of its target is
// skipped. Shared lines: the pet bite ternary splits by owner; other shared lines are left alone.
import { readFileSync, writeFileSync } from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const TABS = arg('tab', path.join(ROOT, 'docs', 'reports', 'skill_tabulation.json')).split(',');
const GAME = arg('game', path.join(ROOT, 'mojiworld_game.html'));
const OUT = arg('out', path.join(ROOT, 'docs', 'reports', 'skill_tier_patch.json'));
const MD = arg('md', path.join(ROOT, 'docs', 'reports', 'SKILL_TIER_PROPOSAL.md'));
const TOL = Number(arg('tol', 0.10));
// heals and buffs whose damage is incidental are not damage skills: a tier would scale Holy Light x10
const SUPPORT = new Set(['warCry', 'holyLight', 'celestialAurora', 'bloodlust', 'guardian', 'eagleEye'].concat(arg('skip', '').split(',').filter(Boolean)));
// periodic sources whose strike count steps by one inside the window (Divine Aegis: 3 or 4 orbit strikes,
// a 33% step) keep the number that puts BOTH counts in band rather than chasing one reading
const KEEP = new Set(arg('keep', '').split(',').filter(Boolean));
const MODEL = {
  base: (cd) => Math.min(400, Math.max(100, 100 + 30 * cd)),
  job: (cd) => Math.min(900, Math.max(500, 350 + 25 * cd)),
  master: (cd, id) => id === 'crusader_ult' ? 2500 : 1000,
};
const src = readFileSync(GAME, 'utf8');
const sandbox = {}; vm.runInNewContext(readFileSync(path.join(ROOT, 'tools', 'skill_damage_scan.js'), 'utf8'), sandbox);
const { skills } = sandbox.lxScanSkills(src);
const byId = Object.fromEntries(skills.map((s) => [s.id, s]));
const tab = { classes: {} }; let ver = '';
for (const f of TABS) { const t = JSON.parse(readFileSync(f, 'utf8')); ver = ver || t.ver; Object.assign(tab.classes, t.classes); }
// rounding a designer would type: 3 significant figures, flats to whole numbers (never below 1)
const sig3 = (v) => { if (v === 0) return '0'; const p = Math.max(0, 2 - Math.floor(Math.log10(Math.abs(v)))); return String(+v.toFixed(p)); };
const roundFlat = (v) => String(Math.max(1, Math.round(v)));
const patch = {}; const rows = []; const wanted = {}; const descEdits = {};
for (const [cls, c] of Object.entries(tab.classes)) {
  const basic = c.basic && c.basic.total; if (!basic) continue;
  for (const [id, x] of Object.entries(c.rows)) {
    const s = byId[id]; if (!s) continue;
    const tier = s.tier === 'base' ? 'base' : s.tier;
    const measured = x.total / basic * 100;
    const row = { id, name: s.name, cls, tier, slot: s.slot, cd: (s.cd || 0) / 1000, lines: x.lines || 0, measured, target: null, ratio: null, edits: [], note: '' };
    rows.push(row);
    if (s.slot === 'd') { row.note = 'the basic: denominator, never edited'; continue; }
    if (x.err) { row.note = 'ERR ' + x.err; continue; }
    if (!x.total) { row.note = 'no damage of its own (buff / utility)'; continue; }
    if (SUPPORT.has(id)) { row.note = 'support skill: its damage is incidental, left as is'; continue; }
    if (KEEP.has(id)) { row.target = MODEL[tier](row.cd, id); row.ratio = row.target / measured; row.note = 'kept: a periodic source that lands 3 or 4 strikes per window; its number is set so both counts sit in band'; continue; }
    row.target = MODEL[tier](row.cd, id);
    row.ratio = row.target / measured;
    if (Math.abs(row.ratio - 1) <= TOL) { row.note = 'within tolerance'; continue; }
    if (!s.lines.length) { row.note = 'NO EDITABLE LINE - hand-tune'; continue; }
    // record the wanted value of every field this skill owns; a line two skills share (the pet bite
    // ternary: Wild Bond owns 1.1, Apex Bond owns 0.51) is written ONCE, below, from both owners' wishes
    let touched = 0;
    for (const l of s.lines) {
      const fields = l.fields.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === 'mul' || f.kind === 'flat');
      if (!fields.length) continue;
      let own = fields;
      if (l.shared) {
        if (/_petSlot === 'ultPet'/.test(l.text)) own = fields.filter(({ i }) => i === (id === 'beastmaster_ult' ? 0 : 1));
        else { row.note += (row.note ? '; ' : '') + 'shared line left alone: ' + l.text.slice(0, 40); continue; }
      }
      const w = wanted[l.text] || (wanted[l.text] = { line: l, values: {}, owners: [] });
      if (!w.owners.includes(id)) w.owners.push(id);
      for (const { f, i } of own) { const nv = f.kind === 'flat' ? roundFlat(f.value * row.ratio) : sig3(f.value * row.ratio); if (nv !== l.text.slice(f.start, f.end)) { w.values[i] = nv; touched++; } }
    }
    if (!touched) { row.note = 'nothing changed after rounding'; continue; }
    // the SKILLS description quotes multipliers ("2.4× ATK each"): rescale those too, so the text stays exact
    const rowText = src.split(/\r?\n/)[s.rowLine - 1].trim();
    const descNew = rowText.replace(/(\d+(?:\.\d+)?)(\s?[x×]\s?ATK)/g, (m, n, unit) => +n >= 0.05 ? sig3(+n * row.ratio) + unit : m);
    if (descNew !== rowText) (descEdits[id] = descEdits[id] || []).push({ anchor: rowText, count: 1, new: descNew });
    row.touched = touched;
  }
}
// one edit per line, carrying every owner's wanted values; filed under the first owner
for (const w of Object.values(wanted)) {
  if (!Object.keys(w.values).length) continue;
  const l = w.line; let out = '', pos = 0;
  for (let i = 0; i < l.fields.length; i++) { const f = l.fields[i]; out += l.text.slice(pos, f.start) + (w.values[i] != null ? w.values[i] : l.text.slice(f.start, f.end)); pos = f.end; }
  out += l.text.slice(pos);
  const e = { anchor: l.text, count: l.count, new: out };
  (patch[w.owners[0]] = patch[w.owners[0]] || { lines: [] }).lines.push(e);
  for (const id of w.owners) { const r = rows.find((x) => x.id === id); if (r) r.edits.push(e); }
}
for (const [id, list] of Object.entries(descEdits)) { (patch[id] = patch[id] || { lines: [] }).lines.push(...list); const r = rows.find((x) => x.id === id); if (r) r.edits.push(...list); }
for (const r of rows) if (r.touched && !r.edits.length) r.note = 'edits carried by a shared line';
writeFileSync(OUT, 'LX_SKILL_PATCH:2 ' + JSON.stringify(patch));
const order = { base: 0, job: 1, master: 2 };
rows.sort((a, b) => a.cls.localeCompare(b.cls) || order[a.tier] - order[b.tier] || a.cd - b.cd);
const md = [`# Skill tier proposal — from the ${ver} tabulation`, '',
  'Targets are a % of the class basic hit, by tier and cooldown: base kit `100 + 30·cd` (100–400), job tier `350 + 25·cd` (500–900), master 1000 (Bastion of Dawn 2500). Every multiplier and flat on a skill\'s own lines is scaled by one ratio, so the number of attacks and the split between them stay as designed; only the total moves. Rows within ±' + Math.round(TOL * 100) + '% keep their numbers.', '',
  '| class | tier | key | skill | cd s | lines | measured | target | ratio | edits |', '|---|---|---|---|---:|---:|---:|---:|---:|---|'];
for (const r of rows) md.push(`| ${r.cls} | ${r.tier} | ${r.slot} | ${r.name} | ${r.cd} | ${r.lines} | ${Math.round(r.measured)}% | ${r.target == null ? '—' : Math.round(r.target) + '%'} | ${r.ratio == null ? '—' : '×' + r.ratio.toFixed(2)} | ${r.edits.length ? r.edits.map((e) => e.new.replace(/\s*\/\/.*$/, '').trim()).join('<br>') : r.note} |`);
writeFileSync(MD, md.join('\n') + '\n');
const n = Object.keys(patch).length;
console.log(`${rows.length} rows, ${n} skills get edits (${Object.values(patch).reduce((a, p) => a + p.lines.length, 0)} lines) -> ${OUT}\n${MD}`);
