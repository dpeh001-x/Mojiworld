#!/usr/bin/env node
// ROTTER (monster id `zombie`) hurt + death SFX regeneration — ludo.ai
// /audio/sound-effect.
//
// Per user: "rotter hurt and death noise sounds wrong, its like a animal
// squeak, regenerate appropriate sounds using ludo.ai ensure it is under 1s
// then wire".
//
// ROOT CAUSE, not a taste call. The shipped clips were composed by
// tools/gen_monster_sounds.js, whose familyFor() routes an id to a sonic
// profile by regex. Its undead pattern is /skel|undead|crypt|sepulchre|ribcage/
// — `zombie` matches none of them, so the Rotter fell through to the `beast`
// default and its prompts literally read:
//
//   hit: "a quick gruff ANIMAL grunt, a meaty thud"
//   die: "a feral ANIMAL yelp ending in a growling whimper as a BEAST is felled"
//
// plus the shared flavour line "Cute, adorable cartoon creature ... playful,
// endearing, toy-like". An animal squeak is exactly what that asks for. The
// classification fix lands alongside this script in tools/gen_monster_sounds.js
// (new `undead` profile + a zombie override) so a future regen cannot
// reproduce it; this script generates the two clips now.
//
// The Rotter is a 1.8x-scale rotting corpse (hp 4450, toxic spit `mtoxic`,
// `revivesOnce` — it gets back up once), so the direction is heavy wet
// necrotic flesh, not a critter: no yelp, no squeak, nothing cute.
//
// Every clip is requested short AND VERIFIED: duration is measured from the
// returned MP3's own frame headers — the API's `duration` field is a hint that
// has overshot by 2x before — and anything at or over the 1 s bar is retried
// shorter, then hard-trimmed at a frame boundary as a last resort.
//
//   node scripts/gen_rotter_sfx.mjs              # dry run (prints the plan)
//   node scripts/gen_rotter_sfx.mjs --generate   # calls Ludo (2 credits each)
// Needs LUDO_API_KEY.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { report } from './sfx_analyze.mjs';

const FFMPEG = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const TAG = (argv.find(a => a.startsWith('--tag=')) || '').split('=')[1] || 'pre_rotter_undead';
const MAX_SEC = 1.0;

// The complaint is a TIMBRE complaint, so every prompt says what to avoid as
// loudly as what to make — the same shape that fixed Captain Plum and Octobaby
// in scripts/gen_sfx_regen_pass.mjs.
const SHORT = ' Very short one-shot, punchy, no tail, no music, no reverb wash, mono game SFX.';
const NOT_AN_ANIMAL = ' NOT an animal, NOT a squeak, NOT a yelp or whimper, NOT a chirp, '
  + 'NOT cute, NOT toy-like, nothing high-pitched or shrill. Low, wet and human-sized.';

// ACCEPTANCE, measured — not just "did the API return a file".
//   maxCentroid: spectral centroid ceiling in Hz. A squeak is BRIGHT; the whole
//     complaint is brightness, so a candidate that is not darker than the clip
//     it replaces is a failed regen no matter how good the prompt reads. The
//     shipped originals measured 2460 Hz (hit) and 2604 Hz (die).
//   maxTailDb: how loud the final 60 ms may still be, in dB below peak. Clips
//     that need trimming to fit the 1 s bar can end mid-sound; a loud tail is
//     an audible hard cut. Anything under about -25 dB is inaudible.
const SOUNDS = [
  { file: 'audio/monster/mob_zombie_hit.mp3', dur: 0.5, maxCentroid: 2100, maxTailDb: -25,
    desc: 'A rotting zombie taking a hit — a dull wet thud into waterlogged dead flesh with a '
      + 'low phlegmy grunt forced out of a ruined throat, thick and gurgling, a soft squelch under it.'
      + NOT_AN_ANIMAL + SHORT },
  // Third prompt for this one. The wet vocabulary was the problem, not the
  // length: "gurgling / fluid / squelching splat" all describe BROADBAND SPRAY,
  // and every pass built from those words measured brighter than the squeak it
  // was replacing (3216 Hz, then 2689 Hz, against an incumbent 2604 Hz). So the
  // wetness is dropped entirely and the clip is described as a chest-cavity
  // groan plus a dull body-fall — both low-frequency events.
  { file: 'audio/monster/mob_zombie_die.mp3', dur: 0.7, maxCentroid: 2300, maxTailDb: -25,
    desc: 'A corpse collapsing — a DEEP hollow dying groan from the chest, muffled as if forced '
      + 'through rotten lungs, pitch sagging downward and running out of air, ending in the dull '
      + 'soft thud of a heavy body dropping onto earth. Muffled, bassy, boomy, dark, felt more '
      + 'than heard, like it is behind a wall. '
      + 'NO splash, NO gurgle, NO bubbling, NO hiss, NO sizzle, NO spray, NO crunch, NO ringing, '
      + 'NOTHING bright or trebly or crisp.'
      + NOT_AN_ANIMAL + SHORT },
];

