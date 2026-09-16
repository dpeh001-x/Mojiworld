#!/usr/bin/env node
// Bake a patch from tools/skill_tuner.html into mojiworld_game.html.
//   node scripts/apply_skill_patch.mjs 'LX_SKILL_PATCH:2 {"shinobi_seal":{"lines":[{"anchor":"const LX_KAGE_DMG = 6.84;","count":1,"new":"const LX_KAGE_DMG = 7;"}]}}'
//   node scripts/apply_skill_patch.mjs --file skill_patch.json        # the tuner's Download patch
//   node scripts/apply_skill_patch.mjs --check '<patch>'              # report, write nothing
//   node scripts/apply_skill_patch.mjs --game path/to/candidate.html '<patch>'
//
// LX_SKILL_PATCH:2 — per skill id: { cd, mp, lines: [{ anchor, count, new }] }. `anchor` is a whole line
// of the source, trimmed, exactly as the tuner read it; it must occur `count` times or the patch aborts
// (the file moved under you - reload the tuner). `new` is the same line with only its numbers changed.
// LX_SKILL_PATCH:1 (cd / mp only) is still accepted. Declarative for the ids it names, every other skill
// untouched. Before writing, every inline <script> is syntax-checked with node --check; the write is
// atomic (tmp + rename) and refuses to shrink the file, because this file has been zeroed by a bad write.
import { readFileSync, writeFileSync, renameSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(k); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const check = argv.includes('--check'); if (check) argv.splice(argv.indexOf('--check'), 1);
const file = flag('--file'); const GAME = flag('--game') || join(ROOT, 'mojiworld_game.html');
const raw = (file ? readFileSync(file, 'utf8') : argv.join(' ')).trim();
if (!raw) { console.error("Usage: node scripts/apply_skill_patch.mjs [--check] [--game g.html] [--file patch.json | 'LX_SKILL_PATCH:2 {...}']"); process.exit(1); }
const m = raw.match(/LX_SKILL_PATCH:([12])\s*([\s\S]+)$/);
if (!m) { console.error('Not an LX_SKILL_PATCH:1 / :2 blob.'); process.exit(1); }
let patch; try { patch = JSON.parse(m[2]); } catch (e) { console.error('Bad JSON: ' + e.message); process.exit(1); }
const ids = Object.keys(patch); if (!ids.length) { console.error('Patch is empty.'); process.exit(1); }

const src = readFileSync(GAME, 'utf8');
let out = src, changed = 0, skipped = 0;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const id of ids) {
  const e = patch[id] || {}; const touched = [];
  for (const l of (e.lines || [])) {
    if (typeof l.anchor !== 'string' || typeof l.new !== 'string' || !l.anchor.trim()) { console.error(`ABORT ${id}: malformed line edit`); process.exit(1); }
    const n = out.split(l.anchor).length - 1, want = l.count == null ? 1 : l.count;
    if (n !== want) { console.error(`ABORT ${id}: line found ${n}x, patch expects ${want} - the file changed since the tuner read it. Reload it and re-apply.\n  ${l.anchor.slice(0, 100)}`); process.exit(1); }
    if (l.anchor === l.new) continue;
    out = out.split(l.anchor).join(l.new); touched.push(`${n > 1 ? n + 'x ' : ''}${l.anchor.slice(0, 48)}${l.anchor.length > 48 ? '...' : ''}`);
  }
  if (e.cd != null || e.mp != null) {
    const rm = out.match(new RegExp('^\\s{2}' + esc(id) + '\\s*:\\s*\\{[^\\n]*$', 'm'));
    if (!rm) { console.log('  ' + id + ' - NOT FOUND in SKILLS, cd/mp skipped'); skipped++; }
    else {
      let L = rm[0];
      for (const f of ['cd', 'mp']) {
        if (e[f] == null) continue; const v = Math.round(Number(e[f]));
        if (!isFinite(v) || v < 0) { console.log(`  ${id}.${f} - bad value, skipped`); continue; }
        const hit = L.match(new RegExp('(\\b' + f + ':\\s*)(\\d+)')); if (!hit) { console.log(`  ${id}.${f} - no ${f} field, skipped`); continue; }
        if (+hit[2] === v) continue; L = L.replace(hit[0], hit[1] + v); touched.push(`${f} ${hit[2]}->${v}`);
      }
      if (L !== rm[0]) out = out.replace(rm[0], L);
    }
  }
  if (!touched.length) { skipped++; continue; }
  changed++; console.log('  ' + id + '  ' + touched.join(', '));
}
if (!changed) { console.log('Nothing to change.'); process.exit(0); }
if (out.length < src.length * 0.99) { console.error(`ABORT: output shrank from ${src.length} to ${out.length} bytes.`); process.exit(1); }

// every inline script must still parse
const dir = mkdtempSync(join(tmpdir(), 'lxpatch-')); let i = 0, bad = 0;
for (const s of out.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (/\bsrc=/.test(s[1]) || (/type=/.test(s[1]) && !/module|javascript/.test(s[1]))) continue;
  const f = join(dir, 'blk' + (i++) + (/module/.test(s[1]) ? '.mjs' : '.js')); writeFileSync(f, s[2]);
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); if (r.status !== 0) { bad++; console.error('SYNTAX ' + r.stderr.split('\n').slice(0, 3).join(' | ')); }
}
if (bad) { console.error(`ABORT: ${bad} inline script(s) no longer parse. Nothing written.`); process.exit(1); }
if (check) { console.log(`\n--check: ${changed} skill(s) would change, ${skipped} skipped; ${i} scripts parse. Nothing written.`); process.exit(0); }
writeFileSync(GAME + '.tmp', out, 'utf8'); renameSync(GAME + '.tmp', GAME);
console.log(`\nBaked ${changed} skill(s), ${skipped} skipped, ${i} inline scripts parse -> ${GAME}`);
