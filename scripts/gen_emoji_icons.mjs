#!/usr/bin/env node
// Custom icons for every emoji the game shows, generated with ludo.ai.
// ============================================================================
// Per user: "ensure that no emojis are used, if they are they should be changed
// to customised images, use ludo.ai to generate them".
//
// Input: a jobs JSON [{ cp: '1f525', name: 'fire' }, ...] (cp = the emoji's code
// points, lower-case hex joined by '-', variation selectors and skin tones
// stripped). For each job not already on disk: one ludo.ai sprite generation,
// then sharp: trim the transparent margin, fit at 86% into a 128 x 128
// transparent square, write <out>/<cp>.webp (and the raw download to
// <out>/raw/<cp>.png so a re-pack never needs a re-generation).
//
// ludo.ai CONTRACT (2026-09-11, as in gen_sovereign_drain_pillar.mjs /
// gen_bossbar_ui.mjs): POST /assets/image answers 202 with a JOB {id, status,
// poll_after_ms}; GET /assets/jobs/<id> until status 'succeeded' -> result:
// [{url}]. 402 = out of credits (stop). Each job costs 0.5 credits, so a job id
// is recorded in <out>/jobs_state.json the moment it exists and a re-run POLLS
// it instead of paying for a new one.
//
//   LUDO_API_KEY=... node scripts/gen_emoji_icons.mjs --jobs=jobs.json --out=dir
//                    [--only=1f525,2694] [--skip=a9] [--conc=4] [--force]
// The key is read from the environment only; it is never written anywhere.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const KEY = process.env.LUDO_API_KEY;
if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const JOBS = JSON.parse(readFileSync(arg('jobs'), 'utf8'));
const OUT = arg('out', path.join(ROOT, 'Sprites/ui/emoji'));
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const SKIP = new Set((arg('skip', '') || '').split(',').filter(Boolean));
const CONC = Math.max(1, Number(arg('conc', 6)));
const FORCE = process.argv.includes('--force');
mkdirSync(path.join(OUT, 'raw'), { recursive: true });
const STATE_F = path.join(OUT, 'jobs_state.json');
const state = existsSync(STATE_F) ? JSON.parse(readFileSync(STATE_F, 'utf8')) : {};
const saveState = () => { writeFileSync(STATE_F + '.tmp', JSON.stringify(state, null, 1)); renameSync(STATE_F + '.tmp', STATE_F); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let OUT_OF_CREDITS = false;

// Short, subject-first prompts: long style prefixes pull the sprite model toward
// chibi characters (memory: ludo-api-usage). The subject is the emoji's CLDR
// name (with a few game-meaning overrides); the suffix pins it to one icon.
const prompt = (name) => `A single ${name} icon, fantasy RPG game interface icon, bold clean dark outline, soft cel shading, vivid saturated colours, centered, fills the frame, one object only, no text, no letters, no numbers, no border, no background scenery, transparent background`;

async function submit(job) {
  const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
    body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: prompt(job.name) }) });
  if (res.status === 402) { OUT_OF_CREDITS = true; throw new Error('OUT OF CREDITS (402)'); }
  if (res.status === 429) { await res.text().catch(() => ''); throw Object.assign(new Error('queue full (429)'), { busy: true }); }
  const txt = await res.text();
  if (!res.ok) throw new Error(`POST ${res.status}: ${txt.slice(0, 140)}`);
  return JSON.parse(txt);
}
async function poll(id) {
  const t0 = Date.now();
  let wait = 5000;
  for (;;) {
    await sleep(wait);
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(30000) });
    // the status endpoint rate-limits too (429) - measured 2026-09-11: 57 paid jobs abandoned mid-poll.
    // Back off and keep polling; the job is paid for and still running.
    if (r.status === 429) { await r.text().catch(() => ''); wait = Math.min(30000, wait * 2 + Math.random() * 3000); continue; }
    if (!r.ok) throw new Error(`job ${id}: ${r.status}`);
    const j = await r.json();
    if (j.status === 'succeeded') return j;
    if (j.status === 'failed' || j.status === 'cancelled') throw Object.assign(new Error(`job ${id} ${j.status}`), { dead: true });
    if (Date.now() - t0 > 600000) throw new Error(`job ${id} still ${j.status} after 600 s`);
    wait = Math.min(15000, Math.max(5000, Number(j.poll_after_ms) || 6000));   // >= 5 s between checks per job
  }
}
const urlOf = (d) => Array.isArray(d) ? (d[0] && d[0].url)
  : (d && (d.url || (d.images && d.images[0] && d.images[0].url) || (Array.isArray(d.result) && d.result[0] && d.result[0].url)));

