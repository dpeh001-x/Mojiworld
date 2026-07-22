#!/usr/bin/env node
// Build anim_calib_manifest.js for monster_animator.html.
// =============================================================================
// Scans Sprites/{monsters,bosses}/{idle,walk,attack}/ for entities that have
// animation frames, pairs each with its base sprite (for the foot-anchor bbox
// the game uses), and emits a window.LX_ANIM_MANIFEST the tool reads. Run after
// adding/regenerating frames:  node scripts/gen_anim_manifest.mjs
// =============================================================================
import sharp from 'sharp';
import { readdir, writeFile, readFile, access } from 'node:fs/promises';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const STATES = ['idle', 'walk', 'attack'];

// Alpha bbox-bottom fraction of a sprite (mirrors the game's foot anchor).
async function baseInfo(path) {
  try {
    const { data, info } = await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, C = info.channels;
    let bottom = 0;
    for (let y = H - 1; y >= 0; y--) { let hit = false; for (let x = 0; x < W; x++) if (data[(y * W + x) * C + 3] > 16) { hit = true; break; } if (hit) { bottom = y; break; } }
    return { w: W, h: H, botFrac: +(((bottom + 1) / H).toFixed(4)) };
  } catch { return null; }
}

// Per-frame content boxes, mirroring the game's _spriteContentBox /
// _spriteBodyBox thresholds (alpha>16 = content, alpha>235 = solid body).
// Baked so the animator's content-normalisation still works when canvas
// pixel readback is blocked (file:// taint) — [top, bottom, bodyTop, bodyBottom].
async function frameBox(path) {
  try {
    const { data, info } = await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, C = info.channels;
    let cT = -1, cB = -1, bT = -1, bB = -1;
    for (let y = 0; y < H; y++) {
      let any = false, solid = false;
      for (let x = 0; x < W; x++) {
        const a = data[(y * W + x) * C + 3];
        if (a > 16) { any = true; if (a > 235) { solid = true; break; } }
      }
      if (any) { if (cT < 0) cT = y; cB = y; }
      if (solid) { if (bT < 0) bT = y; bB = y; }
    }
    return cT < 0 ? null : [cT, cB, bT, bB];
  } catch { return null; }
}

async function scanGroup(group, dir) {
  // discover entity types from the idle/walk/attack subdirs
  const types = new Set();
  for (const st of STATES) {
    const sdir = join(dir, st);
    if (!(await exists(sdir))) continue;
    for (const f of await readdir(sdir)) {
      const m = f.match(/^(.+)_(\d+)\.webp$/i);
      if (m) types.add(m[1]);
    }
  }
  const out = {};
  for (const type of types) {
    // base sprite (for the foot-anchor bbox) — png then webp
    let base = null, basePath = null;
    for (const ext of ['.png', '.webp']) {
      const p = join(dir, type + ext);
      if (await exists(p)) { base = await baseInfo(p); basePath = `Sprites/${group === 'boss' ? 'bosses' : 'monsters'}/${type}${ext}`; break; }
    }
    const states = {};
    for (const st of STATES) {
      let count = 0; let dims = null; const cb = [];
      while (await exists(join(dir, st, `${type}_${count}.webp`))) {
        const fp = join(dir, st, `${type}_${count}.webp`);
        if (count === 0) { try { const mm = await sharp(await readFile(fp)).metadata(); dims = { w: mm.width, h: mm.height }; } catch {} }
        cb.push(await frameBox(fp));
        count++;
      }
      if (count) states[st] = { count, ...(dims || {}), dir: `Sprites/${group === 'boss' ? 'bosses' : 'monsters'}/${st}/${type}`, cb };
    }
    if (Object.keys(states).length) out[type] = { group, base, basePath, states };
  }
  return out;
}

const manifest = {
  ...(await scanGroup('monster', join(root, 'Sprites', 'monsters'))),
  ...(await scanGroup('boss', join(root, 'Sprites', 'bosses'))),
};
const n = Object.keys(manifest).length;
// v0.29.179 — BAKE-TIME CANVAS VALIDATION. A BOSS whose static sprite lives on
// a different canvas than its frame sets puts the static's bbox row out of
// range for the drawn frame — the class both the game and the animator patch
// with the runtime canvas-geometry guard (the Legosaurus float fix). The right
// place to stop it is here, when data is baked: normalize the static onto the
// frame canvas (same-aspect proportional re-encode) instead of shipping the
// mismatch. Monsters are exempt — their draw path sizes AND anchors from the
// static, and per-state frame aspect is handled at draw (e.g. voltipup's
// square frames vs 1000x700 base are by design).
let _mismatches = 0;
for (const [t, ent] of Object.entries(manifest)) {
  if (ent.group !== 'boss' || !ent.base || !ent.states.idle) continue;
  const b = ent.base, f = ent.states.idle;
  if (b.w !== f.w || b.h !== f.h) {
    _mismatches++;
    console.warn(`!! BOSS CANVAS MISMATCH: ${t} static ${b.w}x${b.h} vs frames ${f.w}x${f.h}` +
      ` — re-encode the static onto the frame canvas (see v0.29.179) or the runtime guard must catch it.`);
  }
}
// (v0.29.186 — the v0.29.185 cross-state canvas + character-drift validations
// were removed with the rebake rollback: the restored pre-rebake frames ship
// per-state canvases by origin, and the runtime guard + content-norm handle
// them — warning on every build would be permanent noise.)
if (_mismatches) console.warn(`!! ${_mismatches} boss canvas mismatch(es) — fix the asset(s), do not rely on the runtime guard.`);
else console.log('canvas validation: all boss statics match their frame canvases.');
await writeFile(join(root, 'anim_calib_manifest.js'),
  '// AUTO-GENERATED by scripts/gen_anim_manifest.mjs — do not hand-edit.\n' +
  '// Lists every animated entity (monster/boss) + its base foot-anchor bbox +\n' +
  '// per-state frame info, for monster_animator.html.\n' +
  'window.LX_ANIM_MANIFEST = ' + JSON.stringify(manifest, null, 0) + ';\n' +
  // v0.29.186 — bake stamp: the animator appends this to every frame URL as a
  // cache-buster, so a re-bake can never be masked by stale CDN/browser cache.
  'window.LX_ANIM_MANIFEST_STAMP = ' + JSON.stringify(new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)) + ';\n');
console.log(`Wrote anim_calib_manifest.js — ${n} animated entities.`);
