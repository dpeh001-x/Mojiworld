#!/usr/bin/env node
// DEADEYE / DEADEYE PROTOCOL — skill-bar icons and sound effects for the v0.30.610 revamp (ludo.ai).
// Per user: "regenerate new sound effects and make sure the icons of the skill is changed to the new one".
//
//   node scripts/gen_deadeye_sfx_icons.mjs --icons [--n 3]        # candidates -> scripts/_tmp_deadeye_review/
//   node scripts/gen_deadeye_sfx_icons.mjs --pick marksman_ult=2  # candidate -> Sprites/skills/<id>.webp (lossless)
//   node scripts/gen_deadeye_sfx_icons.mjs --sfx [--only a,b]     # takes -> review dir, best take -> audio/skill/<id>.mp3
// Needs LUDO_API_KEY and ffmpeg/ffprobe on PATH. After a drop: sfx_duration_test, gen_sfx_manifest, and a sw.js CACHE bump
// (both the icons and the clips replace files under their own names).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(ROOT, 'scripts', '_tmp_deadeye_review');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api', KEY = process.env.LUDO_API_KEY;
const argv = process.argv.slice(2), has = (f) => argv.includes(f), arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const only = (arg('--only') || '').split(',').filter(Boolean), want = (k) => !only.length || only.includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(REVIEW, { recursive: true });

// Same frame-less sticker-emblem brief as scripts/generate_ult_icons.mjs, so the pair sits with the rest of the bar.
const PREFIX = 'Mobile game SKILL ICON — a single bold emblem that clearly depicts the skill, floating FREE on a FULLY TRANSPARENT background (alpha only). ' +
  'ABSOLUTELY NO frame, NO border, NO box, NO rounded-square, NO circle badge, NO panel, NO background fill or gradient, NO ground, NO scene — ONLY the emblem itself with clean transparent edges all around it. ' +
  'Chibi anime style: thick dark outline around the emblem, vibrant saturated colors, soft cel shading, bright additive glow. ' +
  'Strong centered composition filling about 85% of the square canvas with a small transparent margin. ' +
  'ABSOLUTELY NO TEXT: no letters, numbers, words, runes-as-writing or watermark. Bold, clean, instantly readable at small size. ';
const ICONS = {   // palette = the revamp's art: white-hot core, warm gold, thin electric-cyan accents
  marksman_oneshot: 'FOCUS FIRE: a glowing gold sniper lock-on reticle ring with four tick marks, and four or five bright white-gold tracer lines streaking in from the left and converging on its centre, a white-hot impact spark at the bullseye, small cyan sparks — gold, white and cyan only',
  marksman_ult: 'OVERCLOCK: a heavy gold armour-piercing drill bullet wrapped in a spiralling cyan energy helix, bursting through a thin gold crosshair ring, with three small glowing homing bullets curving in behind it — gold, white and cyan only',
};
const SFX = {   // [prompt, requested s, max s] — the press cues fire every 250-420 ms, so they are kept tight
  marksman_oneshot: ['Three very fast crisp sniper-rifle energy shots in a tight burst: sharp cracking snaps with a bright metallic ping, clean and punchy, dry with no reverb tail, video game skill sound effect', 0.5, 0.6],
  marksman_ult: ['A rapid ripple of five small high-tech energy rounds firing in a tight volley: quick electric zips over a soft magnetic whoosh, clean and punchy, very short, dry, video game skill sound effect', 0.45, 0.55],
  deadeye_execute: ['One massive armour-piercing drill round fired and striking: a deep punchy cannon boom layered with a rising electric whine and a bright ringing metallic impact, a powerful finisher, video game sound effect', 0.8, 0.95],
  deadeye_lock: ['A crisp high-tech sniper scope target-lock sound: a soft servo click followed by two quick rising digital beeps, clean and futuristic, video game UI sound effect', 0.4, 0.5],
};

