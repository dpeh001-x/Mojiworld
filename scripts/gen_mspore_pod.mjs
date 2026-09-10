#!/usr/bin/env node
// Sprites/projectiles/mspore.webp — the shared mob spore pod, recoloured and turned to face right.
// ============================================================================
// Per user: "regenerate a similar cute looking mspore sprite, white pink and red colour, make it
// direction sensitive facing right".
//
// A NEW FILE, not an edit to scripts/gen_projectile_restyle.mjs. That script is the shared
// four-sprite restyle pass (mcoffinshard / mspine / mspore / p_pincer) and re-running it would
// regenerate three sprites nobody asked about. This targets the one.
//
// WHAT IT HAS TO MATCH. mspore is the house reference for the mob-projectile look - the changelog
// calls it that by name - so "similar" is a hard constraint, not a vibe: chunky chibi pod, thick
// near-black outline, soft cel shading, one glossy highlight, a simple dot-eyed face. Only the
// palette and the facing change.
//
// WHERE IT IS DRAWN. Seven monsters fire it, the Shroom among them. The draw branch blits it into
// a SQUARE box at p.w, which is 31 px on screen - so the silhouette has to survive a thumbnail, and
// the face has to read at about a third the size of this comment's line height. That is why the
// brief asks for two big eyes and one thick mouth and nothing else.
//
// FACING RIGHT IS HALF ART AND HALF ENGINE. The mspore branch is a plain drawImage with no rotation
// and no flip (unlike msplinter, which rotates to velocity because it "has a clear pointy tip"), so
// directional art on its own would point backwards on every leftward shot. The game-side flip ships
// with this art; the gate below only proves the ART faces right.
//
//   node scripts/gen_mspore_pod.mjs                # brief + what is shipped today
//   node scripts/gen_mspore_pod.mjs --generate     # needs LUDO_API_KEY
//   flags: --rolls N
import sharp from 'sharp';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Sprites', 'projectiles', 'mspore.webp');
const S = 640;
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const ROLLS = Number(argOf('--rolls', '6'));

const PROMPT =
  'A cute round SPORE POD creature for a 2D game, seen from the side and LOOKING TO THE RIGHT. '
  + 'A plump white puffball body with a soft ruffled frill around it, capped and speckled with '
  + 'bright PINK and deep RED - a red cap on top, pink spots and small pink bubbles clinging to the '
  + 'side, a pale pink blush. '
  + 'Its FACE is turned to the RIGHT side of the body, near the right edge: two big simple black '
  + 'dot eyes and one small happy curved mouth, all placed in the RIGHT half of the pod and looking '
  + 'off to the right. Nothing on the left half but the body and its frill, so the creature clearly '
  + 'faces right the way a fish or a bird does. '
  + 'Chunky chibi cartoon style, bold clean shapes, a THICK near-black outline all the way round, '
  + 'soft cel shading with one glossy white highlight. Cheerful and friendly, not scary. '
  + 'Colours are ONLY white, pink and red with the black outline - no green, no blue, no purple, '
  + 'no orange, no yellow. '
  + 'Flat 2D game sprite on a fully transparent background, the whole creature drawn COMPLETE with '
  + 'a clear even margin on all four sides - nothing touching or running off the edge of the frame. '
  + 'No text, no letters, no watermark, no background scenery, no ground, no shadow.';

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const ALPHA_ON = 16;

function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: mx ? d / mx : 0, v: mx / 255 };
}
async function px(buf, n) {
  const p = n ? sharp(buf).resize(n, n, { fit: 'fill' }) : sharp(buf);
  const { data, info } = await p.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}