async function processImage(cp, buf) {
  writeFileSync(path.join(OUT, 'raw', cp + '.png'), buf);
  const trimmed = await sharp(buf).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
  const S = 128, inner = Math.round(S * 0.86);
  const fitted = await sharp(trimmed).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'center' }]).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, cp + '.webp'));
}

async function gen(job) {
  const dst = path.join(OUT, job.cp + '.webp');
  if (!FORCE && existsSync(dst)) return { cp: job.cp, skipped: true };
  let lastErr = null;
  // a full account queue (429: at most 50 jobs waiting or running) is waited out, not counted as a
  // failure - measured 2026-09-11: without this a busy account turned 373 of 387 jobs into instant errors
  let busyWaits = 0;
  for (let attempt = 1; attempt <= 2 && !OUT_OF_CREDITS; attempt++) {
    try {
      let id = !FORCE && state[job.cp] && state[job.cp].id;
      let data = null;
      if (!id) {
        const r = await submit(job);
        if (urlOf(r)) data = r;                      // an old-style immediate answer
        else if (r && r.id) { id = r.id; state[job.cp] = { id, at: Date.now() }; saveState(); }
        else throw new Error('POST gave neither a url nor a job: ' + JSON.stringify(r).slice(0, 120));
      }
      if (!data) data = await poll(id);
      const url = urlOf(data);
      if (!url) throw new Error('job done but no url: ' + JSON.stringify(data).slice(0, 120));
      const buf = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(120000) })).arrayBuffer());
      await processImage(job.cp, buf);
      state[job.cp] = { ...(state[job.cp] || {}), done: true }; saveState();
      return { cp: job.cp, ok: true, attempt };
    } catch (e) {
      lastErr = e;
      if (e.busy && busyWaits < 120) { busyWaits++; attempt--; await sleep(10000 + Math.random() * 10000); continue; }
      if (e.dead && state[job.cp]) { delete state[job.cp]; saveState(); }   // a failed job may be re-submitted once
      else if (!e.dead) break;                                              // a stuck/timeout job keeps its id for a later re-run
    }
  }
  return { cp: job.cp, error: String(lastErr && lastErr.message).slice(0, 200) };
}

const todo = JOBS.filter((j) => (!ONLY.length || ONLY.includes(j.cp)) && !SKIP.has(j.cp));
console.log(`jobs ${todo.length} (of ${JOBS.length}), concurrency ${CONC}, out ${OUT}`);
const results = []; let i = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (i < todo.length && !OUT_OF_CREDITS) {
    const job = todo[i++];
    const r = await gen(job);
    results.push(r);
    if (r.ok || r.error) console.log(`${r.ok ? 'ok  ' : 'ERR '} ${job.cp} ${job.name}${r.error ? ' - ' + r.error : ''}`);
  }
}));
const ok = results.filter((r) => r.ok).length, sk = results.filter((r) => r.skipped).length, er = results.filter((r) => r.error);
console.log(`done: ${ok} generated, ${sk} already on disk, ${er.length} failed${OUT_OF_CREDITS ? ' - STOPPED: out of credits' : ''}`);
writeFileSync(path.join(OUT, 'gen_log.json'), JSON.stringify(results, null, 1));
process.exit(OUT_OF_CREDITS ? 3 : 0);
