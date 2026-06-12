#!/usr/bin/env node
// Deterministic SFX duration enforcement: trim a clip to a target length with
// a short fade-out (ludo's duration param is advisory and often over-pads).
//   node tools/trim_audio.mjs <file> <seconds> [fadeMs=80]
// Trims IN PLACE (atomic via .tmp rename). Uses the npm static ffmpeg.
import { execFileSync } from 'node:child_process';
import { renameSync, statSync } from 'node:fs';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

const [, , file, secStr, fadeStr] = process.argv;
if (!file || !secStr) { console.error('usage: node tools/trim_audio.mjs <file> <seconds> [fadeMs]'); process.exit(1); }
const sec = +secStr, fade = (+fadeStr || 80) / 1000;
const tmp = file + '.trim.mp3';
execFileSync(ffmpegPath.path, [
  '-y', '-i', file,
  '-t', String(sec),
  '-af', `afade=t=out:st=${(sec - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
  '-codec:a', 'libmp3lame', '-q:a', '4',
  tmp,
], { stdio: 'pipe' });
renameSync(tmp, file);
console.log(`${file} -> ${sec}s (${Math.round(statSync(file).size / 1024)}kB)`);
