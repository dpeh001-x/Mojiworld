#!/usr/bin/env node
// qte_holy - the JUDGEMENT SEAL sigil, redrawn as a LOCKDOWN.
// ============================================================================
// Per user (2026-09-09): "regenerate qte_holy sprite and the subsequent animations, make sure
// that there are no cut offs (ensure it is linked to boss causing the judgement lock) the sprite
// should be more appropriate as it technically is not 'holy' based, it is essentially a lockdown
// on the character", then "for qte_holy can be much bigger using a bigger canvas".
//
// WHAT THE ART IS FOR. _QTE_THEMES.holy is the shackle QTE skin routed by _qteThemeFor() to
// every aetherion* form, towerArbiter, towerSovereign and any zodiac boss - the Tower's judges.
// The sigil is spawned AROUND THE PLAYER for the length of the stun; it is the thing pinning you
// in place, not a blessing. The shipped art was a winged sunburst mandala: angel wings, a halo
// and a radiant core, which reads as being blessed rather than being held. Measured, the wings
// are why its ink box is aspect 1.28 while every other theme's sigil is a circle (qte_chains
// 0.99). The redraw is a BINDING SEAL: a verdict ring of judgement glyphs, four manacle clamps
// biting inward, taut chains crossing to a central padlock stamped with the scales. Gold stays -
// it is the theme's own palette (border #ffe9a8, ramp #ffffff / #ffeebb / #d4a017) and it is what
// ties the sigil to the judges that cast it.
//
// KEY NAME IS UNCHANGED. 'qte_holy' is referenced from _QTE_THEMES, the asset manifest, the
// sprite frame index and _FX_ANIM_KEYS. Renaming the files to rename a look would touch four
// tables for zero player-visible gain; the label the player actually reads is 'JUDGEMENT SEAL'.
//
// BIGGER CANVAS (per user). 768 -> 1024 for the still and 952 -> 1024 for the frames, and the
// script prints the SOURCE union size next to it so an upscale can never be passed off as detail.
//
// NO CUT-OFFS - four guards, one of which is new:
//   1. the still is trimmed to its ink and re-seated with a real transparent gutter;
//   2. the loop is packed by ONE shared crop of the nine-frame union, and a union already on the
//      source border means the model clipped the art, which throws and re-rolls;
//   3. every written file is re-measured and any ink on a border throws;
//   4. NEW - the flush gate. A frame can clear all of the above and still read as cut off when a
//      ring is drawn with a flat sliced edge INSIDE the composition. It measures how much of each
//      side of the ink box is solid ink; a drawn shape touches its own box at a few points, a
//      sliced one runs along it. The shipped qte_holy_4 also sat 11px from a 952px border, which
//      is what the union crop is there to stop.
//
//   node scripts/gen_qte_lockdown.mjs                # dry run, prints the briefs
//   node scripts/gen_qte_lockdown.mjs --generate     # needs LUDO_API_KEY
//   flags: --rolls N   --anim-only   --still-only
import sharp from 'sharp';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const STILL_OUT = join(repoRoot, 'Sprites', 'fx', 'qte_holy.webp');
const FX_ANIM = join(repoRoot, 'Sprites', 'fx', 'anim');
const FRAMES = 9, STILL_SIZE = 1024, ANIM_SIZE = 1024;
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const ROLLS = Number(argOf('--rolls', '5'));

