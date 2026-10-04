#!/usr/bin/env node
// Build data/boss_resize_manifest.js for tools/boss_resizer.html.
// =============================================================================
// WHY THIS EXISTS
// The runtime boss frame-normaliser is OFF: _BOSS_FRAME_TRUST_ALL = true
// (v0.29.197, per user "remove the rescaling entirely"). Every boss frame is
// now drawn exactly as authored in a constant box, so whatever size drift is
// baked into the art goes straight to the screen — e.g. young_confused_barnaby
// attack drifts 15.5% and duck 13.8% frame-to-frame. The intended fix is the
// per-frame scale array (calib.fs[frameIdx]), which _drawBossSprite already
// applies foot-anchored — but nothing could AUTHOR it. tools/boss_resizer.html
// is that authoring tool, and this file is its measurement backbone.
//
// Per frame we bake:
//   c  content box [top,bottom,left,right]   alpha > 16   (the drawn extent)
//   s  solid box   [top,bottom,left,right]   alpha > 235  (the opaque core)
//   p  row profile, 128 buckets of "widest opaque run in that row band",
//      0-255, base64 — lets the tool measure a USER-CHOSEN Y band (torso only,
//      ignoring a reared weapon) with no canvas pixel access at all. That
//      matters because a file:// canvas is tainted, and because a raised
//      hammer legitimately grows the content box without the figure growing.
// Thresholds mirror the game's _spriteContentBox / _spriteBodyBox exactly.
//
// Run after any boss art drop:  node scripts/gen_boss_resize_manifest.mjs
//   node scripts/gen_boss_resize_manifest.mjs --check   # exit 1 if the table is stale
// scripts/animator_parity_check.mjs runs the --check, so an art drop that skips
// this generator fails there. Without it the table went stale for 25 bosses at
// once: King Krook's idle was still the 1800x1400 canvas he had before v0.30.706.
// =============================================================================
import sharp from 'sharp';
import { readdir, writeFile, readFile, access, rename, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'data', 'boss_resize_manifest.js');
const CHECK = process.argv.includes('--check');
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const BUCKETS = 128;

// Every state directory a boss frame set can live in. idle/walk/attack are the
// universal three; duck/weave are the evade sets (_BOSS_EVADE_TYPES, currently
// Barnaby only) and are exactly where his worst drift lives, so they are not
// optional here the way they are in gen_anim_manifest.mjs.
const STATES = ['idle', 'walk', 'attack', 'duck', 'weave'];

// ---- the game's own size chain (mirrors _drawBossSprite) -------------------
// Baked so the tool can report a FINAL height in real game pixels rather than
// source-canvas numbers nobody can act on. m.h comes from MONSTER_TYPES, the
// draw multiplier from BOSS_DRAW_SCALE, the zodiac bump from
// _ZODIAC_SPRITE_FX[sign].sizeMul. Phase and cast variants (gravitos2star,
// aetherion2, legosaurusdash) size from their BASE type, which is the type the
// monster actually is.
const BOX_H = {
  aetherion: 160, gravitos: 380, king: 98, kingKrook: 130, legosaurus: 238,
  mooma: 151, octobaby: 160, pqConductor: 140, sundered_smith: 140,
  towerArbiter: 160, towerSovereign: 300, young_confused_barnaby: 140,
};
BOX_H.miraFallen = 170;   // v0.30.1627 mira-fallen: the Woman Who Turned Back
const ZODIAC_ORDER = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const ZODIAC_SIZE_MUL = { scorpio: 1.20, capricorn: 1.30 };
const BOSS_DRAW_SCALE = { gravitos: 0.95 };
// The game's _BOSS_ATK_SCALE, EMPTY since v0.30.706: kingKrook's 1.10 went when
// all his sets moved to one 960x960 canvas. Still 1.10 here, it put his attack
// 10% taller than the game draws it (268 px, not 244), and "match all to idle"
// would have baked a 9% shrink into his swing. The table stays, as in the game.
const BOSS_ATK_SCALE = {};
const BOSS_SIZE_REF = 1024;

