#!/usr/bin/env node
// WEAPON IMPACT CLIPS (final polish audit C6; per user "Work on all the above"). Every landed hit of every class was the
// same synth beep - 'hit' a 240 Hz square, 'crit' a chirp - while casts use recorded clips and monsters have 285 of their
// own. Eight short impacts from ludo.ai's /audio/sound-effect, one normal and one critical per class, played through the
// existing once-per-frame hit-sound block (the synth stays as the fallback while a clip loads).
// Each is accepted only when measured: short (a hit, not a whoosh), not near-silent; trimmed of trailing silence with a
// 25 ms fade so it never clicks, and peak-normalised (crit a little hotter than normal).
//
//   node scripts/gen_impact_sfx.mjs              # dry run
//   node scripts/gen_impact_sfx.mjs --generate   # calls ludo.ai (LUDO_API_KEY), writes audio/impact/*.mp3
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const FFMPEG = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.IMPACT_DIR || path.join(ROOT, 'audio', 'impact');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const MAX_SEC = 0.45;
const SHORT = ' A single very short punchy one-shot game hit sound, no whoosh before it, no voice, no music, no reverb tail, mono.';
const CRIT = ' Heavier and brighter than a normal hit: a sharp critical-hit impact with an extra metallic ring or crack.';
const CLS = {
  warrior: 'A heavy sword or axe striking a monster: a meaty thwack with a dull metal edge.',
  rogue: 'A quick dagger stab into a monster: a short sharp slice and a tight flesh tick.',
  mage: 'A magic bolt hitting a monster: a compact arcane zap-thump with a faint sparkle.',
  archer: 'An arrow striking a monster: a crisp wooden thunk as the arrowhead lands.',
};
const JOBS = [];
for (const c of Object.keys(CLS)) {
  JOBS.push({ file: `hit_${c}.mp3`, desc: CLS[c] + SHORT, peak: -5 });
  JOBS.push({ file: `hit_${c}_crit.mp3`, desc: CLS[c] + CRIT + SHORT, peak: -3 });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function probe(file) {
  const t = String(spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '');
  const d = t.match(/Duration: (\d+):(\d+):([\d.]+)/), mx = t.match(/max_volume: (-?[\d.]+) dB/), mean = t.match(/mean_volume: (-?[\d.]+) dB/);
  return { dur: d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : NaN, max: mx ? parseFloat(mx[1]) : NaN, mean: mean ? parseFloat(mean[1]) : NaN };
}
async function ludoSound(desc, dur, key) {
  const res = await fetch(`${API}/audio/sound-effect`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(180000), body: JSON.stringify({ description: desc, duration: dur, loop: false }) });
  if (res.status === 402) throw new Error('OUT OF CREDITS');
  if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  let j = await res.json();
  if (res.status === 202 || (j && j.id && j.status && !j.url && !j.result)) {   // asset endpoints answer with a job (2026-09-11)
    const t0 = Date.now();
    while (j.status !== 'succeeded') {
      if (j.status === 'failed' || j.status === 'cancelled') throw new Error('job ' + j.status);
      if (Date.now() - t0 > 600000) throw new Error('job timed out');
      await sleep(Math.min(15000, Math.max(2000, Number(j.poll_after_ms) || 5000)));
      const r = await fetch(`${API}/assets/jobs/${j.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error('poll HTTP ' + r.status); j = await r.json();
    }
  }
  const R = (j.result && !Array.isArray(j.result)) ? j.result : (Array.isArray(j.result) ? j.result[0] : j);
  const url = (R && (R.url || R.audio_url)) || j.url;
  if (!url) throw new Error('no url: ' + JSON.stringify(j).slice(0, 160));
  return Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
}
if (!process.argv.includes('--generate')) { for (const j of JOBS) console.log(`plan ${j.file} (<= ${MAX_SEC}s, peak ${j.peak} dB): ${j.desc.slice(0, 80)}...`); process.exit(0); }
const key = process.env.LUDO_API_KEY; if (!key) { console.log('LUDO_API_KEY is not set'); process.exit(2); }
fs.mkdirSync(OUT_DIR, { recursive: true });
let bad = 0;
for (const j of JOBS) {
  let ok = false;
  for (let a = 1; a <= 3 && !ok; a++) {
    process.stdout.write(`${j.file} attempt ${a} ... `);
    try {
      const raw = path.join(os.tmpdir(), 'imp_raw_' + process.pid + '_' + j.file);
      fs.writeFileSync(raw, await ludoSound(j.desc, 0.5, key));
      // trim leading / trailing silence, cap the length, fade the tail, then peak-normalise
      const trim = path.join(os.tmpdir(), 'imp_trim_' + process.pid + '_' + j.file.replace('.mp3', '.wav'));
      let r = spawnSync(FFMPEG, ['-hide_banner', '-y', '-i', raw, '-af', `silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,atrim=0:${MAX_SEC},afade=t=out:st=${(MAX_SEC - 0.025).toFixed(3)}:d=0.025`, '-ac', '1', '-ar', '44100', trim], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error('trim: ' + String(r.stderr).slice(-120));
      const m = probe(trim);
      if (!(m.dur >= 0.06 && m.dur <= MAX_SEC + 0.02) || !(m.max > -40)) throw new Error(`rejected: ${m.dur}s, max ${m.max} dB`);
      const out = path.join(OUT_DIR, j.file);
      r = spawnSync(FFMPEG, ['-hide_banner', '-y', '-i', trim, '-af', `volume=${(j.peak - m.max).toFixed(2)}dB`, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', '-map_metadata', '-1', out + '.tmp.mp3'], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error('encode: ' + String(r.stderr).slice(-120));
      fs.renameSync(out + '.tmp.mp3', out);
      const f = probe(out); console.log(`ok ${f.dur.toFixed(2)}s, peak ${f.max} dB, mean ${f.mean} dB`); ok = true;
    } catch (e) { console.log('fail: ' + e.message); if (/CREDITS/.test(e.message)) { a = 99; } else await sleep(3000 * a); }
  }
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