const SEAL_PROMPT =
  'A circular ARCANE BINDING SEAL for a 2D fantasy game - a magical LOCKDOWN sigil that clamps '
  + 'shut around a prisoner, seen straight on. Build it from the outside in: an outer ring of '
  + 'heavy engraved gold judgement glyphs and tally marks like a court verdict wheel; inside it '
  + 'four thick gold-and-dark-iron MANACLE CLAMPS at the top, bottom, left and right, their jaws '
  + 'biting inward toward the middle; short sharp restraint spikes angled inward between the '
  + 'clamps; taut gold chains strung across the opening from clamp to clamp, pulled tight; and at '
  + 'the exact centre a heavy gold PADLOCK medallion stamped with a pair of balance scales, glowing '
  + 'from its keyhole. A little cracked gold light leaks between the links. '
  + 'Colours: antique gold, pale gold and warm cream highlights over dark iron and deep bronze, '
  + 'on nothing. It must read as CAPTURE - a cage snapping shut - not as a blessing. '
  + 'Do NOT draw any angel wings, feathers, halo, cross, star, sunburst or radiating rays of light. '
  + 'No character, no creature, no hands, no background, no ground, no text or letters. '
  + 'Roughly as wide as it is tall - a circle, not a wide winged shape. '
  + 'Flat 2D cartoon game sprite, bold clean shapes, crisp painted edges, strong readable silhouette, '
  + 'no photorealism. Fully transparent background, the whole seal floating free and drawn COMPLETE '
  + 'with a clear even margin on all four sides - every ring, chain and clamp closed and unbroken, '
  + 'nothing touching, running off or sliced flat by the edge of the frame.';

