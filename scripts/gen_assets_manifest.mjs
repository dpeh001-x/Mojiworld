#!/usr/bin/env node
// Rebuild data/assets_manifest.json — the offline cache-warm list.
//   node scripts/gen_assets_manifest.mjs          # write
//   node scripts/gen_assets_manifest.mjs --check  # exit 1 if it has drifted
//
// What the list is FOR (see the _lxWarmAllAssets block in mojiworld_game.html):
// once the service worker is CONTROLLING, the game trickle-fetches every path
// in here so the SW cache ends up holding the whole game — later sessions on
// that device render with zero pop-in, even for content never visited. A file
// missing from the list still WORKS; it just never gets pre-cached, so it pops
// in the first time it is met and is unavailable offline.
//
// It had no generator, so it drifted: measured at the time this was written,
// 264 files on disk were absent from the list (every asset added since it was
// last hand-built) and 36 entries pointed at files that no longer exist —
// wasted 404s on every warm pass. Run this after any art or audio drop, the
// same way gen_sprite_frame_index.mjs is run after a sprite drop.
// =============================================================================
import { readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(repoRoot, 'data', 'assets_manifest.json');
const check = process.argv.includes('--check');

// Roots and the extensions that matter in each. Kept explicit rather than
// "everything": the manifest is a download list, so a stray .psd or a source
// .png beside a shipped .webp would cost the player bandwidth for nothing.
const ROOTS = [
  { dir: 'Sprites', exts: ['.webp', '.png'] },
  { dir: 'audio', exts: ['.mp3'] },
];

// Working files on disk that must never be shipped: backups taken before a
// regen, archived one-offs, scratch. The convention across Sprites/ and audio/
// is a LEADING UNDERSCORE, and it is used consistently — every one of the 16
// underscore-prefixed directories under those two roots is a backup
// (_backup_gravitos, _icon_backup, _orig_backup, _themes_backup, …) and
// nothing shipped lives in one.
//
// Matching on the leading underscore rather than on the word "backup" is the
// point: a substring match both MISSED real backup dirs whose name does not
// start with the word (_icon_backup, _orig_backup — 78 files) and CAUGHT
// shipped assets that merely contain it (Sprites/ui/menu/menu_backups.webp,
// audio/npc/npc_old_arlen.mp3 — Old Arlen is an NPC, not an old file).
const SKIP_DIR = /^_/;
const SKIP_FILE = /^_/;   // e.g. Sprites/bosses/_backup_legosaurus_1290.webp

const walk = (abs, rel, exts, out) => {
  let entries;
  try { entries = readdirSync(abs, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIR.test(e.name)) continue;
      walk(join(abs, e.name), rel + '/' + e.name, exts, out);
    } else if (!SKIP_FILE.test(e.name) && exts.some((x) => e.name.toLowerCase().endsWith(x))) {
      out.push(rel + '/' + e.name);
    }
  }
  return out;
};

const list = [];
for (const { dir, exts } of ROOTS) walk(join(repoRoot, dir), dir, exts, list);
// Stable order so a re-run with no art change produces a byte-identical file
// (and so the resumable cursor in _lxWarmAllAssets stays meaningful).
list.sort();

const next = JSON.stringify(list);
let prev = null;
try { prev = readFileSync(OUT, 'utf8'); } catch {}

if (check) {
  if (prev === next) { console.log('data/assets_manifest.json is up to date. (' + list.length + ' assets)'); process.exit(0); }
  let before = [];
  try { before = JSON.parse(prev || '[]'); } catch {}
  const had = new Set(before), has = new Set(list);
  const added = list.filter((p) => !had.has(p));
  const gone = before.filter((p) => !has.has(p));
  console.error(`data/assets_manifest.json has DRIFTED: ${added.length} missing from it, ${gone.length} stale entries.`);
  if (added.length) console.error('  missing e.g. ' + added.slice(0, 4).join(', '));
  if (gone.length) console.error('  stale   e.g. ' + gone.slice(0, 4).join(', '));
  process.exit(1);
}

// Atomic write (repo convention — a truncated manifest would silently disable
// the whole cache-warm pass).
writeFileSync(OUT + '.tmp', next, 'utf8');
renameSync(OUT + '.tmp', OUT);
let beforeN = 0; try { beforeN = JSON.parse(prev || '[]').length; } catch {}
console.log(`data/assets_manifest.json: ${beforeN} -> ${list.length} assets`);
