#!/usr/bin/env node
// The mage's fireball and ice spike — new base art + 9-frame loops (ludo.ai).
//   -> Sprites/projectiles/p_fireball.webp   + anim/p_fireball_0..8.webp
//      Sprites/projectiles/p_icespike.webp   + anim/p_icespike_0..8.webp
//
//   node scripts/gen_mage_proj_v2.mjs --rolls 4 --generate        # both bases
//   node scripts/gen_mage_proj_v2.mjs --generate --only fireball
//   node scripts/gen_mage_proj_v2.mjs --anim                      # both loops
//   node scripts/gen_mage_proj_v2.mjs --check
//   node scripts/gen_mage_proj_v2.mjs --bake fireball 2
//
// WHAT WAS ACTUALLY WRONG, measured rather than eyeballed. Both sprites fought
// the render mode the engine draws them in, and in both cases the obvious
// silhouette metrics said everything was fine:
//
//   p_fireball  aspect 0.99, silhouette rot90 IoU 0.924  -- looks perfect
//   p_icespike  aspect 0.96, taper 0.96, one component   -- looks perfect
//
//   * THE FIREBALL IS SPUN, at 0.40 rad/frame (~3.8 revolutions a second), and
//     it had a FACE. A silhouette metric cannot see a face; it is interior
//     detail inside a perfectly round outline. Comparing masked luminance
//     against itself rotated 90 degrees does see it: the old fireball scored
//     76.7 where p_mage_orb -- the sibling sprite spun the same way -- scores
//     45.1 and the bolt loop 44-51. A face cartwheeling four times a second
//     reads as a mascot doing somersaults, not as fire.
//   * THE ICE SPIKE IS ORIENTED TO ITS VELOCITY, and it was a round cluster of
//     three overlapping blobs -- aspect 0.96. Rotating a blob to face its
//     direction of travel communicates nothing, because a blob has no facing.
//     An oriented projectile has to be elongated and has to taper toward +x,
//     which is the direction the engine assumes is forward.
//
// So the gates below are per-sprite and they are the render contract, not
// taste: rotational uniformity for the one that spins, directionality for the
// one that points.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'projectiles');
const ANIM = join(DIR, 'anim');
const KEEP = join(repoRoot, 'scripts', '_tmp_mageproj_rolls');
const SIZE = 768, FRAMES = 9, ALPHA = 12;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const STYLE =
  ' Epic painterly fantasy game PROJECTILE sprite for a 2D side-scrolling platformer, in the style of a '
  + 'glowing arcane energy orb: rich saturated colour, soft inner glow, crisp painted highlights and a '
  + 'bold dark outline around the silhouette. A single object centred on a pure transparent background, '
  + 'alpha only. No scene, no ground, no character, no background, no frame, no border. '
  + 'ABSOLUTELY NO FACE: no eyes, no mouth, no eyebrows, no cheeks, no expression, not a creature and '
  + 'not a mascot. It is an element, not a character.';

const ITEMS = {
  fireball: {
    prompt:
      'a churning BALL OF FIRE: a blinding white-hot core wrapped in swirling orange and amber flame '
      + 'that curls outward EVENLY IN EVERY DIRECTION like a small sun, with licks of fire and bright '
      + 'sparks radiating all the way around the rim and a few embers drifting just outside it. It must '
      + 'be RADIALLY SYMMETRICAL - the same in every direction, with no top, no bottom and no front, '
      + 'because the game spins it rapidly as it flies.',
    motion:
      'The fire INSIDE the ball boils violently: the flame tongues sweep and curl AROUND the white-hot '
      + 'core in a strong visible swirl, big licks of fire rise and are swallowed and new ones erupt, '
      + 'the core flares brilliantly bright then dims, and sparks burst off the rim and die. This is a '
      + 'DRAMATIC, high-energy churn - every frame should look clearly different from the last. '
      + 'The OUTLINE of the ball stays the same round shape and the same size throughout - the fire '
      + 'moves, the silhouette does not. Do not rotate, tumble or revolve the sprite as a whole (the '
      + 'game already spins it); all of the motion happens INSIDE the outline. '
      + 'CRITICAL - LOCKED FRAMING: perfectly centred at the exact same size and position in every '
      + 'frame; no zoom, pan, crop, rescale, drift, wobble, mirror or flip. '
      + 'CRITICAL - SEAMLESS LOOP: the last frame flows continuously back into the first. '
      + 'Same art style, same fiery palette, same dark outline, transparent background, and NO FACE.',
    gates: 'spin',
  },
  icespike: {
    prompt:
      'a single ICE SPIKE flying to the RIGHT: one long tapered shard of glassy blue-white ice, broad '
      + 'at its LEFT end and narrowing to a needle-sharp point at its RIGHT end, with pale cyan '
      + 'highlights along the facets, a faint frost-vapour trail and two or three small ice chips '
      + 'drifting behind it at the LEFT. Clearly ARROW-SHAPED and clearly aimed RIGHT: it is ONE shard, '
      + 'not a cluster, not a group, not several crystals.',
    motion:
      'The ice spike BLAZES with cold as it flies: bright white glints sweep visibly along its facets '
      + 'from tail to tip and flash out, the frost vapour billowing behind it boils and re-forms in big '
      + 'curling plumes, new ice chips break off and drift away, and a pale blue glow pulses through the '
      + 'shard from within. Every frame should look clearly different from the last. '
      + 'The shard keeps the same shape, size and position and always points RIGHT - the game rotates '
      + 'it to its direction of travel, so do not rotate, tumble or spin the sprite itself. '
      + 'CRITICAL - LOCKED FRAMING: perfectly centred at the exact same size and position in every '
      + 'frame; no zoom, pan, crop, rescale, drift, wobble, mirror or flip. '
      + 'CRITICAL - SEAMLESS LOOP: the last frame flows continuously back into the first. '
      + 'Same art style, same icy blue-white palette, same dark outline, transparent background.',
    gates: 'point',
  },
};

