#!/usr/bin/env node
// Steam LIBRARY HERO: Guguma (his original art) in the blazing crystal cavern (bg_v3_dungeon), logo space at centre.
//
// Per user: "regenerate this ugly steam banner (i cant remember what are the dimensions) with something
// high intensity with guguma in this background, have the mojiworld logo words in the centre".
//
// The pasted banner is the library hero (the explorer / ninja / starry-orb key art) with Steam's own
// library_logo drawn over it. Steam composites that logo itself - its position is a Steamworks setting -
// so the hero carries NO wordmark (Valve's library-hero rule; a baked one would show twice). This builds
// the art around an open centre for the logo, and a preview with the logo placed there.
//
//   node scripts/gen_steam_hero_guguma.mjs --pose [--n 4]        # ludo.ai: Guguma action poses -> STAGE
//   node scripts/gen_steam_hero_guguma.mjs --compose [art.png] [--battle]  # master, upload size, logo preview
//   (shipped art: --compose with no path = his original Sprites/npc/Guguma_hi.webp. The earlier battle-cry
//    version was --compose steam/assets/refs/guguma_battlecry_pose.png --battle;
//    then copy STAGE/library_hero.png -> steam/assets/ and library_hero_upload.png -> steam/assets/upload/library_hero.png)
//
// Sizes (tools/gen_steam_upload_assets.mjs): master 3840x1240, upload 1920x620.
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'steam_hero_guguma');
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const POSE_PROMPT =
  'Redraw THIS EXACT yellow chick character in a HIGH-INTENSITY heroic action pose for game key art: ' +
  'leaping forward through the air toward the right, body tilted into the charge, BOTH wings flared ' +
  'wide and swept back, one foot kicked back, fierce determined eyes with a bright highlight, beak wide ' +
  'open in a battle cry, head tuft feathers blown back by the speed. KEEP THE CHARACTER DESIGN EXACTLY: ' +
  'round plump yellow body, three-feather head tuft, cream belly patch, small orange beak, orange feet, ' +
  'thick dark outline, the same smooth cel-shaded cartoon style and colours. Full body, the whole ' +
  'character inside the frame with empty margin, nothing cut off. NO fire, NO effects, NO ground, NO ' +
  'text, NO other characters. Plain transparent background.';

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', signal: AbortSignal.timeout(600000),
    headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (res.status === 402) { console.error('OUT OF LUDO CREDITS'); process.exit(9); }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let j = await res.json();
  const st = j && (j.status || j.state);
  if (st && !['succeeded', 'completed', 'done'].includes(st)) {
    const id = j.id || j.job_id || j.jobId;
    if (!id) throw new Error('queued with no job id: ' + JSON.stringify(j).slice(0, 200));
    console.log(`  job ${id} ${st}…`);
    for (let i = 0; i < 240; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const q = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(60000) });
      if (!q.ok) continue;
      const jj = await q.json(), s2 = jj && (jj.status || jj.state);
      if (['succeeded', 'completed', 'done'].includes(s2)) { j = jj; break; }
      if (['failed', 'error'].includes(s2)) throw new Error('job failed: ' + JSON.stringify(jj).slice(0, 200));
    }
  }
  if (j && j.result && !j.url) return j.result;
  return j;
}
const urlsOf = (d) => (Array.isArray(d) ? d : [d]).flatMap((x) => (typeof x === 'string' ? [x] : x && x.url ? [x.url] : x && x.images ? x.images.map((i) => i.url || i) : []));
async function opaqueShare(buf) {
  const { data } = await sharp(buf).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let n = 0; for (const v of data) if (v > 200) n++;
  return n / data.length;
}

