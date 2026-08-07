// Does every asset path the game builds still resolve to a file on disk?
//
// The v0.29.286 WebP conversion rewrote literal paths but missed paths built by
// CONCATENATION ('Sprites/skills/' + id + '.png'), which no regex over literals
// can see. Those fail silently at runtime — an onerror handler and a fallback
// glyph look exactly like "no art authored yet".
//
//   node scripts/asset_path_audit.mjs [file ...]
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
const FILES = process.argv.slice(2).length ? process.argv.slice(2)
  : ['mojiworld_game.html', 'monster_animator.html'];
const ROOTS = 'Sprites|audio|backgrounds|assets|steam';
const MEDIA = 'png|webp|jpg|jpeg|gif|svg|mp3|ogg|wav|mp4|webm';

const dirCache = new Map();
// Recurse: a path like 'Sprites/equipment/' + cat + '/' + name + '.webp' puts a
// VARIABLE directory in the middle, so the art sits one level down
// (equipment/weapons/*.webp) and a top-level-only scan reports a false miss.
function extsIn(dir, depth = 3) {
  const key = dir + '#' + depth;
  if (dirCache.has(key)) return dirCache.get(key);
  let set = null;
  try {
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      set = new Set();
      for (const f of readdirSync(dir)) {
        const full = dir + '/' + f;
        let isDir = false;
        try { isDir = statSync(full).isDirectory(); } catch (e) {}
        if (isDir) {
          if (depth > 0) { const sub = extsIn(full, depth - 1); if (sub) for (const e of sub) set.add(e); }
        } else { const i = f.lastIndexOf('.'); if (i > 0) set.add(f.slice(i + 1).toLowerCase()); }
      }
    }
  } catch (e) {}
  dirCache.set(key, set);
  return set;
}
function fileCount(dir, ext) {
  try { return readdirSync(dir).filter(f => f.toLowerCase().endsWith('.' + ext)).length; } catch (e) { return 0; }
}

const missingLiteral = [], brokenPattern = [], seenPat = new Set();
for (const F of FILES) {
  if (!existsSync(F)) { console.log(`(skipped, not found: ${F})`); continue; }
  const src = readFileSync(F, 'utf8');
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;

  // --- 1. fully literal paths ---------------------------------------------
  for (const m of src.matchAll(new RegExp(`['"\`]((?:${ROOTS})/[^'"\`\\s\${}()]+\\.(?:${MEDIA}))['"\`]`, 'gi'))) {
    const p = m[1];
    // Comments and docs carry illustrative paths ("Sprites/ui/<id>.webp",
    // "Sprites/vfx/*.png"). They are not requests, so reporting them as
    // missing files buries the real hits.
    if (/[<>*?]|\$\{/.test(p)) continue;
    if (existsSync(p)) continue;
    // A path inside a comment is documentation (an asset request to an artist,
    // a note about removed code), not a request the browser will ever make.
    // Reporting those as failures is what makes an audit get ignored.
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const before = src.slice(lineStart, m.index);
    const inComment = before.includes('//') || /^\s*\*/.test(before);
    missingLiteral.push({ file: F, line: lineOf(m.index), path: p, inComment });
  }

  // --- 2. concatenated:  'Sprites/x/' + id + '.png' -------------------------
  for (const m of src.matchAll(new RegExp(`['"\`]((?:${ROOTS})/(?:[\\w.-]+/)*)['"\`]\\s*\\+[^;\\n]{0,120}?\\+\\s*['"\`](\\.(?:${MEDIA}))['"\`]`, 'gi'))) {
    const dir = m[1].replace(/\/$/, ''), ext = m[2].slice(1).toLowerCase();
    const key = dir + '|' + ext;
    if (seenPat.has(key)) continue; seenPat.add(key);
    const have = extsIn(dir);
    if (have && !have.has(ext)) {
      brokenPattern.push({ file: F, line: lineOf(m.index), dir, wants: ext,
        found: [...have].sort().join(','), counts: [...have].sort().join(',') });
    }
  }

  // --- 3. template literals:  `Sprites/x/${id}.png` -------------------------
  for (const m of src.matchAll(new RegExp('`((?:' + ROOTS + ')/(?:[\\w.-]+/)*)\\$\\{[^}]{1,80}\\}(\\.(?:' + MEDIA + '))`', 'gi'))) {
    const dir = m[1].replace(/\/$/, ''), ext = m[2].slice(1).toLowerCase();
    const key = dir + '|' + ext;
    if (seenPat.has(key)) continue; seenPat.add(key);
    const have = extsIn(dir);
    if (have && !have.has(ext)) {
      brokenPattern.push({ file: F, line: lineOf(m.index), dir, wants: ext,
        found: [...have].sort().join(','), counts: [...have].sort().join(',') });
    }
  }
}

console.log('=== BUILT PATHS whose directory has ZERO files of that extension ===');
if (!brokenPattern.length) console.log('  (none)');
for (const b of brokenPattern) console.log(`  ${b.file}:${b.line}  ${b.dir}/*.${b.wants}  -> dir has [${b.counts}]`);

const inCode = missingLiteral.filter(m => !m.inComment);
const inDocs = missingLiteral.filter(m => m.inComment);
console.log(`\n=== LITERAL paths in CODE with no file on disk ===`);
if (!inCode.length) console.log('  (none)');
const byDir = new Map();
for (const m of inCode) {
  const d = m.path.slice(0, m.path.lastIndexOf('/'));
  if (!byDir.has(d)) byDir.set(d, []);
  byDir.get(d).push(m);
}
for (const [d, list] of [...byDir.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${d}/  — ${list.length} missing`);
  for (const m of list.slice(0, 4)) console.log(`      ${m.file}:${m.line}  ${m.path}`);
  if (list.length > 4) console.log(`      … and ${list.length - 4} more`);
}

if (inDocs.length) {
  console.log(`\n=== (informational) ${inDocs.length} more sit inside comments — asset requests / notes, not requests ===`);
  for (const m of inDocs.slice(0, 6)) console.log(`  ${m.file}:${m.line}  ${m.path}`);
}
console.log(`\nin-code missing: ${inCode.length}   broken-pattern dirs: ${brokenPattern.length}   (in-comment, ignored: ${inDocs.length})`);
process.exit((inCode.length || brokenPattern.length) ? 1 : 0);
