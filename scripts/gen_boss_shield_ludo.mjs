// GENERATE THE BOSS PHASE-SHIELD ICON via ludo.ai (v0.30.389).
// Per user: "for the bosses when they are in the phase where they only take 1
// damage, put a translucent big shield icon in front of the boss sprite (to
// generate via ludo.ai) so that players are aware of it".
//   node scripts/gen_boss_shield_ludo.mjs --candidates    -> STAGE/cand_N.png (pick by eye or let --bake choose)
//   node scripts/gen_boss_shield_ludo.mjs --bake [N]      -> Sprites/fx/boss_shield.webp (512, planted 0.92)
// The game draws it translucent (globalAlpha) over the boss, so the art itself is
// a solid, readable shield with a soft rim. Reads LUDO_API_KEY from the env.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = process.env.SHIELD_STAGE || join(ROOT, 'scripts', '_tmp_boss_shield');
const OUT = process.env.SHIELD_OUT || join(ROOT, 'Sprites', 'fx', 'boss_shield.webp');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const key = process.env.LUDO_API_KEY;
const has = (f) => process.argv.includes(f);
const N = 4;
const PROMPT = 'A single large magical barrier shield icon, front view, perfectly centered and symmetrical: a tall heater-shield shape of ' +
  'glowing golden energy with a hexagonal honeycomb lattice inside, a bright soft cyan-white rim light, a few small sparks of light around the edge. ' +
  'Clean crisp edges, painterly anime game FX style, no text, no character, no background, isolated on a transparent background.';

async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(240000) });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const urlsOf = (d) => { const out = []; const walk = (v) => { if (typeof v === 'string' && /^https?:\/\//.test(v) && /\.(png|webp|jpg|jpeg)(\?|$)/i.test(v)) out.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(d); return [...new Set(out)]; };
async function bbox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let l = info.width, t = info.height, r = -1, b = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { if (data[(y * info.width + x) * 4 + 3] > 24) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; } }
  return r < 0 ? null : { l, t, w: r - l + 1, h: b - t + 1, W: info.width, H: info.height };
}
async function ensureAlpha(buf) {
  const meta = await sharp(buf).metadata();
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaMin = data.filter((_, i) => i % 4 === 3).reduce((m, v) => Math.min(m, v), 255);
  if (meta.hasAlpha && alphaMin < 250) return buf;
  const c = [data[0], data[1], data[2]];
  for (let i = 0; i < data.length; i += 4) { const d = Math.abs(data[i] - c[0]) + Math.abs(data[i + 1] - c[1]) + Math.abs(data[i + 2] - c[2]); if (d < 40) data[i + 3] = 0; else if (d < 90) data[i + 3] = Math.round(255 * (d - 40) / 50); }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
async function plant(buf, size, fill) {
  const b = await bbox(buf); if (!b) throw new Error('empty image');
  const scale = (size * fill) / Math.max(b.w, b.h);
  const w = Math.max(1, Math.round(b.w * scale)), h = Math.max(1, Math.round(b.h * scale));
  const cut = await sharp(buf).extract({ left: b.l, top: b.t, width: b.w, height: b.h }).resize({ width: w, height: h, fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cut, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }]).png().toBuffer();
}
// a shield reads best tall and centred: score = alpha coverage inside the bbox x aspect closeness to 0.8
async function score(buf) {
  const b = await bbox(buf); if (!b) return -1;
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let solid = 0; for (let y = b.t; y < b.t + b.h; y++) for (let x = b.l; x < b.l + b.w; x++) if (data[(y * info.width + x) * 4 + 3] > 128) solid++;
  const cover = solid / (b.w * b.h); const aspect = b.w / b.h; const aspectScore = 1 - Math.min(1, Math.abs(aspect - 0.8) / 0.8);
  const cx = (b.l + b.w / 2) / info.width, cy = (b.t + b.h / 2) / info.height; const centred = 1 - Math.min(1, (Math.abs(cx - 0.5) + Math.abs(cy - 0.5)) * 2);
  return cover * 0.5 + aspectScore * 0.3 + centred * 0.2;
}

await mkdir(STAGE, { recursive: true });
if (has('--candidates')) {
  if (!key) { console.error('LUDO_API_KEY is not set'); process.exit(2); }
  const data = await post('/assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: N, augment_prompt: false, prompt: PROMPT });
  const urls = urlsOf(data); if (!urls.length) { console.error('no image urls in response: ' + JSON.stringify(data).slice(0, 400)); process.exit(1); }
  let i = 0;
  for (const u of urls) { const buf = await ensureAlpha(await fetchBuf(u)); const b = await bbox(buf); const sc = await score(buf); await writeFile(join(STAGE, `cand_${i}.png`), buf); console.log(`cand_${i}: ${b ? b.w + 'x' + b.h : 'empty'} score ${sc.toFixed(3)}`); i++; }
  console.log(`${i} candidate(s) in ${STAGE}`);
}
if (has('--bake')) {
  const pick = process.argv[process.argv.indexOf('--bake') + 1];
  let chosen = null;
  if (pick && /^\d+$/.test(pick)) chosen = join(STAGE, `cand_${pick}.png`);
  else {
    const files = (await readdir(STAGE)).filter((f) => /^cand_\d+\.png$/.test(f)); let best = -1;
    for (const f of files) { const sc = await score(await readFile(join(STAGE, f))); console.log(`${f} score ${sc.toFixed(3)}`); if (sc > best) { best = sc; chosen = join(STAGE, f); } }
  }
  if (!chosen) { console.error('no candidate to bake - run --candidates first'); process.exit(1); }
  const still = await plant(await readFile(chosen), 512, 0.92);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, await sharp(still).webp({ quality: 92, alphaQuality: 95 }).toBuffer());
  const meta = await sharp(OUT).metadata();
  console.log(`baked ${chosen} -> ${OUT} (${meta.width}x${meta.height}, alpha ${meta.hasAlpha})`);
}
if (!has('--candidates') && !has('--bake')) console.log('usage: --candidates | --bake [N]');