// The spun sprite has to look the same rotated. p_mage_orb (spun 0.35) scores
// 45 and the bolt loop 44-51, so 58 is a real bar that the old faced fireball
// (76.7) fails and a churning ball comfortably clears.
const MAX_ROT_DIFF = 58;
const SPIN_ASPECT = [0.85, 1.18];
const MIN_SPIN_IOU = 0.88;
// The oriented sprite has to be a shard, not a blob (old: aspect 0.96).
const MIN_POINT_ASPECT = 1.80;
const MIN_POINT_TAPER = 1.30;
const MIN_ONE_PIECE = 0.90;    // largest connected component's share of the ink
// A loop that does not MOVE is not an animation, and identical alpha boxes
// prove nothing about that: the brief asks the silhouette to hold still while
// the interior churns. So motion is measured on the interior - mean absolute
// luminance change between consecutive frames, over pixels opaque in both.
// The game's own bolt loop is the benchmark at 10.3. The first fireball roll
// came back at 5.6 with two live frames and the rest nearly static; the first
// ice roll at 3.5. Fire is asked to swirl so it is held to a real bar; ice
// glitters rather than morphs, so its bar is lower on purpose.
const MIN_MOTION = { fireball: 8.0, icespike: 5.0 };

function bandsOf(data, w, c, box) {
  let warm = 0, cold = 0, sat = 0;
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] <= 90) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === 0 || (mx - mn) / mx < 0.22) continue;
    sat++;
    let hue;
    if (mx === r) hue = 60 * (((g - b) / (mx - mn)) % 6);
    else if (mx === g) hue = 60 * ((b - r) / (mx - mn) + 2);
    else hue = 60 * ((r - g) / (mx - mn) + 4);
    if (hue < 0) hue += 360;
    if (hue <= 55 || hue >= 340) warm++;
    else if (hue >= 165 && hue <= 260) cold++;
  }
  return { warm: sat ? warm / sat : 0, cold: sat ? cold / sat : 0 };
}

async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, ink = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] > ALPHA) {
      ink++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const box = { x0, y0, x1, y1 };
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;

  // taper — thick left third vs thin right third
  const col = [];
  for (let x = x0; x <= x1; x++) {
    let lo = -1, hi = -1;
    for (let y = y0; y <= y1; y++) if (data[(y * w + x) * c + 3] > ALPHA) { if (lo < 0) lo = y; hi = y; }
    col.push(lo < 0 ? 0 : hi - lo + 1);
  }
  const th = Math.max(1, Math.floor(bw / 3));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const taper = mean(col.slice(0, th)) / Math.max(1e-6, mean(col.slice(bw - th)));

  // silhouette + INTERIOR rotational symmetry, both about the box centre
  let inter = 0, uni = 0, lsum = 0, ln = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * w + x) * c;
    const rx = Math.round(cx - (y - cy)), ry = Math.round(cy + (x - cx));
    const inBounds = rx >= 0 && ry >= 0 && rx < w && ry < h;
    const j = inBounds ? (ry * w + rx) * c : -1;
    const a1 = data[i + 3] > ALPHA, a2 = j >= 0 ? data[j + 3] > ALPHA : false;
    if (a1 && a2) inter++;
    if (a1 || a2) uni++;
    if (j >= 0 && data[i + 3] > 128 && data[j + 3] > 128) {
      lsum += Math.abs((data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
                     - (data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114));
      ln++;
    }
  }

  // one piece, or several?
  const seen = new Uint8Array(w * h);
  let biggest = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const s0 = y * w + x;
    if (seen[s0] || data[s0 * c + 3] <= ALPHA) continue;
    let n = 0; const st = [s0]; seen[s0] = 1;
    while (st.length) {
      const q = st.pop(); n++;
      const qx = q % w, qy = (q / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || data[ni * c + 3] <= ALPHA) continue;
        seen[ni] = 1; st.push(ni);
      }
    }
    if (n > biggest) biggest = n;
  }

  return { w, h, bw, bh, aspect: bw / bh, taper, iou: inter / uni,
    rotDiff: ln ? lsum / ln : 999, onePiece: biggest / Math.max(1, ink),
    ...bandsOf(data, w, c, box) };
}

