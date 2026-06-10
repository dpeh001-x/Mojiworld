#!/usr/bin/env node
// Boss attack-frame normalizer — v0.26.312
// =============================================================================
// Ludo's animateSprite/editImage output re-canvases the character onto a small
// square with heavy padding (char fills ~50% of a 512² frame, floating centre).
// The game's _drawBossSprite scales by SOURCE pixel size + aspect and anchors
// the foot via the IDLE bbox — so a padded 512² frame renders smaller and
// mis-aligned vs the tightly-framed idle sprite (the "pixel size distortion").
//
// This re-frames every Sprites/bosses/attack/<type>{,_0..3}.webp to EXACTLY the
// idle sprite's canvas size + character placement (same scale, centre-x, foot
// line). A unified crop box across the 4 frames keeps the body locked while
// effects (orbs / fire) play. Run after generating; idempotent-ish (re-running
// re-normalizes already-normalized frames to the same target, a no-op in size).
//
//   node scripts/normalize_boss_attack.mjs            # all bosses with frames
//   node scripts/normalize_boss_attack.mjs octobaby   # one or more bosses
// =============================================================================
import sharp from 'sharp';
import { readdir, writeFile, readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Sharp on Windows memory-maps inputs and keeps the handle open, which blocks
// re-opening / overwriting the same file. Feeding Buffers (never paths) plus
// disabling the cache avoids the "UNKNOWN: open" lock entirely.
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOSS_DIR = join(repoRoot, 'Sprites', 'bosses');
// Which subdir of frames to normalize (attack | idle). --dir <name>, default attack.
const _argv = process.argv.slice(2);
const _dirIdx = _argv.indexOf('--dir');
const FRAME_SUBDIR = _dirIdx >= 0 ? _argv[_dirIdx + 1] : 'attack';
const ATK_DIR = join(BOSS_DIR, FRAME_SUBDIR);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

async function idlePath(type) {
  for (const ext of ['.png', '.webp']) { const p = join(BOSS_DIR, type + ext); if (await exists(p)) return p; }
  return null;
}
// Alpha bounding box of an image buffer (alpha > 16).
async function bbox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + (c - 1)] > 16) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, IW: w, IH: h };
}
// Re-frame buffer `buf`, cropping `box`, into an IW×IH canvas matching the
// idle's character rect (height fraction, centre-x, bottom line).
async function reframe(buf, box, idle) {
  const targetH = Math.round(idle.charHfrac * idle.IH);
  let targetW = Math.round(targetH * (box.w / box.h));
  if (targetW > idle.IW) targetW = idle.IW;
  const left = Math.round(idle.cx * idle.IW - targetW / 2);
  const top  = Math.round(idle.bottom * idle.IH - targetH);
  const crop = await sharp(buf).extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .resize(targetW, targetH, { fit: 'fill' }).png().toBuffer();
  return sharp({ create: { width: idle.IW, height: idle.IH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: crop, left: Math.max(0, left), top: Math.max(0, top) }])
    .webp({ quality: 92 }).toBuffer();
}

async function normalizeBoss(type) {
  const ip = await idlePath(type);
  if (!ip) return `${type}: no idle sprite`;
  const ib = await bbox(await readFile(ip));
  const idle = { IW: ib.IW, IH: ib.IH, cx: (ib.x + ib.w / 2) / ib.IW, bottom: (ib.y + ib.h) / ib.IH, charHfrac: ib.h / ib.IH };

  // Frames present? Read the contiguous _0.._N set into buffers up front
  // (avoids read-while-write; supports any frame count — 4, 9, 16, ...).
  const frames = [];
  for (let i = 0; i < 64; i++) { const p = join(ATK_DIR, `${type}_${i}.webp`); if (!(await exists(p))) break; frames.push({ p, buf: await readFile(p) }); }
  let didFrames = 0;
  if (frames.length) {
    const boxes = await Promise.all(frames.map(f => bbox(f.buf)));
    const uni = { x: Math.min(...boxes.map(b => b.x)), y: Math.min(...boxes.map(b => b.y)) };
    uni.w = Math.max(...boxes.map(b => b.x + b.w)) - uni.x;
    uni.h = Math.max(...boxes.map(b => b.y + b.h)) - uni.y;
    for (const f of frames) { await writeFile(f.p, await reframe(f.buf, uni, idle)); didFrames++; }
  }
  // Single pose (static fallback).
  const posePath = join(ATK_DIR, `${type}.webp`);
  let didPose = false;
  if (await exists(posePath)) { const pbuf = await readFile(posePath); const pb = await bbox(pbuf); if (pb) { await writeFile(posePath, await reframe(pbuf, pb, idle)); didPose = true; } }
  return `${type}: ${ib.IW}x${ib.IH} idle -> ${didFrames} frames${didPose ? ' + pose' : ''} normalized`;
}

// Targets: CLI boss names (ignoring the --dir flag + its value), else every
// boss that has at least one frame in the chosen subdir.
let targets = _argv.filter((a, i) => a !== '--dir' && _argv[i - 1] !== '--dir');
if (!targets.length) {
  const files = await readdir(ATK_DIR).catch(() => []);
  targets = [...new Set(files.filter(f => /_\d\.webp$/.test(f)).map(f => f.replace(/_\d\.webp$/, '')))];
}
if (!targets.length) { console.error(`No boss frames found in Sprites/bosses/${FRAME_SUBDIR}/.`); process.exit(1); }
for (const t of targets) { try { console.log(await normalizeBoss(t)); } catch (e) { console.log(`${t}: FAIL ${e.message}`); } }
