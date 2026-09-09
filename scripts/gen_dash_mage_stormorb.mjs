#!/usr/bin/env node
// dash_mage + mstormorb — regenerated art and animation (ludo.ai).
// ============================================================================
// Per user (2026-09-09): "regenerate better more suitable sprites and animation for
// dash_mage (should be more magical / wizardry like)" and "mstormorb (should be better
// art more suited for the game aesthetics)".
//
// WHAT WAS WRONG, measured against how the engine actually draws each one:
//
//   dash_mage  Sprites/fx/dash_mage.webp, 768². spawnSpriteBurst() draws it ONCE at the
//              midpoint of a mage blink, in a SQUARE size×size box (no keepAspect), 120-260 px
//              wide, life 22, flipX when dashing left — so it is a DIRECTIONAL streak that
//              must point RIGHT and never rotates. The shipped art was a plain blue-white
//              energy dart with four sparkles: it reads as a generic projectile, not as a
//              wizard's blink. The game's own arcane language is right next door in
//              arcane_burst (incantation circle, rune band, violet core) and dash_mage
//              shared none of it.
//
//   mstormorb  Sprites/projectiles/mstormorb.webp, 512². Drawn for towerStormcaller's shot
//              AND the generic `mhoming` orb, with { mode:'spin', spinRate:0.28 } — it is
//              under CONSTANT rotation. The shipped art was a murky grey smoke puff with thin
//              black scribbled arcs: no round silhouette, off-centre mass, low contrast
//              against dark maps, and nothing about it survives being spun. A spun sprite has
//              to be round, radially balanced and centred or it wobbles like a thrown rock.
//
// BOTH ARE NOW ANIMATED, which the engine already supported and neither used:
//   dash_mage  -> Sprites/fx/anim/dash_mage_0..8.webp        (needs 'dash_mage' in _FX_ANIM_KEYS)
//   mstormorb  -> Sprites/projectiles/anim/mstormorb_0..8.webp (needs 'mstormorb' in _PROJ_ANIM_KEYS;
//                the mob draw path already reads _projAnimFrame(p.skill) before the static sprite)
//
// NO whole-image rotation in either loop: spawnSpriteBurst spins the burst and the projectile
// renderer spins the orb, so a rotation baked into the frames would double up and judder. The
// frames animate the ENERGY (arcs, runes, churn) and nothing else. Same rule as
// gen_arcane_burst_fx.mjs and gen_bolt_anim.mjs.
//
//   node scripts/gen_dash_mage_stormorb.mjs                  # dry run: prints the briefs
//   node scripts/gen_dash_mage_stormorb.mjs --generate       # needs LUDO_API_KEY
//   flags: --only=dash|orb   --skip-anim   --rolls N
import sharp from 'sharp';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DASH_OUT = join(repoRoot, 'Sprites', 'fx', 'dash_mage.webp');
const ORB_OUT = join(repoRoot, 'Sprites', 'projectiles', 'mstormorb.webp');
const FX_ANIM = join(repoRoot, 'Sprites', 'fx', 'anim');
const PROJ_ANIM = join(repoRoot, 'Sprites', 'projectiles', 'anim');
const FRAMES = 9, DASH_SIZE = 768, ORB_SIZE = 512;
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';
const ROLLS = Number(argOf('--rolls', '4'));

