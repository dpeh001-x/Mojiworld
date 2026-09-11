#!/usr/bin/env node
// Build tools/skill_sfx_catalog.js - the skill list the tester's Skill Sound
// Tuner (tools/skill_sfx_tester.html) shows.
//
// Every row has to name the clip a skill REALLY plays, resolved exactly the way
// _playSkillSfx resolves it: a direct _SKILL_SFX_FILES entry wins, else the
// _SKILL_SFX_ALIAS bucket, else nothing (a silent skill). Those tables, plus
// SKILLS / CLASSES / JOBS / MASTERS for the names, are read from the RUNNING
// game rather than regex-scraped out of 9 MB of source, so a re-pointed alias
// or a new skill shows up without anyone touching this script.
//
// The output is a <script> (window.LX_SKILL_SFX_CATALOG = ...) rather than JSON
// because testers open the page straight off disk, where fetch() is refused.
//
//   node scripts/gen_skill_sfx_catalog.mjs                 write it
//   node scripts/gen_skill_sfx_catalog.mjs --check         exit 1 when stale
//   node scripts/gen_skill_sfx_catalog.mjs --game=x.html   read another build
// Re-run after adding or renaming a skill, re-pointing an alias, or adding clips.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const CHECK = process.argv.includes('--check');
const GAME = path.resolve(ROOT, opt('game', 'mojiworld_game.html'));
const OUT = path.join(ROOT, 'tools', 'skill_sfx_catalog.js');
// What a tester may swap a skill onto: short one-shots only. Music, ambient
// beds, voices and monster sounds would never be right for a cast.
const LIB_CATS = ['skill', 'ui', 'mob-fire'];
// Same rule as _LX_SFX_FILE_RE in the game: a plain audio/ path, no dots or ..
const FILE_RE = /^audio\/(?:[\w-]+\/)*[\w-]+\.(?:mp3|ogg|wav|m4a)$/;

