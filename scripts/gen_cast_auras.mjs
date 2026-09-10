#!/usr/bin/env node
// Regenerate the monster CAST-FLASH auras (Sprites/projectiles/cast/*.webp) in the house style.
//
// Per user (2026-09-10, with cast/mspore.webp attached): "regenerate the sprites from
// Sprites/projectiles/cast ... make the art good, similar to mspore as per the attached image
// style". The reference is the pink spore flash shipped in v0.30.533: ONE round burst of light with
// two crescent arcs sweeping out either side, a thick near-black keyline, soft cel shading, one
// glossy highlight, a fully transparent background with an even margin. The other 23 files are the
// v0.26.204 pack - literal objects (a cookie, a ticket, a roll of bandage, a punching fist) in a
// flatter, heavier style with ground shadows on some. This regenerates those 23 as burst GLYPHS in
// the spore's composition and idiom, each in its own element's palette; mspore itself is the
// reference and is not touched.
//
// Where they are drawn: drawMonster blits the aura at the monster's centre, m.w x 1.6, growing
// from 0.6x to 1.1x and fading 0.85 -> 0 over LX_MOB_CAST_DURATION, with globalCompositeOperation
// 'lighter'. Additive blending means the keyline itself adds nothing on screen and DARK bodies
// vanish - so every prompt asks for a BRIGHT core and bright edge light, and a gate below refuses
// a candidate that would be invisible under 'lighter'.
//
// Refuses rather than ships: a candidate must be on a transparent ground with nothing on the
// border, roughly square (it is blitted into a square box), carry a real keyline, be mostly ITS
// element's hue (or mostly neutral, for the bone / stone / linen glyphs), and be bright enough to
// read additively. Every candidate is dumped to CAST_DUMP_DIR (default scripts/_tmp_cast) so a
// refused roll can be looked at; nothing is written to Sprites/ until a roll passes.
//
//   node scripts/gen_cast_auras.mjs                      # dry run: prints every prompt
//   node scripts/gen_cast_auras.mjs --generate           # all 23 (needs LUDO_API_KEY)
//   node scripts/gen_cast_auras.mjs --generate --only=mbloodbolt,mink
//   node scripts/gen_cast_auras.mjs --rejudge --only=mink   # re-gate the dumped candidates, no API call
//   flags: --rolls=<per key, default 3>
//
// Loosened per user ("make the style less strict for the remainder") after the first run refused
// four keys three times each on margins, not on art: mhornshot at aspect 1.42-1.52 against a 1.4
// ceiling the reference itself (1.35) nearly fails, mforgespark and mstarshot at 52-54% in-band
// against 55%, mink at 43-49% near-black against 40% while still 22-27% bright. The gates that
// are about correctness (transparent ground, nothing on the border, bright enough to read under
// 'lighter') stay; the ones that were taste are wider, and the prompt no longer forbids accent
// colours or insists on one exact composition.
import sharp from 'sharp';
import { writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'Sprites', 'projectiles', 'cast');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const a = argv.find((x) => x.startsWith(f + '=')); return a ? a.split('=')[1] : d; };
const ROLLS = Number(val('--rolls', 3));
const DUMP = process.env.CAST_DUMP_DIR || join(ROOT, 'scripts', '_tmp_cast');
const S = 768;   // the endpoint returns 768px; seat() never enlarges

// The reference prompt's shape, lifted from gen_mspore_pod.mjs --cast (the roll that shipped the
// attached image). Only the theme sentence and the palette clause change per key.
const HEAD = 'A magical CAST FLASH glyph for a 2D game: ';
const TAIL = ' Chunky chibi cartoon style, bold clean shapes, soft cel shading, glossy highlights, cheerful, a bright '
  + 'luminous core. The burst may be any energetic shape - arcs, rays, rings, wisps or shards - as long as it is ONE '
  + 'compact glyph centred in frame. Flat 2D game sprite on a fully transparent background, drawn COMPLETE with a '
  + 'clear even margin on all four sides - nothing touching or running off the edge. No text, no letters, '
  + 'no watermark, no background, no creature, no face, no character.';