const SEAL_MOTION =
  'This binding seal SLAMS SHUT on its prisoner and then strains. Across the nine frames run one '
  + 'full lock-down cycle, spread EVENLY so every frame differs clearly from the one before, '
  + 'including the last three: the outer glyph ring grinds round and its engraved marks light up '
  + 'one after another; the four manacle clamps swing inward and SNAP closed with a hard spark '
  + 'flash at each jaw; the chains across the middle jolt taut and quiver under the strain; the '
  + 'central padlock stamps down, its keyhole flaring to a white-hot pulse, then dimming; and gold '
  + 'embers spit off the clamps and fade. Give it a real beat - a bright violent snap in the middle '
  + 'of the loop and a tense settle after it. '
  + 'The seal keeps the SAME position and the SAME overall size in every frame: only the ring '
  + 'rotation, the clamp jaws, the chain tension and the glow change. Do not travel, tilt, flip or '
  + 'zoom the picture, do not add wings, rays, letters or new objects. The last frame flows back '
  + 'into the first so the loop is seamless. '
  + 'Every ring, chain and clamp stays COMPLETE and entirely inside the picture with a clear margin '
  + 'all round: let it brighten and spark rather than grow past the edge, and never draw a ring or '
  + 'clamp with a flat or straight-sliced edge. '
  + 'Keep the area around the seal COMPLETELY EMPTY and transparent in every frame - no background '
  + 'wash, no full-frame haze or glow, no rectangular flash, no smoke or light filling the picture, '
  + 'no vignette and no border. Only the seal itself and the sparks close around it are ever drawn.';

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const ALPHA_ON = 8;
async function px(buf) { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; }
function inkBox(p) {
  let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3] > ALPHA_ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; n++; }
  if (x1 < 0) throw new Error('fully transparent');
  return { x0, y0, x1, y1, n, w: x1 - x0 + 1, h: y1 - y0 + 1, W: p.w, H: p.h };
}
// ---- gates ------------------------------------------------------------------
// A straight sliced edge INSIDE the composition, which the border check cannot see.
// EDGE_OPAQUE, not "any ink". First cut measured coverage at alpha > 40 and started rejecting
// loops that were not sliced at all - a soft full-frame glow lights up the whole perimeter at low
// alpha, and the ink box (alpha > 8) is then the whole picture. A SLICE is a hard cut through
// solid art, so it leaves NEAR-OPAQUE pixels sitting on the box edge; a glow tapers away long
// before it. Calibrated on three known sets at alpha > 180: the dash_mage frames the user called
// cut off measure 13 / 16 / 22%, the clean dash_rogue loop 5%, the clean dash_warrior loop 0%.
// The limit sits at 10%, between them.
const EDGE_OPAQUE = 180, FLUSH_LIMIT = 10;
function flushSides(p) {
  const bx = inkBox(p); const A = (x, y) => p.d[(y * p.w + x) * 4 + 3];
  let L = 0, R = 0, T = 0, B = 0;
  for (let y = bx.y0; y <= bx.y1; y++) { if (A(bx.x0, y) > EDGE_OPAQUE) L++; if (A(bx.x1, y) > EDGE_OPAQUE) R++; }
  for (let x = bx.x0; x <= bx.x1; x++) { if (A(x, bx.y0) > EDGE_OPAQUE) T++; if (A(x, bx.y1) > EDGE_OPAQUE) B++; }
  const h = bx.y1 - bx.y0 + 1, w = bx.x1 - bx.x0 + 1;
  return { L: 100 * L / h, R: 100 * R / h, T: 100 * T / w, B: 100 * B / w };
}
function gateFlush(p, label) {
  const f = flushSides(p); const LIM = FLUSH_LIMIT;
  const bad = Object.entries(f).filter(([, v]) => v > LIM).map(([k, v]) => `${k} ${v.toFixed(0)}%`);
  return bad.length ? [`${label} is CUT OFF inside the art - a straight sliced edge (${bad.join(', ')}; limit ${LIM}%)`] : [];
}
// The theme palette is gold. Measured on SATURATED colour only - the white core of a glow sprite
// carries no hue and is most of its pixels, so an unfiltered average always reads as no-colour.
function medianHue(p) {
  const hs = [];
  for (let i = 0; i < p.d.length; i += 4) {
    if (p.d[i + 3] < 120) continue;
    const r = p.d[i] / 255, g = p.d[i + 1] / 255, b = p.d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (mx < 0.15 || d / mx < 0.35) continue;
    let h; if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4);
    hs.push(h < 0 ? h + 360 : h);
  }
  if (hs.length < 500) return null;
  hs.sort((a, b) => a - b); return hs[hs.length >> 1];
}
// The wings are the measurable difference between a blessing and a cage: the shipped sigil's ink
// box is 1.28 wide-to-tall because of them, where every other theme's is a circle (qte_chains
// 0.99). Run this gate against the old art and it fails - which is how it was proved to
// discriminate rather than just pass whatever came back.
function gateSeal(p) {
  const bx = inkBox(p), bad = [];
  if (bx.x0 === 0 || bx.y0 === 0 || bx.x1 >= bx.W - 1 || bx.y1 >= bx.H - 1) bad.push('ink on the canvas border');
  const aspect = bx.w / bx.h;
  if (aspect < 0.85 || aspect > 1.18) bad.push(`not a circular seal: ink ${bx.w}x${bx.h} (aspect ${aspect.toFixed(2)}, want 0.85-1.18) - a wide box means wings or rays came back`);
  const hue = medianHue(p);
  if (hue == null) bad.push('almost no saturated colour - the seal has to be gold');
  else if (hue < 25 || hue > 60) bad.push(`wrong palette: saturated colour sits at hue ${Math.round(hue)}deg, want gold 25-60deg`);
  const fill = bx.n / (bx.w * bx.h);
  if (fill > 0.72) bad.push(`solid disc, not a seal ring: ${Math.round(fill * 100)}% of the box is ink (want <= 72%)`);
  bad.push(...gateFlush(p, 'the still'));
  return { bad, bx, aspect, hue, fill };
}