const browser = await chromium.launch({ channel: 'chrome',
  args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
let pageErrors = 0;
page.on('pageerror', () => pageErrors++);
await page.goto('file:///' + GAME.split(path.sep).join('/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof SKILLS === 'object' && typeof _SKILL_SFX_FILES === 'object'
  && typeof _playSkillSfx === 'function', null, { timeout: 120000 });
const G = await page.evaluate(() => {
  const lab = (t) => Object.fromEntries(Object.entries(t || {}).map(([k, v]) => [k, { name: (v && v.name) || k, icon: (v && v.icon) || '' }]));
  return {
    ver: typeof GAME_VERSION === 'string' ? GAME_VERSION : '',
    skills: Object.entries(SKILLS).map(([id, s]) => ({ id, name: s.name || id, icon: s.icon || '',
      cls: s.cls || '', job: s.job || '', master: s.master || '', desc: s.desc || '' })),
    classes: lab(typeof CLASSES === 'object' ? CLASSES : null),
    jobs: lab(typeof JOBS === 'object' ? JOBS : null),
    masters: lab(typeof MASTERS === 'object' ? MASTERS : null),
    files: Object.assign({}, _SKILL_SFX_FILES),
    alias: Object.assign({}, _SKILL_SFX_ALIAS),
    targetVol: _SKILL_SFX_TARGET_VOL,
    masterDefault: typeof _SFX_MASTER_DEFAULT === 'number' ? _SFX_MASTER_DEFAULT : 1,
  };
});
await browser.close();

const resolve = (id) => { const key = G.files[id] ? id : (G.alias[id] || id); return { key, file: G.files[key] || null }; };
const short = (s, n = 170) => {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 25)).replace(/[\s,;:.—-]+$/, '') + '…';
};
const rows = G.skills.map((s) => ({ id: s.id, name: s.name, icon: s.icon, cls: s.cls, job: s.job,
  master: s.master, desc: short(s.desc), ...resolve(s.id) }));

// Extra cues that ride _playSkillSfx under their own ids (Deadeye's lock-on and
// execute, via _lxDeSfx). They are tunable like any skill, so they get rows,
// filed under the skill whose id prefixes theirs.
const src = readFileSync(GAME, 'utf8');
const cueIds = new Set([...src.matchAll(/_(?:lxDeSfx|playSkillSfx)\('([A-Za-z_0-9]+)'\)/g)].map((m) => m[1]));
for (const id of [...cueIds].sort()) {
  if (rows.some((r) => r.id === id)) continue;
  const parent = G.skills.filter((s) => id.startsWith(s.id + '_')).sort((a, b) => b.id.length - a.id.length)[0];
  const tail = id.slice(parent ? parent.id.length + 1 : 0).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  rows.push({ id, name: parent ? `${parent.name} — ${tail}` : tail, icon: parent ? parent.icon : '',
    cls: parent ? parent.cls : '', job: parent ? parent.job : '', master: parent ? parent.master : '',
    desc: parent ? `An extra sound inside ${parent.name}.` : 'An extra skill sound.', cue: parent ? parent.id : '', ...resolve(id) });
}

const sections = Object.entries(G.classes).map(([id, c]) => ({ id, label: c.name, icon: c.icon }));
if (rows.some((r) => !G.classes[r.cls])) sections.push({ id: 'other', label: 'Other', icon: '' });
for (const r of rows) if (!G.classes[r.cls]) r.cls = 'other';

const man = readFileSync(path.join(ROOT, 'data', 'sfx_manifest.js'), 'utf8');
const MAN = JSON.parse(man.slice(man.indexOf('['), man.lastIndexOf(']') + 1));
const library = MAN.filter((m) => LIB_CATS.includes(m.cat) && FILE_RE.test(m.file))
  .map((m) => ({ id: m.id, file: m.file, cat: m.cat, kb: m.kb }));
const libFiles = new Set(library.map((l) => l.file));
const warn = [];
for (const r of rows) {
  if (!r.file) continue;
  if (!existsSync(path.join(ROOT, r.file))) warn.push(`${r.id} plays ${r.file}, which is not on disk`);
  if (!libFiles.has(r.file)) { library.push({ id: path.basename(r.file).replace(/\.\w+$/, ''), file: r.file, cat: 'skill', kb: 0 }); libFiles.add(r.file); }
}

const cat = { ver: G.ver, targetVol: G.targetVol, masterDefault: G.masterDefault, sections,
  jobs: G.jobs, masters: G.masters, rows, library };
const fmt = (o) => '{\n' + Object.entries(o).map(([k, v]) => {
  const one = (x) => '    ' + JSON.stringify(x);
  if (Array.isArray(v)) return `  ${JSON.stringify(k)}: [\n${v.map(one).join(',\n')}\n  ]`;
  if (v && typeof v === 'object') return `  ${JSON.stringify(k)}: {\n${Object.entries(v).map(([a, b]) => `    ${JSON.stringify(a)}: ${JSON.stringify(b)}`).join(',\n')}\n  }`;
  return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
}).join(',\n') + '\n}';
const text = '// GENERATED by scripts/gen_skill_sfx_catalog.mjs from the running game - do not edit;\n'
  + '// re-run it after adding or renaming a skill, re-pointing an alias, or adding clips.\n'
  + '// Read by tools/skill_sfx_tester.html (a <script>, so the page also works off disk).\n'
  + `window.LX_SKILL_SFX_CATALOG = ${fmt(cat)};\n`;

const silent = rows.filter((r) => !r.file).map((r) => r.id);
console.log(`${rows.length} rows (${rows.filter((r) => r.cue).length} extra cues), ${library.length} clips in the library, `
  + `${silent.length} silent${silent.length ? ': ' + silent.join(', ') : ''}; game ${G.ver}, ${pageErrors} page errors during boot`);
for (const w of warn) console.log('  WARN ' + w);
if (CHECK) {
  const old = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  const m = old.match(/window\.LX_SKILL_SFX_CATALOG = (\{[\s\S]*\});/);
  const strip = (c) => JSON.stringify({ ...c, ver: '' });
  const same = !!m && strip(JSON.parse(m[1])) === strip(cat);
  console.log(same ? 'catalog is current' : 'catalog is STALE - run node scripts/gen_skill_sfx_catalog.mjs');
  process.exit(same ? 0 : 1);
}
writeFileSync(OUT + '.tmp', text);
renameSync(OUT + '.tmp', OUT);
console.log(`wrote ${path.relative(ROOT, OUT)} (${text.length} bytes)`);
