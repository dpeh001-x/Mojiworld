// SMITH GOLEM ATTACK via ludo.ai - a BIG overhead swing that smashes the ground, body held.
// ============================================================================
// Per user (2026-09-08): "use ludo.ai regenerate the attack sprite sequence such that
// the body does not change much but make smithgolem do a big swing that smashes the
// ground". Earlier rolls turned the golem away at the apex and drifted its size; this
// pass keeps the body honest with gates the old ones lacked:
//   - EYES: both red eyes found as a pair in EVERY frame (a turned head fails), and their
//     spacing - a rigid facial measure - sets each frame's scale, so the body lands at the
//     static sprite's size regardless of what the model drew;
//   - FIT: each frame is rescaled by that spacing, feet-centroid centred on the rig's foot
//     mark, ink bottom on row 1012, on the rig's 1280x1024 canvas (idle/walk unchanged);
//   - BODY: the fitted eye spacing within 5% of the static's in every frame and the per-frame
//     scale k within 8% across the roll (the grey-stone span is NOT used: dust and hammer
//     highlights inflate it);
//   - EDGES: alpha feathered to zero over the last 104px of every side, so the model's dust
//     fades instead of being cut; then zero edge px, >= 24px margin;
//   - SWING: some frame has hammer lava ABOVE the head top, some frame has lava at the floor
//     in FRONT of the feet.
//   node scripts/gen_smithgolem_attack_ludo.mjs --generate [--rolls 3]   # LUDO_API_KEY; saves rolls to scripts/_tmp_golem_attack_rolls/
//   node scripts/gen_smithgolem_attack_ludo.mjs --from 2                  # re-fit + gate a saved roll, no credits
//   node scripts/gen_smithgolem_attack_ludo.mjs --from 2 --install        # write Sprites/monsters/attack/smithgolem_0..8.webp
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, renameSync, readFileSync, existsSync } from 'node:fs';
import { measure, findEyes } from './lib/sprite_warp.mjs';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const KEEP = path.join(ROOT, 'scripts/_tmp_golem_attack_rolls'); mkdirSync(KEEP, { recursive: true });
const SRC = path.join(ROOT, 'Sprites/monsters/smithgolem.webp'); const W = 1280, H = 1024, OX = 128, FLOOR = 1012, N = 9;
const argv = process.argv.slice(2); const has = (f) => argv.includes(f); const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const MOTION = 'A nine-frame HAMMER SMASH by this stone golem, seen from the SAME camera in every frame: it FACES THE CAMERA the whole time with BOTH glowing red square eyes visible in every single frame, it never turns sideways or away, it never rotates, its body stays EXACTLY the same size and its feet stay planted on the same ground line. Beats: '
  + '(1) standing, hammer held at its side. (2) it lifts the hammer up. (3) hammer raised HIGH OVERHEAD in both hands, arms straight up, body leaning slightly back. (4) the hammer at its highest point above its head, wind-up peak. '
  + '(5) the hammer sweeping DOWN in a big arc in front of the body. (6) IMPACT: the hammer head SMASHES THE GROUND in front of its feet, a small burst of sparks and a few stone chips at the point of contact only. '
  + '(7) hammer resting on the ground, body leaning forward over it, sparks fading. (8) it lifts the hammer back up to its side. (9) standing again, exactly like frame 1. '
  + 'The hammer is a separate object clearly visible in every frame, never merging into the body. NO flames on the body, NO explosions, NO dust clouds, NO big shockwave, NO ground crack reaching the edge of the picture. Transparent background, no ground plane, no shadow, one single character.';
