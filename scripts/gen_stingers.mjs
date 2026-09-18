#!/usr/bin/env node
// VICTORY + DEFEAT STINGS (final polish audit A4 / B6; per user "Work on all the above"). The game had none: a boss kill
// kept the boss theme looping under the boon wheel, and a death was a 0.45 s synth buzz over the map music. Two short
// musical stings from ludo.ai's /audio/sound-effect, each accepted only when measured - long enough to read as a phrase,
// short enough to stay a sting, not near-silent - and brought to TARGET_LUFS with plain gain (true peak <= -1 dBTP) so
// they sit just under the music they interrupt.
//
//   node scripts/gen_stingers.mjs              # dry run: prints the plan
//   node scripts/gen_stingers.mjs --generate   # calls ludo.ai (LUDO_API_KEY), writes audio/stinger/*.mp3
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const FFMPEG = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.STINGER_DIR || path.join(ROOT, 'audio', 'stinger');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TARGET_LUFS = -16;
const NOT = ' No voices, no singing, no sound effects, no ambience; clean ending with a short natural tail.';
const STINGS = [
  { file: 'victory.mp3', dur: 4, min: 2.5, max: 6,
    desc: 'Short triumphant fantasy RPG victory fanfare: bright brass and strings rise into a warm major-key resolve, '
      + 'a final held chord with a cymbal swell, joyful and heroic, like finishing a boss battle.' + NOT },
  { file: 'defeat.mp3', dur: 4, min: 2.5, max: 6,
    desc: 'Short somber fantasy RPG defeat sting: a slow descending minor phrase on soft strings and a low piano, '
      + 'fading into a quiet held low note, sad but gentle, like falling in battle.' + NOT },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function probe(file) {
  const t = String(spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '');
  const sum = t.slice(t.lastIndexOf('Summary:')), num = (re) => { const m = sum.match(re); return m ? parseFloat(m[1]) : NaN; };
  const d = t.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return { I: num(/I:\s+(-?[\d.]+) LUFS/), tp: num(/Peak:\s+(-?[\d.]+) dBFS/), dur: d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : NaN };
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
if (!process.argv.includes('--generate')) {
  for (const s of STINGS) console.log(`plan ${s.file} (${s.dur}s, accept ${s.min}-${s.max}s, -> ${TARGET_LUFS} LUFS): ${s.desc.slice(0, 90)}...`);
  process.exit(0);
}
const key = process.env.LUDO_API_KEY; if (!key) { console.log('LUDO_API_KEY is not set'); process.exit(2); }
fs.mkdirSync(OUT_DIR, { recursive: true });
let bad = 0;
for (const s of STINGS) {
  let ok = false;
  for (let a = 1; a <= 3 && !ok; a++) {
    process.stdout.write(`${s.file} attempt ${a} ... `);
    try {
      const raw = path.join(os.tmpdir(), 'sting_raw_' + process.pid + '_' + s.file);
      fs.writeFileSync(raw, await ludoSound(s.desc, s.dur, key));
      const m = probe(raw);
      if (!(m.dur >= s.min && m.dur <= s.max) || !(m.I > -40)) throw new Error(`rejected: ${m.dur}s, ${m.I} LUFS`);
      const gain = Math.min(TARGET_LUFS - m.I, -1 - m.tp), out = path.join(OUT_DIR, s.file);
      const r = spawnSync(FFMPEG, ['-hide_banner', '-y', '-i', raw, '-af', `volume=${gain.toFixed(2)}dB`, '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '160k', '-map_metadata', '-1', out + '.tmp.mp3'], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error('ffmpeg: ' + String(r.stderr).slice(-160));
      fs.renameSync(out + '.tmp.mp3', out);
      const f = probe(out); console.log(`ok ${f.dur.toFixed(2)}s, ${f.I.toFixed(1)} LUFS, peak ${f.tp.toFixed(1)}`); ok = true;
    } catch (e) { console.log('fail: ' + e.message); if (/CREDITS/.test(e.message)) { a = 99; } else await sleep(3000 * a); }
  }
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