if (has('--pose')) {
  if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
  await mkdir(STAGE, { recursive: true });
  // Guguma at ~72% of a square, so the leap has room to reach outward
  const inner = 740;
  const src = await sharp(join(ROOT, 'Sprites/npc/Guguma_hi.webp')).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const seed = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: src, left: 142, top: 142 }]).png().toBuffer();
  const N = Math.max(1, Math.min(4, Number(arg('--n') || 4)));
  const d = await post('/assets/image/edit', { image: 'data:image/png;base64,' + seed.toString('base64'),
    reference_image: 'data:image/png;base64,' + seed.toString('base64'), prompt: POSE_PROMPT, n: N, augment_prompt: false });
  const urls = urlsOf(d);
  console.log(`  ${urls.length} pose(s)`);
  for (let i = 0; i < urls.length; i++) {
    let buf = await fetchBuf(urls[i]);
    const op = await opaqueShare(buf);
    await writeFile(join(STAGE, `pose_${i}_raw.png`), await sharp(buf).png().toBuffer());
    if (op > 0.6) {   // came back on a painted ground: strip it through ludo, keep the raw beside it
      const m = await post('/assets/image/remove-background', { image: 'data:image/png;base64,' + (await sharp(buf).png().toBuffer()).toString('base64') });
      buf = await fetchBuf(urlsOf(m)[0]);
    }
    await writeFile(join(STAGE, `pose_${i}.png`), await sharp(buf).ensureAlpha().png().toBuffer());
    console.log(`  pose_${i}.png  (raw ${(op * 100).toFixed(0)}% opaque${op > 0.6 ? ' -> matted' : ''})`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------- compose ----
const W = 3840, H = 1240;
// Guguma BEHIND the title, in the centre Steam never crops: head above the logo, body behind it, feet below.
// A first pass had him huge at the left: he crowded the logo and a narrow library window cut his wing.
// HIS ORIGINAL ART, not a redraw (per user: "for guguma, he needs to be the more original cuter version").
// The ludo battle-cry pose (refs/guguma_battlecry_pose.png) grew big wings and angry brows; Guguma_hi.webp is
// the in-game drawing itself.
// BIGGER (per user: "make guguma bigger"): the ceiling is his face against the centred logo. Measured on his
// art, the beak spans 0.371-0.437 of his trimmed height at 0.70-0.82 of his width; measured on the wordmark,
// its LETTERS under that beak start ~30 px below the logo's box (the box is raised by the sparkle over the
// I). Tuft at y 40, a 1400 px logo, 14 px of clear air under the beak: h 1045, up from 900. (cx, cy) is the
// light's origin; he is placed by his top edge and his horizontal centre (ax).
const G = { cx: 1920, cy: 540, top: 40, h: 1045, ax: 0.5 };
const DEFAULT_ART = 'Sprites/npc/Guguma_hi.webp';
// --battle rebuilds the earlier battle-cry look: fire trail, a hot rim glow hugging him, shockwave rings and a
// strong underlight. Without it none of those are drawn - the rim glow and the rings read as a halo around him
// (per user: "remove the weird halo effect around guguma").
const BATTLE = has('--battle');
// lava light on him: strong enough to set him in the cave, gentle enough that his yellow stays his yellow
const UNDERLIGHT = BATTLE ? 0.85 : 0.4;
// THICKER BLACK OUTLINE (per user): his silhouette grown by OUTLINE px with a true distance, so the line is
// even all round - a blur-and-threshold swell goes thin in the notch under a wing and blobby at the tuft.
const OUTLINE = 16, OUTLINE_RGB = [11, 8, 8];
const LOGO = { w: 1400, cx: W / 2, cy: H / 2 };      // where the preview puts Steam's library_logo
let seed = 20260916;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const svg = (body, defs = '') => Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${body}</svg>`);

async function cavern() {
  // 1456x816 -> 3840 wide is 2152 tall; the band keeps the crystals and puts the lava seam at ~0.87 of H
  const band = await sharp(join(ROOT, 'backgrounds/bg_v3_dungeon.webp')).resize(W, 2152, { kernel: 'lanczos3' })
    .extract({ left: 0, top: 771, width: W, height: H }).png().toBuffer();
  return sharp(band).blur(2.6).modulate({ saturation: 1.18, brightness: 0.74 }).linear(1.15, -18).png().toBuffer();
}
function shade() {   // darker ceiling and corners, hotter floor
  return svg(`<rect width="${W}" height="${H}" fill="url(#top)"/><rect width="${W}" height="${H}" fill="url(#vig)"/>`,
    `<linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12030a" stop-opacity="0.72"/>
       <stop offset="0.45" stop-color="#12030a" stop-opacity="0.08"/><stop offset="1" stop-color="#12030a" stop-opacity="0.35"/></linearGradient>
     <radialGradient id="vig" cx="0.5" cy="0.55" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/>
       <stop offset="1" stop-color="#000" stop-opacity="0.78"/></radialGradient>`);
}
function heat() {    // screen-blended: bloom behind Guguma, light burst, fire trail, the lava seam flaring
  let rays = '';
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.08, sp = 0.035 + rnd() * 0.03, R = 2600;
    rays += `<path d="M${G.cx} ${G.cy} L${(G.cx + Math.cos(a - sp) * R).toFixed(0)} ${(G.cy + Math.sin(a - sp) * R).toFixed(0)} L${(G.cx + Math.cos(a + sp) * R).toFixed(0)} ${(G.cy + Math.sin(a + sp) * R).toFixed(0)}Z" opacity="${(0.25 + rnd() * 0.5).toFixed(2)}"/>`;
  }
  // the fire trail belongs to a CHARGING pose; his original art stands, so it is opt-in (--battle)
  let trail = '';
  for (let i = 0; i < (BATTLE ? 9 : 0); i++) {
    const y0 = G.cy + 60 + (i - 4) * 58 + rnd() * 30, len = 1100 + rnd() * 700, th = 18 + rnd() * 34, dy = 120 + rnd() * 90;
    // a POINTED head hidden behind his body, widest mid-way, a point again at the tail: blunt heads all
    // ending on one line stacked into a pale slab behind him
    const hx = G.cx - 60;
    trail += `<path d="M${hx} ${y0} Q${hx - len * 0.35} ${y0 - th} ${hx - len} ${y0 + dy} Q${hx - len * 0.35} ${y0 + th * 1.3 + dy * 0.25} ${hx} ${y0}Z" fill="url(#trail)" opacity="${(0.5 + rnd() * 0.5).toFixed(2)}"/>`;
  }
  return svg(
    `<g fill="url(#ray)" filter="url(#b8)">${rays}</g>
     <ellipse cx="${G.cx}" cy="${G.cy}" rx="1250" ry="900" fill="url(#bloom)"/>
     ${BATTLE ? `<ellipse cx="${G.cx}" cy="${G.cy + 40}" rx="760" ry="560" fill="none" stroke="#ffd690" stroke-width="26" opacity="0.42" filter="url(#b8)"/>
     <ellipse cx="${G.cx}" cy="${G.cy + 40}" rx="1020" ry="720" fill="none" stroke="#ff8a3a" stroke-width="14" opacity="0.22" filter="url(#b8)"/>` : ''}
     <g filter="url(#b6)">${trail}</g>
     <rect x="0" y="${H * 0.8}" width="${W}" height="${H * 0.2}" fill="url(#seam)"/>`,
    `<filter id="b8" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="8"/></filter>
     <filter id="b6" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
     <radialGradient id="ray" gradientUnits="userSpaceOnUse" cx="${G.cx}" cy="${G.cy}" r="2100">
       <stop offset="0" stop-color="#ffd27a" stop-opacity="0.34"/><stop offset="1" stop-color="#ff6a2a" stop-opacity="0"/></radialGradient>
     <radialGradient id="bloom"><stop offset="0" stop-color="#fff0b8" stop-opacity="0.85"/><stop offset="0.28" stop-color="#ffab3d" stop-opacity="0.55"/>
       <stop offset="0.62" stop-color="#ff4d1f" stop-opacity="0.18"/><stop offset="1" stop-color="#ff4d1f" stop-opacity="0"/></radialGradient>
     <linearGradient id="trail" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff6c9" stop-opacity="0"/><stop offset="0.12" stop-color="#fff6c9"/><stop offset="0.3" stop-color="#ffc247"/>
       <stop offset="0.6" stop-color="#ff5a1c" stop-opacity="0.7"/><stop offset="1" stop-color="#ff3a10" stop-opacity="0"/></linearGradient>
     <linearGradient id="seam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a2a" stop-opacity="0"/>
       <stop offset="0.45" stop-color="#ff9a3a" stop-opacity="0.38"/><stop offset="1" stop-color="#ff5a1a" stop-opacity="0"/></linearGradient>`);
}
function embers(front) {   // back layer: many small rising sparks; front layer: a few big out-of-focus ones
  let body = '';
  const n = front ? 26 : 320;
  for (let i = 0; i < n; i++) {
    // denser around Guguma and along the lava seam
    const nearG = rnd() < 0.45;
    const x = nearG ? G.cx - 900 + rnd() * 2100 : rnd() * W;
    const y = nearG ? G.cy - 520 + rnd() * 1080 : H * (0.25 + rnd() * 0.75);
    if (front) {
      const r = 14 + rnd() * 30;
      body += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="url(#bokeh)" opacity="${(0.35 + rnd() * 0.45).toFixed(2)}"/>`;
    } else {
      const len = 6 + rnd() * 26, th = 1.6 + rnd() * 3.2, ang = -35 - rnd() * 40;
      body += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${len.toFixed(1)}" height="${th.toFixed(1)}" rx="${(th / 2).toFixed(1)}" fill="${rnd() < 0.3 ? '#fff4c8' : '#ffb347'}" opacity="${(0.45 + rnd() * 0.55).toFixed(2)}" transform="rotate(${ang.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
    }
  }
  return svg(front ? `<g filter="url(#bb)">${body}</g>` : `<g filter="url(#glow)">${body}</g>`,
    `<filter id="bb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
     <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4" result="b"/>
       <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
     <radialGradient id="bokeh"><stop offset="0" stop-color="#fff2c0" stop-opacity="0.95"/><stop offset="0.5" stop-color="#ffa43a" stop-opacity="0.6"/>
       <stop offset="1" stop-color="#ff5a1a" stop-opacity="0"/></radialGradient>`);
}
async function guguma(posePath) {
  const trimmed = await sharp(posePath).ensureAlpha().trim({ threshold: 10 }).png().toBuffer();
  const m = await sharp(trimmed).metadata();
  const h = G.h, w = Math.round(m.width * h / m.height);
  const body = await sharp(trimmed).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
  // lava light from below: an orange ramp kept only where Guguma is, soft-lit onto him
  const ramp = Buffer.from(`<svg width="${w}" height="${h}"><defs><linearGradient id="u" x1="0" y1="0" x2="0.3" y2="1">
    <stop offset="0.35" stop-color="#ff7a2a" stop-opacity="0"/><stop offset="1" stop-color="#ff5010" stop-opacity="${UNDERLIGHT}"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#u)"/></svg>`);
  const tint = await sharp(ramp).composite([{ input: body, blend: 'dest-in' }]).png().toBuffer();
  const lit = await sharp(body).composite([{ input: tint, blend: 'soft-light' }]).png().toBuffer();
  const ol = await outlined(lit, w, h);
  if (!BATTLE) return { img: ol.img, P: ol.P, w, h, rim: null, pad: 0 };
  // hot rim (--battle only): his silhouette, grown and blurred, tinted gold, laid under him
  const pad = 90;
  // two pipelines: in one, sharp extends BEFORE it extracts the channel, and the padding arrives opaque
  const a1 = await sharp(body).extractChannel('alpha').png().toBuffer();
  const alpha = await sharp(a1).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0 } })
    .blur(22).linear(1.9, 0).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  const rimRGBA = Buffer.alloc(alpha.info.width * alpha.info.height * 4);
  // PREMULTIPLIED: screen blending reads the colour of a see-through pixel, so an orange rgb at alpha 0
  // lit the rim layer's whole rectangle. Colour scaled by coverage is black where there is no glow.
  for (let p = 0, q = 0; p < alpha.data.length; p++, q += 4) {
    const k = Math.min(255, alpha.data[p]) / 255;
    rimRGBA[q] = Math.round(255 * k); rimRGBA[q + 1] = Math.round(170 * k); rimRGBA[q + 2] = Math.round(60 * k); rimRGBA[q + 3] = Math.round(255 * k);
  }
  const rim = await sharp(rimRGBA, { raw: { width: alpha.info.width, height: alpha.info.height, channels: 4 } }).png().toBuffer();
  return { img: ol.img, P: ol.P, w, h, rim, pad };
}
// His art padded by P, laid over a black silhouette grown OUTLINE px (chamfer 5-7-11 distance, 1 px anti-alias).
async function outlined(img, w, h) {
  const P = OUTLINE + 4, W2 = w + 2 * P, H2 = h + 2 * P;
  const padded = await sharp(img).extend({ top: P, bottom: P, left: P, right: P, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const { data: a } = await sharp(padded).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  const INF = 1e9, d = new Float64Array(W2 * H2);
  for (let i = 0; i < d.length; i++) d[i] = a[i] > 127 ? 0 : INF;
  const relax = (x, y, dx, dy, c) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W2 || ny >= H2) return;
    const i = y * W2 + x, v = d[ny * W2 + nx] + c;
    if (v < d[i]) d[i] = v;
  };
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    relax(x, y, -1, 0, 5); relax(x, y, -1, -1, 7); relax(x, y, 0, -1, 5); relax(x, y, 1, -1, 7);
    relax(x, y, -2, -1, 11); relax(x, y, 2, -1, 11); relax(x, y, -1, -2, 11); relax(x, y, 1, -2, 11);
  }
  for (let y = H2 - 1; y >= 0; y--) for (let x = W2 - 1; x >= 0; x--) {
    relax(x, y, 1, 0, 5); relax(x, y, 1, 1, 7); relax(x, y, 0, 1, 5); relax(x, y, -1, 1, 7);
    relax(x, y, 2, 1, 11); relax(x, y, -2, 1, 11); relax(x, y, 1, 2, 11); relax(x, y, -1, 2, 11);
  }
  const line = Buffer.alloc(W2 * H2 * 4);
  for (let i = 0, q = 0; i < d.length; i++, q += 4) {
    const k = Math.max(0, Math.min(1, OUTLINE + 0.5 - d[i] / 5));
    line[q] = OUTLINE_RGB[0]; line[q + 1] = OUTLINE_RGB[1]; line[q + 2] = OUTLINE_RGB[2]; line[q + 3] = Math.round(255 * k);
  }
  const base = await sharp(line, { raw: { width: W2, height: H2, channels: 4 } }).png().toBuffer();
  return { img: await sharp(base).composite([{ input: padded }]).png().toBuffer(), P };
}

