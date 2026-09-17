#!/usr/bin/env node
// Knight HOLY SHIELD FX (ludo.ai): the cast emblem and the three holy waves.
// ============================================================================
// Per user: "For the skill Holy shield sprites and projectile sprites can be much better and grander,
// regenerate sprite and animation with ludo.ai".
//
// Holy Shield had one static cast sprite (a small blue crystal kite shield inside a thin ring) and its
// three damaging waves were not art at all - just rings of 28-40 white and yellow particle dots. This
// paints both, each as a still plus a 9-frame loop:
//
//   Sprites/fx/holy_shield.webp  + anim/holy_shield_0..8   the cast emblem (replaced in place)
//   Sprites/fx/holy_wave.webp    + anim/holy_wave_0..8     a wave ring (new), one per wave, grown by the engine
//
// Kept distinct from Guardian (v0.30.769: a GOLD winged tower shield): Holy Shield is the knight's
// ultimate BARRIER, so it is a sapphire crystal shield inside a crystal-light dome, silver and ice-blue.
//
//   node scripts/gen_holy_shield_fx.mjs --asset shield --base [--n 3]
//   node scripts/gen_holy_shield_fx.mjs --asset shield --anim --pick <file>
//   node scripts/gen_holy_shield_fx.mjs --install shield     (and the same for --asset wave)
// Pipeline after scripts/gen_knight_guardian_fx.mjs: job polling, the base seated at a 0.26 margin before
// animating, one union crop across all frames, a hard refusal of any frame with ink on the border.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts', '_tmp_holy_review');
const FRAMES = 9, SIZE = 768, EDGE_MARGIN = 0.04, ALPHA_ON = 12;
const arg = (k) => { const i = process.argv.indexOf('--' + k); if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]; const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : ''; };
const has = (f) => process.argv.includes('--' + f);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ART = {
  shield: {
    base: 'A GRAND HOLY CRYSTAL BARRIER for a 2D fantasy game, the ultimate protective emblem of a paladin knight, viewed '
      + 'perfectly flat face-on, perfectly mirror-symmetrical and centred: in the middle a tall majestic KITE SHIELD of '
      + 'faceted glowing SAPPHIRE CRYSTAL with a polished silver rim traced in fine gold filigree and a radiant white-gold '
      + 'HOLY CROSS blazing at its heart; around the shield a luminous DOME of interlocking hexagonal crystal-light panels, '
      + 'pale ice-blue and translucent; behind everything a great ring of glowing holy runes and a starburst of long '
      + 'cathedral light rays fanning out; small floating crystal shards and four-pointed sparkles orbit it. Palette: '
      + 'white-hot core, sapphire and ice blue, silver, touches of warm gold. Flat 2D cartoon game sprite, bold clean '
      + 'shapes, crisp cel shading, thick dark outline, high contrast, readable silhouette, the whole emblem fully inside '
      + 'the frame with empty space on every side. Fully TRANSPARENT background. NO character, NO person, NO knight, NO '
      + 'hands, NO face, NO text, NO letters, NO watermark, NO ground, NO background.',
    motion: 'The holy crystal barrier RADIATES and HUMS with strong visible change in EVERY frame, spread evenly across all nine: '
      + 'a band of bright light sweeps across the hexagonal dome panel by panel; the holy cross on the shield pulses '
      + 'white-hot and dims; the rune ring behind lights up rune by rune in a travelling pulse; the light rays lengthen and '
      + 'fade in alternating pairs; the crystal shards glint and bob. CRITICAL - DO NOT ROTATE the emblem; orientation '
      + 'identical in every frame. CRITICAL - LOCKED FRAMING: centred, same size and position in every frame, no zoom, pan, '
      + 'crop, drift, mirror or flip. CRITICAL - SEAMLESS LOOP back to the first frame. Same palette, thick dark outline and '
      + 'fully transparent background in every frame.',
  },
  wave: {
    base: 'A HOLY SHOCKWAVE RING for a 2D fantasy game, viewed perfectly flat face-on and radially symmetric: a single '
      + 'bold circular wave of radiant white-gold and ice-blue holy light, thick and bright at the ring and feathering '
      + 'softly outward and inward, with faceted sapphire crystal shards and small glowing four-pointed holy-cross '
      + 'sparkles embedded evenly around the band, and faint thin rune arcs riding just inside it. The whole middle of '
      + 'the circle is EMPTY and fully transparent. Divine, powerful, clean. Crisp 2D game VFX art, perfectly centred, '
      + 'the ring nearly filling the frame with a little empty space around it. Fully TRANSPARENT background. NO '
      + 'character, NO shield, NO text, NO ground, NO background.',
    motion: 'The holy shockwave ring SURGES with strong visible change in every frame, spread evenly across all nine: bright '
      + 'pulses of white light race around the ring, the embedded crystal shards glint one after another, the cross '
      + 'sparkles flare and fade, and the soft outer glow ripples. CRITICAL - LOCKED FRAMING: the ring stays centred at '
      + 'exactly the same size and position in every frame, no zoom, pan, drift, crop or flip. CRITICAL - SEAMLESS LOOP. '
      + 'Same palette and a fully transparent background in every frame; the centre stays empty.',
  },
};

