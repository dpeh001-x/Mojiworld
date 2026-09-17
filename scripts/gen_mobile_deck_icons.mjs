#!/usr/bin/env node
// Mobile deck icons the painted HUD set was missing: the d-pad arrow, fullscreen, and the close X.
// =============================================================================
// Per user: "Try to have custom icons for all buttons" and "The directional icons can be further improved".
// Same recipe as scripts/gen_hud_stat_icons.mjs - short subject-first prompt + that script's verbatim style tail, 128x128
// webp - so these sit in one visual language with hp / mp / jump / talk. Job API (POST -> id, poll /assets/jobs/<id>),
// with the job ids kept in a state file so a paid job is never re-posted.
//
//   node scripts/gen_mobile_deck_icons.mjs --generate [--out <dir>]   -> <dir>/<key>_v<n>.webp candidates (+ raw/)
// Needs LUDO_API_KEY from the environment (never committed).
// =============================================================================
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const argv = process.argv.slice(2);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OUT = arg('--out') || path.join(process.env.TEMP || '.', 'deck_icons');
// VERBATIM from gen_hud_stat_icons.mjs / generate_ui_icons.mjs - the tail keeps the set matched.
const SUFFIX = ' game UI icon for a 2D side-scroller, cel-shaded anime style with bold dark outlines, glossy highlights, vibrant saturated colors, single object icon only, centered, no character, no person, no creature, no hands, no text, fully inside the frame with empty margin on all sides, transparent background';
const JOBS = [
  { key: 'dpad_arrow', v: 1, prompt: 'A chunky glossy golden arrow pointing right with a rounded arrowhead' },
  { key: 'dpad_arrow', v: 2, prompt: 'A chunky glossy lavender and white arrow pointing right with a rounded arrowhead' },
  { key: 'dpad_arrow', v: 3, prompt: 'A chunky glossy cyan crystal arrow pointing right with a rounded arrowhead' },
  { key: 'fullscreen', v: 1, prompt: 'Four glossy golden corner brackets arranged as a square frame, expand to fullscreen symbol' },
  { key: 'fullscreen', v: 2, prompt: 'A glossy purple square with four white arrows pointing outward to its corners, expand symbol' },
  { key: 'close', v: 1, prompt: 'A glossy bold red X cross mark' },
  { key: 'close', v: 2, prompt: 'A round glossy red button with a bold white X cross mark' },
  // per user: "regenerate the jump icon" (the mobile Jump button)
  { key: 'jump', v: 1, prompt: 'A chunky glossy golden arrow pointing straight up, springing off a small puffy white cloud' },
  { key: 'jump', v: 2, prompt: 'A pair of glossy golden winged boots leaping upward' },
  { key: 'jump', v: 3, prompt: 'A glossy cyan double chevron pointing up with golden sparkles, jump symbol' },
  { key: 'jump', v: 4, prompt: 'A bouncy glossy golden spring coil launching upward with motion lines' },
  { key: 'jump', v: 5, prompt: 'A chunky glossy golden upward arrow with a white motion trail and a small star burst at its base' },
];
const KEYS = (() => { const i = process.argv.indexOf('--keys'); return i >= 0 ? process.argv[i + 1].split(',') : null; })();
if (KEYS) { for (let i = JOBS.length - 1; i >= 0; i--) if (!KEYS.includes(JOBS[i].key)) JOBS.splice(i, 1); }
if (!argv.includes('--generate')) { for (const j of JOBS) console.log(`${j.key}_v${j.v}: ${j.prompt}`); console.log('\nRe-run with --generate (needs LUDO_API_KEY).'); process.exit(0); }
const KEY = process.env.LUDO_API_KEY; if (!KEY) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
mkdirSync(path.join(OUT, 'raw'), { recursive: true });
const STATE_F = path.join(OUT, 'jobs_state.json');
const state = existsSync(STATE_F) ? JSON.parse(readFileSync(STATE_F, 'utf8')) : {};
const saveState = () => { writeFileSync(STATE_F + '.tmp', JSON.stringify(state, null, 1)); renameSync(STATE_F + '.tmp', STATE_F); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const urlOf = (d) => Array.isArray(d) ? (d[0] && d[0].url) : (d && (d.url || (d.images && d.images[0] && d.images[0].url) || (Array.isArray(d.result) && d.result[0] && d.result[0].url)));

async function submit(job) {
  for (let busy = 0; ; busy++) {
    const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: job.prompt + SUFFIX }) });
    if (res.status === 402) throw new Error('OUT OF CREDITS (402)');
    if (res.status === 429) { await res.text().catch(() => ''); if (busy > 20) throw new Error('queue stayed full'); await sleep(15000); continue; }
    const txt = await res.text();
    if (!res.ok) throw new Error(`POST ${res.status}: ${txt.slice(0, 140)}`);
    return JSON.parse(txt);
  }
}
async function poll(id) {
  const t0 = Date.now(); let wait = 5000;
  for (;;) {
    await sleep(wait);
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(30000) });
    if (r.status === 429) { await r.text().catch(() => ''); wait = Math.min(30000, wait * 2 + Math.random() * 3000); continue; }
    if (!r.ok) throw new Error(`job ${id}: ${r.status}`);
    const j = await r.json();
    if (j.status === 'succeeded') return j;
    if (j.status === 'failed' || j.status === 'cancelled') throw new Error(`job ${id} ${j.status}`);
    if (Date.now() - t0 > 600000) throw new Error(`job ${id} still ${j.status} after 600 s`);
    wait = Math.min(15000, Math.max(5000, Number(j.poll_after_ms) || 6000));
  }
}
async function run(job) {
  const name = `${job.key}_v${job.v}`, dst = path.join(OUT, name + '.webp');
  if (existsSync(dst)) return name + ': exists';
  let id = state[name] && state[name].id, data = null;
  if (!id) { const r = await submit(job); if (urlOf(r)) data = r; else if (r && r.id) { id = r.id; state[name] = { id, at: Date.now() }; saveState(); } else throw new Error('no job id'); }
  if (!data) data = await poll(id);
  const url = urlOf(data); if (!url) throw new Error('no url');
  const buf = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(120000) })).arrayBuffer());
  writeFileSync(path.join(OUT, 'raw', name + '.png'), buf);
  const trimmed = await sharp(buf).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
  const S = 128, inner = Math.round(S * 0.86);
  const fitted = await sharp(trimmed).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fitted, gravity: 'center' }]).webp({ quality: 92, alphaQuality: 100 }).toFile(dst);
  return name + ': ok';
}
const results = await Promise.allSettled(JOBS.map((j, i) => sleep(i * 800).then(() => run(j))));
results.forEach((r, i) => console.log(r.status === 'fulfilled' ? r.value : `${JOBS[i].key}_v${JOBS[i].v}: FAIL ${r.reason && r.reason.message}`));
process.exit(results.some((r) => r.status === 'rejected') ? 2 : 0);