async function raw(buf) { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; }
function feetCx(d, w, h, t, b) { const y0 = Math.round(b - (b - t) * 0.12); let m = 0, mx = 0; for (let y = y0; y <= b; y++) for (let x = 0; x < w; x++) { const a = d[(y * w + x) * 4 + 3]; m += a; mx += a * x; } return m ? mx / m : w / 2; }
function lava(d, w, h) { let minY = h, maxY = -1, maxYx = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (d[o + 3] > 128 && d[o] > 190 && d[o + 1] > 60 && d[o + 1] < 180 && d[o + 2] < 90) { if (y < minY) minY = y; if (y > maxY) { maxY = y; maxYx = x; } } } return { minY, maxY, maxYx }; }
// ---- reference: the static sprite on the rig canvas --------------------------
const S = await raw(readFileSync(SRC)); const sEyes = findEyes(S.d, S.w, S.h); if (!sEyes) { console.error('no eye pair on the static'); process.exit(1); }
const sM = measure(S.d, S.w, S.h); const REF = { spacing: sEyes.spacing, stoneH: sM.stoneH, feetX: feetCx(S.d, S.w, S.h, sM.t, sM.b) + OX, headTop: sM.stoneTop };
console.log(`reference: eye spacing ${REF.spacing}px, body ${REF.stoneH}px, feet x ${REF.feetX.toFixed(0)}`);
// ---- fit one returned frame onto the rig canvas -----------------------------
async function fit(png) { const f = await raw(png); const e = findEyes(f.d, f.w, f.h); if (!e) return { bad: 'no eye pair' };
  const k = REF.spacing / e.spacing; const rw = Math.max(1, Math.round(f.w * k)), rh = Math.max(1, Math.round(f.h * k));
  const r = await raw(await sharp(png).resize(rw, rh, { kernel: 'lanczos3' }).png().toBuffer()); const m = measure(r.d, r.w, r.h); if (m.b < 0) return { bad: 'empty' };
  // plant the FEET, not the global ink bottom: dust at the edge can hang a row or two lower
  // (and is feathered away below), so the bottom is read under the feet columns only
  const fx = feetCx(r.d, r.w, r.h, m.t, m.b); let fb = -1; for (let y = r.h - 1; y >= 0 && fb < 0; y--) for (let x = Math.max(0, Math.round(fx - 1.3 * REF.spacing)); x < Math.min(r.w, Math.round(fx + 1.3 * REF.spacing)); x++) if (r.d[(y * r.w + x) * 4 + 3] > 16) { fb = y; break; }
  const dx = Math.round(REF.feetX - fx), dy = FLOOR - fb;
  const out = Buffer.alloc(W * H * 4); for (let y = 0; y < r.h; y++) { const Y = y + dy; if (Y < 0 || Y > FLOOR) continue; for (let x = 0; x < r.w; x++) { const X = x + dx; if (X < 0 || X >= W) continue; out.set(r.d.subarray((y * r.w + x) * 4, (y * r.w + x) * 4 + 4), (Y * W + X) * 4); } }   // rows below the floor are dropped
  // EDGE FEATHER: the model's dust clouds drift to the canvas edge; a hard cut there is the
  // "clipped rubble" defect. Fade alpha to zero over the last 104px of every side (full at
  // 104, zero at 24) - the body never reaches that band, only dust and hammer trails do.
  // (left / right / top only: the feet are planted on row 1012 by construction and nothing sits below them)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; if (!out[o + 3]) continue; const dEdge = Math.min(x, W - 1 - x, y); if (dEdge < 104) out[o + 3] = Math.round(out[o + 3] * Math.max(0, Math.min(1, (dEdge - 24) / 80))); }
  const M = measure(out, W, H), E = findEyes(out, W, H), L = lava(out, W, H); const bad = [];
  if (M.edge) bad.push('edge ' + M.edge); if (M.margin < 24) bad.push('margin ' + M.margin); if (M.b !== FLOOR) bad.push('bottom ' + M.b); if (!E) bad.push('eyes lost');
  // body size: the eye spacing is the rigid measure (the grey-stone span is inflated by dust and hammer highlights)
  if (E && Math.abs(E.spacing / REF.spacing - 1) > 0.05) bad.push('eye spacing ' + E.spacing); return { buf: out, k: +k.toFixed(3), m: M, eyes: E, lava: L, bad: bad.join(',') || null }; }
async function gateRoll(frames) { const bad = frames.map((f, i) => f.bad ? i + ':' + f.bad : null).filter(Boolean);
  const ks = frames.map((f) => f.k).filter(Boolean); if (ks.length && Math.max(...ks) / Math.min(...ks) > 1.08) bad.push('head size drifts ' + Math.min(...ks) + '..' + Math.max(...ks));
  const apex = frames.some((f) => f.buf && f.lava.minY < f.m.stoneTop - 0.2 * REF.spacing), impact = frames.some((f) => f.buf && f.lava.maxY > FLOOR - 1.6 * REF.spacing && f.lava.maxYx > REF.feetX + 0.8 * REF.spacing);
  if (!apex) bad.push('no frame raises the hammer above the head'); if (!impact) bad.push('no frame puts the hammer at the floor in front of the feet'); return bad; }
async function sheet(frames, p) { const TW = 250, TH = 200, comps = []; for (let i = 0; i < frames.length; i++) if (frames[i].buf) comps.push({ input: await sharp(frames[i].buf, { raw: { width: W, height: H, channels: 4 } }).resize(TW, TH).png().toBuffer(), left: 4 + i * (TW + 4), top: 4 });
  await sharp({ create: { width: N * (TW + 4) + 4, height: TH + 8, channels: 4, background: { r: 30, g: 34, b: 44, alpha: 1 } } }).composite(comps).png().toFile(p); }
