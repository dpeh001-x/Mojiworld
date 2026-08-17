// NPC talk-babble casting guard.
//
// WHAT THIS TEST DOES NOT DO, stated first because it matters:
// it would NOT have caught the bug that prompted it. Bravo was reported as
// "a naggy granny on a young girl", and the offending clip measured 552 Hz —
// comfortably inside the female/child range and PASSING every check below.
// "Naggy granny" lives in timbre, rasp and cadence, none of which a
// fundamental-frequency estimate can see.
//
// What it IS worth keeping for: the first attempted recast came back at
// 345 Hz — eight semitones BELOW the clip it was replacing — and this catches
// that class of miss, along with a corrupt file, a wildly wrong length, and
// clipping (two of the four candidates peaked over 1.0). A floor, not a
// verdict. Judging whether a voice sounds RIGHT still needs ears.
// Run: node scripts/npc_voice_cast_test.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pcm, vowelBandRatio } from './sfx_analyze.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'audio', 'npc');
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

// name -> minimum fundamental. Only characters whose casting has been argued
// belong here; a blanket rule over all 44 would be inventing requirements.
const CAST = {
  // v0.29.x — the 520 Hz FLOOR here was itself the next bug. Reported: "Bravo
  // NPC sounds like an animal, make sure she produces a human girl sound."
  // A human vowel needs harmonics in its first-formant region, roughly
  // 300-900 Hz; at the 668 Hz this floor was pushing her to, the fundamental
  // is the ONLY component under 1 kHz, so there is nothing left to form a
  // vowel out of and the clip reads as a chirp. Measured share of energy
  // below 1 kHz: Bravo 0.026, against Nurse Joyce — an actual human read — at
  // 0.661. The floor is now a BAND, and the deciding test is the vowel band,
  // not the pitch. Pitch never was the granny signal (that clip sat at 552 Hz,
  // inside this band); rasp and cadence were.
  bravo: {
    minF0: 280, maxF0: 520, minVowelBand: 0.20,
    why: 'chibi girl explorer — a CHILD, but a human one: high enough to stay young, '
       + 'low enough that harmonics still land in the vowel band',
  },
};

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('about:blank');

const measure = async (file) => {
  const b64 = fs.readFileSync(file).toString('base64');
  return page.evaluate(async (data) => {
    const bin = atob(data);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let audio;
    try { audio = await ctx.decodeAudioData(buf.buffer); } catch (e) { ctx.close(); return { decodeError: String(e).slice(0, 80) }; }
    const ch = audio.getChannelData(0), sr = audio.sampleRate;
    let peak = 0, sum = 0;
    for (let i = 0; i < ch.length; i++) { const v = ch[i]; sum += v * v; if (Math.abs(v) > peak) peak = Math.abs(v); }
    const win = Math.floor(sr * 0.04);
    let best = 0, bestE = -1;
    for (let s = 0; s + win < ch.length; s += Math.floor(win / 2)) {
      let e = 0; for (let i = s; i < s + win; i++) e += ch[i] * ch[i];
      if (e > bestE) { bestE = e; best = s; }
    }
    const seg = ch.slice(best, best + win);
    const minLag = Math.floor(sr / 900), maxLag = Math.floor(sr / 70);
    let bestLag = -1, bestCorr = 0;
    for (let lag = minLag; lag <= maxLag && lag < seg.length; lag++) {
      let c = 0; for (let i = 0; i + lag < seg.length; i++) c += seg[i] * seg[i + lag];
      if (c > bestCorr) { bestCorr = c; bestLag = lag; }
    }
    ctx.close();
    return { duration: audio.duration, f0: bestLag > 0 ? sr / bestLag : null, peak, rms: Math.sqrt(sum / ch.length) };
  }, b64);
};

for (const [key, spec] of Object.entries(CAST)) {
  const file = path.join(DIR, `npc_${key}.mp3`);
  if (!fs.existsSync(file)) { check(false, `npc_${key}.mp3 exists`, file); continue; }
  const m = await measure(file);
  if (m.decodeError) { check(false, `npc_${key}.mp3 decodes`, m.decodeError); continue; }
  console.log(`npc_${key}: ${m.duration.toFixed(2)}s  f0 ${Math.round(m.f0)}Hz  peak ${m.peak.toFixed(3)}  rms ${m.rms.toFixed(3)}`);
  check(true, `npc_${key}.mp3 decodes`);
  check(m.f0 >= spec.minF0 && (!spec.maxF0 || m.f0 <= spec.maxF0),
    `npc_${key} sits in its cast register (${spec.minF0}${spec.maxF0 ? '-' + spec.maxF0 : '+'} Hz) — ${spec.why}`,
    Math.round(m.f0));
  if (spec.minVowelBand) {
    // The "is this a person" check. Measured in Node with the same DFT the
    // generator accepts on, so the test and the generator cannot disagree.
    const vb = vowelBandRatio(pcm(file));
    check(vb >= spec.minVowelBand,
      `npc_${key} reads as a human voice, not a critter (vowel-band >=${spec.minVowelBand})`,
      +vb.toFixed(3));
  }
  check(m.duration > 0.4 && m.duration < 2.0, `npc_${key} length is in the corpus band`, +m.duration.toFixed(2));
  check(m.peak < 1.0, `npc_${key} does not clip`, +m.peak.toFixed(3));
}

await browser.close();
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
