#!/usr/bin/env node
// WEAPON IMPACT CLIPS (final polish audit C6). Every landed hit of every class was the same synth beep; these are one
// normal and one critical impact per class from ludo.ai's /audio/sound-effect, played through the once-per-frame hit block.
//
// v2 (2026-09-18, after measuring the first set): a hit has to BEHAVE like a hit, which the first set mostly did not -
// measured 10 ms envelopes showed the rogue clips swelling for ~100 ms before peaking (a swish), the archer hit and the mage
// crit staying loud for their whole length, and two clips ending mid-sound (archer -7 dB, mage -22 dB: clicks - the 25 ms
// fade had been placed past the end of any clip the silence trim left short). At up to twenty hits a second a sustained clip
// smears into a buzz. So now:
//   - several rolls per clip, each SCORED on its envelope (attack: how fast it reaches its peak; decay: how far it has fallen
//     120 ms later) and the best kept; a roll that takes longer than 30 ms to peak is refused outright;
//   - the kept roll is SHAPED: cut to 0.30 s (crit 0.38 s) and given an exponential tail from 45 ms on, so it cannot ring or
//     click whatever the model drew; then peak-normalised (crit a little hotter).
//
//   node scripts/gen_impact_sfx.mjs                      # dry run
//   node scripts/gen_impact_sfx.mjs --generate [--rolls 3] [--only warrior]   # LUDO_API_KEY; rolls kept in $TMP
//   node scripts/gen_impact_sfx.mjs --from-raw=<dir>     # re-score and re-finish kept imp_raw_* downloads, no API calls
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const FFMPEG = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.IMPACT_DIR || path.join(ROOT, 'audio', 'impact');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const HIT = ' A single short game hit sound with an INSTANT sharp attack: the loudest moment is the very first instant, then it dies'
  + ' away quickly. No build-up, no swell, no whoosh or swish before it, no rattle, no second hit, no ringing tail, no voice, no music, mono.';
