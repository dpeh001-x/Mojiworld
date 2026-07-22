#!/usr/bin/env node
// rebase_anim_canvas.mjs — v0.29.185
// =============================================================================
// Rebase EVERY animation state of a boss (idle/walk/attack frames + the static
// base + the single attack pose) onto ONE fixed canvas, with the character
// pre-scaled so its content height is the SAME in every frame (the idle-set
// median). Kills the per-state canvas mismatch + Ludo frame drift at the
// source, so the runtime needs no per-boss guards.
//
// Canvas choice (per user "sufficiently big to prevent cutoffs"): start from
// the base static's canvas and GROW it until every rebased frame — locked
// character + its authored lift + horizontal sway + a 3% safety margin —
// fits with zero clipping. The character's ON-SCREEN size is preserved
// exactly: the reference height is solved against the game's sizeFactor for
// the chosen canvas so hb.h × mul × sf × refFrac stays what it is today.
//
//   node scripts/rebase_anim_canvas.mjs                # audit / dry-run
//   node scripts/rebase_anim_canvas.mjs --apply        # rewrite frames
//   node scripts/rebase_anim_canvas.mjs --apply --only kingKrook,mooma
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, rename, access, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOSS = join(root, 'Sprites', 'bosses');
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const only = (() => { const i = argv.indexOf('--only'); return i >= 0 ? new Set(argv[i + 1].split(',')) : null; })();
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

// hitboxes (hb.h × hb.mul) — needed to preserve the exact on-screen size
const _w = {};
new Function('window', await readFile(join(root, 'monster_hitboxes.js'), 'utf8'))(_w);
const hbTable = _w.LX_MOB_HITBOX || {};

async function box(buf) {                     // content box, alpha>64 (GAME _spriteContentBox convention)
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  let t = -1, b = -1, l = W, r = -1;
  for (let y = 0; y < H; y++) {
    let any = false;
    for (let x = 0; x < W; x++) if (data[(y * W + x) * C + 3] > 64) { any = true; if (x < l) l = x; if (x > r) r = x; }
    if (any) { if (t < 0) t = y; b = y; }
  }
  return t < 0 ? null : { t, b, l, r, W, H, cH: b - t + 1, cW: r - l + 1 };
}
const sf = (W, H) => Math.max(0.7, Math.min(1.6, Math.max(W, H) / 1024));

async function loadState(type, st) {
  const out = [];
  for (let f = 0; f < 9; f++) {
    const p = join(BOSS, st, `${type}_${f}.webp`);
    if (!(await exists(p))) return null;
    const buf = await readFile(p);
    out.push({ p, buf, bx: await box(buf) });
  }
  return out;
}

