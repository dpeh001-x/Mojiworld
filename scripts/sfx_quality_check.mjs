#!/usr/bin/env node
// SFX QUALITY CHECK - the faults a generated one-shot actually ships with.
// =============================================================================
// Peak level says nothing about whether a clip is GOOD: a single tick in half a
// second of silence normalises to the same -1 dBFS as a full-bodied slam. This
// decodes every clip and checks the things that make a cue sound wrong in game:
//
//   silence      near-nothing under the peak (one click, or a dead file)
//   dead air     the cue starts late, so the button feels unresponsive
//   hard cut     it still has energy in its last 30 ms - it ends mid-sound
//   clipping     runs of full-scale samples, i.e. audible distortion
//   DC offset    a thump on every play and wasted headroom
//   twins        two clips that are the same audio under different names
//   hits         a note asking for several impacts got a single one
//
// Thresholds are stated per check below, and every number printed is measured
// from the decoded samples, not from a header or the API's word.
//
//   node scripts/sfx_quality_check.mjs <file.mp3|dir> ...     # check these
//   node scripts/sfx_quality_check.mjs --order <work_order.json>
//   flags: --hits a,b,c  (ids that must have >= 2 onsets; deathBlossom needs 3)
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let FFMPEG = 'ffmpeg';
try { FFMPEG = require('@ffmpeg-installer/ffmpeg').path; } catch (e) { /* fall back to PATH */ }
const SR = 22050, FRAME = Math.round(SR * 0.01);           // 10 ms frames
// Magic Bolt was called "too loud" and Dimensional Warp "should have been softer", so both are held
// below the rest deliberately. A loudness check that does not know that reports the fix as a fault.
const QUIET_BY_DESIGN = new Set(['mage_bolt', 'mage_warp']);
const argv = process.argv.slice(2);
const optOf = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

// clips whose tester note asks for more than one impact; the count they must reach
const MULTI = { deathBlossom: 3, rogue_shadow: 2, shinobi_ult: 2, phantom_cut: 2, beastmaster_pack: 2, skyhunter_gale: 2, doombringer_apoc: 2 };
for (const id of String(optOf('hits', '')).split(',').filter(Boolean)) MULTI[id] = MULTI[id] || 2;

const files = [];
const orderFile = optOf('order', null);
if (orderFile) for (const it of JSON.parse(fs.readFileSync(orderFile, 'utf8')).items) files.push(it.file);
for (const a of argv.filter((x) => !x.startsWith('--'))) {
  if (a === orderFile) continue;
  if (fs.existsSync(a) && fs.statSync(a).isDirectory()) { for (const f of fs.readdirSync(a)) if (/\.mp3$/i.test(f)) files.push(path.join(a, f)); }
  else if (/\.mp3$/i.test(a)) files.push(a);
}
if (!files.length) { console.error('usage: sfx_quality_check.mjs <file.mp3|dir>... | --order <work_order.json>'); process.exit(2); }

const db = (x) => (x <= 0 ? -Infinity : 20 * Math.log10(x));
function pcm(file) {
  const raw = execFileSync(FFMPEG, ['-v', 'quiet', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], { maxBuffer: 64 << 20 });
  const n = raw.length >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = raw.readInt16LE(i * 2) / 32768;
  return out;
}
function analyse(file) {
  const x = pcm(file);
  if (!x.length) return { empty: true };
  let peak = 0, sum = 0, sumsq = 0, clipRun = 0, clipRuns = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]); if (a > peak) peak = a; sum += x[i]; sumsq += x[i] * x[i];
    if (a >= 0.997) { clipRun++; if (clipRun === 3) clipRuns++; } else clipRun = 0;
  }
  const frames = [];
  for (let i = 0; i + FRAME <= x.length; i += FRAME) {
    let s = 0; for (let k = 0; k < FRAME; k++) s += x[i + k] * x[i + k];
    frames.push(Math.sqrt(s / FRAME));
  }
  const relDb = frames.map((r) => db(r) - db(peak));
  const active = relDb.filter((d) => d > -40).length / Math.max(1, relDb.length);
  const lead = relDb.findIndex((d) => d > -30);
  const tailFrames = relDb.slice(-3);                       // last 30 ms
  const tail = tailFrames.length ? Math.max(...tailFrames) : -Infinity;
  // Onsets are counted two ways and the larger wins, because the two kinds of "several hits" look
  // nothing alike. SEPARATED hits (three blade strikes with silence between) are caught by a schmitt
  // trigger - loud, away, loud again; peak-picking missed one of deathBlossom's three because its
  // first hit starts in frame 0 with no rise in front of it. BLENDED hits (whams landing on the tail
  // of the one before) never fall far enough for the trigger, so prominence catches those.
  // Onsets are measured against the LOUDEST FRAME, not the sample peak. A 10 ms frame's RMS sits well
  // under the waveform's peak, so peak-referenced bars are a moving target: deathBlossom's three hits
  // measure -9.8, -11.4 and -10.5 dB against its peak and all three fall under a -8 bar, scoring zero
  // on a clip built from three copies of one impact.
  const envMax = Math.max(...frames, 0);
  const relEnv = frames.map((r) => db(r) - db(envMax));
  let state = 'low', fired = 0;
  for (const d of relEnv) {
    if (state === 'low' && d > -8) { fired++; state = 'high'; }
    else if (state === 'high' && d < -18) state = 'low';
  }
  const peaks = [];
  for (let i = 0; i < relEnv.length; i++) {
    if (relEnv[i] < -20) continue;
    if (i > 0 && relEnv[i] < relEnv[i - 1]) continue;
    if (i < relEnv.length - 1 && relEnv[i] < relEnv[i + 1]) continue;
    let floor = relEnv[i]; for (let k = Math.max(0, i - 12); k < i; k++) floor = Math.min(floor, relEnv[k]);
    if (i > 0 && relEnv[i] - floor < 4) continue;
    if (peaks.length && i - peaks[peaks.length - 1] < 3) continue;
    peaks.push(i);
  }
  const onsets = new Array(Math.max(fired, peaks.length));
  let cross = 0; for (let i = 1; i < x.length; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) cross++;
  return { dur: x.length / SR, peakDb: db(peak), rmsDb: db(Math.sqrt(sumsq / x.length)), dc: sum / x.length,
    active, leadMs: lead < 0 ? Infinity : lead * 10, tail, clipRuns, onsets: onsets.length,
    zcr: cross / (x.length / SR),
    // kept for the twin test: correlate the WAVEFORMS. A coarse envelope fingerprint called two
    // unrelated clips identical (Prismatic Cascade and Calamity Incarnate scored 0.997 on envelope
    // shape and -0.07 on the samples), which is a false alarm that costs a regeneration.
    wave: Float32Array.from({ length: Math.floor(x.length / 5) }, (_, i) => x[i * 5]) };
}