const prompt = (theme, palette) => HEAD + theme + ' Mainly coloured in ' + palette + ', with a thick near-black outline.' + TAIL;

// Per user ("because there should be some variety"): the first nineteen share the spore's orb-and-
// crescents composition; the four below were given their OWN burst shapes instead, and the prompt
// tail now says any energetic shape will do. Re-roll any of the nineteen the same way if the set
// reads too uniform - change the theme sentence, not the style tail.
// hue: [lo, hi] in degrees (wrapping allowed) that the coloured pixels must mostly fall in;
// mono: true for glyphs that are meant to be mostly white / cream / grey.
const KEYS = {
  mbloodbolt:  { hue: [335, 20], palette: 'white, bright crimson RED and deep blood red', not: 'no blue, no green, no yellow, no purple',
    theme: 'a bright round burst of crimson blood light with two curved crescent splash arcs sweeping out to either side of it and a few round droplets flicking off, like a spray of energy released.' },
  mbonechip:   { mono: true, palette: 'white, ivory and pale warm cream', not: 'no strong colour at all, no blue, no green, no red',
    theme: 'a bright round burst of pale bone light with two curved crescent bone-shard arcs sweeping out to either side of it and small bone chips flicking off.' },
  mbubble:     { hue: [170, 210], palette: 'white, bright aqua CYAN and deep teal-blue', not: 'no red, no pink, no yellow, no green',
    theme: 'a bright round water-bubble burst with two curved crescent ripple arcs sweeping out to either side of it and a few small round droplets flicking off.' },
  mcookie:     { hue: [15, 45], palette: 'white, warm caramel ORANGE-BROWN and deep chocolate brown', not: 'no blue, no green, no pink, no purple',
    theme: 'a bright round burst of warm golden cookie-crumb light with two curved crescent arcs sweeping out to either side of it and small chocolate-chip crumbs flicking off.' },
  mdark:       { hue: [255, 300], palette: 'white, bright electric VIOLET and deep dark purple', not: 'no red, no green, no yellow, no orange',
    theme: 'a bright round burst of void light, a glowing violet-white core rimmed with deep purple, with two curved crescent shadow arcs sweeping out to either side of it and a few dark motes flicking off.' },
  memberspark: { hue: [15, 50], palette: 'white, bright ORANGE and hot yellow', not: 'no blue, no green, no pink, no purple',
    theme: 'a bright round ember flare with two curved crescent flame arcs sweeping out to either side of it and small hot sparks flicking off.' },
  mforgespark: { hue: [20, 55], palette: 'white, bright molten ORANGE and gold', not: 'no blue, no green, no pink, no purple',
    theme: 'a burst of white-hot forge sparks - a radiating star of sharp spark rays and molten droplets flying outward from a small glowing core, like metal struck on an anvil.' },
  mghostshot:  { hue: [255, 300], palette: 'white, pale lavender and bright VIOLET', not: 'no red, no green, no yellow, no orange',
    theme: 'a bright round burst of phantom violet light with two curved crescent ripple arcs sweeping out to either side of it and a few ghostly wisps curling off.' },
  mholybeam:   { hue: [38, 62], palette: 'white, bright GOLD and warm yellow', not: 'no blue, no green, no red, no purple',
    theme: 'a bright round burst of divine gold light with two curved crescent halo arcs sweeping out to either side of it and small rays of light flicking off.' },
  mhornshot:   { mono: true, palette: 'white, warm cream and pale bone-tan', not: 'no strong colour at all, no blue, no green, no red',
    theme: 'a bone-tan flare shaped like two thick curved horns crossing in a V, with a bright glowing core between the horn tips and small bone chips flying off.' },
  micicle:     { hue: [175, 225], palette: 'white, pale ice CYAN and clear sky blue', not: 'no red, no pink, no yellow, no green',
    theme: 'a bright round burst of pale frost light with two curved crescent ice-crystal arcs sweeping out to either side of it and small ice shards flicking off.' },
  mink:        { hue: [265, 320], palette: 'white, bright MAGENTA-violet and deep ink purple', not: 'no red, no green, no yellow, no orange',
    theme: 'an ink splat - a glowing magenta-white core inside a splash of deep violet ink with irregular splash lobes and round droplets flying outward, glossy and wet.' },
  mlantern:    { hue: [75, 150], palette: 'white, bright acid GREEN and pale yellow-green', not: 'no red, no blue, no orange, no purple',
    theme: 'a bright round burst of eerie green soul-flame light with two curved crescent flame arcs sweeping out to either side of it and small wisps flicking off.' },
  morange:     { hue: [18, 48], palette: 'white, bright citrus ORANGE and warm yellow', not: 'no blue, no green, no pink, no purple',
    theme: 'a bright round burst of citrus orange light with two curved crescent peel-slice arcs sweeping out to either side of it and small juice droplets flicking off.' },
  msplinter:   { hue: [18, 48], palette: 'white, warm AMBER wood-brown and pale tan', not: 'no blue, no green, no pink, no purple',
    theme: 'a bright round burst of amber wood light with two curved crescent splinter arcs sweeping out to either side of it and small wood chips flicking off.' },
  mstarshot:   { hue: [40, 65], palette: 'white, pale starlight YELLOW and soft cream', not: 'no red, no green, no orange, no purple',
    theme: 'a starlight twinkle - one big glossy four-point star with a bright white core and soft yellow glow, smaller stars and sparkle dots scattered around it.' },
  mstinger:    { hue: [30, 58], palette: 'white, bright honey AMBER and gold', not: 'no blue, no green, no pink, no purple',
    theme: 'a bright round burst of honey-amber light with two curved crescent arcs sweeping out to either side of it and small sting sparks flicking off.' },
  mstone:      { mono: true, palette: 'white, pale grey and warm beige', not: 'no strong colour at all, no blue, no green, no red',
    theme: 'a bright round burst of dust-cloud light with two curved crescent arcs sweeping out to either side of it and small stone chips flicking off.' },
  mticket:     { hue: [38, 62], palette: 'white, bright GOLD and warm yellow', not: 'no blue, no green, no red, no purple',
    theme: 'a bright round burst of golden light with two curved crescent arcs sweeping out to either side of it and small confetti scraps flicking off.' },
  mtidemark:   { hue: [70, 140], palette: 'white, sickly pale GREEN and dark olive', not: 'no red, no blue, no orange, no purple',
    theme: 'a bright round burst of withered green glyph light with two curved crescent vine-tendril arcs sweeping out to either side of it and small leaves flicking off.' },
  mtoxic:      { hue: [75, 150], palette: 'white, bright toxic LIME GREEN and deep green', not: 'no red, no blue, no orange, no purple',
    theme: 'a bright round burst of toxic green light with two curved crescent arcs sweeping out to either side of it and small bubbling drops flicking off.' },
  mvoltzap:    { hue: [42, 66], palette: 'white, bright electric YELLOW and pale gold', not: 'no red, no green, no blue, no purple',
    theme: 'a bright round burst of yellow lightning light with two curved crescent arcs sweeping out to either side of it and small jagged sparks flicking off.' },
  mwrap:       { mono: true, palette: 'white, pale cream and faded linen beige', not: 'no strong colour at all, no blue, no green, no red',
    theme: 'a bright round burst of pale linen-white light with two curved crescent bandage-strip arcs sweeping out to either side of it and small loose threads flicking off.' },
};