// ONE shared crop across the loop: per-frame fitting re-centres each frame and makes the loop
// jitter. A union already on the source border means the model clipped it - no transform invents
// pixels back. Prints the source union so an upscale onto the bigger canvas is never mistaken for
// extra detail.
async function packFrames(bufs, size, label) {
  const boxes = []; for (const b of bufs) boxes.push(inkBox(await px(b)));
  const W = boxes[0].W, H = boxes[0].H;
  const u = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
  const touched = [u.x0 <= 1 && 'left', u.y0 <= 1 && 'top', u.x1 >= W - 2 && 'right', u.y1 >= H - 2 && 'bottom'].filter(Boolean);
  if (touched.length) throw new Error(`the loop is clipped at the source edge (${touched.join(', ')})`);
  const inner = Math.round(size * 0.90), cw = u.x1 - u.x0 + 1, chh = u.y1 - u.y0 + 1;
  const scale = inner / Math.max(cw, chh), out = [];
  for (const b of bufs) {
    const crop = await sharp(b).extract({ left: u.x0, top: u.y0, width: cw, height: chh })
      .resize(Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(chh * scale)), { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: crop, gravity: 'centre' }]).webp({ quality: 93, alphaQuality: 100 }).toBuffer());
  }
  console.log(`  ${label}: source union ${cw}x${chh} of ${W}x${H} -> ${inner}px on a ${size}px canvas (${(scale).toFixed(2)}x), ${Math.round((size - inner) / 2)}px gutter every side`);
  return out;
}
// A loop that stalls looks broken on screen. Measure per-step change and refuse a dead pair.
async function motionProfile(bufs) {
  const ps = []; for (const b of bufs) ps.push(await px(b));
  const steps = [];
  for (let i = 1; i < ps.length; i++) { const a = ps[i - 1], b = ps[i]; let diff = 0, n = 0;
    for (let o = 0; o < a.d.length; o += 16) { diff += Math.abs(a.d[o + 3] - b.d[o + 3]) + Math.abs(a.d[o] - b.d[o]); n++; }
    steps.push(diff / n / 255); }
  return steps;
}
// "a bright violent snap in the middle of the loop" is a claim the art has to support: measure
// the brightest frame's light against the dimmest one's.
async function flashProfile(bufs) {
  const out = [];
  for (const b of bufs) { const p = await px(b); let lum = 0, n = 0;
    for (let i = 0; i < p.d.length; i += 4) { const a = p.d[i + 3] / 255; if (a < 0.05) continue; lum += a * (0.299 * p.d[i] + 0.587 * p.d[i + 1] + 0.114 * p.d[i + 2]); n++; }
    out.push(n ? lum / n : 0); }
  return out;
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
async function seat(raw, size, margin) {
  let content; try { content = await sharp(raw).trim({ threshold: 6 }).png().toBuffer(); } catch { content = await sharp(raw).png().toBuffer(); }
  const inner = Math.round(size * (1 - 2 * margin));
  const fitted = await sharp(content).resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'centre' }]).webp({ quality: 95, alphaQuality: 100 }).toBuffer();
}

