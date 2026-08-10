#!/usr/bin/env node
// Gravitos per-attack cast animations (ludo.ai), generalised from the one-off
// Soul Drain script so the next attack costs a prompt, not a pipeline.
//   node scripts/generate_gravitos_attack_anim.mjs --attack laser --generate
//   ... --generate --force       # re-roll over existing frames
//   ... --salvage-only           # re-mask the kept raws, no API call
// Needs LUDO_API_KEY.
//
// Guarantees, all enforced rather than hoped for:
//   • CANVAS SIZE — every frame is emitted at the base sprite's exact
//     1656x1505, the size every other gravitos set uses, so nothing rescales
//     when the game swaps to it mid-fight.
//   • CHARACTER SIZE — the body's core height is held within tolerance of
//     gravitos.webp ITSELF (not merely of frame 0), so the character does not
//     jump size when the attack starts, and does not pulse across frames.
//   • NO EDGE CUTOFFS — no body pixel on the left/right/top edges. Bottom
//     contact is allowed: the source art stands with feet on the canvas floor.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites', 'bosses', 'gravitos.webp');
const OUT_DIR = join(repoRoot, 'Sprites', 'bosses', 'attack');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const FACING = ' Keep the EXACT same left/right facing and orientation as the ' +
  'source image — NEVER mirror or flip the character horizontally.';
// Hard-won boilerplate. The eagle model detonates a full-frame opaque blast on
// anything phrased as an outward burst — five Soul Drain rolls proved it — and
// the counter is to keep ALL energy ON the body and state the emptiness of the
// rest of the frame as a requirement.
// The laser roll also revealed a SECOND failure mode beyond the blast: the
// model pushed the CAMERA IN, turning frames 1-8 into a head-and-torso close-up
// with the head cropped. "Do not zoom" buried mid-paragraph was not enough, so
// framing now leads the clause and is stated in terms the model can measure:
// full figure, feet visible, small in frame, wide shot, identical crop.
const CONTAIN =
  ' FRAMING (most important): every frame is the SAME WIDE SHOT as the source ' +
  'image — the FULL FIGURE head to toe, feet visible, standing SMALL in the ' +
  'middle of a large mostly-empty frame, occupying the SAME modest fraction of ' +
  'the image as in the source. The camera NEVER moves, NEVER pushes in, NEVER ' +
  'zooms, NEVER crops to the torso or head. Do not enlarge him. Every frame ' +
  'has the IDENTICAL crop and the IDENTICAL character scale as frame one. ' +
  'CRITICAL: the REST of the frame stays completely EMPTY and TRANSPARENT — ' +
  'no background, no room-filling blast, no energy field, no glow clouds away ' +
  'from his body. At least a third of the image on every side of him remains ' +
  'fully transparent in EVERY frame. Never clip his head, arms, feet or any ' +
  'part at any edge. ONE single connected body; do not duplicate or detach ' +
  'limbs.' + FACING;