// ---- measurement ------------------------------------------------------------------------------
async function px(buf, size = 256) {
  const { data, info } = await sharp(buf).resize(size, size, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, W: info.width, H: info.height };
}
const hueOf = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn; if (!c) return 0;
  let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; h *= 60; return h < 0 ? h + 360 : h; };
const inBand = (h, [lo, hi]) => lo <= hi ? (h >= lo && h <= hi) : (h >= lo || h <= hi);
function measure(p, spec) {
  const { d, W, H } = p; let ink = 0, x0 = W, y0 = H, x1 = -1, y1 = -1, op = 0, dark = 0, bright = 0, sat = 0, band = 0, light = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, a = d[i + 3]; if (a <= 16) continue; ink++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (a < 200) continue; op++;
    const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (mx < 70) dark++; if (lum > 150) bright++; if (mx > 150) light++;
    const s = mx ? (mx - mn) / mx : 0; if (s >= 0.35 && mx >= 64) { sat++; if (spec.hue && inBand(hueOf(r, g, b), spec.hue)) band++; } }
  const corners = [0, (W - 1) * 4, (H - 1) * W * 4, ((H - 1) * W + W - 1) * 4].map((i) => d[i + 3]);
  return { ink, fill: ink / (W * H), border: x0 <= 0 || y0 <= 0 || x1 >= W - 1 || y1 >= H - 1, aspect: (x1 - x0 + 1) / (y1 - y0 + 1), corners: Math.max(...corners),
    dark: op ? dark / op : 0, bright: op ? bright / op : 0, light: op ? light / op : 0, sat: op ? sat / op : 0, band: sat ? band / sat : 0 };
}
function gate(m, spec) {
  const bad = [], pc = (v) => (100 * v).toFixed(0) + '%';
  if (m.corners > 8) bad.push(`background is not transparent (corner alpha ${m.corners})`);
  if (m.border) bad.push('ink on the canvas border');
  if (m.fill < 0.12) bad.push(`almost empty (${pc(m.fill)} of the canvas)`);
  if (m.fill > 0.72) bad.push(`a filled slab, not a glyph (${pc(m.fill)} of the canvas)`);
  if (m.aspect < 0.6 || m.aspect > 1.6) bad.push(`not a square-ish glyph (aspect ${m.aspect.toFixed(2)}; it is blitted into a square box)`);   // the crescents make the reference itself 1.35; the first run refused 1.46 and 1.55 for nothing
  if (m.dark < 0.03) bad.push(`no keyline (${(100 * m.dark).toFixed(1)}% near-black, want >= 3%)`);
  if (m.dark > 0.55) bad.push(`mostly black (${pc(m.dark)}) - it would vanish under lighter blending`);
  if (m.bright < 0.20) bad.push(`too dim to read additively (${pc(m.bright)} bright pixels, want >= 20%)`);
  if (spec.mono) {
    if (m.sat > 0.45) bad.push(`meant to be neutral but ${pc(m.sat)} is saturated colour (want <= 45%)`);
    if (m.light < 0.50) bad.push(`a neutral glyph must be mostly light (${pc(m.light)}, want >= 50%)`);
  } else {
    if (m.sat < 0.15) bad.push(`hardly any colour (${pc(m.sat)} saturated, want >= 15%)`);
    if (m.band < 0.40) bad.push(`off-palette: only ${pc(m.band)} of its colour is in the ${spec.hue[0]}-${spec.hue[1]} hue band (want >= 40%)`);
  }
  return bad;
}
const line = (m) => `fill ${(100 * m.fill).toFixed(0)}% aspect ${m.aspect.toFixed(2)} keyline ${(100 * m.dark).toFixed(1)}% bright ${(100 * m.bright).toFixed(0)}% sat ${(100 * m.sat).toFixed(0)}% band ${(100 * m.band).toFixed(0)}%${m.border ? ' BORDER' : ''}`;

