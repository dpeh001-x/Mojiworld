#!/usr/bin/env node
// Hardbake a tester's Skill Sound Tuner hand-back into data/skill_sfx_tune.js.
// The tuner (tools/skill_sfx_tester.html) "Copy everything" text ends with a
// one-line JSON blob tagged LX_SFX_PATCH:1. Paste the whole text (or only that
// line, or a file holding either):
//   node scripts/apply_sfx_patch.mjs '<pasted text>'
//   node scripts/apply_sfx_patch.mjs report.txt
//   node scripts/apply_sfx_patch.mjs --paste < report.txt
//   --dry-run        print what would change, write nothing
//   --table=<path>   bake into another copy of the table (tests)
// Semantics: DECLARATIVE per skill. Every skill in the patch ends up with
// exactly the tuning the tester heard (an empty entry = back to as-authored,
// which removes it); skills not in the patch are untouched, so two testers'
// patches compose. A skill whose baked entry changed after the tester's page
// loaded it is reported as a CONFLICT and then overwritten - loudly, never
// silently. Values are clamped with the game's own rules (_lxSkillSfxTune);
// an unknown skill id or a clip that is not on disk refuses the whole patch.
// Atomic write + node --check before the table is replaced.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const DRY = args.includes('--dry-run');
const TABLE = path.resolve(ROOT, opt('table', 'data/skill_sfx_tune.js'));
const CATALOG = path.join(ROOT, 'tools', 'skill_sfx_catalog.js');
const fail = (m) => { console.error('apply_sfx_patch: ' + m); process.exit(2); };

const input = args.find((a) => !a.startsWith('--'));
const raw = args.includes('--paste') ? readFileSync(0, 'utf8')
  : input ? (existsSync(input) ? readFileSync(input, 'utf8') : input) : '';
if (!raw.trim()) fail('usage: apply_sfx_patch.mjs <pasted text | file> [--dry-run]  (or --paste < file)');

// The blob is the JSON object whose first key is LX_SFX_PATCH. Walk to its
// matching brace (strings respected) so any surrounding report text is ignored.
function objectAt(s, i) {
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return s.slice(i, j + 1);
  }
  return null;
}
const at = raw.indexOf('{"LX_SFX_PATCH"');
if (at < 0) fail('no LX_SFX_PATCH blob found - paste the whole "Copy everything" text, including its last line');
const blob = objectAt(raw, at);
if (!blob) fail('the LX_SFX_PATCH line is cut off - paste all of it');
let patch;
try { patch = JSON.parse(blob); } catch (e) { fail('the LX_SFX_PATCH line is damaged (' + e.message + ') - copy it again'); }
if (patch.LX_SFX_PATCH !== 1 || !patch.tune || typeof patch.tune !== 'object') fail('not an LX_SFX_PATCH v1 blob');

// ---- the game's rules (_lxSkillSfxTune) + the tuner's canonical form (compact) ----
const FILE_RE = /^audio\/(?:[\w-]+\/)*[\w-]+\.(?:mp3|ogg|wav|m4a)$/;
const r2 = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
function canon(t, ownFile) {
  t = (t && typeof t === 'object') ? t : {};
  const n = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : d;
  const o = { vol: n(t.vol, 0, 2, 1), pitch: n(t.pitch, -12, 12, 0), start: n(t.start, 0, 10, 0),
    end: n(t.end, 0, 10, 0), fade: n(t.fade, 0, 3, 0), delay: n(t.delay, 0, 1.5, 0),
    file: (typeof t.file === 'string' && FILE_RE.test(t.file)) ? t.file : '', mute: t.mute === true };
  if (o.end && o.end <= o.start) o.end = 0;
  if (o.mute) return { mute: true };
  const out = {};
  const put = (k, v, d, dflt) => { const x = r2(v, d); if (x !== dflt) out[k] = x; };
  put('vol', o.vol, 2, 1); put('pitch', o.pitch, 1, 0); put('start', o.start, 3, 0);
  put('end', o.end, 3, 0); put('fade', o.fade, 3, 0); put('delay', o.delay, 3, 0);
  if (o.file && o.file !== ownFile) out.file = o.file;
  if ((out.start || out.end || out.fade) && typeof t.dur === 'number' && isFinite(t.dur) && t.dur > 0) out.dur = r2(t.dur, 3);
  return out;
}
const noDur = (o) => { const c = { ...o }; delete c.dur; return JSON.stringify(c); };

