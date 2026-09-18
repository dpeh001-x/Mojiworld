#!/usr/bin/env node
// WEAPON IMPACTS BEHAVE LIKE HITS (v0.30.893). The first set of audio/impact clips passed every length / level check and
// still sounded wrong: the rogue pair swelled for ~100 ms before peaking (a swish, not a stab), the archer hit held its
// level to the end, and the archer and mage hits stopped mid-sound (-9 and -22 dB below peak on the last sample: a click on
// every landed hit). This reads each clip's 5 ms envelope and holds the three properties a hit needs, so a regenerated
// set cannot bring any of it back silently.
//   node scripts/impact_envelope_test.mjs [dir]       (default audio/impact; no browser, no network)
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const FFMPEG = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.resolve(process.argv[2] || path.join(ROOT, 'audio', 'impact'));
const ATTACK_MS = 30, AFTER_DB = -30, END_DB = -45;   // peak within 30 ms; 120 ms later 30 dB down; the tail ends 45 dB down
const db = (x) => (x > 1e-9 ? 20 * Math.log10(x) : -180);
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
for (const c of ['warrior', 'rogue', 'mage', 'archer']) for (const k of ['', '_crit']) {
  const f = path.join(DIR, `hit_${c}${k}.mp3`);
  if (!fs.existsSync(f)) { check(false, `hit_${c}${k}.mp3 exists`); continue; }
  const r = spawnSync(FFMPEG, ['-hide_banner', '-v', 'error', '-i', f, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
  const b = r.stdout, s = new Float32Array(b.buffer, b.byteOffset, b.length >> 2);
  let end = s.length; while (end > 0 && Math.abs(s[end - 1]) < 1e-4) end--;   // decoder padding
  const W = 220, win = [];                                                      // 5 ms RMS windows
  for (let i = 0; i + W <= end; i += W) { let e = 0; for (let j = 0; j < W; j++) e += s[i + j] * s[i + j]; win.push(Math.sqrt(e / W)); }
  let p = 0; for (let i = 1; i < win.length; i++) if (win[i] > win[p]) p = i;
  const at = p * 5, after = db(win[Math.min(win.length - 1, p + 24)]) - db(win[p]), tail = db(win[win.length - 1]) - db(win[p]);
  check(at <= ATTACK_MS && after <= AFTER_DB && tail <= END_DB, `the ${c} ${k ? 'crit' : 'hit'} strikes at once, dies away and ends without a click`,
    `peak at ${at} ms, ${after.toFixed(1)} dB 120 ms later, last 5 ms ${tail.toFixed(1)} dB`);
}
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