function inkBox(p) {
  let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3] > ALPHA_ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('fully transparent');
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, W: p.w, H: p.h };
}
// WHICH WAY IS IT LOOKING. The dark facial features are the only thing that says so, and the thick
// house outline is also near-black - so the outline has to be excluded or it drowns the signal.
// Erode the silhouette by 7% of the body width and read only the dark pixels that survive: those
// are eyes and mouth, not the rim. Their centroid, as a signed fraction of the body half-width, is
// the facing. The shipped mint pod scores about 0 because its face is dead centre.
function facing(p) {
  const b = inkBox(p);
  const on = (x, y) => x >= 0 && y >= 0 && x < p.w && y < p.h && p.d[(y * p.w + x) * 4 + 3] > ALPHA_ON;
  const r = Math.max(2, Math.round(b.w * 0.07));
  let sx = 0, n = 0;
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    if (!on(x, y)) continue;
    // inside-the-body test: every sample at radius r in four directions must still be opaque
    if (!(on(x - r, y) && on(x + r, y) && on(x, y - r) && on(x, y + r))) continue;
    const i = (y * p.w + x) * 4;
    const v = Math.max(p.d[i], p.d[i + 1], p.d[i + 2]);
    if (v < 90) { sx += x; n++; }          // a dark feature well inside the silhouette
  }
  if (!n) return { bias: 0, n: 0 };
  const mid = (b.x0 + b.x1) / 2;
  return { bias: ((sx / n) - mid) / (b.w / 2), n };
}
function palette(p) {
  let white = 0, pinkRed = 0, off = 0, n = 0;
  for (let i = 0; i < p.d.length; i += 4) {
    if (p.d[i + 3] <= ALPHA_ON) continue;
    n++;
    const c = hsv(p.d[i], p.d[i + 1], p.d[i + 2]);
    if (c.v < 0.22) continue;                             // the outline and the eyes
    if (c.s < 0.16) { if (c.v > 0.72) white++; continue; } // white body / highlight
    if (c.h >= 320 || c.h <= 18) pinkRed++;                // pink and red
    else off++;                                            // any other hue at all
  }
  return { whitePct: 100 * white / Math.max(1, n), pinkPct: 100 * pinkRed / Math.max(1, n), offPct: 100 * off / Math.max(1, n) };
}

function gate(p, label) {
  const bad = [], b = inkBox(p), f = facing(p), c = palette(p);
  if (b.x0 === 0 || b.y0 === 0 || b.x1 >= b.W - 1 || b.y1 >= b.H - 1) bad.push(`${label}: ink on the canvas border - the pod is cut off`);
  // FACING RIGHT, the whole point of the request. The shipped mint pod scores about 0.00 because
  // its face is dead centre; anything at or below that is not a right-facing creature, it is a
  // front-facing one that happens to have a bubble on the right.
  if (f.n < 40) bad.push(`${label}: no dark facial features found inside the body (${f.n} px) - there is no face to read a direction from`);
  else if (f.bias < 0.14) bad.push(`${label}: not facing right - the eyes and mouth sit ${f.bias >= 0 ? 'only ' : ''}${(100 * f.bias).toFixed(0)}% of the way toward the right edge (want >= 14%; the shipped front-facing pod scores about 0)`);
  // WHITE PINK AND RED (per user), enforced by hue rather than hoped for. The sprite being replaced
  // is 38% green and 28% blue, so "no other hue" is the actual ask.
  if (c.offPct > 6) bad.push(`${label}: off-palette - ${c.offPct.toFixed(1)}% of it is a hue that is neither pink nor red nor white (want <= 6%; the mint pod scores 66%)`);
  if (c.pinkPct < 8) bad.push(`${label}: barely any pink or red (${c.pinkPct.toFixed(1)}%, want >= 8%)`);
  if (c.whitePct < 8) bad.push(`${label}: barely any white (${c.whitePct.toFixed(1)}%, want >= 8%)`);
  return bad;
}
// It is blitted into a SQUARE box, so a square source is what avoids a squash. Trim, fit inside 88%
// of the canvas and centre: the same seating the other projectile sprites get.
async function seat(raw) {
  let content; try { content = await sharp(raw).trim({ threshold: 10 }).png().toBuffer(); } catch { content = await sharp(raw).png().toBuffer(); }
  const inner = Math.round(S * 0.88);
  const fitted = await sharp(content).resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'centre' }]).webp({ quality: 94, alphaQuality: 100 }).toBuffer();
}
async function makeImage(prompt, label) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`  ${label} attempt ${a} ... `);
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
const line = (t, p) => { const f = facing(p), c = palette(p); return `${t}: facing ${(100 * f.bias).toFixed(0)}% right, white ${c.whitePct.toFixed(0)}%, pink/red ${c.pinkPct.toFixed(0)}%, off-palette ${c.offPct.toFixed(1)}%`; };