// ---- inputs ----
let rows = null;
if (existsSync(CATALOG)) {
  const m = readFileSync(CATALOG, 'utf8').match(/window\.LX_SKILL_SFX_CATALOG = (\{[\s\S]*\});/);
  if (m) rows = Object.fromEntries(JSON.parse(m[1]).rows.map((r) => [r.id, r]));
}
if (!rows) console.warn('WARN tools/skill_sfx_catalog.js missing - skill ids are not validated');
const src = readFileSync(TABLE, 'utf8');
const tm = src.match(/^([\s\S]*?)window\.LX_SKILL_SFX_TUNE = (\{[\s\S]*?\});\r?\n?$/);
if (!tm) fail(path.relative(ROOT, TABLE) + ' did not match the expected shape');
const header = tm[1].replace(/\r\n/g, '\n');
const table = JSON.parse(tm[2]);

const problems = [];
for (const [id, t] of Object.entries(patch.tune)) {
  if (rows && !rows[id]) problems.push(`unknown skill id "${id}"`);
  if (t && typeof t.file === 'string' && t.file && !FILE_RE.test(t.file)) problems.push(`${id}: "${t.file}" is not a plain audio/ path`);
  else if (t && t.file && !existsSync(path.join(ROOT, t.file))) problems.push(`${id}: ${t.file} is not on disk`);
}
if (problems.length) fail('refusing the whole patch:\n  ' + problems.join('\n  '));

// ---- bake ----
const changes = [], conflicts = [];
for (const [id, t] of Object.entries(patch.tune)) {
  const own = rows && rows[id] ? rows[id].file : null;
  const before = table[id] ? canon(table[id], own) : {};
  if (patch.was && patch.was[id] && noDur(canon(patch.was[id], own)) !== noDur(before)) conflicts.push(id);
  const after = canon(t, own);
  if (Object.keys(after).length) table[id] = after; else delete table[id];
  changes.push({ id, before, after });
}
const ids = Object.keys(table).sort();
const out = header + 'window.LX_SKILL_SFX_TUNE = {'
  + (ids.length ? '\n' + ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(table[id])}`).join(',\n') + '\n' : '\n')
  + '};\n';

console.log(`LX_SFX_PATCH from ${patch.who || '(no name)'} ${patch.date || ''}, tuned on ${patch.build || '?'}:`);
for (const c of changes) console.log(`  ${c.id.padEnd(22)} ${JSON.stringify(c.before)}  ->  ${JSON.stringify(c.after)}`);
if (!changes.length) console.log('  (no tuning changes in this patch)');
for (const id of conflicts) console.log(`  CONFLICT ${id}: its baked tuning changed after the tester's page loaded it - the tester's version won`);
const bad = Object.entries(patch.notes || {}).filter(([, n]) => n && n.verdict === 'bad');
if (bad.length) {
  console.log(`\n${bad.length} sound(s) marked "needs a new sound" - tuning cannot fix those. Regenerate from the same text:`);
  console.log('  node scripts/regen_sfx_from_comments.mjs --paste < <the pasted report>');
  for (const [id, n] of bad) console.log(`    ${id}: ${n.comment || '(no comment)'}`);
}
if (DRY) { console.log('\n--dry-run: nothing written'); process.exit(0); }
const tmp = TABLE + '.patchtmp.js';
writeFileSync(tmp, out);
execFileSync(process.execPath, ['--check', tmp]);
renameSync(tmp, TABLE);
console.log(`\nbaked ${changes.length} skill(s) into ${path.relative(ROOT, TABLE)} (${ids.length} tuned in total)`);