// ---- the briefs -------------------------------------------------------------
// The palette is the game's own: the procedural fallback this sprite replaces pushes
// #aaccff / #cc99ff / #88aaff particles, and arcane_burst is violet-on-white-hot.
// v0.30.47x — per user: "regenerate mage dash sprite to be light blue and more wizardry, also
// animation should be more flashy without cut off". The v0.30.465 art was violet-dominant; the
// palette is now ICE/SKY BLUE end to end, and the wizardry is pushed harder - a full seal, a
// double rune ring, spell-script, arcane sigils - rather than a lance with a few glyphs on it.
const DASH_PROMPT =
  "A WIZARD'S BLINK — an arcane teleport streak for a 2D fantasy game, drawn flat side-on and "
  + 'pointing to the RIGHT, in a LIGHT BLUE palette: pale ice blue, cornflower blue #88aaff and '
  + 'sky blue #aaccff over a brilliant white-hot core. NO purple and NO violet anywhere. '
  + 'Composition, left to right: a shattering INCANTATION SEAL where the wizard vanished — two '
  + 'concentric rune rings of glowing pale-blue arcane glyphs breaking apart into drifting sigils; '
  + 'a long tapering lance of white-hot ice-blue magic streaking rightward out of it, wrapped in a '
  + 'double helix of small arcane rune symbols and fine spell-script; and at the right end a '
  + 'brilliant white-hot arrowhead flare where the wizard is arriving, throwing sharp four-point '
  + 'starbursts and a scatter of glittering blue motes. '
  + 'Invented magical glyphs, NOT real letters or words. '
  + 'Strictly horizontal, the streak running left-to-right across the middle of the frame and '
  + 'centred vertically. Flat 2D cartoon game VFX, bold clean shapes, bright painted glow, crisp '
  + 'edges, high contrast, no photorealism, no character, no hands, no background, no ground, no '
  + 'text, no logo. Fully transparent background, the effect floating free with a clear even '
  + 'margin on all four sides and nothing touching or running off the edge of the frame.';
// The first loop drifted twice, both visible at in-game size: a row of LARGE inscription glyphs
// faded in along the beam from frame 6 and read as a text banner laid over the effect, and frames
// 6-8 were then nearly identical, so the tail of the blink sat still. Both are called out here.
const DASH_MOTION =
  'The arcane blink streak surges and FLASHES. Across the nine frames, spread the motion EVENLY: '
  + 'EVERY frame must differ clearly from the one before it, including the last three, and there '
  + 'must be no pair of near-identical frames anywhere in the loop. '
  + 'Make it SPECTACULAR: partway through the loop the whole effect flares to a brilliant white-hot '
  + 'peak — the core blazing, the rune rings blazing with it, a burst of extra starbursts and '
  + 'glittering blue motes thrown outward — then settles back down. '
  + 'What moves: the rune rings on the left spin and crack wider, their glyphs drifting outward and '
  + 'fading; the lance of magic pulses brighter and its energy flows steadily to the right; the tiny '
  + 'rune symbols wrapped around the streak twinkle and slide along it; the white-hot arrowhead at '
  + 'the right flares and its starbursts snap outward. '
  + 'CRITICAL: do NOT add any new symbols, letters, words, inscriptions, captions or a row of large '
  + 'glyphs along the beam. Do not write anything. The only glyphs are the small ones already present '
  + 'in the first frame, and they must stay small and stay wrapped around the streak. '
  + 'The streak keeps the SAME position, the SAME length and the SAME horizontal direction in every '
  + 'frame - it must not rotate, tilt, travel, grow or shrink. Do not rotate the picture. '
  + 'Nothing new enters the frame and nothing touches the border.';
// Round, centred and radially balanced because the renderer spins it 0.28 rad per frame.
const ORB_PROMPT =
  'A crackling STORM ORB projectile for a 2D fantasy game, seen perfectly flat face-on, PERFECTLY '
  + 'ROUND and radially symmetrical about its exact centre. A brilliant white-hot core, a glowing '
  + 'electric-blue #9fd4ff plasma sphere around it, and forked white lightning arcs curling around '
  + 'the ball in a balanced pinwheel so it looks the same from every angle as it rotates. A thin '
  + 'crown of small sparks and a soft blue glow ring at the rim. Bold dark outline, bright painted '
  + 'highlights, high contrast so it stays readable against dark cave and night backgrounds. '
  + 'Cute chunky stylised fantasy game art, the same look as a cartoon fireball projectile. '
  + 'One single ball filling the frame, centred, with a small even margin on all sides. '
  + 'No smoke, no grey haze, no muddy colours, no clouds, no character, no background, no text. '
  + 'Fully transparent background, nothing touching or running off the edge of the frame.';
const ORB_MOTION =
  'The storm orb CHURNS in place. Across the nine frames, spread the motion evenly: the lightning '
  + 'arcs snap and re-form around the ball, the white-hot core pulses brighter and dimmer, the sparks '
  + 'at the rim flicker. '
  + 'The ball stays exactly the same SIZE and stays exactly CENTRED in every frame, and the picture '
  + 'must NOT be rotated, tilted, moved or zoomed — only the electricity changes. '
  + 'The last frame flows back into the first so the loop is seamless. Nothing touches the border.';

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

