// Audit: every asset path referenced in game HTML/JS vs the git index
// (git ls-files = exact case GitHub Pages serves). Reports:
//   MISSING  — referenced but no file at any case
//   CASEMIS  — file exists but case differs (works on Windows, 404 on Pages)
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const ROOT = 'C:/Users/Xenon/Desktop/Mojiworld';
const SOURCES = ['mojiworld_game.html', 'anim_calib.js', 'anim_calib_manifest.js',
  'mob_offsets.js', 'monster_hitboxes.js', 'monster_animator_app.js'];

const tracked = execSync('git ls-files', { cwd: ROOT, maxBuffer: 64e6 })
  .toString().split('\n').filter(Boolean);
const exact = new Set(tracked);
const lower = new Map();           // lowercase -> exact
for (const f of tracked) lower.set(f.toLowerCase(), f);

const RE = /["'`(](?:\.\/)?((?:Sprites|backgrounds|audio|portraits|maps|tiles|ui|fx)\/[^"'`()\\?#\n]+?\.(?:png|webp|jpg|jpeg|gif|svg|mp3|ogg|wav|m4a))["'`)]/g;
const refs = new Map();            // path -> first source
for (const s of SOURCES) {
  let txt;
  try { txt = await readFile(`${ROOT}/${s}`, 'utf8'); } catch { continue; }
  for (const m of txt.matchAll(RE)) {
    const p = m[1].replace(/\\/g, '/');
    if (!refs.has(p)) refs.set(p, s);
  }
}

let miss = 0, casem = 0;
for (const [p, src] of [...refs].sort()) {
  if (exact.has(p)) continue;
  const hit = lower.get(p.toLowerCase());
  if (hit) { console.log(`CASEMIS  ${p}  ->  ${hit}   (ref in ${src})`); casem++; }
  else     { console.log(`MISSING  ${p}   (ref in ${src})`); miss++; }
}
console.log(`\nrefs: ${refs.size} | case-mismatch: ${casem} | missing: ${miss}`);
