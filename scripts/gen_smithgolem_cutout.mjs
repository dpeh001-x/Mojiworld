// SMITH GOLEM - cut-out animation built from the static sprite, one body for all 27 frames.
// ============================================================================
// Why not another ludo roll: three generations (v0.30.229, .233, .426) and eight kept
// rolls all share the same defects - the attack turns the golem away (head shrinks to
// ~60%), the "walk" is unrelated poses, dust/rubble clips at the canvas edge, the face
// drifts between frames. Rescaling cannot fix a turned pose. So the frames are now
// RIGGED from Sprites/monsters/smithgolem.webp itself: the hammer is lifted out (it sits
// over transparent background beside the shoulder; only the handle passes behind the
// fist), the legs are split below the skirt, and every frame is body + legs + hammer
// under small affine transforms about fixed pivots. Size, face, feet, colours are
// identical everywhere by construction.
//   idle   9f  2% breath about the foot line (game ping-pongs it)
//   walk   9f  heavy in-place stomp: legs alternate 26px lifts behind the skirt, 8px bob, 2.5deg sway
//   attack 9f  wind-up over the shoulder while the body crouches back (f1-3), LUNGE + SLAM to the
//              floor (f4, held 130ms) with sparks, settle (f5), recoil to rest (f6-8). The whole
//              golem (legs too) translates and leans about its feet; the hammer pivots at the fist.
//   node scripts/gen_smithgolem_cutout.mjs            # renders + gates + contact sheet to scripts/_style_pack/smithgolem_cutout/
//   node scripts/gen_smithgolem_cutout.mjs --install  # writes Sprites/monsters/{idle,walk,attack}/smithgolem_0..8.webp
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { I, mul, about, translate, apply, warp, over, measure, eyeBlobs } from './lib/sprite_warp.mjs';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const STAGE = path.join(ROOT, 'scripts/_style_pack/smithgolem_cutout'); mkdirSync(STAGE, { recursive: true });
const SRC = path.join(ROOT, 'Sprites/monsters/smithgolem.webp'); const SW = 1024, H = 1024, FLOOR = 1012;
// The slam needs room: fist -> far edge of the hammer head is ~355px and the 1024 canvas
// has 312px right of the fist. The frames are 1280 wide, extended 128px on BOTH sides so
// the body keeps its place relative to the canvas centre (the game centres a frame on the
// mob and takes the draw width from the frame's own aspect).
const W = 1280, OX = (W - SW) / 2;
const FEET = [414 + OX, FLOOR], FIST = [712 + OX, 770];          // pivots: foot-line centre, the hammer hand
const { data } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const stone = (o) => { const R = data[o], G = data[o + 1], B = data[o + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B); return (mx ? (mx - mn) / mx : 0) < 0.25 && (R + G + B) / 3 > 120; };
// ---- segmentation (source coords; written at x+OX on the wide canvas) ----------
const body = Buffer.alloc(W * H * 4), hammer = Buffer.alloc(W * H * 4), legL = Buffer.alloc(W * H * 4), legR = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < SW; x++) { const o = (y * SW + x) * 4; if (data[o + 3] < 6) continue; const s = stone(o); const d = (y * W + x + OX) * 4;
  const inFist = Math.hypot(x - 712, y - 770) < 92;
  const head = x >= 634 && y <= 745 && !(y > 600 + (x - 635) * 1.318) && !(inFist && s);   // the strap sits below that diagonal
  const pommel = x >= 612 && x <= 690 && y >= 855 && y <= 975 && !s && !(Math.hypot(x - 712, y - 770) < 100);
  if (head || pommel) { hammer.set(data.subarray(o, o + 4), d); continue; }
  if (y >= 925) { (x < 470 ? legL : legR).set(data.subarray(o, o + 4), d); if (y >= 952) continue; }   // 925-951 = skirt band, in BOTH
  body.set(data.subarray(o, o + 4), d); }