// ---- measurement ------------------------------------------------------------
const ALPHA_ON = 8;
async function px(buf) { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; }
function inkBox(p) {
  let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1, n = 0, sx = 0, sy = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (p.d[(y * p.w + x) * 4 + 3] > ALPHA_ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; n++; sx += x; sy += y; }
  }
  if (x1 < 0) throw new Error('fully transparent');
  return { x0, y0, x1, y1, n, cx: sx / n, cy: sy / n, w: x1 - x0 + 1, h: y1 - y0 + 1, W: p.w, H: p.h };
}
// centroid of the brightest tenth — for the dash, that is the arrival flare, which must lead
function brightCentroid(p) {
  const lum = []; for (let i = 0; i < p.w * p.h; i++) { const o = i * 4; if (p.d[o + 3] > 64) lum.push((p.d[o] + p.d[o + 1] + p.d[o + 2]) / 3); }
  if (!lum.length) return null; lum.sort((a, b) => b - a); const cut = lum[Math.floor(lum.length * 0.1)] || 200;
  let n = 0, sx = 0; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { const o = (y * p.w + x) * 4; if (p.d[o + 3] > 64 && (p.d[o] + p.d[o + 1] + p.d[o + 2]) / 3 >= cut) { n++; sx += x; } }
  return n ? sx / n : null;
}

