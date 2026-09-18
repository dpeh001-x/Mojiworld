#!/usr/bin/env node
// THE DASH'S WHOOSH (v0.30.x, final polish audit A5). The Shift / double-tap dash made no sound: quickDash called nothing
// and audio.play('dash') had no branch. audio/skill/dash.mp3 is the right whoosh but spends 0.2 s rising before it arrives
// (it peaks 335 ms in), so on a 0.15 s dash it would land after the move. This cuts its body out - from 190 ms, 280 ms long,
// a 120 ms exponential fade - and sets it at -9 dBFS peak, a step under the weapon impacts, because players dash constantly.
// dash.mp3 itself is untouched: skills that alias to it keep it.
//   node scripts/make_quick_dash_sfx.mjs      # writes audio/skill/quick_dash.mp3 (atomic)
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const FFMPEG = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'audio', 'skill', 'dash.mp3'), OUT = path.join(ROOT, 'audio', 'skill', 'quick_dash.mp3');
const START = 0.19, LEN = 0.28, FADE = 0.12, PEAK = -9;
const cut = `atrim=${START}:${(START + LEN).toFixed(2)},asetpts=PTS-STARTPTS`;
const mx = parseFloat((spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', SRC, '-af', cut + ',volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/max_volume: (-?[\d.]+)/) || [])[1]);
if (!Number.isFinite(mx)) throw new Error('could not read ' + SRC);
const tmp = OUT + '.tmp.mp3';
const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', SRC, '-af',
  `${cut},afade=t=out:st=${(LEN - FADE).toFixed(2)}:d=${FADE}:curve=exp,volume=${(PEAK - mx).toFixed(2)}dB`,
  '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', '-map_metadata', '-1', tmp], { encoding: 'utf8' });
if (r.status || !fs.existsSync(tmp) || fs.statSync(tmp).size < 1000) throw new Error('ffmpeg failed: ' + String(r.stderr).slice(-160));
fs.renameSync(tmp, OUT);
console.log(`wrote ${path.relative(ROOT, OUT)} (${fs.statSync(OUT).size} bytes): ${START}-${(START + LEN).toFixed(2)} s of dash.mp3, peak ${PEAK} dBFS`);
