#!/usr/bin/env node
// ART QUALITY AUDIT — companion to scripts/icon_coverage.mjs.
// =============================================================================
// icon_coverage.mjs answers "is there art for every id?". This answers the
// other half: "is the art we have actually usable?". It catches the three
// failure modes that ship silently because the file EXISTS and the loader is
// happy, so nothing 404s and no readiness guard trips:
//
//   1. LOW RESOLUTION   — art authored small, then scaled up in game and blurry.
//   2. TINY FILE        — a few KB usually means near-empty, truncated, or
//                         crushed to mush by over-compression.
//   3. NO TRANSPARENCY  — a sprite whose alpha never drops below 255. These
//                         render as a SOLID RECTANGLE over the scene, which is
//                         exactly what an effect sprite must never do.
//
//   node scripts/art_quality_audit.mjs
//   node scripts/art_quality_audit.mjs --dirs vfx,fx      # limit scope
//   node scripts/art_quality_audit.mjs --min-px 256       # stricter res floor
// Exits 1 if anything fails, so it can gate a release.
// =============================================================================
import sharp from 'sharp';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITES = join(repoRoot, 'Sprites');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

const DIRS = String(arg('--dirs', 'vfx,fx,boons,skills')).split(',').map(s => s.trim()).filter(Boolean);
const MIN_PX = Number(arg('--min-px', 200));   // longest edge
const MIN_KB = Number(arg('--min-kb', 6));

// Art that is legitimately a flat opaque tile (backgrounds, keyart) would trip
// the transparency check; effect/icon folders should never contain one.
const OPAQUE_OK = /(^|\/)(backgrounds|world|floors|keyart)(\/|$)/;

const rows = [];
for (const d of DIRS) {
  const dir = join(SPRITES, d);
  if (!existsSync(dir)) { console.log(`(skip ${d} — not found)`); continue; }
  for (const f of readdirSync(dir).filter(x => /\.(png|webp)$/i.test(x))) {
    const p = join(dir, f);
    let meta, alphaMin = null;
    try {
      meta = await sharp(p).metadata();
      const st = await sharp(p).ensureAlpha().stats();
      alphaMin = st.channels[3] ? st.channels[3].min : null;
    } catch (e) { rows.push({ d, f, err: String(e.message || e).slice(0, 60) }); continue; }
    rows.push({ d, f, w: meta.width, h: meta.height, kb: Math.round(statSync(p).size / 1024), alphaMin });
  }
}

const broken  = rows.filter(r => r.err);
const lowRes  = rows.filter(r => !r.err && Math.max(r.w, r.h) < MIN_PX);
const tiny    = rows.filter(r => !r.err && r.kb < MIN_KB);
const opaque  = rows.filter(r => !r.err && r.alphaMin === 255 && !OPAQUE_OK.test(r.d));

const section = (title, list, fmt) => {
  console.log(`\n${list.length ? '✗' : '✓'} ${title}: ${list.length}`);
  list.slice(0, 20).forEach(r => console.log('    ' + fmt(r)));
  if (list.length > 20) console.log(`    ... +${list.length - 20} more`);
};

console.log('=== ART QUALITY AUDIT ===');
console.log(`scanned ${rows.length} files in Sprites/{${DIRS.join(',')}}`);
console.log(`thresholds: longest edge >= ${MIN_PX}px, size >= ${MIN_KB}KB, alpha must drop below 255`);
section(`unreadable`, broken, r => `${r.d}/${r.f}  ${r.err}`);
section(`low resolution (< ${MIN_PX}px)`, lowRes, r => `${r.d}/${r.f}  ${r.w}x${r.h}`);
section(`suspiciously small (< ${MIN_KB}KB)`, tiny, r => `${r.d}/${r.f}  ${r.kb}KB  ${r.w}x${r.h}`);
section(`no transparency (renders as a solid box)`, opaque, r => `${r.d}/${r.f}  ${r.w}x${r.h}  ${r.kb}KB`);

const failed = broken.length + lowRes.length + tiny.length + opaque.length;
console.log(`\n${failed ? failed + ' issue(s) found' : 'all clear'} — ${rows.length} files`);
process.exit(failed ? 1 : 0);