// Median hue of the SATURATED colour (near-white core excluded - it carries no hue, and it is
// most of a glow sprite). Light blue lands ~195-235 deg; violet ~265-290. This is how "light
// blue, not purple" is checked rather than eyeballed.
function medianHue(p) {
  const hues = [];
  for (let i = 0; i < p.w * p.h; i++) {
    const o = i * 4; if (p.d[o + 3] < 140) continue;
    const R = p.d[o] / 255, Gc = p.d[o + 1] / 255, B = p.d[o + 2] / 255;
    const mx = Math.max(R, Gc, B), mn = Math.min(R, Gc, B), c = mx - mn;
    if (c < 0.18 || mx < 0.15) continue;                   // unsaturated: the white core, skip
    let h; if (mx === R) h = ((Gc - B) / c + 6) % 6; else if (mx === Gc) h = (B - R) / c + 2; else h = (R - Gc) / c + 4;
    hues.push(h * 60);
  }
  if (!hues.length) return null;
  hues.sort((x, y) => x - y); return Math.round(hues[Math.floor(hues.length / 2)]);
}
// count of near-white pixels - the flare. A flashy loop peaks and settles; a flat one does not.
function brightCount(p) { let n = 0; for (let i = 0; i < p.w * p.h; i++) { const o = i * 4; if (p.d[o + 3] > 140 && p.d[o] > 225 && p.d[o + 1] > 225 && p.d[o + 2] > 225) n++; } return n; }
// ---- gates ------------------------------------------------------------------
// Every gate is a property the ENGINE depends on, not a taste call.
function gateDash(b, bx) {
  const bad = [];
  if (bx.x0 === 0 || bx.y0 === 0 || bx.x1 >= bx.W - 1 || bx.y1 >= bx.H - 1) bad.push('ink on the canvas border');
  const aspect = bx.w / bx.h;
  if (aspect < 1.5) bad.push(`not a streak: ink ${bx.w}x${bx.h} (aspect ${aspect.toFixed(2)}, want >= 1.5)`);
  if (b != null && b < bx.x0 + bx.w * 0.5) bad.push('the bright arrival flare is not leading on the RIGHT (the burst is flipped for a left dash, so the art must point right)');
  return bad;
}
function gateOrb(bx) {
  const bad = [];
  if (bx.x0 === 0 || bx.y0 === 0 || bx.x1 >= bx.W - 1 || bx.y1 >= bx.H - 1) bad.push('ink on the canvas border');
  const aspect = bx.w / bx.h;
  if (aspect < 0.88 || aspect > 1.14) bad.push(`not round: ink ${bx.w}x${bx.h} (aspect ${aspect.toFixed(2)}, want 0.88-1.14) - it is drawn under constant spin`);
  const offX = Math.abs(bx.cx - bx.W / 2) / bx.W, offY = Math.abs(bx.cy - bx.H / 2) / bx.H;
  if (offX > 0.04 || offY > 0.04) bad.push(`off-centre by ${(offX * 100).toFixed(1)}% / ${(offY * 100).toFixed(1)}% - a spun sprite must sit on the centre or it wobbles`);
  const fill = bx.n / (bx.w * bx.h);
  if (fill < 0.45) bad.push(`too wispy to read as a ball: ink fills ${(fill * 100).toFixed(0)}% of its box (want >= 45%)`);
  return bad;
}
// Trim to ink, re-seat centred on a square canvas with a real gutter.
async function seat(raw, size, margin) {
  let content; try { content = await sharp(raw).trim({ threshold: 6 }).png().toBuffer(); } catch { content = await sharp(raw).png().toBuffer(); }
  const inner = Math.round(size * (1 - 2 * margin));
  const fitted = await sharp(content).resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'centre' }]).webp({ quality: 95 }).toBuffer();
}
// ONE shared crop+scale across the loop: per-frame fitting re-centres each frame and makes the
// animation jitter. If the union already touches the border the model clipped it - regenerate.
async function packFrames(bufs, size, label) {
  const boxes = []; for (const b of bufs) boxes.push(inkBox(await px(b)));
  const W = boxes[0].W, H = boxes[0].H;
  const u = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
  const touched = [u.x0 <= 1 && 'left', u.y0 <= 1 && 'top', u.x1 >= W - 2 && 'right', u.y1 >= H - 2 && 'bottom'].filter(Boolean);
  if (touched.length) throw new Error(`the loop is clipped at the source edge (${touched.join(', ')})`);
  const inner = Math.round(size * 0.91), cw = u.x1 - u.x0 + 1, chh = u.y1 - u.y0 + 1;
  const scale = inner / Math.max(cw, chh), out = [];
  for (const b of bufs) {
    const crop = await sharp(b).extract({ left: u.x0, top: u.y0, width: cw, height: chh })
      .resize(Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(chh * scale)), { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: crop, gravity: 'centre' }]).webp({ quality: 92 }).toBuffer());
  }
  console.log(`  ${label}: union ${cw}x${chh} of ${W}x${H} -> packed to ${inner}px, ${Math.round((size - inner) / 2)}px gutter`);
  return out;
}
// A loop that stalls is a loop that looks broken. The first dash roll ended with three frames
// that were within 0.3% of each other, so the tail of the blink simply froze on screen. Measure
// the per-step change and refuse a loop with a dead pair.
async function motionProfile(bufs) {
  const ps = []; for (const b of bufs) ps.push(await px(b));
  const steps = [];
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1], b = ps[i]; let diff = 0, n = 0;
    for (let o = 0; o < a.d.length; o += 16) { diff += Math.abs(a.d[o + 3] - b.d[o + 3]) + Math.abs(a.d[o] - b.d[o]); n++; }
    steps.push(diff / n / 255);
  }
  return steps;
}
function gateMotion(steps, label) {
  const pct = steps.map((s) => +(s * 100).toFixed(2));
  console.log(`  ${label}: per-frame change ${pct.join(' / ')} %`);
  const dead = pct.filter((p) => p < 0.35);
  return dead.length ? [`the loop stalls: ${dead.length} step(s) under 0.35% change (${pct.join('/')})`] : [];
}
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / data.num_cols), ch = Math.floor(meta.height / data.num_rows), o = [];
    for (let r = 0; r < data.num_rows && o.length < n; r++) for (let c = 0; c < data.num_cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames in the response');
}
async function makeImage(prompt, label) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`  ${label} image attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000), body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0] && data[0].url : (data && (data.url || (data.images && data.images[0] && data.images[0].url)));
      if (!url) throw new Error('no url in the response');
      console.log('ok'); return await fetchBuf(url);
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} FAILED: ${last && last.message}`);
}
async function animate(baseBuf, motion, size, prefix, dir, label) {
  const uri = 'data:image/png;base64,' + (await sharp(baseBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`  ${label} animate attempt ${a} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000), body: JSON.stringify({ initial_image: uri, motion_prompt: motion, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      console.log('frames in');
      const packed = await packFrames(bufs, size, label);
      const stall = gateMotion(await motionProfile(packed), label);
      if (stall.length) throw new Error(stall.join('; '));
      // FLASHY, measured: the loop has to actually peak in brightness, not just wobble.
      if (label === 'dash_mage') {
        const bright = []; for (const b of packed) bright.push(brightCount(await px(b)));
        const hi = Math.max(...bright), lo = Math.min(...bright), ratio = lo ? hi / lo : Infinity;
        console.log(`  ${label}: white-core pixels per frame ${bright.join(' / ')} (peak/floor ${ratio.toFixed(2)}x)`);
        if (ratio < 1.35) throw new Error(`the loop does not flare: peak/floor only ${ratio.toFixed(2)}x (want >= 1.35)`);
      }
      await mkdir(dir, { recursive: true });
      const written = [];
      for (let i = 0; i < FRAMES; i++) { const p = join(dir, `${prefix}_${i}.webp`); await writeFile(p + '.tmp', packed[i]); await rename(p + '.tmp', p); written.push(p); }
      for (const f of written) { const bx = inkBox(await px(await readFile(f))); if (bx.x0 === 0 || bx.y0 === 0 || bx.x1 >= bx.W - 1 || bx.y1 >= bx.H - 1) throw new Error(`${f} touches the border after packing`); }
      console.log(`  ${label}: ${FRAMES} frames written, none touching a border`);
      return;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} ANIM FAILED: ${last && last.message}`);
}
// ---- run --------------------------------------------------------------------
if (!has('--generate')) {
  console.log('DRY RUN - briefs only. Re-run with --generate (needs LUDO_API_KEY).\n');
  console.log('dash_mage base:\n' + DASH_PROMPT + '\n\ndash_mage motion:\n' + DASH_MOTION + '\n');
  console.log('mstormorb base:\n' + ORB_PROMPT + '\n\nmstormorb motion:\n' + ORB_MOTION);
  process.exit(0);
}
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
async function build(name, prompt, motion, out, size, margin, gate, animDir, animPrefix) {
  console.log(`\n=== ${name} ===`);
  // --anim-only: the base on disk is already the one that passed, so re-roll just the loop
  // rather than paying for a fresh image and risking a worse base.
  if (has('--anim-only')) { await animate(await readFile(out), motion, size, animPrefix, animDir, name); return; }
  let chosen = null;
  for (let roll = 1; roll <= ROLLS && !chosen; roll++) {
    const raw = await makeImage(prompt, `${name} roll ${roll}`);
    const seated = await seat(raw, size, margin);
    const p = await px(seated), bx = inkBox(p);
    const bad = gate(name === 'dash_mage' ? brightCentroid(p) : null, bx);
    let hue = null;
    if (name === 'dash_mage') { hue = medianHue(p);
      if (hue == null || hue < 190 || hue > 245) bad.push(`not light blue: median hue ${hue} deg (want 190-245; violet reads ~270)`); }
    console.log(`  roll ${roll}: ink ${bx.w}x${bx.h} at (${bx.x0},${bx.y0})${hue != null ? `, hue ${hue} deg` : ''} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
    if (!bad.length) chosen = seated;
  }
  if (!chosen) { console.error(`${name}: no roll passed the gates`); process.exitCode = 2; return; }
  await writeFile(out + '.tmp', chosen); await rename(out + '.tmp', out);
  console.log(`  base -> ${out.replace(repoRoot, '').replace(/\\/g, '/')}`);
  if (!has('--skip-anim')) await animate(chosen, motion, size, animPrefix, animDir, name);
}
if (!only || only === 'dash') await build('dash_mage', DASH_PROMPT, DASH_MOTION, DASH_OUT, DASH_SIZE, 0.045, (b, bx) => gateDash(b, bx), FX_ANIM, 'dash_mage');
if (!only || only === 'orb') await build('mstormorb', ORB_PROMPT, ORB_MOTION, ORB_OUT, ORB_SIZE, 0.05, (b, bx) => gateOrb(bx), PROJ_ANIM, 'mstormorb');
console.log('\ndone.');