const rows = [];
for (const f of [...new Set(files)]) {
  if (!fs.existsSync(f)) { rows.push({ id: path.basename(f, '.mp3'), file: f, missing: true }); continue; }
  try { rows.push({ id: path.basename(f, '.mp3'), file: f, ...analyse(f) }); }
  catch (e) { rows.push({ id: path.basename(f, '.mp3'), file: f, error: String(e.message).slice(0, 80) }); }
}
const twins = [];
for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
  const A = rows[i], B = rows[j];
  if (!A.wave || !B.wave || Math.abs(A.dur - B.dur) > 0.02) continue;
  const n = Math.min(A.wave.length, B.wave.length);
  let sa = 0, sb = 0, sab = 0;
  for (let k = 0; k < n; k++) { sa += A.wave[k] * A.wave[k]; sb += B.wave[k] * B.wave[k]; sab += A.wave[k] * B.wave[k]; }
  const corr = sab / (Math.sqrt(sa * sb) || 1);
  if (corr > 0.98) twins.push(A.id + ' ~ ' + B.id + ' (correlation ' + corr.toFixed(3) + ')');
}
const bad = [];
const f1 = (v, d = 1) => (v == null || !isFinite(v) ? ' n/a' : v.toFixed(d));
console.log('clip                   dur   peak    rms   active  lead   tail  clip  onsets');
for (const r of rows.sort((a, b) => a.id.localeCompare(b.id))) {
  if (r.missing) { bad.push(r.id + ': file missing'); continue; }
  if (r.error) { bad.push(r.id + ': ' + r.error); continue; }
  if (r.empty) { bad.push(r.id + ': decodes to nothing'); continue; }
  console.log(r.id.padEnd(21) + f1(r.dur, 2).padStart(6) + f1(r.peakDb).padStart(7) + f1(r.rmsDb).padStart(7)
    + (100 * r.active).toFixed(0).padStart(7) + '%' + f1(r.leadMs, 0).padStart(6) + f1(r.tail).padStart(7)
    + String(r.clipRuns).padStart(5) + String(r.onsets).padStart(7));
  if (r.peakDb < (QUIET_BY_DESIGN.has(r.id) ? -12 : -6)) bad.push(r.id + ': peaks at ' + f1(r.peakDb) + ' dBFS - too quiet to hear under combat');
  if (r.active < 0.15) bad.push(r.id + ': only ' + (100 * r.active).toFixed(0) + '% of it is above -40 dB of its peak - mostly silence');
  if (r.leadMs > 120) bad.push(r.id + ': ' + f1(r.leadMs, 0) + ' ms of dead air before it starts - the cast will feel late');
  if (r.tail > -10) bad.push(r.id + ': still at ' + f1(r.tail) + ' dB of peak in its last 30 ms - it ends mid-sound');
  if (r.clipRuns > 2) bad.push(r.id + ': ' + r.clipRuns + ' runs of full-scale samples - clipped');
  if (Math.abs(r.dc) > 0.01) bad.push(r.id + ': DC offset ' + r.dc.toFixed(3));
  if (MULTI[r.id] && r.onsets < MULTI[r.id]) bad.push(r.id + ': its note asks for ' + MULTI[r.id] + ' hits, ' + r.onsets + ' onset(s) found');
}
for (const t of twins) bad.push('the same audio twice: ' + t);
console.log('\n' + rows.length + ' clips checked.');
console.log(bad.length ? 'NEEDS ATTENTION:\n  ' + bad.join('\n  ') : 'no faults found: none silent, late, cut mid-sound, clipped, DC-offset or duplicated.');
process.exit(bad.length ? 1 : 0);
