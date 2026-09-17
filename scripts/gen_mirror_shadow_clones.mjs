#!/usr/bin/env node
// MIRROR SHADOW (shadowlord_clones) — the three shadow clones, regenerated (ludo.ai).
// ============================================================================
// Per user: "For mirror shadow the shadows can be more aesthetic and better looking representing a
// more powerful final skill, using ludo.ai regenerate the sprite and animation".
//
// The clones are the Shadowlord's master signature, and they were flat purple cut-outs: a single
// matte fill with a thin pink outline. Each clone keeps its STANCE — the fan reads left / centre /
// right in game (crouching blade, crossed dual blades, leaping fan) — because the stills are
// regenerated with /assets/image/edit FROM the current still, and the new art is fitted back into
// the old still's exact content box so nothing about the clone's in-game size or position moves.
//
//   Sprites/summons/clone_<k>.webp                  640x864 still (fallback + animate seed)
//   Sprites/summons/anim/clone_<k>_attack_0..8.webp 844x1140 padded loop, as before
//
//   LUDO_API_KEY=... node scripts/gen_mirror_shadow_clones.mjs --stills [--n 2] [--only left]
//   node scripts/gen_mirror_shadow_clones.mjs --pick left=1,center=2,right=1
//   LUDO_API_KEY=... node scripts/gen_mirror_shadow_clones.mjs --animate [--only left]
// Replaces art under EXISTING names: bump sw.js CACHE, then gen_sprite_frame_index / assets manifest.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(ROOT, 'scripts', '_tmp_clone_review');
const KEY = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const has = (f) => process.argv.includes('--' + f);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(REVIEW, { recursive: true });

const SUM = path.join(ROOT, 'Sprites', 'summons');
const ANIM = path.join(SUM, 'anim');
const PAD = 0.16;                       // the old generator's headroom: 640x864 -> 844x1140 frames
const STYLE = 'Redraw this exact character in the exact same pose, stance, proportions, facing and framing, '
  + 'as a far more powerful and beautiful LIVING SHADOW: a sleek chibi ninja whose body is deep void-black and '
  + 'midnight-indigo shadow with a glossy sheen, a crisp glowing violet-to-magenta rim light tracing the whole '
  + 'silhouette, two piercing glowing lavender eyes, soft wisps of dark shadow-flame curling upward off the '
  + 'shoulders, scarf and headband tails, faint starlight specks deep inside the body, and weapons forged of '
  + 'translucent glowing purple-magenta energy with a bright white-hot edge. Elegant, menacing, final-skill grade. '
  + 'Clean 2D game sprite, cel-shaded painterly style, bold readable silhouette, fully transparent background, '
  + 'NO ground, NO shadow on the floor, NO text, NO frame, NO extra characters.';
const CLONES = {
  left:   { pose: 'a crouching ninja holding a single curved blade low and ready',
            motion: 'SLASHES in place: from the ready crouch it whips the glowing energy blade through a fast crescent arc and snaps back to ready' },
  center: { pose: 'a standing ninja leader with two blades crossed in front of the chest',
            motion: 'STRIKES in place: it throws both glowing energy blades out wide in a fast double slash and draws them back to the crossed guard' },
  right:  { pose: 'a leaping ninja swinging a folding war-fan',
            motion: 'SWINGS in place: it sweeps the glowing war-fan through a fast wide arc, the fan flaring with light, then returns to the pose' },
};
const HOLD = ' The shadow-flame wisps curl upward and flicker, the violet rim light pulses brighter at the moment of the strike, '
  + 'and a short glowing afterimage trail follows the weapon. CRITICAL: the body stays centred with its feet at the EXACT '
  + 'same spot, the SAME size and framing in every frame, fully inside the frame with empty margins - no walking, drifting, '
  + 'zooming, cropping, rotating the whole body, mirroring or rescaling. Same colours and style and a fully transparent '
  + 'background in every frame, looping smoothly back to the first frame.';