// ---- seat + encode: the spore's own pipeline - trim, fit inside 88%, never enlarge, lossless
// until the single final encode ------------------------------------------------------------------
async function seat(raw) {
  let content; try { content = await sharp(raw).trim({ threshold: 10 }).png().toBuffer(); } catch { content = await sharp(raw).png().toBuffer(); }
  const cm = await sharp(content).metadata();
  const inner = Math.min(Math.round(S * 0.88), Math.max(cm.width, cm.height)), CAN = Math.round(inner / 0.88);
  const fitted = await sharp(content).resize(inner, inner, { fit: 'inside', withoutEnlargement: true, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: CAN, height: CAN, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fitted, gravity: 'centre' }]).png().toBuffer();
}
const encode = (png) => sharp(png).webp({ quality: 98, alphaQuality: 100, effort: 6 }).toBuffer();

// ---- API --------------------------------------------------------------------------------------
const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
async function makeImage(text, label) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000), body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: text }) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0] && data[0].url : (data && (data.url || (data.images && data.images[0] && data.images[0].url)));
      if (!url) throw new Error('no url in the response');
      return await fetchBuf(url);
    } catch (e) { last = e; console.log(`  ${label} attempt ${a} failed: ${e.message}`); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} FAILED: ${last && last.message}`);
}

// ---- main -------------------------------------------------------------------------------------
const only = val('--only', '').split(',').filter(Boolean);
const keys = Object.keys(KEYS).filter((k) => !only.length || only.includes(k));
for (const k of only) if (!KEYS[k]) { console.error('unknown key ' + k); process.exit(1); }
if (!has('--generate')) { console.log('DRY RUN - ' + keys.length + ' keys\n'); for (const k of keys) console.log(k + ':\n  ' + prompt(KEYS[k].theme, KEYS[k].palette) + '\n'); process.exit(0); }
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
await mkdir(DUMP, { recursive: true });
const written = [], failed = [];
const install = async (k, out) => { const dst = join(OUT_DIR, k + '.webp'); await writeFile(dst + '.tmp', out); await rename(dst + '.tmp', dst); console.log(`  -> Sprites/projectiles/cast/${k}.webp (${Math.round(out.length / 1024)}KB)`); };
if (has('--rejudge')) {
  const fsn = await import('node:fs');
  for (const k of keys) {
    const spec = KEYS[k]; let done = false;
    for (const fname of fsn.readdirSync(DUMP).filter((x) => x.startsWith(k + '_r') && x.endsWith('.webp')).sort()) {
      const out = fsn.readFileSync(join(DUMP, fname)); const m = measure(await px(out), spec), bad = gate(m, spec);
      console.log(`${k} rejudge ${fname}: ${line(m)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : done ? 'passes (already installed an earlier roll)' : 'PASSES'}`);
      if (!bad.length && !done) { await install(k, out); done = true; }
    }
    (done ? written : failed).push(k);
  }
  console.log(`\nrejudged - written ${written.length}: ${written.join(' ')}\nstill failing ${failed.length}: ${failed.join(' ') || '-'}`);
  process.exit(failed.length ? 2 : 0);
}
for (const k of keys) {
  const spec = KEYS[k]; let done = false;
  for (let roll = 1; roll <= ROLLS && !done; roll++) {
    const seated = await seat(await makeImage(prompt(spec.theme, spec.palette), `${k} roll ${roll}`));
    const out = await encode(seated); await writeFile(join(DUMP, `${k}_r${roll}.webp`), out);
    const m = measure(await px(out), spec), bad = gate(m, spec);
    console.log(`${k} roll ${roll}: ${line(m)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES'}`);
    if (!bad.length) { await install(k, out); written.push(k); done = true; }
  }
  if (!done) failed.push(k);
}
console.log(`\nwritten ${written.length}: ${written.join(' ')}\nfailed ${failed.length}: ${failed.join(' ') || '-'}`);
process.exit(failed.length ? 2 : 0);
