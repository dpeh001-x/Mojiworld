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
// v0.30.x — states only some entities own. Barnaby's evade pair lives under
// Sprites/bosses/{duck,weave}/; the zodiac trio under
// Sprites/bosses/zodiac/{charge,fly,pounce}/. Scanning for a state whose
// directory does not exist is a no-op, so each group can simply ask for more.
const BOSS_EXTRA = ['duck', 'weave'];
const ZODIAC_EXTRA = ['charge', 'fly', 'pounce'];

// Alpha bbox-bottom fraction of a sprite (mirrors the game's foot anchor).
// v0.29.x — EXACT mirror of the game's _detectSpriteBboxBottom: alpha > 64
// (not 16 — low-alpha ghost rows at the canvas bottom of Ludo-generated art
// fooled the old threshold) and require TWO opaque pixels in a row (single-
// pixel speckles are noise). The old 16-threshold produced botFrac values a
// few % below the game's, planting animator previews lower than in-game.
async function baseInfo(path) {
  try {
    const { data, info } = await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, C = info.channels;
    let bottom = H - 1, found = false;
    for (let y = H - 1; y >= 0 && !found; y--) {
      let run = 0;
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * C + 3] > 64) { if (++run >= 2) { bottom = y; found = true; break; } }
        else run = 0;
      }
    }
    return { w: W, h: H, botFrac: +(((bottom + 1) / H).toFixed(4)) };
  } catch { return null; }
}

// v0.29.x — base-sprite filename aliases. KEEP IN SYNC with the game's
// MONSTER_SPRITE_ALIASES (mojiworld_game.html ~L91437): these types ship
// their base art under a different filename, and the missing base left the
// animator on a 0.92 default foot anchor while the game measured the real
// sprite (grumpsquid previewed 6px low — the Δbot parity failure).
const BASE_ALIASES = {
  pearlSprite: 'pearl',
  seasponge: 'reefmaw',
  seastar: 'tankstar',
  grumpsquid: 'sourpus',
  vigil_vermillion: 'young_bloodthirsty_vermillion',
};

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

// opts.urlBase overrides the served path prefix, opts.keyPrefix the entity key.
// Both default to the old behaviour, so the two original calls are unchanged.
async function scanGroup(group, dir, opts = {}) {
  const urlBase = opts.urlBase || `Sprites/${group === 'boss' ? 'bosses' : 'monsters'}`;
  const keyPrefix = opts.keyPrefix || '';
  const states = opts.states || STATES;
  // discover entity types from the idle/walk/attack subdirs
  const types = new Set();
  for (const st of states) {
    const sdir = join(dir, st);
    if (!(await exists(sdir))) continue;
    for (const f of await readdir(sdir)) {
      const m = f.match(/^(.+)_(\d+)\.webp$/i);
      if (m) types.add(m[1]);
    }
  }
  const out = {};
  for (const type of types) {
    // base sprite (for the foot-anchor bbox) — png then webp, under the type
    // key first, then its alias filename (see BASE_ALIASES above).
    let base = null, basePath = null;
    for (const name of [type, BASE_ALIASES[type]].filter(Boolean)) {
      for (const ext of ['.png', '.webp']) {
        const p = join(dir, name + ext);
        if (await exists(p)) { base = await baseInfo(p); basePath = `${urlBase}/${name}${ext}`; break; }
      }
      if (base) break;
    }
    const found = {};
    for (const st of states) {
      let count = 0; let dims = null; const cb = [];
      while (await exists(join(dir, st, `${type}_${count}.webp`))) {
        const fp = join(dir, st, `${type}_${count}.webp`);
        if (count === 0) { try { const mm = await sharp(await readFile(fp)).metadata(); dims = { w: mm.width, h: mm.height }; } catch {} }
        cb.push(await frameBox(fp));
        count++;
      }
      if (count) found[st] = { count, ...(dims || {}), dir: `${urlBase}/${st}/${type}`, cb };
    }
    if (Object.keys(found).length) out[keyPrefix + type] = { group, base, basePath, states: found };
  }
  return out;
}

const manifest = {
  ...(await scanGroup('monster', join(root, 'Sprites', 'monsters'))),
  ...(await scanGroup('boss', join(root, 'Sprites', 'bosses'), { states: [...STATES, ...BOSS_EXTRA] })),
  // v0.30.x — the twelve zodiac bosses. Their art is one level down and their
  // statics sit beside it, and the game keys their calibration on
  // 'zodiac_' + sign, so the manifest key has to match or an exported
  // calibration would land under a key the game never reads.
  ...(await scanGroup('boss', join(root, 'Sprites', 'bosses', 'zodiac'),
    { urlBase: 'Sprites/bosses/zodiac', keyPrefix: 'zodiac_', states: [...STATES, ...ZODIAC_EXTRA] })),
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

// v0.30.x — DEGENERATE CONTENT BOXES. This shipped once and must not again:
// aetherionastral was baked with all nine of its cb entries identical
// ([567,1324,569,1324]), while a re-run gives nine distinct boxes and does so
// reproducibly. Nine separately drawn frames essentially never share one alpha
// extent to the pixel, so an all-identical run means the read was bad — a file
// caught mid-write by a parallel session is the likely culprit here — and the
// result is silent: content-normalisation then scales every frame against a box
// that does not describe it, and the animator's "in-game" number is wrong.
// Cheap invariant, caught at the only moment it is free to catch.
const _degenerate = [];
for (const [t, ent] of Object.entries(manifest)) {
  for (const [st, info] of Object.entries(ent.states)) {
    const cb = info.cb;
    if (!Array.isArray(cb) || cb.length < 2) continue;
    if (cb.some((b) => b == null)) continue;                 // a null is already a read failure, reported elsewhere
    const first = JSON.stringify(cb[0]);
    if (cb.every((b) => JSON.stringify(b) === first)) _degenerate.push(`${t}.${st} (${cb.length} frames, all ${first})`);
  }
}
if (_degenerate.length && !process.argv.includes('--allow-degenerate')) {
  console.error('\n!! REFUSING TO WRITE — every frame of these states baked the SAME content box:');
  for (const d of _degenerate) console.error('   ' + d);
  console.error('   Distinct frames do not share one alpha extent; the read was almost certainly bad.');
  console.error('   Re-run this generator (it is reproducible). If the art really is identical across');
  console.error('   the set, pass --allow-degenerate to override.\n');
  process.exit(1);
}
else console.log('canvas validation: all boss statics match their frame canvases.');
await writeFile(join(root, 'data', 'anim_calib_manifest.js'),
  '// AUTO-GENERATED by scripts/gen_anim_manifest.mjs — do not hand-edit.\n' +
  '// Lists every animated entity (monster/boss) + its base foot-anchor bbox +\n' +
  '// per-state frame info, for monster_animator.html.\n' +
  'window.LX_ANIM_MANIFEST = ' + JSON.stringify(manifest, null, 0) + ';\n' +
  // v0.29.186 — bake stamp: the animator appends this to every frame URL as a
  // cache-buster, so a re-bake can never be masked by stale CDN/browser cache.
  'window.LX_ANIM_MANIFEST_STAMP = ' + JSON.stringify(new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)) + ';\n');
console.log(`Wrote anim_calib_manifest.js — ${n} animated entities.`);