// Per user: both sets read as a standing pose with a glow — they "need more
// action". The punch set is the proof that action is achievable inside the
// framing rules: it grows 41% -> 59% WIDE mid-swing and still passes, because
// the growth is a limb extending, not a camera moving. So these prompts push
// big limb/torso movement while the camera language stays absolute, and the
// height tolerance is raised per-attack to admit a real pose without loosening
// the zoom or edge guards (those catch the failure that actually matters).
const ATTACKS = {
  // LASER SWEEP. The bolts themselves are game projectiles (skill 'gravbolt'),
  // so the sprite must NOT draw a beam — it only plays the caster. That is also
  // what keeps this inside the model's safe zone: a head-centred charge cannot
  // become a room-filling blast the way "fires a beam" reliably does.
  // Two rolls of "charges a targeting beam ... his eye and head ignite" both
  // made the model push the camera into a head-and-torso close-up: naming the
  // eye/head as the subject IS a request for a close-up, whatever the framing
  // clause says. The two sets that came back correctly framed (punch,
  // soulDrain) are both WHOLE-BODY actions, so this is rewritten as a
  // full-figure stance — the glow is incidental, the pose is the subject.
  // v2 (per user: "it needs more special effects"). The first pass was
  // deliberately bare because effects kept triggering a full-frame blast — but
  // the blast is SALVAGEABLE (the shroud contains it); the camera zoom is not.
  // So the effects come back in force, described as ORBITING and CLINGING
  // rather than radiating, and the shroud for this attack is widened so the
  // energy has room to bloom instead of being shaved to the silhouette.
  laser: { key: 'gravitoslaser', tol: 0.25, pad: 0.22, prompt:
    'the full-body dark cosmic robot warrior fires a shoulder-mounted weapon, ' +
    'shown head to toe. ONLY HIS ARMS, LEGS AND TORSO MOVE — he pulls both ' +
    'fists back beside his ribs and turns one shoulder forward, then punches ' +
    'both arms straight out wide to either side and plants one foot forward, ' +
    'shoulders squaring off, head level. Big clear limb movement between ' +
    'frames; his feet stay on the ground line and his head stays at the same ' +
    'height in every frame. ' +
    'ENERGY EFFECTS cling to and orbit him: magenta-pink and violet ' +
    'electricity crackling along his armour plates, jagged filaments wrapping ' +
    'his arms, cyan seams blazing white-hot, sparks and embers shedding off ' +
    'his shoulders, building to a blazing peak. All of it WRAPS AROUND HIM ' +
    'and hugs his outline — it does NOT radiate outward across the picture. ' +
    'Do NOT draw any beam, ray, laser line, bolt or projectile leaving his ' +
    'body, and no expanding shockwave or explosion.' + CONTAIN },
  // Regenerates the GENERIC attack set (Sprites/bosses/attack/gravitos_*), the
  // one drawn for every pattern without dedicated art — which is most of his
  // kit, so its stiffness is the most-seen animation on the boss.
  attack: { key: 'gravitos', tol: 0.25, pad: 0.30, prompt:
    'the full-body dark cosmic robot warrior throws a HEAVY TWO-FISTED SMASH, ' +
    'shown head to toe, with BIG dynamic movement between frames. He rears ' +
    'back and raises both fists high with his torso twisting, then drives them ' +
    'down and forward in a powerful overhead-to-chest smash, dropping into a ' +
    'wide braced stance with one leg forward and shoulders low. His silhouette ' +
    'changes dramatically frame to frame: tall and wound up, then broad and ' +
    'committed. ' +
    'Energy clings to him as he swings: cyan and violet power surging along ' +
    'his armour seams, sparks trailing off his fists, a tight impact flare at ' +
    'his hands on the strike. All effects HUG his body and follow his limbs — ' +
    'they do NOT radiate outward across the picture, and there is no ' +
    'expanding shockwave, no explosion and no projectile.' + CONTAIN },
};

const attack = arg('--attack') || 'laser';
if (!ATTACKS[attack]) { console.error(`unknown --attack ${attack}. known: ${Object.keys(ATTACKS).join(', ')}`); process.exit(1); }
const KEY = ATTACKS[attack].key || `gravitos${attack}`;
const TOL = ATTACKS[attack].tol || 0.14;
const RAW = join(repoRoot, 'scripts', `_tmp_${KEY}_raw`);
// A key that IS an existing boss sprite (gravitos) must never have its static
// written to Sprites/bosses/<key>.webp — that file is the boss's base sprite
// and this script's own input. Its attack static belongs in attack/.
const BASE_TYPES = new Set(['gravitos', 'gravitos2', 'gravitos3']);
const STATIC_OUT = BASE_TYPES.has(KEY)
  ? join(OUT_DIR, `${KEY}.webp`)
  : join(repoRoot, 'Sprites', 'bosses', `${KEY}.webp`);
