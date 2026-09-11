#!/usr/bin/env node
// Sprites/fx/safezone_shield.webp - the shelter mark drawn inside the Singularity safe zone.
// =============================================================================
// Per user, on the SAFE label: "the safe word does not look very nice, could we think of a better
// word or symbol to instruct players to seek shelter inside". A shield is the one mark every
// player reads as "you are protected here" without a word; it is drawn INSIDE the zone rect (the
// rect is the lethal boundary, nothing may paint outside it) and bobs gently over the portal's
// eye. Same cel-shaded style tail as the HUD icon set, so it is a matched piece.
//
//   node scripts/gen_safezone_icon.mjs              # dry run
//   node scripts/gen_safezone_icon.mjs --generate   # needs LUDO_API_KEY
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { readFileSync } from 'node:fs';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Sprites', 'fx', 'safezone_shield.webp');
const SIZE = 128;
const has = (f) => process.argv.includes(f);
const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

// the HUD icon set's style tail, read verbatim so this stays a matched piece
const hud = readFileSync(join(ROOT, 'scripts', 'gen_hud_stat_icons.mjs'), 'utf8');
const SUFFIX = (/const SUFFIX = '([^']+)'/.exec(hud) || [])[1];
if (!SUFFIX) { console.error('could not read the HUD style tail'); process.exit(1); }
const PROMPT = 'A glossy pale-blue and white heater shield with a soft cyan glow and a small white four-point star in its centre' + SUFFIX;

async function pollJob(job, label) {
  const t0 = Date.now();
  for (;;) {
    await sleep(Math.min(15000, Math.max(2000, Number(job.poll_after_ms) || 5000)));
    const r = await fetch(`${API}/assets/jobs/${job.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`job ${job.id}: ${r.status}`);
    job = await r.json();
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' || job.status === 'cancelled') throw new Error(`job ${job.id} ${job.status}`);
    if (Date.now() - t0 > 300000) throw new Error(`job ${job.id} still ${job.status} after 300s`);
    process.stdout.write(`[${label} ${job.status}] `);
  }
}
if (!has('--generate')) { console.log('DRY RUN.\n' + PROMPT + '\n'); process.exit(0); }
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
let last;
for (let a = 1; a <= 4; a++) {
  try {
    process.stdout.write(`  shield attempt ${a} ... `);
    const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(150000), body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }) });
    if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
    let data = await res.json();
    if (res.status === 202 || (data && data.id && data.status && !data.url && !data.result)) data = await pollJob(data, 'image');
    const url = Array.isArray(data) ? data[0] && data[0].url
      : (data && (data.url || (data.images && data.images[0] && data.images[0].url) || (Array.isArray(data.result) && data.result[0] && data.result[0].url)));
    if (!url) throw new Error('no url: ' + JSON.stringify(data).slice(0, 160));
    const raw = await fetchBuf(url);
    const trimmed = await sharp(raw).ensureAlpha().trim({ threshold: 10 }).png().toBuffer().catch(() => raw);
    const buf = await sharp(trimmed)
      .resize(SIZE - 8, SIZE - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 4, bottom: 4, left: 4, right: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92 }).toBuffer();
    const m = await sharp(buf).metadata();
    if (m.width !== SIZE || m.height !== SIZE || !m.hasAlpha) throw new Error(`bad output ${m.width}x${m.height}`);
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT + '.tmp', buf); await rename(OUT + '.tmp', OUT);
    console.log('ok -> Sprites/fx/safezone_shield.webp'); process.exit(0);
  } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
}
console.error('FAILED: ' + (last && last.message)); process.exit(2);