// --cast: the OTHER mspore. Sprites/projectiles/cast/mspore.webp is the overhead glow flash drawn
// on the monster at m.w x 1.6 for 280ms as it fires, and it is currently green and teal. Leaving it
// would have the Shroom flash green and then spit a pink pod, so the recolour has to cover both
// files or it is half done. No facing gate here - it is a radial flash, not a creature.
const CAST_OUT = join(ROOT, 'Sprites', 'projectiles', 'cast', 'mspore.webp');
const CAST_PROMPT =
  'A magical CAST FLASH glyph for a 2D game: a bright round burst of spore light with two curved '
  + 'crescent arcs sweeping out to either side of it, like a puff of energy released. '
  + 'Coloured ONLY in white, bright PINK and deep RED, with a thick near-black outline - no green, '
  + 'no teal, no blue, no orange, no yellow. '
  + 'Chunky chibi cartoon style, bold clean shapes, soft cel shading, one glossy highlight, cheerful. '
  + 'Flat 2D game sprite on a fully transparent background, drawn COMPLETE with a clear even margin '
  + 'on all four sides - nothing touching or running off the edge. '
  + 'No text, no letters, no watermark, no background, no creature, no face.';
if (has('--cast')) {
  if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
  await mkdir(join(ROOT, 'scripts', '_tmp_mspore'), { recursive: true });
  console.log('=== mspore cast aura ===');
  for (let roll = 1; roll <= ROLLS; roll++) {
    const buf = await seat(await makeImage(CAST_PROMPT, 'cast roll ' + roll));
    await writeFile(join(ROOT, 'scripts', '_tmp_mspore', `cast${roll}.webp`), buf);
    const p2 = await px(buf), b = inkBox(p2), c = palette(p2), bad = [];
    if (b.x0 === 0 || b.y0 === 0 || b.x1 >= b.W - 1 || b.y1 >= b.H - 1) bad.push('ink on the canvas border');
    if (c.offPct > 6) bad.push(`off-palette ${c.offPct.toFixed(1)}% (want <= 6%; the green one scores 60%)`);
    if (c.pinkPct < 8) bad.push(`barely any pink or red (${c.pinkPct.toFixed(1)}%)`);
    console.log(`  cast roll ${roll}: white ${c.whitePct.toFixed(0)}%, pink/red ${c.pinkPct.toFixed(0)}%, off-palette ${c.offPct.toFixed(1)}% - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES'}`);
    if (!bad.length) { await writeFile(CAST_OUT + '.tmp', buf); await rename(CAST_OUT + '.tmp', CAST_OUT); console.log('  -> Sprites/projectiles/cast/mspore.webp'); process.exit(0); }
  }
  console.error('no cast roll passed'); process.exit(2);
}
const _keep = (process.argv.find((x) => x.startsWith('--keep=')) || '').split('=')[1];
if (_keep) {
  const buf = await sharp(_keep).webp({ quality: 94, alphaQuality: 100 }).toBuffer();
  const p = await px(buf), bad = gate(p, 'keep');
  console.log(`${line('keep ' + _keep, p)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
  if (bad.length) process.exit(2);
  await writeFile(OUT + '.tmp', buf); await rename(OUT + '.tmp', OUT);
  console.log(`  -> ${OUT} (${Math.round(buf.length / 1024)}KB)`); process.exit(0);
}
if (!has('--generate')) {
  console.log('DRY RUN.\n\n' + PROMPT + '\n');
  const p = await px(await sharp(OUT).toBuffer());
  console.log(line('what is shipped today', p));
  console.log('  (it is the mint-green front-facing pod: the recolour and the turn are both real changes)');
  process.exit(0);
}
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
await mkdir(join(ROOT, 'scripts', '_tmp_mspore'), { recursive: true });
console.log('=== mspore ===');
let best = null;
for (let roll = 1; roll <= ROLLS && !best; roll++) {
  const buf = await seat(await makeImage(PROMPT, `roll ${roll}`));
  await writeFile(join(ROOT, 'scripts', '_tmp_mspore', `roll${roll}.webp`), buf);
  const p = await px(buf), bad = gate(p, 'roll ' + roll);
  console.log(`  ${line('roll ' + roll, p)} - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
  if (!bad.length) { best = buf; await writeFile(OUT + '.tmp', buf); await rename(OUT + '.tmp', OUT); console.log(`  -> Sprites/projectiles/mspore.webp (${Math.round(buf.length / 1024)}KB)`); }
}
if (!best) { console.error('no roll passed the gates'); process.exit(2); }
console.log('\ndone.');