async function ludo(route, body, timeout = 180000) {
  const res = await fetch(`${API}/${route}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout), body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text(); if (/\b402\b|credits/i.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(`HTTP ${res.status} ${t.slice(0, 120)}`); }
  let j = await res.json();
  if (res.status === 202 && j.id) {   // async job: poll until it settles (see memory: ludo-api-async-jobs)
    for (let i = 0; ; i++) {
      if (i > 40) throw new Error('job timed out');
      const q = await (await fetch(`${API}/assets/jobs/${j.id}?wait=30`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(60000) })).json();
      if (q.status === 'succeeded') { j = q.result; break; }
      if (q.status === 'failed' || q.status === 'canceled' || q.status === 'cancelled') throw new Error('job ' + q.status);
      await sleep(Math.max(1000, q.poll_after_ms || 2000));
    }
  }
  const url = Array.isArray(j) ? j[0] && j[0].url : (j && (j.url || (j.images && j.images[0] && j.images[0].url) || (j.audio && j.audio.url)));
  if (!url) throw new Error('no url: ' + JSON.stringify(j).slice(0, 120));
  const dl = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!dl.ok) throw new Error('download ' + dl.status);
  return Buffer.from(await dl.arrayBuffer());
}

// ---- icons ----------------------------------------------------------------------------------------
async function iconCandidate(raw) {
  const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('empty');
  const corner = data[3] + data[(W - 1) * 4 + 3] + data[((H - 1) * W) * 4 + 3] + data[((H - 1) * W + W - 1) * 4 + 3];
  if (corner > 0) throw new Error('background not transparent');
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, fill = Math.max(cw, ch) / Math.max(W, H);
  if (fill < 0.45) throw new Error(`emblem too small (${(fill * 100) | 0}%)`);
  const crop = await sharp(raw).extract({ left: x0, top: y0, width: cw, height: ch }).png().toBuffer();
  const inner = await sharp(crop).resize(236, 236, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: inner, left: 10, top: 10 }]).png().toBuffer();
}
async function makeIcons() {
  const n = Number(arg('--n') || 3), tiles = [];
  for (const id of Object.keys(ICONS)) {
    if (!want(id)) continue;
    for (let k = 1, got = 0; got < n && k <= n + 4; k++) {
      process.stdout.write(`${id} candidate ${k} ... `);
      try {
        const png = await iconCandidate(await ludo('assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + ICONS[id] + '.' }));
        got++; const f = path.join(REVIEW, `icon_${id}_${got}.png`); fs.writeFileSync(f, png); tiles.push({ f, id, got }); console.log('ok -> ' + path.basename(f));
      } catch (e) { console.log('rejected: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(2000); }
    }
  }
  // contact sheet on the HUD's dark plate and on a light plate, at bar size (48 px) and big (160 px)
  const comp = []; tiles.forEach((t, i) => { comp.push({ input: t.f, left: 10 + i * 270, top: 10 }); });
  for (const [i, t] of tiles.entries()) { const big = await sharp(t.f).resize(160, 160).png().toBuffer(), sm = await sharp(t.f).resize(48, 48).png().toBuffer(); comp.push({ input: big, left: 10 + i * 270, top: 275 }, { input: sm, left: 190 + i * 270, top: 330 }); }
  if (tiles.length) await sharp({ create: { width: 10 + tiles.length * 270, height: 450, channels: 4, background: { r: 30, g: 36, b: 52, alpha: 1 } } }).composite(comp).png().toFile(path.join(REVIEW, 'icons_sheet.png'));
  console.log('sheet: ' + tiles.map((t) => `${t.id}#${t.got}`).join('  '));
}
async function pick(spec) {
  const [id, k] = spec.split('='); if (!ICONS[id]) throw new Error('unknown icon ' + id);
  const src = path.join(REVIEW, `icon_${id}_${k}.png`), out = path.join(ROOT, 'Sprites', 'skills', id + '.webp');
  fs.writeFileSync(out + '.tmp', await sharp(src).webp({ lossless: true }).toBuffer()); fs.renameSync(out + '.tmp', out);
  console.log(`wrote Sprites/skills/${id}.webp from candidate ${k}`);
}

// ---- sound ----------------------------------------------------------------------------------------
const run = (cmd, a) => { const r = spawnSync(cmd, a, { encoding: 'utf8' }); if (r.status !== 0) throw new Error(cmd + ' failed: ' + (r.stderr || '').slice(-200)); return r; };
const dur = (f) => +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.trim();
const peak = (f) => { const m = /max_volume: (-?[\d.]+) dB/.exec(run('ffmpeg', ['-hide_banner', '-i', f, '-af', 'volumedetect', '-f', 'null', '-']).stderr); return m ? +m[1] : 0; };
// trim leading/trailing silence, cap at `max` with a 40 ms fade-out, peak-normalise to -1 dBFS, encode like the clip it replaces
function master(rawMp3, out, max, fmt) {
  const a = path.join(REVIEW, '_a.wav'), b = path.join(REVIEW, '_b.wav');
  run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', rawMp3, '-af', 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.004,areverse,silenceremove=start_periods=1:start_threshold=-54dB:start_silence=0.03,areverse', a]);
  const d = Math.min(dur(a), max - 0.03), g = -1 - peak(a);
  run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', a, '-t', d.toFixed(3), '-af', `volume=${g.toFixed(2)}dB,afade=t=out:st=${Math.max(0, d - 0.04).toFixed(3)}:d=0.04`, b]);
  run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', b, '-c:a', 'libmp3lame', '-b:a', fmt.br, '-ar', fmt.sr, '-ac', fmt.ch, out]);
  return { d: dur(out), gain: g };
}
async function makeSfx() {
  for (const [id, [prompt, req, max]] of Object.entries(SFX)) {
    if (!want(id)) continue;
    const target = path.join(ROOT, 'audio', 'skill', id + '.mp3');
    const ref = fs.existsSync(target) ? target : path.join(ROOT, 'audio', 'skill', 'marksman_oneshot.mp3');
    const [codec, sr, ch, bps] = run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels,bit_rate', '-of', 'csv=p=0', ref]).stdout.trim().split(',');
    const fmt = { sr, ch, br: Math.round(+bps / 1000) + 'k' };
    const takes = [];
    for (let t = 1; t <= 3 && takes.length < 2; t++) {
      process.stdout.write(`${id} take ${t} (req ${req}s) ... `);
      try {
        const raw = path.join(REVIEW, `sfx_${id}_${t}_raw.mp3`), out = path.join(REVIEW, `sfx_${id}_${t}.mp3`);
        fs.writeFileSync(raw, await ludo('audio/sound-effect', { description: prompt, duration: req, loop: false }, 150000));
        const rawD = dur(raw), m = master(raw, out, max, fmt);
        if (m.d < 0.12) throw new Error(`only ${m.d.toFixed(2)}s of sound after trimming`);
        takes.push({ out, d: m.d, rawD }); console.log(`raw ${rawD.toFixed(2)}s -> ${m.d.toFixed(2)}s (gain ${m.gain.toFixed(1)} dB)`);
      } catch (e) { console.log('rejected: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(2000); }
    }
    if (!takes.length) { console.error('FAILED: no usable take for ' + id); process.exit(1); }
    // the take whose natural length (before the cap) sits closest to the brief: an overshooting take was cut, not composed
    takes.sort((x, y) => Math.abs(Math.min(x.rawD, 2) - req) - Math.abs(Math.min(y.rawD, 2) - req));
    const bak = path.join(REVIEW, `sfx_${id}_before.mp3`); if (fs.existsSync(target) && !fs.existsSync(bak)) fs.copyFileSync(target, bak);
    fs.copyFileSync(takes[0].out, target + '.tmp'); fs.renameSync(target + '.tmp', target);
    console.log(`  -> audio/skill/${id}.mp3 = ${path.basename(takes[0].out)} (${takes[0].d.toFixed(2)}s; ${codec} ${fmt.br} ${sr} Hz ${ch}ch)`);
  }
}
if ((has('--icons') || has('--sfx')) && !KEY) { console.error('LUDO_API_KEY required.'); process.exit(1); }
if (has('--icons')) await makeIcons();
if (arg('--pick')) for (const s of arg('--pick').split(',')) await pick(s);
if (has('--sfx')) await makeSfx();
if (!has('--icons') && !arg('--pick') && !has('--sfx')) { for (const [k, v] of Object.entries(ICONS)) console.log('icon ' + k + ': ' + v); for (const [k, v] of Object.entries(SFX)) console.log('sfx ' + k + ': ' + v[0]); }