// Mean absolute luminance change between consecutive frames of a loop, over
// pixels opaque in both. Sees interior churn that an alpha-box comparison
// cannot: nine frames with identical silhouettes may be nine copies of one
// image, or exactly the animation that was asked for.
async function loopMotion(bufs) {
  const raw = [];
  for (const b of bufs) raw.push(await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  const per = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i], z = raw[(i + 1) % raw.length];
    const { width: w, height: h, channels: c } = a.info;
    let sum = 0, n = 0;
    for (let px = 0; px < w * h; px++) {
      const ia = px * c, ib = px * z.info.channels;
      if (a.data[ia + 3] <= 128 || z.data[ib + 3] <= 128) continue;
      sum += Math.abs((a.data[ia] * 0.299 + a.data[ia + 1] * 0.587 + a.data[ia + 2] * 0.114)
                    - (z.data[ib] * 0.299 + z.data[ib + 1] * 0.587 + z.data[ib + 2] * 0.114));
      n++;
    }
    per.push(sum / Math.max(1, n));
  }
  return { mean: per.reduce((x, y) => x + y, 0) / per.length, min: Math.min(...per), per };
}

function grade(kind, m) {
  if (!m) return { ok: false, why: 'empty' };
  const f = [];
  if (kind === 'spin') {
    if (m.aspect < SPIN_ASPECT[0] || m.aspect > SPIN_ASPECT[1]) f.push(`aspect ${m.aspect.toFixed(2)} not round`);
    if (m.iou < MIN_SPIN_IOU) f.push(`silhouette rot90 IoU ${m.iou.toFixed(3)}<${MIN_SPIN_IOU}`);
    if (m.rotDiff > MAX_ROT_DIFF) f.push(`interior rot90 diff ${m.rotDiff.toFixed(1)}>${MAX_ROT_DIFF} (a face, or a fixed top and bottom)`);
    if (m.warm < 0.60) f.push(`warm ${(m.warm * 100).toFixed(0)}%<60%`);
  } else {
    if (m.aspect < MIN_POINT_ASPECT) f.push(`aspect ${m.aspect.toFixed(2)}<${MIN_POINT_ASPECT} (a blob has no facing)`);
    if (m.taper < MIN_POINT_TAPER) f.push(`taper ${m.taper.toFixed(2)}<${MIN_POINT_TAPER} (not pointing right)`);
    if (m.onePiece < MIN_ONE_PIECE) f.push(`largest piece ${(m.onePiece * 100).toFixed(0)}%<${MIN_ONE_PIECE * 100}% (a cluster, not one shard)`);
    if (m.cold < 0.55) f.push(`cold ${(m.cold * 100).toFixed(0)}%<55%`);
  }
  return { ok: !f.length, why: f.join(', ') };
}

// Trim, fit and centre. The oriented spike also has to survive being rotated to
// any angle, so its content is held inside the canvas's inscribed circle.
async function frame(buf, kind) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, c = info.channels;
  let x0 = w, y0 = h, x1 = 0, y1 = 0, any = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] > ALPHA) {
      any = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (!any) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  // 'point' art rotates to any angle: the diagonal of the content must fit the
  // inscribed circle (2*r/sqrt(2) = 0.707*SIZE), so use 0.68 for margin.
  // 'spin' art is round, so its own diagonal is already its width.
  const inner = Math.round(SIZE * (kind === 'point' ? 0.68 : 0.90));
  const content = await sharp(buf).ensureAlpha()
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize(inner, inner, { fit: 'inside' }).png().toBuffer();
  const md = await sharp(content).metadata();
  return sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: content, left: Math.round((SIZE - md.width) / 2), top: Math.round((SIZE - md.height) / 2) }])
    .webp({ quality: 92 }).toBuffer();
}