async function evaluate(label, pngs) { const frames = []; for (const p of pngs) frames.push(await fit(p)); const bad = await gateRoll(frames);
  console.log(`${label}: k ${frames.map((f) => f.k ?? '-').join('/')}  body ${frames.map((f) => f.m ? f.m.stoneH : '-').join('/')}  ${bad.length ? 'REJECT - ' + bad.join('; ') : 'OK'}`);
  await sheet(frames, path.join(KEEP, label + '_sheet.png')); return { frames, bad }; }
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
let chosen = null;
if (has('--from')) { const n = arg('--from'); const pngs = []; for (let i = 0; i < N; i++) pngs.push(readFileSync(path.join(KEEP, `roll${n}_${i}.png`))); const r = await evaluate('roll' + n, pngs); if (!r.bad.length || has('--force')) chosen = r.frames; }
else if (has('--generate')) {
  const apiKey = process.env.LUDO_API_KEY; if (!apiKey) { console.error('LUDO_API_KEY required'); process.exit(1); } const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
  const trim = await sharp(readFileSync(SRC)).ensureAlpha().trim({ threshold: 8 }).png().toBuffer(); const tm = await sharp(trim).metadata(); const pad = Math.round(Math.max(tm.width, tm.height) * 0.08);
  const sq = await sharp(trim).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(); const sm = await sharp(sq).metadata(); const sc = Math.min(1, Math.sqrt(1000000 / (sm.width * sm.height)) * 0.98);
  const seed = await sharp(sq).resize(Math.floor(sm.width * sc), Math.floor(sm.height * sc)).webp({ quality: 94 }).toBuffer(); writeFileSync(path.join(KEEP, 'seed.webp'), seed);
  const ROLLS = Number(arg('--rolls') || 3); let start = 1; while (existsSync(path.join(KEEP, `roll${start}_0.png`))) start++;
  for (let roll = start; roll < start + ROLLS; roll++) { process.stdout.write(`roll ${roll} ... `); let anim;
    try { const res = await fetch(`${API}/assets/sprite/animate`, { method: 'POST', signal: AbortSignal.timeout(600000), headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_image: 'data:image/webp;base64,' + seed.toString('base64'), motion_prompt: MOTION, frames: N, frame_size: -9, model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite' }) });
      if (!res.ok) { const t = await res.text(); if (res.status === 402) { console.error('OUT OF CREDITS'); process.exit(3); } throw new Error(res.status + ' ' + t.slice(0, 140)); } anim = await res.json(); } catch (e) { console.log(e.message); continue; }
    let pngs = []; if (anim.spritesheet_url && anim.num_cols && anim.num_rows) { const sh = await fetchBuf(anim.spritesheet_url); const md = await sharp(sh).metadata(); const cw = Math.floor(md.width / anim.num_cols), ch = Math.floor(md.height / anim.num_rows);
      for (let r = 0; r < anim.num_rows && pngs.length < N; r++) for (let c = 0; c < anim.num_cols && pngs.length < N; c++) pngs.push(await sharp(sh).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer()); }
    if (pngs.length < N && Array.isArray(anim.individual_frame_urls)) { pngs = []; for (const u of anim.individual_frame_urls.slice(0, N)) pngs.push(await sharp(await fetchBuf(u)).png().toBuffer()); }
    if (pngs.length < N) { console.log('only ' + pngs.length + ' frames'); continue; }
    for (let i = 0; i < N; i++) writeFileSync(path.join(KEEP, `roll${roll}_${i}.png`), pngs[i]);
    const r = await evaluate('roll' + roll, pngs); if (!r.bad.length) { chosen = r.frames; console.log('roll ' + roll + ' passes every gate'); break; } }
} else { console.log(MOTION + '\n\n--generate (LUDO_API_KEY) | --from N [--install]'); process.exit(0); }
if (!chosen) { console.error('no roll passed the gates (see scripts/_tmp_golem_attack_rolls/*_sheet.png)'); process.exit(2); }
if (has('--install')) { for (let i = 0; i < N; i++) { const p = path.join(ROOT, 'Sprites/monsters/attack', `smithgolem_${i}.webp`); const b = await sharp(chosen[i].buf, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer(); writeFileSync(p + '.tmp', b); renameSync(p + '.tmp', p); } console.log('installed 9 attack frames'); }