const KEY = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
async function ludo(route, body, timeout = 400000) {
  const res = await fetch(`${API}/${route}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout), body: JSON.stringify(body) });
  if (res.status === 402) throw new Error('402 OUT OF CREDITS');
  const txt = await res.text(); if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 160)}`);
  let j = JSON.parse(txt);
  if (res.status === 202 && j.id) {
    const id = j.id; let wait = Number(j.poll_after_ms) || 5000;
    for (let i = 0; ; i++) {
      if (i > 90) throw new Error('job timed out');
      await sleep(Math.max(4000, wait));
      const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(45000) });
      if (r.status === 429) { await r.text().catch(() => {}); continue; }
      const k = await r.json();
      if (k.status === 'succeeded') { j = k.result; break; }
      if (k.status === 'failed' || k.status === 'cancelled') throw new Error('job ' + k.status);
      wait = Number(k.poll_after_ms) || wait;
    }
  }
  return j;
}
const urlOf = (d) => (Array.isArray(d) ? (d[0] && d[0].url) : (d && (d.url || (d.images && d.images[0] && d.images[0].url) || (Array.isArray(d.result) && d.result[0] && d.result[0].url))));
async function framesFrom(data, n) {
  const d = Array.isArray(data) ? data[0] : data;
  const urls = d.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  if (d.spritesheet_url && d.num_cols && d.num_rows) {
    const s = await fetchBuf(d.spritesheet_url), m = await sharp(s).metadata(), cw = Math.floor(m.width / d.num_cols), ch = Math.floor(m.height / d.num_rows), o = [];
    for (let r = 0; r < d.num_rows && o.length < n; r++) for (let c = 0; c < d.num_cols && o.length < n; c++) o.push(await sharp(s).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  throw new Error('no usable frames');
}

async function alphaBox(buf, on = ALPHA_ON) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, clear = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = data[(y * w + x) * ch + (ch - 1)];
    if (a > on) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } else clear++;
  }
  if (x1 < 0) throw new Error('a frame is fully transparent');
  return { x0, y0, x1: x1 + 1, y1: y1 + 1, w, h, clearPct: 100 * clear / (w * h) };
}
async function seat(raw, size, margin) {
  let content; try { content = await sharp(raw).trim({ threshold: 6 }).png().toBuffer(); } catch { content = await sharp(raw).png().toBuffer(); }
  const inner = Math.round(size * (1 - 2 * margin));
  const fitted = await sharp(content).resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'centre' }]).webp({ quality: 95, alphaQuality: 100 }).toBuffer();
}
async function packFrames(bufs, maxDrift = 0.2) {
  const boxes = []; for (const b of bufs) boxes.push(await alphaBox(b));
  const W = boxes[0].w, H = boxes[0].h;
  if (boxes[0].clearPct < 5) throw new Error(`frame 0 is only ${boxes[0].clearPct.toFixed(1)}% transparent - the loop came back without alpha`);
  const u = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
  const touched = [u.x0 <= 1 ? 'left' : null, u.y0 <= 1 ? 'top' : null, u.x1 >= W - 1 ? 'right' : null, u.y1 >= H - 1 ? 'bottom' : null].filter(Boolean);
  if (touched.length) throw new Error(`frames are clipped at the source canvas edge (${touched.join(', ')})`);
  // size drift across the loop, measured on the SOLID art (alpha > 200): the glow and light rays are meant to
  // lengthen and fade, so a box around them reads that as a 30-40% rescale when the emblem has not moved at all.
  const solid = []; for (const b of bufs) solid.push(await alphaBox(b, 200));
  let drift = 0; for (const b of solid) drift = Math.max(drift, Math.abs((b.x1 - b.x0) - (solid[0].x1 - solid[0].x0)) / (solid[0].x1 - solid[0].x0), Math.abs((b.y1 - b.y0) - (solid[0].y1 - solid[0].y0)) / (solid[0].y1 - solid[0].y0));
  if (drift > maxDrift) throw new Error(`the art changes size by ${(drift * 100).toFixed(0)}% across the loop`);
  const inner = Math.round(SIZE * (1 - 2 * EDGE_MARGIN));
  const cw = u.x1 - u.x0, chh = u.y1 - u.y0, scale = inner / Math.max(cw, chh);
  const out = [];
  for (const b of bufs) {
    const cropped = await sharp(b).extract({ left: u.x0, top: u.y0, width: cw, height: chh })
      .resize(Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(chh * scale)), { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, gravity: 'centre' }]).webp({ quality: 90, alphaQuality: 100 }).toBuffer());
  }
  console.log(`  union ${cw}x${chh} of ${W}x${H}, size drift ${(drift * 100).toFixed(1)}%, packed to ${inner}px`);
  return out;
}
async function assertNoCutoff(files) {
  for (const f of files) {
    const b = await alphaBox(await readFile(f));
    const hit = [b.x0 === 0 ? 'left' : null, b.y0 === 0 ? 'top' : null, b.x1 >= b.w ? 'right' : null, b.y1 >= b.h ? 'bottom' : null].filter(Boolean);
    if (hit.length) throw new Error(`${f} touches the canvas edge (${hit.join(', ')})`);
  }
}
async function sheet(files, out, S = 220) {
  const cells = [];
  for (const [i, f] of files.entries()) cells.push({ input: await sharp(f).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: 10 + i * (S + 10), top: 10 });
  await sharp({ create: { width: 20 + files.length * (S + 10), height: S + 20, channels: 4, background: { r: 70, g: 92, b: 80, alpha: 1 } } }).composite(cells).png().toFile(out);
  console.log('sheet -> ' + path.relative(ROOT, out));
}