// Belt and braces: refuse to run at all if the resolved static would clobber
// the input sprite.
if (STATIC_OUT === BASE) { console.error('refusing: static output would overwrite the base sprite'); process.exit(1); }

if (!has('--generate') && !has('--salvage-only')) {
  console.log(`# ${attack} -> Sprites/bosses/attack/${KEY}_0..8.webp + ${KEY}.webp static`);
  console.log('# Re-run with --generate (needs LUDO_API_KEY), or --salvage-only to re-mask kept raws.');
  process.exit(0);
}

// ---------- measurement helpers --------------------------------------------
// `dark:true` measures the ARMOUR rather than the lit envelope. Gravitos is
// dark navy/violet; his effects are bright pink, white and cyan. On an
// FX-heavy attack, opaque lightning above the head counts as "body" under a
// pure-alpha measure and reports the character as 20% taller than it is —
// which is a glow growing, not the sprite rescaling. Luminance gates it out.
async function coreMetrics(buf, dark) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1, sx = 0, sy = 0, n = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    if (data[i * 4 + 3] > 200 && (!dark || lum < 130)) {
      const x = i % info.width, y = (i / info.width) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      sx += x; sy += y; n++;
    }
  }
  return { w: info.width, h: info.height, minX, maxX, minY, maxY,
    cx: sx / n / info.width, cy: sy / n / info.height,
    bw: (maxX - minX + 1) / info.width, bh: (maxY - minY + 1) / info.height };
}
// Edge extents from FULL alpha — an aura touching the frame edge is a cutoff
// even though it is not armour.
async function edgeOf(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height;
  for (let i = 0; i < info.width * info.height; i++) if (data[i * 4 + 3] > 200) {
    const x = i % info.width, y = (i / info.width) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y;
  }
  return { minX, maxX, minY, w: info.width, h: info.height };
}
function gate(stats, baseM, label, badOut) {
  let bad = 0;
  const mgX = Math.ceil(stats[0].w * 0.005), mgY = Math.ceil(stats[0].h * 0.005);
  for (const s of stats) {
    const flag = [];
    if (s.minX <= mgX || s.minY <= mgY || s.maxX >= s.w - 1 - mgX) flag.push('CLIPS-EDGE');
    if (Math.abs(s.cx - baseM.cx) > 0.10) flag.push('DRIFTS-X');
    // CHARACTER SIZE vs the BASE SPRITE — this is the "same character size"
    // guarantee. Height is the stable axis: an attack may fling arms wide
    // (width grows) but a body that gets taller is the sprite rescaling.
    if (Math.abs(s.bh - baseM.bh) / baseM.bh > TOL) flag.push('SIZE-DRIFT');
    if (flag.length) { bad++; if (badOut) badOut.add(s.i); }
    console.log(`  ${label} ${s.i}: core ${Math.round(s.bw * 100)}%x${Math.round(s.bh * 100)}% (base ${Math.round(baseM.bh * 100)}%) cx ${s.cx.toFixed(3)}  ${flag.join(' ') || 'ok'}`);
  }
  return bad;
}
// Feathered shroud from a union of body silhouettes: keeps energy hugging the
// body, fades a room-filling blast to nothing. Deterministic.
//
// The silhouette source is NOT just this roll's clean frames. An outward-effect
// attack (laser) can blow out from frame 1, leaving too few clean frames to
// build from — so the union always includes the base sprite and the SHIPPED
// punch set, whose wide arm poses give the mask honest headroom for limbs.
// That makes salvage independent of how badly a given roll misbehaved.
// Per-attack shroud width. A tight shroud (soulDrain) shaves energy to the
// silhouette; an FX-heavy attack needs room to bloom, so `blur` widens the
// falloff and `gain` flattens it into a plateau before it fades. Wide enough
// for a storm around the body, still far short of the frame edges.
const SHROUD = { laser: { blur: 0.075, gain: 6 }, attack: { blur: 0.075, gain: 6 }, _default: { blur: 0.04, gain: 4 } };
async function shroudMask(frames, cleanIdx, W, H) {
  const cfg = SHROUD[attack] || SHROUD._default;
  const px = W * H, union = Buffer.alloc(px);
  const add = async (buf) => {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== W || info.height !== H) return;
    for (let i = 0; i < px; i++) if (data[i * 4 + 3] > 16) union[i] = 255;
  };
  await add(await readFile(BASE));
  for (let i = 0; i < 9; i++) {
    const p = join(OUT_DIR, `gravitospunch_${i}.webp`);
    if (existsSync(p)) await add(await readFile(p));
  }
  for (const ci of cleanIdx) await add(frames[ci]);
  // extractChannel is load-bearing: sharp promotes 1-channel raw to RGB through
  // blur, and without it every stride-1 read lands in the wrong row (that bug
  // once masked a whole animation to transparent while reporting success).
  const blurred = await sharp(union, { raw: { width: W, height: H, channels: 1 } })
    .blur(W * cfg.blur).extractChannel(0).raw().toBuffer();
  if (blurred.length !== px) throw new Error(`mask ${blurred.length} != ${px}`);
  const mask = Buffer.alloc(px);
  for (let i = 0; i < px; i++) mask[i] = Math.min(255, blurred[i] * cfg.gain);
  return mask;
}