const CRIT = ' A heavier, brighter critical hit: a harder crack on the impact itself.';
const CLS = {
  warrior: 'A heavy sword blow landing on armour-hide: one meaty THWACK with a dull metal edge.',
  rogue: 'A dagger stabbing into a monster: one tight, sharp flesh-and-steel STAB.',
  mage: 'A magic bolt bursting on a monster: one compact arcane POP-THUMP with a brief sparkle.',
  archer: 'An arrow striking a monster: one crisp wooden THUNK as the arrowhead lands.',
};
const JOBS = [];
for (const c of Object.keys(CLS)) {
  JOBS.push({ file: `hit_${c}.mp3`, desc: CLS[c] + HIT, peak: -5, len: 0.30 });
  JOBS.push({ file: `hit_${c}_crit.mp3`, desc: CLS[c] + CRIT + HIT, peak: -3, len: 0.38 });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (args) => spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
function pcm(file) { const b = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 's16le', '-ac', '1', '-ar', '44100', '-'], { maxBuffer: 1 << 26 }).stdout; return b; }
// 10 ms RMS envelope in dB below the clip's peak window
function envelope(file) {
  const b = pcm(file), n = b.length >> 1, e = [];
  for (let s = 0; s < n; s += 441) { let q = 0, c = 0; for (let i = s; i < Math.min(n, s + 441); i++) { const v = b.readInt16LE(i * 2); q += v * v; c++; } e.push(Math.sqrt(q / c)); }
  const pk = Math.max(1, ...e); return e.map((v) => 20 * Math.log10(v / pk + 1e-9));
}
// attack = ms to the peak window; decay = dB below peak 120 ms after it; tail = the last 20 ms
function score(file) {
  const e = envelope(file); let p = 0; for (let i = 1; i < e.length; i++) if (e[i] > e[p]) p = i;
  const at = p * 10, d = e[Math.min(e.length - 1, p + 12)] ?? -99;
  let end = e.length; while (end > 1 && e[end - 1] < -90) end--;   // the encoder's silent padding is not the clip's tail
  const tail = end > 2 ? Math.max(e[end - 1], e[end - 2]) : 0;
  return { at, decay: d, tail, ok: at <= 30, s: -at / 10 - Math.max(0, d + 20) };   // faster attack and deeper decay score higher
}
function trimLead(raw, out) { const r = run(['-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB', '-ac', '1', '-ar', '44100', out]); if (r.status) throw new Error('trim'); return out; }
function shape(src, j) {
  const out = path.join(OUT_DIR, j.file), tmp = out + '.tmp.mp3', ft = (j.len - 0.045).toFixed(3);
  const mx = parseFloat((spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', src, '-af', `atrim=0:${j.len},volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/max_volume: (-?[\d.]+)/) || [])[1]);
  const r = run(['-i', src, '-af', `atrim=0:${j.len},afade=t=out:st=0.045:d=${ft}:curve=exp,volume=${(j.peak - mx).toFixed(2)}dB`, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', '-map_metadata', '-1', tmp]);
  if (r.status) throw new Error('encode ' + r.stderr.slice(-100));
  const sc = score(tmp); if (sc.tail > -40) { fs.unlinkSync(tmp); throw new Error('tail ' + sc.tail.toFixed(1) + ' dB'); }
  fs.renameSync(tmp, out); return sc;
}
async function ludoSound(desc, dur, key) {
  const res = await fetch(`${API}/audio/sound-effect`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(180000), body: JSON.stringify({ description: desc, duration: dur, loop: false }) });
  if (res.status === 402) throw new Error('OUT OF CREDITS');
  if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  let j = await res.json();
  if (res.status === 202 || (j && j.id && j.status && !j.url && !j.result)) {   // asset endpoints answer with a job (2026-09-11)
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
  return Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
}
const fromRaw = (argv.find((x) => x.startsWith('--from-raw=')) || '').slice(11);
if (!argv.includes('--generate') && !fromRaw) { for (const j of JOBS) console.log(`plan ${j.file} (${j.len}s, peak ${j.peak} dB): ${j.desc.slice(0, 90)}...`); process.exit(0); }
const key = process.env.LUDO_API_KEY; if (!key && !fromRaw) { console.log('LUDO_API_KEY is not set'); process.exit(2); }
fs.mkdirSync(OUT_DIR, { recursive: true });
const rolls = Number(opt('--rolls') || 3), only = opt('--only');
let bad = 0;
for (const j of JOBS) {
  if (only && !j.file.includes('_' + only)) continue;
  const cands = [];
  if (fromRaw) { for (const n of fs.readdirSync(fromRaw)) if (n.startsWith('imp_raw_') && n.endsWith('_' + j.file)) cands.push(path.join(fromRaw, n)); }
  else for (let a = 1; a <= rolls; a++) {
    try { const raw = path.join(os.tmpdir(), `imp_raw_${process.pid}r${a}_${j.file}`); fs.writeFileSync(raw, await ludoSound(j.desc, 0.5, key)); cands.push(raw); }
    catch (e) { console.log(`  ${j.file} roll ${a}: ${e.message}`); if (/CREDITS/.test(e.message)) break; await sleep(2000); }
  }
  const scored = cands.map((raw) => { const w = trimLead(raw, raw.replace(/\.mp3$/, '.lead.wav')); return { raw, w, ...score(w) }; }).sort((a, b) => b.s - a.s);
  const pick = scored.find((c) => c.ok);
  console.log(`${j.file}: ` + scored.map((c) => `[attack ${c.at}ms, -${Math.abs(c.decay).toFixed(0)}dB@120ms${c.ok ? '' : ' REFUSED'}]`).join(' '));
  if (!pick) { console.log(`  ${j.file}: no roll peaks within 30 ms - kept the current file`); bad++; continue; }
  try { const f = shape(pick.w, j); console.log(`  -> ${path.basename(pick.raw)}: attack ${f.at}ms, tail ${f.tail.toFixed(0)} dB`); }
  catch (e) { console.log(`  ${j.file}: ${e.message}`); bad++; }
}
process.exit(bad ? 1 : 0);
