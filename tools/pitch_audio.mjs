#!/usr/bin/env node
// Deterministic pitch-shift for game clips (companion to trim_audio.mjs).
//   node tools/pitch_audio.mjs <file> <pitchFactor> [--keep-duration] [--volume X]
// pitchFactor: 0.8 = ~3 semitones down, 1.25 = ~4 up. Without --keep-duration
// the clip also lengthens (down) / shortens (up) with the shift, which often
// sounds more natural for monster voices. In-place, atomic.
import { execFileSync } from 'node:child_process';
import { renameSync, statSync } from 'node:fs';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

const args = process.argv.slice(2);
const file = args[0], f = +args[1];
if (!file || !(f > 0)) { console.error('usage: node tools/pitch_audio.mjs <file> <pitchFactor> [--keep-duration] [--volume X]'); process.exit(1); }
const keep = args.includes('--keep-duration');
const vi = args.indexOf('--volume');
const vol = vi >= 0 ? +args[vi + 1] : 1;

const SR = 44100;
const chain = [`aresample=${SR}`, `asetrate=${Math.round(SR * f)}`, `aresample=${SR}`];
if (keep) {
  // atempo accepts 0.5..2.0 per stage; chain stages if the compensation is outside
  let t = 1 / f;
  while (t < 0.5) { chain.push('atempo=0.5'); t /= 0.5; }
  while (t > 2.0) { chain.push('atempo=2.0'); t /= 2.0; }
  chain.push(`atempo=${t.toFixed(4)}`);
}
if (vol !== 1) chain.push(`volume=${vol}`);

const tmp = file + '.pitch.mp3';
execFileSync(ffmpegPath.path, ['-y', '-i', file, '-af', chain.join(','), '-codec:a', 'libmp3lame', '-q:a', '4', tmp], { stdio: 'pipe' });
renameSync(tmp, file);
console.log(`${file} -> pitch x${f}${keep ? ' (duration kept)' : ''}${vol !== 1 ? ' vol x' + vol : ''} (${Math.round(statSync(file).size / 1024)}kB)`);