async function rebase(type) {
  // ---- gather ----
  let basePath = join(BOSS, `${type}.png`);
  if (!(await exists(basePath))) basePath = join(BOSS, `${type}.webp`);
  const baseBuf = await readFile(basePath);
  const baseBx = await box(baseBuf);
  const states = {};
  for (const st of ['idle', 'walk', 'attack']) states[st] = await loadState(type, st);
  if (!states.idle) { console.log(`${type}: no idle frames — skip`); return; }
  const hb = hbTable[type];
  if (!hb || !hb.h) { console.log(`${type}: no hitbox — skip`); return; }
  const mul = hb.mul || 2.0;
  // current on-screen character height (idle median, on the CURRENT idle canvas)
  const iH = states.idle[0].bx.H;
  const idleFracs = states.idle.map(f => f.bx.cH / f.bx.H).sort((a, b) => a - b);
  const idleMedFrac = idleFracs[idleFracs.length >> 1];
  const drawnPx = hb.h * mul * sf(states.idle[0].bx.W, iH) * idleMedFrac;
  // ---- choose canvas: grow from base until nothing can clip (3% margin) ----
  let W0 = baseBx.W, H0 = baseBx.H, refH = 0;
  for (let it = 0; it < 6; it++) {
    refH = drawnPx / (hb.h * mul * sf(W0, H0)) * H0;        // px on this canvas
    let needW = 0, needH = 0;
    for (const st of ['idle', 'walk', 'attack']) {
      if (!states[st]) continue;
      const maxBot = Math.max(...states[st].map(f => f.bx.b));
      for (const f of states[st]) {
        const s = refH / f.bx.cH;
        const lift = (maxBot - f.bx.b) * s;
        const sway = Math.abs(((f.bx.l + f.bx.r + 1) / 2) - f.bx.W / 2) * s;
        needW = Math.max(needW, f.bx.cW * s + 2 * sway);
        needH = Math.max(needH, refH + lift);
      }
    }
    const wantW = Math.ceil(needW * 1.06 / 2) * 2;          // 3% margin each side
    const wantH = Math.ceil(needH * 1.03 / 2) * 2;          // 3% headroom
    if (wantW <= W0 && wantH <= H0) break;
    W0 = Math.max(W0, wantW); H0 = Math.max(H0, wantH);
  }
  refH = drawnPx / (hb.h * mul * sf(W0, H0)) * H0;
  const groundRow = H0 - 1;
  console.log(`${type}: canvas ${baseBx.W}x${baseBx.H} -> ${W0}x${H0}  refH ${refH.toFixed(1)}px (${(refH / H0 * 100).toFixed(1)}%)  drawn ${drawnPx.toFixed(1)}px preserved`);
  // ---- compose one image: content crop scaled to (cW*s, refH), placed ----
  async function compose(src, bx, lift, outPath, label) {
    const s = refH / bx.cH;
    const tw = Math.max(1, Math.round(bx.cW * s)), th = Math.max(1, Math.round(refH));
    const cx = W0 / 2 + (((bx.l + bx.r + 1) / 2) - bx.W / 2) * s;
    let left = Math.round(cx - tw / 2), top = Math.round(groundRow - lift - th + 1);
    left = Math.max(0, Math.min(W0 - tw, left)); top = Math.max(0, Math.min(H0 - th, top));
    const content = await sharp(src).extract({ left: bx.l, top: bx.t, width: bx.cW, height: bx.cH })
      .resize(tw, th, { fit: 'fill' }).toBuffer();
    const ext = outPath.endsWith('.png') ? 'png' : 'webp';
    let img = sharp({ create: { width: W0, height: H0, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: content, left, top }]);
    const out = ext === 'png' ? await img.png().toBuffer() : await img.webp({ quality: 92 }).toBuffer();
    await writeFile(outPath + '.tmp', out); await rename(outPath + '.tmp', outPath);
    return `${label} s=${s.toFixed(3)} lift=${lift.toFixed(0)}`;
  }
  if (!APPLY) {
    for (const st of ['idle', 'walk', 'attack']) {
      if (!states[st]) continue;
      const maxBot = Math.max(...states[st].map(f => f.bx.b));
      const ss = states[st].map(f => (refH / f.bx.cH).toFixed(2)).join(',');
      console.log(`  ${st}: canvas ${states[st][0].bx.W}x${states[st][0].bx.H}  scales [${ss}]  maxLift ${((maxBot - Math.min(...states[st].map(f => f.bx.b))) * refH / states[st][0].bx.cH / states[st][0].bx.H * H0).toFixed(0)}px-ish`);
    }
    return;
  }
  const log = [];
  for (const st of ['idle', 'walk', 'attack']) {
    if (!states[st]) continue;
    const maxBot = Math.max(...states[st].map(f => f.bx.b));
    for (let f = 0; f < 9; f++) {
      const fr = states[st][f];
      const lift = (maxBot - fr.bx.b) * (refH / fr.bx.cH);
      log.push(await compose(fr.buf, fr.bx, lift, fr.p, `${st}${f}`));
    }
  }
  log.push(await compose(baseBuf, baseBx, 0, basePath, 'base'));
  const posePath = join(BOSS, 'attack', `${type}.webp`);
  if (await exists(posePath)) { const pb = await readFile(posePath); log.push(await compose(pb, await box(pb), 0, posePath, 'pose')); }
  console.log('  ' + log.join('  '));
}

let targets = only ? [...only] : argv.filter(a => !a.startsWith('--'));
if (!targets.length) targets = ['legosaurus', 'mooma', 'kingKrook', 'towerArbiter'];
for (const t of targets) await rebase(t);
console.log(APPLY ? 'APPLIED.' : 'Dry-run only — re-run with --apply.');