function baseType(key) {
  if (key.startsWith('zodiac_')) return key;
  if (key.startsWith('gravitos')) return 'gravitos';
  if (key.startsWith('aetherion')) return 'aetherion';
  if (key.startsWith('legosaurus')) return 'legosaurus';
  // The Sovereign's per-attack sets (towerSovereignswing / column / collapse /
  // volley / drain) size from the Sovereign, exactly as the Gravitos cast sets
  // size from Gravitos. Without this they fall through to BOX_H[key] ===
  // undefined and gameBox() returns null, so the resizer shows them with no
  // game height at all -- the one number the tool exists to report.
  if (key.startsWith('towerSovereign')) return 'towerSovereign';
  // Same for King Krook's stomp (drawn on him through m._gravStarKey) and the
  // Arbiter's verdict / column (_LX_BOSS_ATK_SETS): they came with no game box.
  if (key.startsWith('kingKrook')) return 'kingKrook';
  if (key.startsWith('towerArbiter')) return 'towerArbiter';
  if (key.startsWith('miraFallen')) return 'miraFallen';   // v0.30.1627 mira-fallen: her cast + Gate sets
  return key;
}
// The on-screen box a frame of this set is drawn into, before calibration.
function gameBox(key, state, srcW, srcH) {
  const t = baseType(key);
  let h, sizeMul = 1;
  if (t.startsWith('zodiac_')) {
    const sign = t.slice(7);
    h = 110 + (ZODIAC_ORDER.indexOf(sign) + 1) * 4;   // MONSTER_TYPES: 110 + order*4
    sizeMul = ZODIAC_SIZE_MUL[sign] || 1;
  } else {
    h = BOX_H[t];
  }
  if (!h) return null;
  const sizeFactor = Math.max(0.7, Math.min(1.6, Math.max(srcW, srcH) / BOSS_SIZE_REF));
  const drawMul = (BOSS_DRAW_SCALE[t] != null) ? BOSS_DRAW_SCALE[t] : 2.0;
  let targetH = Math.max(1, Math.round(h * drawMul * sizeFactor * sizeMul));
  if (state === 'attack' && BOSS_ATK_SCALE[t]) targetH = Math.max(1, Math.round(targetH * BOSS_ATK_SCALE[t]));
  return { targetH, boxH: h, drawMul, sizeFactor: +sizeFactor.toFixed(4), sizeMul };
}

async function measure(path) {
  const buf = await readFile(path);
  const { data, info } = await sharp(buf).ensureAlpha().extractChannel('alpha')
    .raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let cT = -1, cB = -1, cL = W, cR = -1;
  let sT = -1, sB = -1, sL = W, sR = -1;
  const rows = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let any = false, solid = false, run = 0, best = 0;
    for (let x = 0; x < W; x++) {
      const a = data[o + x];
      if (a > 16) {
        any = true;
        if (++run > best) best = run;
        if (x < cL) cL = x;
        if (x > cR) cR = x;
        if (a > 235) { solid = true; if (x < sL) sL = x; if (x > sR) sR = x; }
      } else run = 0;
    }
    rows[y] = best / W;
    if (any) { if (cT < 0) cT = y; cB = y; }
    if (solid) { if (sT < 0) sT = y; sB = y; }
  }
  if (cT < 0) return null;
  // 128 buckets, each the WIDEST run seen in its row band — a max (not a mean)
  // so a one-row-tall limb still registers instead of averaging away.
  const prof = Buffer.alloc(BUCKETS);
  for (let b = 0; b < BUCKETS; b++) {
    const y0 = Math.floor(b * H / BUCKETS), y1 = Math.max(y0 + 1, Math.floor((b + 1) * H / BUCKETS));
    let mx = 0;
    for (let y = y0; y < y1 && y < H; y++) if (rows[y] > mx) mx = rows[y];
    prof[b] = Math.round(Math.min(1, mx) * 255);
  }
  return { w: W, h: H, c: [cT, cB, cL, cR], s: sT < 0 ? null : [sT, sB, sL, sR], p: prof.toString('base64') };
}

// Frames are the contiguous <key>_0.. run, the same walk every loader does, up
// to the frame index's own ceiling (gen_sprite_frame_index.mjs MAX). It was 16,
// which gravitospunch's 16-frame attack sits exactly on: a 17th frame would
// have been dropped without a word.
const MAX_FRAMES = 24;
async function scanState(dir, key) {
  const frames = [];
  for (let i = 0; i < MAX_FRAMES; i++) {
    const p = join(dir, `${key}_${i}.webp`);
    if (!(await exists(p))) break;
    const m = await measure(p);
    if (!m) break;
    frames.push(m);
  }
  return frames;
}