// Armour bbox in PIXELS (dark opaque pixels — bright FX excluded), used by the
// padded-space scale normalizer.
async function armourBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1;
  for (let i = 0; i < info.width * info.height; i++) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    if (data[i * 4 + 3] > 200 && lum < 130) {
      const x = i % info.width, y = (i / info.width) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY, h: maxY - minY + 1 };
}
const baseMeta = await sharp(BASE).metadata();
const baseA_px = await armourBox(await readFile(BASE));
const baseM = await coreMetrics(await readFile(BASE), true);          // armour only
const baseA = await coreMetrics(await readFile(BASE));                // full alpha
console.log(`base: ${baseMeta.width}x${baseMeta.height}, core ${Math.round(baseM.bw * 100)}%x${Math.round(baseM.bh * 100)}% cx ${baseM.cx.toFixed(3)}`);

let finals = [];
if (has('--salvage-only')) {
  const files = (await readdir(RAW)).filter(f => /^raw_\d+\.png$/.test(f)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  for (const f of files.slice(0, FRAMES)) finals.push(await readFile(join(RAW, f)));
  console.log(`salvage-only: loaded ${finals.length} raws`);
} else {
  if (!has('--force') && existsSync(join(OUT_DIR, `${KEY}_0.webp`))) { console.log('frames exist; use --force'); process.exit(0); }
  const key = process.env.LUDO_API_KEY;
  if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
  // action-heavy sets get more room for flung limbs; cropped back off below
  const PAD = ATTACKS[attack].pad || 0.12;
  const _padX = Math.round(baseMeta.width * PAD), _padY = Math.round(baseMeta.height * PAD);
  const padded = await sharp(await readFile(BASE))
    .extend({ top: _padY, bottom: _padY, left: _padX, right: _padX, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const padMeta = await sharp(padded).metadata();
  const small = await sharp(padded).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();

  console.log(`animating ${attack} (eagle, ${FRAMES} frames, frame_size -9, pad ${Math.round(PAD * 100)}%)...`);
  const res = await fetch(`${API}/assets/sprite/animate`, {
    method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(300000),
    body: JSON.stringify({ initial_image: 'data:image/png;base64,' + small.toString('base64'),
      motion_prompt: ATTACKS[attack].prompt, frames: FRAMES, frame_size: -9, model: 'eagle',
      individual_frames: true, loop: false, image_type: 'sprite' }),
  });
  if (!res.ok) throw new Error(`animate ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const data = await res.json();
  const grab = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
  let cells = [];
  // Slice the spritesheet: individual_frame_urls wrongly SQUARE non-square
  // frames, which is what once gave gravitos "detached limbs".
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const sheet = await grab(data.spritesheet_url), sm = await sharp(sheet).metadata();
    const cw = Math.floor(sm.width / data.num_cols), chh = Math.floor(sm.height / data.num_rows);
    for (let r = 0; r < data.num_rows && cells.length < FRAMES; r++)
      for (let c = 0; c < data.num_cols && cells.length < FRAMES; c++)
        cells.push(await sharp(sheet).extract({ left: c * cw, top: r * chh, width: cw, height: chh }).png().toBuffer());
  } else { for (const u of (data.individual_frame_urls || []).slice(0, FRAMES)) cells.push(await grab(u)); }
  if (cells.length < FRAMES) throw new Error(`got ${cells.length} frames`);
  // Normalize scale IN PADDED SPACE, then crop (see _tmp_pipefix note: a crop
  // before scale-check amputated zoomed frames' legs and the foot-line anchor
  // then disguised it). Armour touching any padded edge = the model truncated
  // the body itself; nothing downstream can repair that, so the frame is
  // dropped here and the ping-pong builder works with what survives.
  const baseFootY = _padY + baseA_px.maxY;          // foot line, padded space
  const baseCX = _padX + (baseA_px.minX + baseA_px.maxX) / 2;
  for (let ci = 0; ci < cells.length; ci++) {
    const onPad = await sharp(cells[ci]).resize(padMeta.width, padMeta.height, { fit: 'fill' }).png().toBuffer();
    const a = await armourBox(onPad);
    const edge = a.minX <= 4 || a.minY <= 4 || a.maxX >= padMeta.width - 5 || a.maxY >= padMeta.height - 5;
    if (edge || a.h <= 0) {
      console.log(`  cell ${ci}: armour truncated at the padded edge — dropped`);
      finals.push(null);
      continue;
    }
    const k = baseA_px.h / a.h;
    const nw = Math.max(1, Math.round(padMeta.width * k)), nh = Math.max(1, Math.round(padMeta.height * k));
    const scaled = await sharp(onPad).resize(nw, nh, { fit: 'fill' }).png().toBuffer();
    const left = Math.round(baseCX - ((a.minX + a.maxX) / 2) * k);
    const top = Math.round((baseFootY + 1) - (a.maxY + 1) * k);
    finals.push(await sharp({ create: { width: padMeta.width, height: padMeta.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: scaled, left, top }]).png().toBuffer()
      .then(b2 => sharp(b2).extract({ left: _padX, top: _padY, width: baseMeta.width, height: baseMeta.height }).png().toBuffer()));
    console.log(`  cell ${ci}: armour ${Math.round(a.h)}px -> scaled x${k.toFixed(3)}, feet on the base foot line`);
  }
  const _distinct = finals.filter(Boolean).length;
  if (_distinct < 4) {
    console.error(`only ${_distinct}/9 cells survived the truncation check — a mirrored sequence needs at least 4 distinct poses. Re-roll.`);
    process.exit(2);
  }
  // When cells dropped, rebuild as a MIRROR of the surviving leading run:
  // wind-up to the last good pose, hold it briefly, recover back down. Every
  // frame differs from its neighbour except the short peak hold — unlike the
  // old nearest-neighbour backfill, which once emitted six copies of one frame
  // and shipped a freeze as an "animation".
  if (finals.some(f => !f)) {
    const run = [];
    for (let ci = 0; ci < finals.length; ci++) { if (!finals[ci]) break; run.push(ci); }
    console.log(`  rebuilding as mirror of leading run [${run.join(',')}]`);
    const peak = run[run.length - 1];
    const order = [...run];
    while (order.length < FRAMES - (run.length - 1)) order.push(peak);
    order.push(...run.slice(0, -1).reverse());
    finals = order.slice(0, FRAMES).map(i => finals[i]);
  }
  await mkdir(RAW, { recursive: true });
  for (let i = 0; i < FRAMES; i++) await writeFile(join(RAW, `raw_${i}.png`), finals[i]);
}

// ---------- gate, salvage if needed, gate again ----------------------------
let stats = [];
for (let i = 0; i < FRAMES; i++) stats.push({ i, ...(await coreMetrics(finals[i], true)), ...(await edgeOf(finals[i])) });
console.log('\nraw frames:');
const rawBad = new Set();
let bad = gate(stats, baseM, 'raw', rawBad);

if (bad) {
  const clean = stats.filter(s => Math.abs(s.bh - baseM.bh) / baseM.bh <= TOL).map(s => s.i);
  console.log(`\n${bad} frame(s) off — salvaging (shroud: base sprite + punch set + clean frames [${clean.join(', ') || 'none'}])`);
  const mask = await shroudMask(finals, clean, baseMeta.width, baseMeta.height);
  const px = baseMeta.width * baseMeta.height;
  const out = [];
  for (const f of finals) {
    const { data } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const d = Buffer.from(data);
    for (let p = 0; p < px; p++) d[p * 4 + 3] = Math.min(d[p * 4 + 3], mask[p]);
    out.push(await sharp(d, { raw: { width: baseMeta.width, height: baseMeta.height, channels: 4 } }).png().toBuffer());
  }
  // A shroud fixes BLEED (glow spilling past the body). It cannot fix a ZOOM —
  // if the model moved the camera in, the mask just slices through solid body
  // and the result is a cropped torso that still measures "in tolerance",
  // because masking changes the very metric the gate reads. So: measure how
  // much OPAQUE content each mask removed. A bleed loses diffuse glow; a zoom
  // loses the character. >35% opaque loss means the frame was mis-framed, not
  // over-lit, and no amount of masking will make it usable.
  let zoomed = 0;
  const badIdx = new Set();
  for (let i = 0; i < FRAMES; i++) {
    const a = await sharp(finals[i]).ensureAlpha().raw().toBuffer();
    const b = await sharp(out[i]).ensureAlpha().raw().toBuffer();
    let was = 0, kept = 0;
    for (let p = 0; p < px; p++) { if (a[p * 4 + 3] > 200) { was++; if (b[p * 4 + 3] > 200) kept++; } }
    const lost = was ? 1 - kept / was : 0;
    if (lost > 0.35) { zoomed++; badIdx.add(i); console.log(`  frame ${i}: mask removed ${Math.round(lost * 100)}% of opaque body — ZOOMED/MIS-FRAMED, not salvageable`); }
  }
  // Decide usability AFTER the shroud, not before. Edge bleed is exactly what
  // the shroud fixes, so judging on the raw gate threw away good FX-heavy
  // frames; only the zoom test (which compares pre/post opaque loss) says a
  // frame is truly unusable. A frame is usable when it is not zoomed AND it
  // passes the gate once shrouded.
  const postStats = [];
  for (let i = 0; i < FRAMES; i++) postStats.push({ i, ...(await coreMetrics(out[i], true)), ...(await edgeOf(out[i])) });
  const postBad = new Set();
  gate(postStats, baseM, 'post', postBad);
  const usable = [];
  for (let i = 0; i < FRAMES; i++) { if (badIdx.has(i) || postBad.has(i)) break; usable.push(i); }
  console.log(`usable leading run after salvage: [${usable.join(',') || 'none'}]`);
  if (zoomed || usable.length < FRAMES) {
    if (!has('--no-pingpong') && usable.length >= 4) {
      const peak = usable[usable.length - 1];
      const holds = FRAMES - (usable.length * 2 - 1);
      const order = [...usable, ...Array(Math.max(0, holds)).fill(peak), ...usable.slice(0, -1).reverse()].slice(0, FRAMES);
      console.log(`building from the usable run as ${order.join(',')}`);
      const seq = order.map(i => out[i]);
      await mkdir(OUT_DIR, { recursive: true });
      for (let i = 0; i < FRAMES; i++)
        await writeFile(join(OUT_DIR, `${KEY}_${i}.webp`), await sharp(seq[i]).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
      await writeFile(STATIC_OUT, await sharp(seq[Math.floor(FRAMES / 2)]).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
      const fin = [];
      for (let i = 0; i < FRAMES; i++) fin.push({ i, ...(await coreMetrics(seq[i], true)), ...(await edgeOf(seq[i])) });
      console.log('\nfinal sequence:');
      if (gate(fin, baseM, 'out', null)) { console.error('rebuilt sequence still fails'); process.exit(2); }
      console.log(`\nOK -> ${FRAMES} frames + static, all ${baseMeta.width}x${baseMeta.height} (mirrored from ${usable.length} unique)`);
      process.exit(0);
    }
  }
  if (zoomed) {
    // The model reliably holds framing for the first few frames and then
    // degrades into a close-up. Rather than buy roll after roll hoping all 9
    // land, build the sequence from the LEADING CLEAN RUN and mirror it: a
    // coil-and-fire that recovers to its opening pose. Every emitted frame is
    // then verified art, the motion is smooth, and it ends where it began —
    // the same shape the shipped Soul Drain set has.
    // The clean run ends at the first frame failing EITHER check. The zoom
    // creeps in gradually: the frame where it starts still passes the
    // mask-loss test but already reads visibly larger with the feet cropped,
    // and only the height check catches it. Trusting the mask test alone put
    // that frame in as the animation's peak.
    const firstBad = Math.min(...[...Array(FRAMES).keys()].filter(i => badIdx.has(i) || rawBad.has(i)));
    const run = [...Array(firstBad).keys()];
    if (!has('--no-pingpong') && run.length >= 4) {
      const peak = run[run.length - 1];
      const holds = FRAMES - (run.length * 2 - 1);
      const order = [...run, ...Array(Math.max(0, holds)).fill(peak), ...run.slice(0, -1).reverse()].slice(0, FRAMES);
      console.log(`\nzoom begins at frame ${firstBad}; building from the clean run [${run.join(',')}] as ${order.join(',')}`);
      finals = order.map(i => finals[i]);
      stats = [];
      for (let i = 0; i < FRAMES; i++) stats.push({ i, ...(await coreMetrics(finals[i])) });
      console.log('\nrebuilt sequence:');
      bad = gate(stats, baseM, 'out', null);
      if (!bad) {
        await mkdir(OUT_DIR, { recursive: true });
        for (let i = 0; i < FRAMES; i++)
          await writeFile(join(OUT_DIR, `${KEY}_${i}.webp`), await sharp(finals[i]).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
        await writeFile(STATIC_OUT, await sharp(finals[Math.floor(FRAMES / 2)]).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
        console.log(`\nOK -> ${FRAMES} frames + static, all ${baseMeta.width}x${baseMeta.height} (mirrored from ${run.length} unique)`);
        process.exit(0);
      }
    }
    console.error(`\n${zoomed} frame(s) are zoomed or mis-framed and the clean run is too short. Raws kept in ${RAW}.`);
    process.exit(3);
  }
  finals = out;
  stats = [];
  for (let i = 0; i < FRAMES; i++) stats.push({ i, ...(await coreMetrics(finals[i], true)), ...(await edgeOf(finals[i])) });
  console.log('\nafter salvage:');
  bad = gate(stats, baseM, 'out');
}
if (bad) { console.error(`\n${bad} frame(s) still fail — raws kept in ${RAW}. Re-roll or adjust the prompt.`); process.exit(2); }

await mkdir(OUT_DIR, { recursive: true });
for (let i = 0; i < FRAMES; i++)
  await writeFile(join(OUT_DIR, `${KEY}_${i}.webp`), await sharp(finals[i]).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
await writeFile(STATIC_OUT, await sharp(finals[FRAMES - 1]).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
console.log(`\nOK -> ${FRAMES} frames + static, all ${baseMeta.width}x${baseMeta.height}`);
