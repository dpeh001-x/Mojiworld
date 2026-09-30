#!/usr/bin/env node
// Sprites/fx/safezone_ring.webp - the ornate gold ring around Gravitos's safe zones (the timer ring that closes onto the zone,
// and its spawn ring). Per user, on the plain ellipse: "the plain ring can be further embelished, please generate something nice".
// Painted flat and round, seen from directly above; the game squashes it into the floor's perspective (x0.42), turns it slowly
// and scales it with the countdown. The centre is punched clear here so the rift orb and its shield always show through.
//
//   node scripts/gen_safezone_ring.mjs                                         # dry run: the prompt
//   node scripts/gen_safezone_ring.mjs --generate --candidates 4 --out <dir>   # needs LUDO_API_KEY; raws saved first
//   node scripts/gen_safezone_ring.mjs --from-raw <png>                        # a chosen raw -> Sprites/fx/safezone_ring.webp
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Sprites', 'fx', 'safezone_ring.webp');
const SIZE = 512, INNER = 0.62;   // the clear centre: a feathered hole of 62% of the ring's outer radius
const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const has = (f) => process.argv.includes(f);
const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

// saturated gold only: a sprite matte keys pale white-gold light out as background (ludo-api-async-jobs, 2026-09-28)
const PROMPT = 'game vfx sprite, an ORNATE GOLDEN MAGIC CIRCLE RING seen from directly above, one flat perfectly round band: '
  + 'a thick outer ring of rich polished gold (#ffc233) and a thinner inner ring, between them a circle of small engraved amber '
  + 'runes and delicate gold filigree scrollwork, four small faceted topaz gems set at twelve, three, six and nine o\'clock, a warm '
  + 'amber glow along the band, bold dark brown-black cel outline, saturated rich gold and amber colours only with no white areas, '
  + 'the whole centre inside the ring completely EMPTY and transparent, symmetrical, centred on a transparent background, 2D game art';

async function pollJob(job, label) {
  const t0 = Date.now();
  for (;;) {
    await sleep(Math.min(15000, Math.max(2000, Number(job.poll_after_ms) || 5000)));
    const r = await fetch(`${API}/assets/jobs/${job.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`job ${job.id}: ${r.status}`);
    job = await r.json();
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' || job.status === 'cancelled') throw new Error(`job ${job.id} ${job.status}`);
    if (Date.now() - t0 > 900000) throw new Error(`job ${job.id} still ${job.status} after 900s (pick it up later: GET /assets/jobs/${job.id})`);
    process.stdout.write(`[${label} ${job.status}] `);
  }
}
async function generateOne(label) {
  const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(150000), body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }) });
  if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
  let data = await res.json();
  if (res.status === 202 || (data && data.id && data.status && !data.url && !data.result)) data = await pollJob(data, label);
  const url = Array.isArray(data) ? data[0] && data[0].url
    : (data && (data.url || (data.images && data.images[0] && data.images[0].url) || (Array.isArray(data.result) && data.result[0] && data.result[0].url)));
  if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 160));
  return fetchBuf(url);
}
// trim, centre in SIZE with a 3% margin, and punch the centre clear with a feathered edge (the orb must show through)
async function fit(raw) {
  const trimmed = await sharp(raw).ensureAlpha().trim({ threshold: 10 }).png().toBuffer().catch(() => raw);
  const inner = Math.round(SIZE * 0.94);
  const sq = await sharp(trimmed).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: (SIZE - inner) >> 1, bottom: SIZE - inner - ((SIZE - inner) >> 1), left: (SIZE - inner) >> 1, right: SIZE - inner - ((SIZE - inner) >> 1), background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true });
  const { data, info } = sq, R = inner / 2, c = SIZE / 2, r0 = R * INNER, feather = R * 0.05;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c), k = d >= r0 ? 1 : d <= r0 - feather ? 0 : (d - (r0 - feather)) / feather;
    const i = (y * info.width + x) * 4 + 3; data[i] = Math.round(data[i] * k);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}
if (has('--from-raw')) {
  const src = resolve(arg('--from-raw'));
  const buf = await (await fit(await sharp(src).png().toBuffer())).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  const m = await sharp(buf).metadata();
  if (m.width !== SIZE || m.height !== SIZE || !m.hasAlpha) throw new Error(`bad output ${m.width}x${m.height}`);
  await mkdir(dirname(OUT), { recursive: true }); await writeFile(OUT + '.tmp', buf); await rename(OUT + '.tmp', OUT);
  console.log('ok -> Sprites/fx/safezone_ring.webp (' + buf.length + ' bytes)'); process.exit(0);
}
if (!has('--generate')) { console.log('DRY RUN.\n' + PROMPT + '\n'); process.exit(0); }
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
const N = Math.max(1, Math.min(8, Number(arg('--candidates') || 4))), DIR = resolve(arg('--out') || 'safezone_ring_candidates');
await mkdir(DIR, { recursive: true });
const jobs = []; for (let k = 1; k <= N; k++) jobs.push((async () => {
  for (let a = 1; a <= 3; a++) {
    try {
      const raw = await generateOne('ring ' + k);
      await writeFile(join(DIR, `raw_${k}.png`), raw);   // the paid result lands on disk before anything else touches it
      await (await fit(raw)).png().toFile(join(DIR, `cand_${k}.png`));
      console.log(`\n  ring ${k}: ok`); return;
    } catch (e) { console.log(`\n  ring ${k} attempt ${a} fail: ${e.message}`); if (a < 3) await sleep(4000 * a); }
  }
})());
await Promise.all(jobs);
console.log('candidates in ' + DIR);