async function scanGroup(spriteDir, relDir, label) {
  const out = {};
  for (const st of STATES) {
    const sdir = join(spriteDir, st);
    if (!(await exists(sdir))) continue;
    const keys = new Set();
    for (const f of await readdir(sdir)) {
      const m = /^(.+)_(\d+)\.webp$/.exec(f);
      if (m) keys.add(m[1]);
    }
    for (const key of [...keys].sort()) {
      const frames = await scanState(sdir, key);
      if (frames.length < 2) continue;
      const w = frames[0].w, h = frames[0].h;
      const box = gameBox(key, st, w, h);
      (out[key] || (out[key] = { group: label, states: {} })).states[st] = {
        count: frames.length, w, h, dir: `${relDir}/${st}/${key}`,
        // the game's draw box for this set, so the tool can talk in game pixels
        game: box || undefined,
        f: frames.map(fr => ({ c: fr.c, s: fr.s, p: fr.p })),
        // canvas size is uniform in every set shipped so far; flag it if not,
        // because a varying canvas means the drift is not a scale problem
        mixedCanvas: frames.some(fr => fr.w !== w || fr.h !== h) || undefined,
      };
      if (!CHECK) process.stdout.write(`  ${label}/${st}/${key} — ${frames.length} frames\n`);
    }
  }
  return out;
}

const bosses = await scanGroup(join(root, 'Sprites', 'bosses'), 'Sprites/bosses', 'boss');
const zodiac = await scanGroup(join(root, 'Sprites', 'bosses', 'zodiac'), 'Sprites/bosses/zodiac', 'zodiac');
// zodiac entities key as 'zodiac_<sign>' in the game's calib lookup
const all = { ...bosses };
for (const [k, v] of Object.entries(zodiac)) all['zodiac_' + k] = v;

const header = `// AUTO-GENERATED by scripts/gen_boss_resize_manifest.mjs — do not hand-edit.
// Per-frame content/solid boxes + row profiles for every boss frame set, for
// tools/boss_resizer.html. c/s = [top,bottom,left,right]; p = 128-bucket row
// profile (widest opaque run per band, 0-255, base64). game.targetH is the
// on-screen box height in GAME PIXELS that _drawBossSprite draws this set into
// before calibration. Thresholds mirror the
// game's _spriteContentBox (alpha>16) and _spriteBodyBox (alpha>235).
`;
const body = header + 'window.LX_BOSS_RESIZE = ' + JSON.stringify(all) + ';\n';
const sets = Object.values(all).reduce((n, e) => n + Object.keys(e.states).length, 0);

if (CHECK) {
  // Compare PARSED objects, not text: data/ tables are CRLF in a Windows
  // checkout and LF in the blob, so a byte compare cries wolf on a clean tree.
  // The round trip drops the undefined fields JSON never writes.
  const want = JSON.parse(JSON.stringify(all));
  let have = null;
  try {
    const src = await readFile(OUT, 'utf8');
    const at = src.indexOf('window.LX_BOSS_RESIZE = ');
    have = JSON.parse(src.slice(at + 'window.LX_BOSS_RESIZE = '.length, src.lastIndexOf(';')));
  } catch (e) { /* missing or unreadable: every entity below reads as stale */ }
  const keys = [...new Set([...Object.keys(want), ...Object.keys(have || {})])].sort();
  const stale = keys.filter((k) => !isDeepStrictEqual(want[k], have && have[k]));
  if (stale.length) {
    const tag = (k) => !(have && k in have) ? k + ' (missing)' : !(k in want) ? k + ' (no art)' : k;
    console.error(`STALE: data/boss_resize_manifest.js no longer describes the art for ${stale.length} ` +
      `entit${stale.length === 1 ? 'y' : 'ies'}: ${stale.map(tag).join(', ')}\n` +
      'Run: node scripts/gen_boss_resize_manifest.mjs');
    process.exit(1);
  }
  console.log(`data/boss_resize_manifest.js is current (${keys.length} entities, ${sets} frame sets)`);
  process.exit(0);
}

// Atomic, per the file-safety rules (this file is over 100 KB): tmp -> node
// --check -> rename, so a failed write can never leave a truncated table.
const tmp = OUT.replace(/\.js$/, '.tmp.js');   // node --check wants a .js extension
await writeFile(tmp, body);
try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' }); }
catch (e) { await unlink(tmp).catch(() => {}); throw e; }
await rename(tmp, OUT);
console.log(`\nwrote data/boss_resize_manifest.js — ${Object.keys(all).length} entities, ${sets} frame sets`);