// both feet on the floor row: the right foot's lowest ink is a row above the left's
const legBase = (L) => { const m = measure(L, W, H); return translate(0, FLOOR - m.b); };
const LB = legBase(legL), RB = legBase(legR);
// ---- sparks (impact) ------------------------------------------------------------
async function sparks(cx, cy, k) { const lines = []; for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.05 + 0.9 * i / 8), L = (30 + 28 * ((i * 7) % 5) / 4) * k;
    lines.push(`<line x1="${cx + Math.cos(a) * 14}" y1="${cy + Math.sin(a) * 14}" x2="${cx + Math.cos(a) * L}" y2="${cy + Math.sin(a) * L}" stroke="${i % 2 ? '#ffd35a' : '#ff8a3a'}" stroke-width="${i % 3 ? 5 : 7}" stroke-linecap="round"/>`); }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g opacity="${k}">${lines.join('')}<circle cx="${cx}" cy="${cy}" r="${16 * k}" fill="#fff2b0"/></g></svg>`;
  return await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer(); }
// ---- deepest on-canvas slam angle: hammer bottom <= FLOOR-6, right edge <= 1000 --------
// solved under the SLAM frames' own body transforms (lean +6/+5 about the feet drops the fist ~32px)
const hammerM = (bodyM, swing) => { const f = apply(bodyM, FIST[0], FIST[1]); return mul(about(f[0], f[1], swing), bodyM); };
const attackBody = (lean, sx, sy, dx) => mul(translate(dx, 0), about(FEET[0], FEET[1], lean, sx, sy));
// lunge +40 / lean +9: at +55 / +10 the fist sits ~97px further right and the 355px hammer
// reach leaves the 1280 canvas at every angle that also clears the floor.
const SLAM_BODIES = [attackBody(9, 1.05, 0.95, 40), attackBody(7, 1.03, 0.965, 36)];   // = the two slam rows below
const slamOk = (a) => SLAM_BODIES.every((bm) => { const bx = measure(warp(hammer, W, H, hammerM(bm, a + 2)), W, H); return bx.b <= FLOOR - 6 && bx.r <= W - 24; });
// the passing set is NOT contiguous (shallow angles clip the right edge, deep ones the
// floor): take the DEEPEST passing angle, never the first run
let SLAM = null; for (let a = 40; a <= 150; a += 2) if (slamOk(a)) SLAM = a;
if (process.env.SLAM_DEBUG) for (let a = 40; a <= 150; a += 6) { const bx = measure(warp(hammer, W, H, hammerM(SLAM_BODIES[0], a + 2)), W, H); console.log('a', a, 'bottom', bx.b, 'right', bx.r, (bx.b <= FLOOR - 6 && bx.r <= W - 24) ? 'ok' : (bx.b > FLOOR - 6 ? 'FLOOR' : 'RIGHT')); }
if (SLAM == null) { console.error('no on-canvas slam angle'); process.exit(2); }
// ---- frame recipes ---------------------------------------------------------------
const rec = { idle: [], walk: [], attack: [] };
for (let i = 0; i < 9; i++) { const t = i / 8; rec.idle.push({ body: about(FEET[0], FEET[1], 0, 1, 1 + 0.02 * Math.sin(Math.PI * t)), swing: 0, legL: LB, legR: RB }); }
for (let i = 0; i < 9; i++) { const p = 2 * Math.PI * i / 9, s = Math.sin(p);
  // a foot travels FORWARD (+x, the golem faces right) while lifted and pushes back while
  // planted: the left leg is airborne for sin>0, where -cos runs -1 -> +1; the right leg
  // is airborne for sin<0, where +cos runs -1 -> +1. (The first cut had the signs
  // swapped and moonwalked.)
  rec.walk.push({ body: mul(translate(0, -10 * Math.abs(s)), about(FEET[0], FEET[1], 2.5 * s)), swing: 0,
    legL: mul(translate(-16 * Math.cos(p), -30 * Math.max(0, s)), LB), legR: mul(translate(16 * Math.cos(p), -30 * Math.max(0, -s)), RB) }); }
// apex -72: the raised head sits above the golem's own head and stays VISIBLE in front;
// at -88 it slid behind the torso and the hammer read as vanished.
// THE BODY MOVES (per user): wind-up crouches BACK (dx -30, lean -8, 5% squat), the slam
// LUNGES forward (dx +55, lean +10, squash) with the legs carried along, then recoils.
// rows: [swing, lean, sx, sy, sparks, dx]
const A = [[0, 0, 1, 1, 0, 0], [-20, -3, 1, 0.985, 0, -10], [-46, -6, 1.01, 0.965, 0, -22], [-72, -8, 1.03, 0.95, 0, -30],
  [SLAM, 9, 1.05, 0.95, 1, 40], [SLAM + 2, 7, 1.03, 0.965, 0.55, 36], [35, 4, 1, 0.99, 0, 24], [8, 1, 1, 1, 0, 8], [0, 0, 1, 1, 0, 0]];
// legs travel and squash with the body but never lean: a lean about the foot-line centre
// would dip the outer foot below the floor row (measured: bottoms 1015-1023).
for (const [swing, lean, sx, sy, sp, dx] of A) { const bm = attackBody(lean, sx, sy, dx), lm = attackBody(0, sx, sy, dx); rec.attack.push({ body: bm, swing, legL: mul(lm, LB), legR: mul(lm, RB), sparks: sp }); }
// ---- render ----------------------------------------------------------------------
async function render(r) { const out = Buffer.alloc(W * H * 4);
  over(out, warp(legL, W, H, r.legL), W, H); over(out, warp(legR, W, H, r.legR), W, H);
  const hw = warp(hammer, W, H, hammerM(r.body, r.swing)); over(out, warp(body, W, H, r.body), W, H); over(out, hw, W, H);   // hammer in front, as in the source
  if (r.sparks) { const bx = measure(hw, W, H); over(out, await sparks(Math.round((bx.l + bx.r) / 2), Math.min(FLOOR - 24, bx.b - 6), r.sparks), W, H); }   // flash disc r16 stays above the floor row
  return out; }
const frames = {}; const bad = []; const refH = measure(await render(rec.idle[0]), W, H).stoneH;   // the rest pose, legs included
for (const st of ['idle', 'walk', 'attack']) { frames[st] = []; for (let i = 0; i < 9; i++) { const buf = await render(rec[st][i]); const m = measure(buf, W, H);
    // head columns only (the hammer's lava sits right of 634 at rest); the window follows the body transform in the attack (lunge + lean carry the head)
    const hx = [220 + OX, 620 + OX].map((x) => Math.round(apply(rec[st][i].body, x, 507)[0]));
    const eyes = eyeBlobs(buf, W, m.stoneTop + 40, m.stoneTop + 170, hx[0], hx[1]);
    frames[st].push({ buf, m, eyes }); const tol = st === 'attack' ? 0.08 : 0.04;
    if (m.edge) bad.push(`${st}_${i} edge px ${m.edge}`); if (m.margin < 24) bad.push(`${st}_${i} margin ${m.margin}`); if (m.b !== FLOOR) bad.push(`${st}_${i} ink bottom ${m.b}`);
    // idle/walk: exactly two eyes (a turned pose cannot pass); attack: at least one - the raised hammer crosses the face at the apex
    if (Math.abs(m.stoneH / refH - 1) > tol) bad.push(`${st}_${i} body ${m.stoneH} vs ${refH}`); if (st === 'attack' ? eyes < 1 : eyes !== 2) bad.push(`${st}_${i} eyes ${eyes}`); } }
// ---- sheet + report --------------------------------------------------------------
const TW = 250, TH = 200; const comps = []; for (const [r, st] of ['idle', 'walk', 'attack'].entries()) for (let i = 0; i < 9; i++) comps.push({ input: await sharp(frames[st][i].buf, { raw: { width: W, height: H, channels: 4 } }).resize(TW, TH).png().toBuffer(), left: 4 + i * (TW + 4), top: 4 + r * (TH + 4) });
await sharp({ create: { width: 9 * (TW + 4) + 4, height: 3 * (TH + 4) + 4, channels: 4, background: { r: 30, g: 34, b: 44, alpha: 1 } } }).composite(comps).png().toFile(path.join(STAGE, 'sheet.png'));
console.log(`slam angle ${SLAM}deg  body ref ${refH}px`); for (const st of ['idle', 'walk', 'attack']) console.log(st.padEnd(7), 'stoneH', frames[st].map((f) => f.m.stoneH).join(','), '| bottoms', frames[st].map((f) => f.m.b).join(','), '| eyes', frames[st].map((f) => f.eyes).join(','), '| margin', Math.min(...frames[st].map((f) => f.m.margin)));
console.log(bad.length ? 'GATES: ' + bad.join('; ') : 'GATES: all clear'); console.log('sheet -> ' + path.join(STAGE, 'sheet.png'));
if (process.argv.includes('--install')) { if (bad.length) { console.error('refusing to install with gate failures'); process.exit(2); }
  for (const st of ['idle', 'walk', 'attack']) for (let i = 0; i < 9; i++) { const p = path.join(ROOT, 'Sprites/monsters', st, `smithgolem_${i}.webp`); const b = await sharp(frames[st][i].buf, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer(); writeFileSync(p + '.tmp', b); renameSync(p + '.tmp', p); }
  console.log('installed 27 frames'); }