if (has('--compose')) {
  const next = arg('--compose');
  const posePath = next && !next.startsWith('--') ? next : join(ROOT, DEFAULT_ART);
  await mkdir(STAGE, { recursive: true });
  const g = await guguma(posePath);
  const gl = Math.round(G.cx - g.w * G.ax), gt = G.top;   // his art's own top-left, before the outline pad
  const hero = await sharp(await cavern()).composite([
    { input: shade(), blend: 'over' },
    { input: heat(), blend: 'screen' },
    { input: embers(false), blend: 'screen' },
    ...(g.rim ? [{ input: g.rim, left: gl - g.pad, top: gt - g.pad, blend: 'screen' }] : []),
    { input: g.img, left: gl - g.P, top: gt - g.P },
    { input: embers(true), blend: 'screen' },
  ]).removeAlpha().png().toBuffer();
  const master = join(STAGE, 'library_hero.png'), upload = join(STAGE, 'library_hero_upload.png');
  await writeFile(master, hero);
  await sharp(hero).resize(1920, 620, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(upload);
  // what Steam shows: the library_logo centred over the hero (a Steamworks setting, not baked in)
  const logo = await sharp(join(ROOT, 'Sprites/ui/mojiworld_logo.webp')).resize(LOGO.w).png().toBuffer();
  const lm = await sharp(logo).metadata();
  // two pipelines again: sharp resizes BEFORE it composites, which would drop the logo on the shrunk image
  const withLogo = await sharp(hero).composite([{ input: logo, left: Math.round(LOGO.cx - lm.width / 2), top: Math.round(LOGO.cy - lm.height / 2) }]).png().toBuffer();
  await sharp(withLogo).resize(1920, 620, { kernel: 'lanczos3' }).png().toFile(join(STAGE, 'preview_with_logo.png'));
  const mm = await sharp(master).metadata(), um = await sharp(upload).metadata();
  console.log(`master ${mm.width}x${mm.height} · upload ${um.width}x${um.height} · preview_with_logo.png -> ${STAGE}`);
}