async function ludo(route, body, timeout = 240000) {
  const res = await fetch(`${API}/${route}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout), body: JSON.stringify(body) });
  if (res.status === 402) throw new Error('402 OUT OF CREDITS');
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 160)}`);
  let j = JSON.parse(txt);
  if (res.status === 202 && j.id) {                       // async job (memory: ludo-api-async-jobs)
    const id = j.id; let wait = Number(j.poll_after_ms) || 5000;
    for (let i = 0; ; i++) {
      if (i > 90) throw new Error('job timed out');
      await sleep(Math.max(4000, wait));
      const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(45000) });
      if (r.status === 429) { await r.text().catch(() => {}); continue; }
      const k = await r.json();
      if (k.status === 'succeeded') { j = k.result; break; }
      if (k.status === 'failed' || k.status === 'cancelled') throw new Error('job ' + k.status + ' ' + JSON.stringify(k.error || '').slice(0, 120));
      wait = Number(k.poll_after_ms) || wait;
    }
  }
  return j;
}
const urlsOf = (d) => { const a = Array.isArray(d) ? d : (d && (d.images || d.result || d.data)) || [d]; return a.map((x) => x && (x.url || x.image_url)).filter(Boolean); };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
async function box(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('fully transparent');
  const corner = data[3] + data[(W - 1) * 4 + 3] + data[((H - 1) * W) * 4 + 3] + data[((H - 1) * W + W - 1) * 4 + 3];
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H, corner };
}
// Fit the new content into the OLD still's content box (same bottom, same centre), 640x864.
async function fitToBox(buf, ref) {
  const b = await box(buf);
  const crop = await sharp(buf).extract({ left: b.x0, top: b.y0, width: b.w, height: b.h }).png().toBuffer();
  const s = Math.min(ref.w / b.w, ref.h / b.h);
  const w = Math.max(1, Math.round(b.w * s)), h = Math.max(1, Math.round(b.h * s));
  const left = Math.round(ref.x0 + (ref.w - w) / 2), top = Math.round(ref.y1 + 1 - h);
  const inner = await sharp(crop).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width: ref.W, height: ref.H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, left: Math.max(0, left), top: Math.max(0, top) }]).png().toBuffer();
}
async function sheet(files, out, S = 260) {
  const cells = [];
  for (const [i, f] of files.entries()) cells.push({ input: await sharp(f).resize(S, Math.round(S * 1.35), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: 10 + i * (S + 10), top: 10 });
  await sharp({ create: { width: 20 + files.length * (S + 10), height: Math.round(S * 1.35) + 20, channels: 4, background: { r: 196, g: 188, b: 170, alpha: 1 } } }).composite(cells).png().toFile(out);
  console.log('sheet -> ' + path.relative(ROOT, out));
}
const only = () => (arg('only') ? arg('only').split(',') : Object.keys(CLONES));
// the ORIGINAL still's box is the size/placement contract; snapshot it once before anything is replaced
const REF = path.join(REVIEW, 'ref_boxes.json');
async function refBoxes() {
  if (fs.existsSync(REF)) return JSON.parse(fs.readFileSync(REF, 'utf8'));
  const o = {}; for (const k of Object.keys(CLONES)) o[k] = await box(fs.readFileSync(path.join(SUM, `clone_${k}.webp`)));
  fs.writeFileSync(REF, JSON.stringify(o)); return o;
}

async function stills(n) {
  const refs = await refBoxes();
  for (const k of only()) {
    const orig = path.join(REVIEW, `orig_${k}.png`);
    if (!fs.existsSync(orig)) fs.writeFileSync(orig, await sharp(path.join(SUM, `clone_${k}.webp`)).png().toBuffer());
    // square seed: the 640x864 still centred on a 1024 transparent square, so the edit has a known frame
    const inner = await sharp(orig).resize({ height: 960 }).png().toBuffer();
    const seed = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: inner, gravity: 'centre' }]).png().toBuffer();
    const uri = 'data:image/png;base64,' + seed.toString('base64');
    const kept = [];
    for (let a = 1; a <= 3 && kept.length < n; a++) {
      process.stdout.write(`${k}: edit batch ${a} ... `);
      try {
        const d = await ludo('assets/image/edit', { image: uri, reference_image: uri, prompt: `This is ${CLONES[k].pose}. ${STYLE}`, n: n - kept.length, augment_prompt: false }, 400000);
        const urls = urlsOf(d); console.log(urls.length + ' image(s)');
        for (const u of urls) {
          const raw = await fetchBuf(u); const b = await box(raw);
          if (b.corner > 0) { console.log('  rejected: background not transparent'); continue; }
          const f = path.join(REVIEW, `${k}_${kept.length + 1}.png`);
          fs.writeFileSync(f, await fitToBox(raw, refs[k])); kept.push(f);
          console.log(`  kept ${path.basename(f)} (content ${b.w}x${b.h})`);
        }
      } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(3000 * a); }
    }
    if (kept.length) await sheet([orig, ...kept], path.join(REVIEW, `${k}_candidates.png`));
  }
}

