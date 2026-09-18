#!/usr/bin/env node
// SOUND-EFFECT OUTLIERS (final polish audit A9; per user "keep going to test and debug", 2026-09-18).
//
// Within a folder where every clip is the same KIND of event - a monster's hurt / death cry, the player's hurt / death
// voice, a boss's intro line, an NPC's talk babble - a few clips were generated far quieter or louder than the rest:
// Octobaby's Stun leg died 30 LU under the other monsters (inaudible), an archer's second hurt grunt sat 18 LU under his
// first, the Shroomaloo intro 15 LU under the other bosses, Stormbearer's babble 13 LU over every other NPC. This moves
// only those outliers, with plain gain (no compressor or limiter, so nothing changes shape): a clip more than SPREAD LU
// from its folder's median goes to within PULL LU of it, and a boost stops where the true peak would pass CEIL_TP.
// Loudness is each clip's loudest 400 ms (EBU R128 momentary), which suits clips shorter than the integrated gate.
// UI and skill sounds are left alone: their differences are design, not accident.
//
//   node scripts/level_sfx_outliers.mjs            # dry run: the plan
//   node scripts/level_sfx_outliers.mjs --write    # apply (re-encodes only the outliers, atomically)
//   node scripts/level_sfx_outliers.mjs --check    # exit 1 while any clip is an outlier its headroom could fix
// Afterwards: node scripts/gen_sfx_manifest.mjs (it records each file's size).
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const FFMPEG = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = process.env.AUDIO_DIR || path.join(ROOT, 'audio');
const DIRS = ['monster', 'voice', 'boss', 'npc'], SPREAD = 8, PULL = 4, CEIL_TP = -1, MIN_MOVE = 2;
const KEEP = new Set(['npc_whisper.mp3']);   // an NPC called Whisper: quiet on purpose
const has = (f) => process.argv.includes(f);

function measure(file) {
  const t = String(spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-v', 'verbose', '-i', file, '-af', 'apad=pad_len=22050,ebur128=peak=true:framelog=verbose', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 }).stderr);
  let M = -99; for (const m of t.matchAll(/ M:\s*(-?[\d.]+)/g)) M = Math.max(M, +m[1]);
  const tp = parseFloat((t.slice(t.lastIndexOf('Summary:')).match(/Peak:\s+(-?[\d.]+)/) || [])[1]);
  const info = t.match(/Audio: mp3, (\d+) Hz, (mono|stereo)[^\n]*?(\d+) kb\/s/);
  return { M, tp, rate: info ? +info[1] : 44100, ch: info && info[2] === 'mono' ? 1 : 2, kbps: info ? +info[3] : 128 };
}
function applyGain(file, gainDb, m) {
  const tmp = path.join(os.tmpdir(), 'lvl_' + process.pid + '_' + path.basename(file));
  const r = spawnSync(FFMPEG, ['-hide_banner', '-y', '-i', file, '-af', `volume=${gainDb.toFixed(2)}dB`, '-ar', String(m.rate), '-ac', String(m.ch),
    '-c:a', 'libmp3lame', '-b:a', Math.max(64, Math.min(192, m.kbps)) + 'k', tmp], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(tmp) || fs.statSync(tmp).size < 500) throw new Error('ffmpeg failed on ' + file + ': ' + String(r.stderr).slice(-200));
  fs.copyFileSync(tmp, file + '.tmp'); fs.renameSync(file + '.tmp', file); fs.unlinkSync(tmp);   // atomic over the original
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
let open = 0, moved = 0;
for (const d of DIRS) {
  const dir = path.join(AUDIO, d); if (!fs.existsSync(dir)) continue;
  const rows = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort().map((f) => ({ f, p: path.join(dir, f), ...measure(path.join(dir, f)) })).filter((x) => x.M > -70);
  const med = median(rows.map((x) => x.M));
  console.log(`${d}: ${rows.length} clips, median ${med.toFixed(1)} LUFS (momentary max)`);
  for (const x of rows) {
    const off = x.M - med; if (Math.abs(off) <= SPREAD || KEEP.has(x.f)) continue;
    const want = off < 0 ? (med - PULL) - x.M : (med + PULL) - x.M;
    const gain = off < 0 ? Math.min(want, CEIL_TP - x.tp) : want;
    const line = `  ${x.f.padEnd(34)} ${off > 0 ? '+' : ''}${off.toFixed(1)} LU  peak ${x.tp.toFixed(1)}  gain ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB${gain < want - 0.05 && off < 0 ? ' (peak-limited)' : ''}`;
    if (Math.abs(gain) < MIN_MOVE) { console.log('  keep' + line.slice(1) + '  (no room)'); continue; }
    if (has('--check')) { open++; console.log('  OFF ' + line.slice(2)); continue; }
    if (has('--write')) { applyGain(x.p, gain, x); const a = measure(x.p); moved++; console.log(`  done${line.slice(1)} -> ${(a.M - med).toFixed(1)} LU, peak ${a.tp.toFixed(1)}`); }
    else console.log('  plan' + line.slice(1));
  }
}
if (has('--check')) { console.log(open ? `${open} clip(s) are outliers their headroom could fix` : 'no fixable outliers'); process.exit(open ? 1 : 0); }
if (has('--write')) console.log(`${moved} clip(s) re-levelled`);
