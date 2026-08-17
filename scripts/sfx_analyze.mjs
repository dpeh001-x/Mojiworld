#!/usr/bin/env node
// SFX A/B ANALYSER — decodes clips to mono PCM with the bundled ffmpeg and
// reports the two numbers that decide whether a regen actually fixed a TIMBRE
// complaint, instead of trusting the prompt:
//
//   * spectral centroid — "brightness". A squeak/yelp sits high; a wet
//     necrotic groan sits low. This is the number that answers "does it still
//     sound like an animal squeak".
//   * tail RMS — how loud the clip still is at its final 60 ms, in dB below
//     peak. Clips that had to be hard-trimmed to fit the 1 s bar can end
//     mid-sound; anything quieter than about -25 dBFS-peak is an inaudible cut.
//
//   node scripts/sfx_analyze.mjs <file.mp3> [more.mp3 ...]
//   node scripts/sfx_analyze.mjs --ab <old.mp3> <new.mp3>
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path;
const SR = 22050;

function pcm(file) {
  const raw = execFileSync(FFMPEG, [
    '-v', 'quiet', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-',
  ], { maxBuffer: 64 * 1024 * 1024 });
  const n = Math.floor(raw.length / 2);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = raw.readInt16LE(i * 2) / 32768;
  return x;
}

// Goertzel-free: a plain DFT magnitude over log-spaced bands is enough for a
// centroid, and a 512-point frame at 22.05 kHz is cheap on a sub-second clip.
function centroid(x) {
  const N = 512, HOP = 256;
  let num = 0, den = 0;
  for (let s = 0; s + N <= x.length; s += HOP) {
    const re = new Float64Array(N / 2), im = new Float64Array(N / 2);
    for (let k = 1; k < N / 2; k++) {
      let r = 0, i2 = 0;
      for (let n = 0; n < N; n++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1));   // hann
        const a = (2 * Math.PI * k * n) / N;
        r += x[s + n] * w * Math.cos(a);
        i2 -= x[s + n] * w * Math.sin(a);
      }
      re[k] = r; im[k] = i2;
    }
    for (let k = 1; k < N / 2; k++) {
      const mag = Math.hypot(re[k], im[k]);
      num += mag * (k * SR / N);
      den += mag;
    }
  }
  return den ? num / den : 0;
}

// VOWEL BAND RATIO — the share of a clip's energy that sits below 1 kHz.
//
// This is the number that separates a HUMAN voice from a critter noise, which
// spectral centroid alone does not. A spoken/babbled vowel puts its first
// formant at roughly 300-900 Hz and carries serious energy there; a chirp,
// squeak, trill or birdlike tone is essentially empty below ~1.5 kHz. So a
// voice clip that reads as "an animal" measures LOW here even when its pitch
// is nominally in a girl's register.
function vowelBandRatio(x, cutHz = 1000) {
  const N = 1024, HOP = 512;
  let low = 0, all = 0;
  const kCut = Math.round(cutHz * N / SR);
  for (let s = 0; s + N <= x.length; s += HOP) {
    for (let k = 1; k < N / 2; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1));
        const a = (2 * Math.PI * k * n) / N;
        re += x[s + n] * w * Math.cos(a);
        im -= x[s + n] * w * Math.sin(a);
      }
      const mag = Math.hypot(re, im);
      all += mag;
      if (k <= kCut) low += mag;
    }
  }
  return all ? low / all : 0;
}

// f0 by autocorrelation over the highest-energy 40 ms window. Deliberately the
// SAME algorithm scripts/npc_voice_cast_test.mjs runs in Chrome, so the number
// a generation is accepted on is the number the shipped test will report.
function f0Of(x) {
  const win = Math.floor(SR * 0.04);
  let best = 0, bestE = -1;
  for (let s = 0; s + win < x.length; s += Math.floor(win / 2)) {
    let e = 0;
    for (let i = s; i < s + win; i++) e += x[i] * x[i];
    if (e > bestE) { bestE = e; best = s; }
  }
  const seg = x.slice(best, best + win);
  const minLag = Math.floor(SR / 900), maxLag = Math.floor(SR / 70);
  let bestLag = -1, bestCorr = 0;
  for (let lag = minLag; lag <= maxLag && lag < seg.length; lag++) {
    let c = 0;
    for (let i = 0; i + lag < seg.length; i++) c += seg[i] * seg[i + lag];
    if (c > bestCorr) { bestCorr = c; bestLag = lag; }
  }
  return bestLag > 0 ? SR / bestLag : 0;
}

const rms = (x, a, b) => {
  let s = 0; const n = Math.max(1, b - a);
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return Math.sqrt(s / n);
};

function report(file) {
  const x = pcm(file);
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  const tail = rms(x, Math.max(0, x.length - Math.round(SR * 0.06)), x.length);
  const dB = (v) => (v > 0 && peak > 0) ? (20 * Math.log10(v / peak)).toFixed(1) : '-inf';
  return {
    file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
    sec: +(x.length / SR).toFixed(2),
    kb: +(fs.statSync(file).size / 1024).toFixed(0),
    centroidHz: Math.round(centroid(x)),
    tailDbBelowPeak: dB(tail),
  };
}

// Voice-specific report: adds the vowel-band ratio. Kept separate because it
// is another full DFT sweep and monster SFX have no use for it.
function voiceReport(file) {
  const base = report(file);
  const x = pcm(file);
  return { ...base, f0: Math.round(f0Of(x)), vowelBand: +vowelBandRatio(x).toFixed(3) };
}

export { pcm, centroid, rms, report, vowelBandRatio, f0Of, voiceReport };

// Importable as a library (gen_rotter_sfx.mjs scores its candidates with it),
// so only run the CLI when this file IS the entry point.
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (!isMain) { /* imported — no CLI */ } else {

const argv = process.argv.slice(2);
if (!argv.length) { console.error('usage: sfx_analyze.mjs [--ab old new] <files...>'); process.exit(1); }
if (argv[0] === '--ab') {
  const a = report(argv[1]), b = report(argv[2]);
  console.log('OLD', JSON.stringify(a));
  console.log('NEW', JSON.stringify(b));
  const d = b.centroidHz - a.centroidHz;
  console.log(`centroid ${a.centroidHz} -> ${b.centroidHz} Hz  (${d >= 0 ? '+' : ''}${d}, ` +
    `${d < 0 ? 'DARKER — less squeak' : 'BRIGHTER'})`);
} else if (argv[0] === '--voice') {
  for (const f of argv.slice(1)) console.log(JSON.stringify(voiceReport(f)));
} else {
  for (const f of argv) console.log(JSON.stringify(report(f)));
}

}