// ---- MP3 duration straight from the frame headers ---------------------------
const RATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const SR = [44100, 48000, 32000, 0];
function frames(buf) {
  let p = 0;
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') {
    const sz = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    p = 10 + sz;
  }
  const out = [];
  let dur = 0;
  while (p + 4 < buf.length) {
    if (buf[p] !== 0xff || (buf[p + 1] & 0xe0) !== 0xe0) { p++; continue; }
    const br = RATES[(buf[p + 2] >> 4) & 0x0f] * 1000;
    const sr = SR[(buf[p + 2] >> 2) & 0x03];
    if (!br || !sr) { p++; continue; }
    const len = Math.floor(144 * br / sr) + ((buf[p + 2] >> 1) & 1);
    dur += 1152 / sr;
    out.push({ off: p, end: p + len, at: dur });
    p += len;
  }
  return { list: out, dur };
}
const durationOf = (buf) => frames(buf).dur;

// FIT TO THE BAR WITH A FADE, not a hard cut.
//
// The API treats `duration` as a hint and has ignored it badly here — a
// requested 0.35 s came back as 1.59 s. The old fallback sliced the MP3 at a
// frame boundary, which is byte-safe but ends the sound mid-groan: measured
// -13 dB below peak at the final 60 ms, i.e. plainly audible as a cut off.
// Re-encoding through ffmpeg instead lets the clip end on a real fade, so the
// tail lands at digital silence and the clip still fits under 1 s.
function fitWithFade(buf, maxSec, force = false) {
  if (!force && durationOf(buf) <= maxSec) return buf;
  const inP = path.join(ROOT, 'scripts', '_tmp_rotter_in.mp3');
  const outP = path.join(ROOT, 'scripts', '_tmp_rotter_fade.mp3');
  fs.writeFileSync(inP, buf);
  // LAME pads: encoder delay at the head plus a full final frame, so a PCM cut
  // at 0.95 s came back measuring 1.02 s. Walk the target down until the
  // ENCODED file measures under the bar rather than assuming the cut holds.
  let out = null;
  for (let keep = maxSec - 0.08; keep >= 0.4; keep -= 0.06) {
    const fade = Math.min(0.25, keep * 0.35);   // last third eases out
    execFileSync(FFMPEG, [
      '-v', 'quiet', '-y', '-i', inP,
      '-t', keep.toFixed(3),
      // curve=exp, not the default linear ramp. A linear fade is still at
      // roughly -18 dB through its final 60 ms, which reads on the tail metric
      // exactly like the hard cut the metric exists to catch. An exponential
      // fade is genuinely silent by the end, so the number keeps meaning
      // "abrupt cut" rather than "a fade is in progress".
      '-af', `afade=t=out:curve=exp:st=${(keep - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
      '-codec:a', 'libmp3lame', '-q:a', '4', '-ac', '1', outP,
    ], { maxBuffer: 32 * 1024 * 1024 });
    const cand = fs.readFileSync(outP);
    if (durationOf(cand) < maxSec) { out = cand; break; }
  }
  for (const p of [inP, outP]) { try { fs.unlinkSync(p); } catch (_) {} }
  return out || buf;
}

const only = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const targets = SOUNDS.filter(s => !only || s.file.includes(only));
if (!targets.length) { console.error(`--only=${only} matched nothing`); process.exit(1); }

// LOUDNESS MATCH. Ludo returns clips at wildly different levels — the first
// accepted death take came back at mean -5.5 dBFS peaking at 0.0, against
// -15.5 for the shipped skeleton death and -13.8 for the Rotter clip it
// replaced. That is ~9 dB hot and hard against the ceiling: in game it would
// blast over its neighbours and clip. So every clip is pulled to the family's
// level, and never allowed to sit at full scale.
const TARGET_MEAN_DB = -14, PEAK_CEIL_DB = -1;
function meanPeak(file) {
  const r = spawnSync(FFMPEG, ['-v', 'info', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const m = (r.stderr || '').match(/mean_volume: ([-\d.]+) dB[\s\S]*?max_volume: ([-\d.]+) dB/);
  return m ? { mean: Number(m[1]), peak: Number(m[2]) } : null;
}
function levelTo(buf) {
  const inP = path.join(ROOT, 'scripts', '_tmp_rotter_lvl_in.mp3');
  const outP = path.join(ROOT, 'scripts', '_tmp_rotter_lvl_out.mp3');
  fs.writeFileSync(inP, buf);
  const mp = meanPeak(inP);
  if (!mp) { try { fs.unlinkSync(inP); } catch (_) {} return buf; }
  // Whichever constraint bites harder: hitting the target mean, or staying
  // under the peak ceiling.
  const gain = Math.min(TARGET_MEAN_DB - mp.mean, PEAK_CEIL_DB - mp.peak);
  if (Math.abs(gain) < 0.3) { try { fs.unlinkSync(inP); } catch (_) {} return buf; }
  execFileSync(FFMPEG, [
    '-v', 'quiet', '-y', '-i', inP, '-af', `volume=${gain.toFixed(2)}dB`,
    '-codec:a', 'libmp3lame', '-q:a', '4', '-ac', '1', outP,
  ], { maxBuffer: 32 * 1024 * 1024 });
  const out = fs.readFileSync(outP);
  console.log(`  level: mean ${mp.mean} dB, peak ${mp.peak} dB -> gain ${gain.toFixed(2)} dB`);
  for (const p of [inP, outP]) { try { fs.unlinkSync(p); } catch (_) {} }
  return durationOf(out) < MAX_SEC ? out : buf;
}

// --refit: re-apply the fade (and level match) to a clip already on disk. Free (no API call) —
// used when a clip's TONE is right but its tail still reads as a cut, so
// nothing needs regenerating.
const refit = (argv.find(a => a.startsWith('--refit=')) || '').split('=')[1];
if (refit) {
  const abs = path.join(ROOT, refit);
  if (!fs.existsSync(abs)) { console.error('no such file: ' + refit); process.exit(1); }
  const before = report(abs);
  const out = levelTo(fitWithFade(fs.readFileSync(abs), MAX_SEC, true));
  const d = durationOf(out);
  if (d >= MAX_SEC) { console.error(`refit produced ${d.toFixed(2)}s — over the bar, not written`); process.exit(1); }
  const tmp = abs + '.tmp';
  fs.writeFileSync(tmp, out);
  fs.renameSync(tmp, abs);
  const after = report(abs);
  console.log('BEFORE', JSON.stringify(before));
  console.log('AFTER ', JSON.stringify(after));
  process.exit(0);
}

if (!has('--generate')) {
  console.log(`DRY RUN — ${targets.length} clips (2 credits each). Bar: < ${MAX_SEC}s\n`);
  for (const s of targets) {
    const abs = path.join(ROOT, s.file);
    const cur = fs.existsSync(abs) ? durationOf(fs.readFileSync(abs)) : null;
    console.log(`  ${(cur == null ? '(new)' : cur.toFixed(2) + 's').padStart(7)} -> req ${s.dur}s  ${s.file}`);
    console.log(`        "${s.desc.slice(0, 110)}..."`);
  }
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const BACKUP = path.join(ROOT, 'audio', '_regen_backup', TAG);
fs.mkdirSync(BACKUP, { recursive: true });

const ATTEMPTS = Number((argv.find(a => a.startsWith('--attempts=')) || '').split('=')[1] || 4);
const SCRATCH = path.join(ROOT, 'scripts', '_tmp_rotter_cand.mp3');   // _tmp_* is gitignored

let failures = 0;
for (const s of targets) {
  const abs = path.join(ROOT, s.file);
  let done = false, last;
  // SEED the incumbent. Without this, "ship the darkest candidate" only ranks
  // within one run, so a bad run overwrites a better file that is already on
  // disk — which happened: a 2381 Hz clip was replaced by a 2689 Hz one. The
  // file being replaced is a candidate like any other, and it wins ties.
  let best = null;
  if (fs.existsSync(abs)) {
    const cur = fs.readFileSync(abs);
    if (durationOf(cur) < MAX_SEC) {
      const r0 = report(abs);
      best = { buf: cur, dur: durationOf(cur), centroidHz: r0.centroidHz, tail: r0.tailDbBelowPeak, incumbent: true };
      console.log(`  incumbent ${s.file}: ${best.dur.toFixed(2)}s, centroid ${best.centroidHz}Hz — must be beaten`);
    }
  }
  for (let a = 1; a <= ATTEMPTS && !done; a++) {
    // Nudge shorter only while we are still overshooting the 1 s bar; a
    // candidate rejected on TIMBRE gets the same length asked for again.
    const req = Math.max(0.35, s.dur - (a - 1) * 0.15);
    try {
      process.stdout.write(`${s.file} attempt ${a} (req ${req}s) ... `);
      const res = await fetch(`${API}/audio/sound-effect`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ description: s.desc, duration: req, loop: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`);
      const j = await res.json();
      const url = j.url || (j.result && j.result.url);
      if (!url) throw new Error('no url in response');
      const dl = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
      if (!dl.ok) throw new Error(`download HTTP ${dl.status}`);
      let buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length < 1000) throw new Error(`suspiciously small (${buf.length}B)`);
      let dur = durationOf(buf);
      if (!dur) throw new Error('not a decodable MP3');
      // Asking shorter is tried first; a faded fit is the fallback, not the
      // habit, because the front of a clip the model authored at its own
      // length is what we keep.
      if (dur >= MAX_SEC && a < ATTEMPTS) throw new Error(`${dur.toFixed(2)}s — over the ${MAX_SEC}s bar, retrying shorter`);
      if (dur >= MAX_SEC) { buf = fitWithFade(buf, MAX_SEC); dur = durationOf(buf); console.log('(faded to fit) '); }
      if (dur >= MAX_SEC) throw new Error(`still ${dur.toFixed(2)}s after the fade fit`);
      buf = levelTo(buf); dur = durationOf(buf);

      // ---- measured acceptance: is it actually DARKER than the squeak? -----
      fs.writeFileSync(SCRATCH, buf);
      const r = report(SCRATCH);
      const tailDb = Number(r.tailDbBelowPeak);
      const okBright = r.centroidHz <= s.maxCentroid;
      const okTail = !Number.isFinite(tailDb) || tailDb <= s.maxTailDb;
      console.log(`${dur.toFixed(2)}s, centroid ${r.centroidHz}Hz (<=${s.maxCentroid}), tail ${r.tailDbBelowPeak}dB (<=${s.maxTailDb})`);
      // Keep the darkest candidate seen, so a run that never clears the bar
      // still ships the best of the batch rather than the last of it.
      if (!best || r.centroidHz < best.centroidHz) best = { buf, dur, centroidHz: r.centroidHz, tail: r.tailDbBelowPeak };
      if (!(okBright && okTail) && a < ATTEMPTS) {
        throw new Error(`rejected on ${!okBright ? 'brightness' : 'tail'} — retrying`);
      }
      const pick = (okBright && okTail) ? { buf, dur, centroidHz: r.centroidHz, tail: r.tailDbBelowPeak } : best;
      if (!(okBright && okTail)) {
        console.log(`  ! bar not cleared in ${ATTEMPTS} attempts — shipping darkest candidate (${pick.centroidHz}Hz)`);
      }
      if (pick.incumbent) { console.log('  = incumbent survived; nothing written'); done = true; break; }
      // Back up ONCE per tag. A second run would otherwise overwrite the true
      // original with the previous run's reject, which is exactly the file the
      // A/B comparison needs to stay honest.
      const bak = path.join(BACKUP, path.basename(abs));
      if (fs.existsSync(abs) && !fs.existsSync(bak)) fs.copyFileSync(abs, bak);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const tmp = abs + '.tmp';
      fs.writeFileSync(tmp, pick.buf);
      fs.renameSync(tmp, abs);                  // atomic, per project convention
      console.log(`OK ${pick.dur.toFixed(2)}s, ${(pick.buf.length / 1024).toFixed(0)} KB, centroid ${pick.centroidHz}Hz`);
      done = true;
    } catch (e) {
      last = e; console.log('FAIL: ' + e.message);
      if (/\b402\b|credits/i.test(e.message)) { console.error('OUT OF CREDITS'); process.exit(3); }
      if (a < 3) await sleep(1500 * a);
    }
  }
  if (!done) { failures++; console.error(`giving up on ${s.file}: ${last?.message}`); }
  await sleep(1200);
}
console.log(failures ? `DONE with ${failures} failure(s)` : 'ALL DONE');
process.exit(failures ? 1 : 0);