const asset = arg('asset');
await mkdir(path.join(OUT, 'anim'), { recursive: true });
if ((has('base') || has('anim')) && !ART[asset]) { console.error('--asset shield|wave'); process.exit(1); }
if ((has('base') || has('anim')) && !KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }

if (has('base')) {
  const n = Math.max(1, Math.min(4, Number(arg('n')) || 3));
  const results = await Promise.allSettled(Array.from({ length: n }, async (_, i) => {
    const raw = await fetchBuf(urlOf(await ludo('assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: ART[asset].base })));
    const b = await alphaBox(raw);
    if (b.clearPct < 5) throw new Error(`cand${i + 1}: no transparency`);
    const p = path.join(OUT, `${asset}_cand${i + 1}.webp`);
    await writeFile(p, await seat(raw, SIZE, EDGE_MARGIN));
    console.log(`  cand${i + 1}: ${b.clearPct.toFixed(1)}% transparent -> ${path.basename(p)}`);
    return p;
  }));
  for (const r of results) if (r.status === 'rejected') console.log('  candidate failed: ' + r.reason.message);
  const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (ok.length) { await assertNoCutoff(ok); await sheet(ok, path.join(OUT, `${asset}_candidates.png`)); }
  process.exit(ok.length ? 0 : 1);
}

if (has('anim')) {
  const pick = arg('pick'); if (!pick) { console.error('--pick <file>'); process.exit(1); }
  const seated = await seat(await readFile(pick), SIZE, 0.26);
  const uri = 'data:image/png;base64,' + (await sharp(seated).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      console.log(`${asset}: animate attempt ${a}`);
      const bufs = await framesFrom(await ludo('assets/sprite/animate', { initial_image: uri, motion_prompt: ART[asset].motion, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }, 600000), FRAMES);
      { const dump = []; for (let i = 0; i < bufs.length; i++) { const f = path.join(OUT, `raw_${asset}_${a}_${i}.png`); await writeFile(f, await sharp(bufs[i]).png().toBuffer()); dump.push(f); } await sheet(dump, path.join(OUT, `raw_${asset}_attempt${a}.png`), 130); }
      const packed = await packFrames(bufs);
      const written = [];
      for (let i = 0; i < FRAMES; i++) { const p = path.join(OUT, 'anim', `holy_${asset}_${i}.webp`); await writeFile(p, packed[i]); written.push(p); }
      await writeFile(path.join(OUT, `holy_${asset}.webp`), packed[0]);   // the still IS frame 0, so the pre-decode flash matches
      await assertNoCutoff([...written, path.join(OUT, `holy_${asset}.webp`)]);
      await sheet(written, path.join(OUT, `${asset}_anim.png`), 150);
      ok = true;
    } catch (e) { last = e; console.log('  fail: ' + e.message); if (/402/.test(e.message)) process.exit(3); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('ANIM FAILED: ' + (last && last.message)); process.exit(1); }
}

// --from-raw <attempt>: pack an attempt whose raw frames were saved, after reviewing its sheet. The shield's shard
// burst widens even the SOLID box by 30-45% while the emblem itself holds perfectly still (see raw_shield_attempt4),
// so for the cast emblem the size gate is a review step, not an automatic refusal.
if (arg('from-raw')) {
  const a = arg('from-raw'); const bufs = [];
  for (let i = 0; i < FRAMES; i++) bufs.push(await readFile(path.join(OUT, `raw_${asset}_${a}_${i}.png`)));
  const packed = await packFrames(bufs, 1);
  const written = [];
  for (let i = 0; i < FRAMES; i++) { const q = path.join(OUT, 'anim', `holy_${asset}_${i}.webp`); await writeFile(q, packed[i]); written.push(q); }
  await writeFile(path.join(OUT, `holy_${asset}.webp`), packed[0]);
  await assertNoCutoff([...written, path.join(OUT, `holy_${asset}.webp`)]);
  await sheet(written, path.join(OUT, `${asset}_anim.png`), 150);
}

if (arg('install')) {
  const k = arg('install'); if (!ART[k]) { console.error('--install shield|wave'); process.exit(1); }
  const put = async (src, dst) => { await copyFile(src, dst + '.tmp'); await rename(dst + '.tmp', dst); };
  await put(path.join(OUT, `holy_${k}.webp`), path.join(ROOT, 'Sprites', 'fx', `holy_${k}.webp`));
  for (let i = 0; i < FRAMES; i++) await put(path.join(OUT, 'anim', `holy_${k}_${i}.webp`), path.join(ROOT, 'Sprites', 'fx', 'anim', `holy_${k}_${i}.webp`));
  console.log(`installed Sprites/fx/holy_${k}.webp + anim/holy_${k}_0..8`);
}