// The seed is deliberately SMALL in its frame. The still is seated at 89% of its canvas, which
// is right for a static sprite but leaves the animator no room: asked for a snap and a flash, it
// grew the seal into all four borders and the union crop threw (attempt 1: "clipped at the source
// edge (left, top, right, bottom)"). The shipped 952px frames had the same problem baked in -
// qte_holy_4's ink measured 930x874, eleven pixels from the border. Handing the model a seal at
// 58% of the frame gives the flare somewhere to go, and the union crop scales the result back up,
// so the extra gutter costs no final resolution.
async function seedFor(buf, pad) {
  const inner = Math.round(1024 * pad);
  const small = await sharp(buf).resize(inner, inner, { fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: small, gravity: 'centre' }]).png().toBuffer();
}
async function animate(baseBuf, motion, size, prefix, dir, label) {
  const uri = 'data:image/png;base64,' + (await sharp(await seedFor(baseBuf, 0.58)).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
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
      for (let i = 0; i < packed.length; i++) {
        const cut = gateFlush(await px(packed[i]), `frame ${i}`);
        if (cut.length) {
          const dbg = process.env.MOJI_ART_DEBUG;
          if (dbg) { await mkdir(dbg, { recursive: true }); for (let j = 0; j < packed.length; j++) await writeFile(join(dbg, `${prefix}_rej${a}_${j}.webp`), packed[j]); console.log(`  (rejected frames dumped to ${dbg})`); }
          throw new Error(cut.join('; '));
        }
      }
      const steps = (await motionProfile(packed)).map((s) => +(s * 100).toFixed(2));
      console.log(`  ${label}: per-frame change ${steps.join(' / ')} %`);
      const dead = steps.filter((s) => s < 0.35);
      if (dead.length) throw new Error(`the loop stalls: ${dead.length} step(s) under 0.35% change`);
      const lum = await flashProfile(packed), ratio = Math.max(...lum) / Math.max(1, Math.min(...lum));
      console.log(`  ${label}: brightness peak/floor ${ratio.toFixed(2)}x`);
      if (ratio < 1.30) throw new Error(`the snap does not land: peak is only ${ratio.toFixed(2)}x the floor (want >= 1.30x)`);
      await mkdir(dir, { recursive: true });
      const written = [];
      for (let i = 0; i < FRAMES; i++) { const p = join(dir, `${prefix}_${i}.webp`); await writeFile(p + '.tmp', packed[i]); await rename(p + '.tmp', p); written.push(p); }
      let worst = 1e9;
      for (const f of written) { const bx = inkBox(await px(await readFile(f)));
        if (bx.x0 === 0 || bx.y0 === 0 || bx.x1 >= bx.W - 1 || bx.y1 >= bx.H - 1) throw new Error(`${f} touches the border after packing`);
        worst = Math.min(worst, bx.x0, bx.y0, bx.W - 1 - bx.x1, bx.H - 1 - bx.y1); }
      console.log(`  ${label}: ${FRAMES} frames written at ${size}px, no cut-off - tightest margin ${worst}px`);
      return;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} ANIM FAILED: ${last && last.message}`);
}
// ---- run --------------------------------------------------------------------
if (!has('--generate')) {
  console.log('DRY RUN - briefs only. Re-run with --generate (needs LUDO_API_KEY).\n');
  console.log('qte_holy seal:\n' + SEAL_PROMPT + '\n\nqte_holy motion:\n' + SEAL_MOTION + '\n');
  console.log('gate self-check against the SHIPPED art (it must FAIL, or the gate proves nothing):');
  const cur = await gateSeal(await px(await readFile(STILL_OUT)));
  console.log(`  shipped qte_holy.webp: aspect ${cur.aspect.toFixed(2)}, hue ${cur.hue == null ? 'n/a' : Math.round(cur.hue)}deg, fill ${Math.round(cur.fill * 100)}%`);
  console.log(cur.bad.length ? '  -> REJECTED: ' + cur.bad.join('; ') : '  -> it PASSES, so the gate does not discriminate - fix the gate');
  process.exit(0);
}
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
console.log('\n=== qte_holy - the judgement lockdown seal ===');
let chosen = null;
if (has('--anim-only')) chosen = await readFile(STILL_OUT);
else for (let roll = 1; roll <= ROLLS && !chosen; roll++) {
  const seated = await seat(await makeImage(SEAL_PROMPT, `seal roll ${roll}`), STILL_SIZE, 0.055);
  const p = await px(seated), g = await gateSeal(p);
  console.log(`  roll ${roll}: ink ${g.bx.w}x${g.bx.h} aspect ${g.aspect.toFixed(2)}, hue ${g.hue == null ? 'n/a' : Math.round(g.hue)}deg, fill ${Math.round(g.fill * 100)}% - ${g.bad.length ? 'REJECT: ' + g.bad.join('; ') : 'PASSES every gate'}`);
  if (!g.bad.length) { chosen = seated; await writeFile(STILL_OUT + '.tmp', seated); await rename(STILL_OUT + '.tmp', STILL_OUT); console.log(`  base -> Sprites/fx/qte_holy.webp at ${STILL_SIZE}px`); }
}
if (!chosen) { console.error('qte_holy: no roll passed the gates'); process.exit(2); }
if (!has('--still-only')) await animate(chosen, SEAL_MOTION, ANIM_SIZE, 'qte_holy', FX_ANIM, 'qte_holy');
console.log('\ndone.');
