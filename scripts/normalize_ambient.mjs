#!/usr/bin/env node
// AMBIENT LOOPS AT ONE LEVEL (final polish audit A2; per user "Work on all the above").
//
// Every ambient loop plays at the same base volume (_AMBIENT_TARGET_VOL), so the FILE decides what a player hears -
// and the 17 files ranged from -57 LUFS (meadow, the only ambience on four maps: silent) to -11 (abyss, cosmic, void,
// temple: about as loud as the music they sit under, which measures around -12.5). This brings each to TARGET_LUFS
// with plain gain: no compressor, no limiter, no dynamic loudnorm, because anything that changes gain over time can
// open an audible seam where a loop wraps. The one limit is headroom: a boost stops where the true peak would pass
// -1 dBTP, so a very spiky quiet file lands a little under the target rather than clipping.
//
//   node scripts/normalize_ambient.mjs             # dry run: measure, print the plan
//   node scripts/normalize_ambient.mjs --write     # apply (re-encodes the files it changes)
//   node scripts/normalize_ambient.mjs --check     # exit 1 when any loop is off target by more than TOL
//   node scripts/normalize_ambient.mjs --regen-meadow --write   # first replace meadow via ludo.ai (LUDO_API_KEY)
// Afterwards: node scripts/gen_sfx_manifest.mjs (it records each file's size).
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const FFMPEG = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.env.AMBIENT_DIR || path.join(ROOT, 'audio', 'ambient');
const TARGET_LUFS = -24, TOL = 1.5, CEIL_TP = -1, SKIP_WITHIN = 0.5;
const argv = process.argv.slice(2), has = (f) => argv.includes(f);

function measure(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const t = String(r.stderr || ''), sum = t.slice(t.lastIndexOf('Summary:'));
  const num = (re) => { const m = sum.match(re); return m ? parseFloat(m[1]) : NaN; };
  const info = t.match(/Audio: mp3, (\d+) Hz, (mono|stereo)/);
  return { I: num(/I:\s+(-?[\d.]+) LUFS/), tp: num(/Peak:\s+(-?[\d.]+) dBFS/), rate: info ? +info[1] : 44100, ch: info && info[2] === 'mono' ? 1 : 2 };
}
function applyGain(file, gainDb, m) {
  const tmp = path.join(os.tmpdir(), 'amb_' + process.pid + '_' + path.basename(file));
  const r = spawnSync(FFMPEG, ['-hide_banner', '-y', '-i', file, '-af', `volume=${gainDb.toFixed(2)}dB`, '-ar', String(m.rate), '-ac', String(m.ch),
    '-c:a', 'libmp3lame', '-b:a', m.ch === 1 ? '64k' : '128k', '-map_metadata', '-1', tmp], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(tmp) || fs.statSync(tmp).size < 2000) throw new Error('ffmpeg failed on ' + file + ': ' + String(r.stderr).slice(-200));
  fs.copyFileSync(tmp, file + '.tmp'); fs.renameSync(file + '.tmp', file); fs.unlinkSync(tmp);   // atomic over the original
}

// ---- meadow: the shipped file is near-silent (-57 LUFS); lifting it 33 dB would lift its noise floor with it -------
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function regenMeadow() {
  const key = process.env.LUDO_API_KEY; if (!key) throw new Error('LUDO_API_KEY is not set');
  const desc = 'Calm open meadow on a sunny day: a soft steady breeze through tall grass, distant songbirds calling now and '
    + 'then, a faint hum of insects. Gentle, even and unobtrusive, a background bed for a game level. No music, no voices, '
    + 'no sudden loud sounds, seamless loop.';
  for (let a = 1; a <= 3; a++) {
    process.stdout.write(`meadow attempt ${a} ... `);
    try {
      const res = await fetch(`${API}/audio/sound-effect`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(180000), body: JSON.stringify({ description: desc, duration: 10, loop: true })   /* 20 s fails schema validation */ });
      if (res.status === 402) throw new Error('OUT OF CREDITS');
      if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
      let j = await res.json();
      if (res.status === 202 || (j && j.id && j.status && !j.url && !j.result)) {   // 2026-09-11: asset endpoints answer with a job
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
      const buf = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
      const tmp = path.join(os.tmpdir(), 'meadow_new_' + process.pid + '.mp3'); fs.writeFileSync(tmp, buf);
      const m = measure(tmp), dur = parseFloat((String(spawnSync(FFMPEG, ['-hide_banner', '-i', tmp], { encoding: 'utf8' }).stderr).match(/Duration: 00:00:([\d.]+)/) || [])[1]);
      console.log(`${(buf.length / 1024) | 0} KB, ${dur}s, ${m.I} LUFS`);
      if (!(dur >= 8) || !(m.I > -45)) throw new Error('rejected: too short or still near-silent');
      return tmp;
    } catch (e) { console.log('fail: ' + e.message); if (/CREDITS/.test(e.message)) break; await sleep(4000 * a); }
  }
  return null;
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.mp3')).sort();
if (has('--regen-meadow')) {
  const nm = await regenMeadow();
  if (nm && has('--write')) { fs.copyFileSync(nm, path.join(DIR, 'meadow.mp3.tmp')); fs.renameSync(path.join(DIR, 'meadow.mp3.tmp'), path.join(DIR, 'meadow.mp3')); console.log('meadow replaced'); }
  else if (!nm) console.log('meadow NOT replaced - normalising the old file instead');
}
let off = 0;
for (const f of files) {
  const p = path.join(DIR, f), m = measure(p);
  if (!Number.isFinite(m.I)) { console.log(`${f}: could not measure`); off++; continue; }
  const want = TARGET_LUFS - m.I, room = CEIL_TP - m.tp, gain = Math.min(want, room);
  const line = `${f.padEnd(14)} ${m.I.toFixed(1).padStart(6)} LUFS  peak ${m.tp.toFixed(1).padStart(5)}  gain ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB${gain < want - 0.05 ? ' (peak-limited)' : ''}`;
  if (has('--check')) {
    // off target AND still movable: a loop held under the target by its own peak is as loud as it can be without clipping
    const bad = Math.abs(m.I - TARGET_LUFS) > TOL && Math.abs(gain) > SKIP_WITHIN;
    if (bad) off++;
    console.log((bad ? 'OFF ' : 'ok  ') + line); continue;
  }
  if (Math.abs(want) <= SKIP_WITHIN || Math.abs(gain) <= SKIP_WITHIN) { console.log('keep ' + line); continue; }   // on target, or as close as its peak allows: no lossy re-encode for nothing
  if (has('--write')) { applyGain(p, gain, m); const a = measure(p); console.log(`done ${line} -> ${a.I.toFixed(1)} LUFS, peak ${a.tp.toFixed(1)}`); }
  else console.log('plan ' + line);
}
if (has('--check')) { console.log(off ? `${off} loop(s) off target` : `all ${files.length} loops within ${TARGET_LUFS} +- ${TOL} LUFS`); process.exit(off ? 1 : 0); }