// Fit the WHOLE SET with ONE scale and ONE offset, from the union of every
// frame's content box. Per-frame fitting would cancel the animation - each
// frame would be re-centred and re-scaled to the same box, so a flaring
// fireball would appear not to flare at all.
//
// It is needed because a livelier loop is a BIGGER loop: the flames that made
// the fireball's motion score jump 5.6 -> 19.5 also pushed it past the canvas
// edge (92 border pixels, i.e. visibly clipped flame at the blit). The base
// frame fits; the frames that animate off it do not, and only the set knows how
// far out they go.
async function refitSet(bufs, kind) {
  const boxes = [];
  for (const b of bufs) {
    const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, c = info.channels;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * c + 3] > ALPHA) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    boxes.push({ x0, y0, x1, y1, w, h });
  }
  const u = { x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)),
              x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) };
  const uw = u.x1 - u.x0 + 1, uh = u.y1 - u.y0 + 1;
  // 'point' art is rotated to any angle, so its content must fit the canvas's
  // inscribed circle; 'spin' art only needs margin.
  const target = SIZE * (kind === 'point' ? 0.66 : 0.88);
  const sc = Math.min(target / uw, target / uh);
  const sw = Math.max(1, Math.round(boxes[0].w * sc)), sh = Math.max(1, Math.round(boxes[0].h * sc));
  const left = Math.round(SIZE / 2 - (u.x0 + uw / 2) * sc);
  const top = Math.round(SIZE / 2 - (u.y0 + uh / 2) * sc);
  const out = [];
  for (const b of bufs) {
    out.push(await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp(b).resize(sw, sh, { fit: 'fill' }).png().toBuffer(), left, top }])
      .webp({ quality: 92 }).toBuffer());
  }
  return out;
}

const only = arg('--only');
const keys = Object.keys(ITEMS).filter((k) => !only || only.split(',').includes(k));

if (has('--check')) {
  let bad = 0;
  for (const k of keys) {
    const p = join(DIR, `p_${k}.webp`);
    if (!existsSync(p)) { console.log(`  ${k}: MISSING`); bad++; continue; }
    const m = await measure(await readFile(p));
    const g = grade(ITEMS[k].gates, m);
    let fr = 0;
    for (let i = 0; i < FRAMES; i++) if (existsSync(join(ANIM, `p_${k}_${i}.webp`))) fr++;
    console.log(`  ${k}: ${m.w}x${m.h} box ${m.bw}x${m.bh} aspect ${m.aspect.toFixed(2)} taper ${m.taper.toFixed(2)}`
      + ` iou ${m.iou.toFixed(3)} rotDiff ${m.rotDiff.toFixed(1)} onePiece ${(m.onePiece * 100).toFixed(0)}%`
      + ` warm ${(m.warm * 100).toFixed(0)}% cold ${(m.cold * 100).toFixed(0)}% | frames ${fr}/${FRAMES}`);
    if (!g.ok || fr !== FRAMES) { console.log(`     FAIL ${g.why || `only ${fr} frames`}`); bad++; }
  }
  console.log(bad ? 'FAIL' : 'PASS');
  process.exit(bad ? 1 : 0);
}

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const hdr = { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' };
const fetchBuf = async (u) => Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(120000) })).arrayBuffer());

if (has('--bake')) {
  const k = arg('--bake'), n = argv[argv.indexOf('--bake') + 2];
  const raw = await readFile(join(KEEP, `${k}_r${n}.png`));
  const g = grade(ITEMS[k].gates, await measure(raw));
  if (!g.ok) { console.error(`${k} roll ${n} does not clear the gate: ${g.why}`); process.exit(2); }
  await writeFile(join(DIR, `p_${k}.webp`), await frame(raw, ITEMS[k].gates));
  console.log(`baked ${k} roll ${n}`);
  process.exit(0);
}
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }

if (has('--anim')) {
  for (const k of keys) {
    const base = join(DIR, `p_${k}.webp`);
    if (!existsSync(base)) { console.log(`${k}: no base yet`); continue; }
    const uri = 'data:image/png;base64,'
      + (await sharp(await readFile(base)).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
    const tries = Number(arg('--anim-rolls') || 3);
    let best = null, err = '';
    for (let a = 1; a <= tries; a++) {
      let bufs = null;
      process.stdout.write(`${k} animate attempt ${a}/${tries} ... `);
      try {
        const res = await fetch(`${API}/assets/sprite/animate`, {
          method: 'POST', headers: hdr, signal: AbortSignal.timeout(300000),
          body: JSON.stringify({ initial_image: uri, motion_prompt: ITEMS[k].motion, frames: FRAMES,
            frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }),
        });
        if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
        const d = await res.json();
        if (d.spritesheet_url && d.num_cols && d.num_rows) {
          const sheet = await fetchBuf(d.spritesheet_url), md = await sharp(sheet).metadata();
          const cw = Math.floor(md.width / d.num_cols), ch = Math.floor(md.height / d.num_rows), o = [];
          for (let r = 0; r < d.num_rows && o.length < FRAMES; r++)
            for (let cc = 0; cc < d.num_cols && o.length < FRAMES; cc++)
              o.push(await sharp(sheet).extract({ left: cc * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
          if (o.length >= FRAMES) bufs = o;
        }
        if (!bufs) {
          const urls = d.individual_frame_urls || [];
          if (urls.length >= FRAMES) bufs = await Promise.all(urls.slice(0, FRAMES).map(fetchBuf));
        }
        if (!bufs) throw new Error('no usable frames');
        const mo = await loopMotion(bufs);
        const bar = MIN_MOTION[k] || 0;
        console.log(`motion ${mo.mean.toFixed(2)} (min frame ${mo.min.toFixed(2)}, bar ${bar}) ${mo.mean >= bar ? 'pass' : 'WEAK'}`);
        if (!best || mo.mean > best.mo.mean) best = { bufs, mo };
        if (mo.mean >= bar) break;   // good enough; stop spending credits
      } catch (e) { err = e.message; console.log('FAIL ' + err); }
    }
    if (!best) { console.error(`${k} animate failed: ${err}`); continue; }
    const bufs = best.bufs;
    if (best.mo.mean < (MIN_MOTION[k] || 0))
      console.log(`  WARNING: best ${k} loop is ${best.mo.mean.toFixed(2)}, under the ${MIN_MOTION[k]} bar — shipping it anyway is a choice, not a pass`);
    await mkdir(ANIM, { recursive: true });
    // Normalise to the shared canvas first, then refit the SET as a whole.
    const sized = [];
    for (const b of bufs) sized.push(await sharp(b).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
    const fitted = await refitSet(sized, ITEMS[k].gates);
    for (let i = 0; i < FRAMES; i++) await writeFile(join(ANIM, `p_${k}_${i}.webp`), fitted[i]);
    console.log(`  wrote ${FRAMES} frames -> anim/p_${k}_0..8.webp`);
  }
  process.exit(0);
}

if (!has('--generate')) { console.error('usage: --generate [--rolls N] [--only k] | --anim | --bake <key> <n> | --check'); process.exit(1); }
const ROLLS = Number(arg('--rolls') || 4);
await mkdir(KEEP, { recursive: true });
let failed = 0;
for (const k of keys) {
  const it = ITEMS[k];
  let best = null;
  for (let r = 1; r <= ROLLS; r++) {
    process.stdout.write(`${k} roll ${r}/${ROLLS} ... `);
    let raw;
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: hdr, signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite-vfx', art_style: 'Hand-Painted', perspective: 'Side-Scroll',
          aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: it.prompt + STYLE }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
      const d = await res.json();
      const url = Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      raw = await fetchBuf(url);
    } catch (e) { console.log('FAIL ' + e.message); continue; }
    await writeFile(join(KEEP, `${k}_r${r}.png`), raw);   // every roll kept
    const m = await measure(raw);
    const g = grade(it.gates, m);
    console.log(m ? `aspect ${m.aspect.toFixed(2)} taper ${m.taper.toFixed(2)} rotDiff ${m.rotDiff.toFixed(1)}`
      + ` onePiece ${(m.onePiece * 100).toFixed(0)}% ${g.ok ? 'pass' : 'GATED ' + g.why}` : 'empty');
    if (!g.ok) continue;
    // Best = most emphatically what the render mode needs: most uniform under
    // rotation for the spun one, most directional for the pointed one.
    const score = it.gates === 'spin' ? -m.rotDiff : m.taper;
    if (!best || score > best.score) best = { raw, m, score };
  }
  if (!best) { console.error(`${k}: no roll cleared the gate`); failed++; continue; }
  await writeFile(join(DIR, `p_${k}.webp`), await frame(best.raw, it.gates));
  console.log(`  wrote p_${k}.webp  aspect ${best.m.aspect.toFixed(2)} taper ${best.m.taper.toFixed(2)} rotDiff ${best.m.rotDiff.toFixed(1)}`);
}
console.log(failed ? 'some keys failed — re-run, or --bake a saved roll' : 'now run: node scripts/gen_mage_proj_v2.mjs --anim');
process.exit(failed ? 2 : 0);