async function pick(spec) {
  for (const kv of spec.split(',')) {
    const [k, i] = kv.split('='); const src = path.join(REVIEW, `${k}_${i}.png`), dst = path.join(SUM, `clone_${k}.webp`);
    if (!CLONES[k] || !fs.existsSync(src)) throw new Error('no candidate ' + kv);
    const b = await sharp(src).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    fs.writeFileSync(dst + '.tmp', b); fs.renameSync(dst + '.tmp', dst); console.log(`installed clone_${k}.webp from candidate ${i}`);
  }
}

async function frames(data, n) {
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
// the clone must not wander: its foot line and body height, against frame 0
async function wander(bufs) {
  const bs = []; for (const b of bufs) bs.push(await box(b));
  let foot = 0, h = 0;
  for (const b of bs) { foot = Math.max(foot, Math.abs(b.y1 - bs[0].y1) / b.H); h = Math.max(h, Math.abs(b.h - bs[0].h) / bs[0].h); }
  return { foot, h, corners: bs.reduce((s, b) => s + (b.corner > 0 ? 1 : 0), 0) };
}
async function motion(bufs) {
  const raws = []; for (const b of bufs) raws.push(await sharp(b).resize(128, 172, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  let t = 0;
  for (let i = 1; i < raws.length; i++) {
    let d = 0, n = 0;
    for (let p = 0; p < raws[i].length; p += 4) {
      const a = raws[i][p + 3], b = raws[i - 1][p + 3]; if (a < 20 && b < 20) continue;
      n++; d += Math.abs(raws[i][p] - raws[i - 1][p]) + Math.abs(raws[i][p + 1] - raws[i - 1][p + 1]) + Math.abs(raws[i][p + 2] - raws[i - 1][p + 2]) + Math.abs(a - b);
    }
    if (n) t += d / n;
  }
  return t / (raws.length - 1);
}
async function animate() {
  for (const k of only()) {
    const still = fs.readFileSync(path.join(SUM, `clone_${k}.webp`));
    const m = await sharp(still).metadata(), px = Math.round(m.width * PAD), py = Math.round(m.height * PAD);
    const padded = await sharp(still).extend({ top: py, bottom: py, left: px, right: px, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const { width: W, height: H } = await sharp(padded).metadata();
    const uri = 'data:image/png;base64,' + (await sharp(padded).resize(990, 990, { fit: 'inside' }).png().toBuffer()).toString('base64');
    let best = null;
    const good = (c) => c.score >= 12 && c.w.foot <= 0.05 && c.w.h <= 0.22 && c.w.corners === 0;
    for (let a = 1; a <= 3; a++) {
      process.stdout.write(`${k}: animate attempt ${a} ... `);
      try {
        const body = { initial_image: uri, motion_prompt: `A living-shadow ninja clone ${CLONES[k].motion}.` + HOLD, frames: 9, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' };
        const bufs = await frames(await ludo('assets/sprite/animate', body, 600000), 9);
        const sized = []; for (const b of bufs) sized.push(await sharp(b).resize(W, H, { fit: 'fill' }).png().toBuffer());
        const c = { bufs: sized, score: await motion(sized), w: await wander(sized) };
        console.log(`motion ${c.score.toFixed(1)} foot ${(c.w.foot * 100).toFixed(1)}% height ${(c.w.h * 100).toFixed(1)}% opaque-corner frames ${c.w.corners}`);
        if (!best || (good(c) && !good(best)) || (good(c) === good(best) && c.score > best.score)) best = c;
        if (good(c)) break;
      } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(4000 * a); }
    }
    if (!best) { console.error(`${k}: no usable animation`); process.exitCode = 1; continue; }
    if (!good(best)) console.log(`  ${k}: WARNING the best attempt did not pass every gate - review the sheet`);
    fs.mkdirSync(ANIM, { recursive: true });
    const outs = [];
    for (let i = 0; i < 9; i++) {
      const f = path.join(ANIM, `clone_${k}_attack_${i}.webp`);
      fs.writeFileSync(f + '.tmp', await sharp(best.bufs[i]).webp({ quality: 90, alphaQuality: 100 }).toBuffer()); fs.renameSync(f + '.tmp', f); outs.push(f);
    }
    await sheet(outs, path.join(REVIEW, `${k}_anim.png`), 150);
  }
}

if (has('stills')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await stills(Number(arg('n', 2))); }
if (arg('pick')) await pick(arg('pick'));
if (has('animate')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await animate(); }
if (!has('stills') && !arg('pick') && !has('animate')) console.log('usage: --stills [--n 2] [--only k] | --pick left=1,... | --animate [--only k]');
