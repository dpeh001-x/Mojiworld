#!/usr/bin/env node
// MUSIC LOOP SEAMS (final polish audit A7; per user "keep going to test and debug", 2026-09-18).
//
// Every music track loops natively (audio.loop = true), so whatever silence a file starts or ends with plays EVERY time
// round: Emerald Village waited 3.8 s between loops, the Mojiworld theme (town and five maps) 2.2 s, Glasswind and Azure
// Academia 2 s. This cuts that silence (below THRESH_DB for at least MIN_SIL s) off both ends of any track whose seam is
// at least MIN_SEAM s, keeping MARGIN s so a fade's last breath is not clipped. The cut is a STREAM COPY - no re-encode,
// the audio and the "made by DADPEH" tags are untouched; mp3 frames make it accurate to ~26 ms.
//
//   node scripts/trim_bgm_seams.mjs            # dry run: each track's seam and the plan
//   node scripts/trim_bgm_seams.mjs --write    # trim (atomic per file)
//   node scripts/trim_bgm_seams.mjs --check    # exit 1 while any track still has a seam >= MIN_SEAM
// Afterwards: node scripts/gen_sfx_manifest.mjs (file sizes) and gen_assets_manifest.mjs.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const FFMPEG = createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.env.BGM_DIR || path.join(ROOT, 'audio');
const THRESH_DB = -50, MIN_SIL = 0.25, MIN_SEAM = 1.0, MARGIN = 0.05;
const has = (f) => process.argv.includes(f);

function seam(file) {
  const t = String(spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', `silencedetect=n=${THRESH_DB}dB:d=${MIN_SIL}`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 }).stderr);
  const d = t.match(/Duration: (\d+):(\d+):([\d.]+)/); const dur = d ? +d[1] * 3600 + +d[2] * 60 + parseFloat(d[3]) : NaN;
  const starts = [...t.matchAll(/silence_start: (-?[\d.e-]+)/g)].map((m) => parseFloat(m[1]));
  const ends = [...t.matchAll(/silence_end: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
  const lead = (starts.length && starts[0] <= 0.05 && ends.length) ? ends[0] : 0;
  const lastStart = starts.length ? starts[starts.length - 1] : NaN;
  const tail = (starts.length > ends.length || (ends.length && ends[ends.length - 1] >= dur - 0.05)) && lastStart > dur * 0.5 ? dur - lastStart : 0;
  const artist = (t.match(/^\s+artist\s+:\s*(.+)$/m) || [])[1] || '';
  return { dur, lead, tail, artist };
}
let open = 0, done = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.mp3')).sort()) {
  const p = path.join(DIR, f), s = seam(p), gap = s.lead + s.tail;
  if (!(gap >= MIN_SEAM)) continue;
  const from = Math.max(0, s.lead - MARGIN), to = s.dur - Math.max(0, s.tail - MARGIN);
  const line = `${f.padEnd(40)} ${s.dur.toFixed(1)} s  lead ${s.lead.toFixed(2)}  tail ${s.tail.toFixed(2)}  -> keep ${from.toFixed(2)}..${to.toFixed(2)}`;
  if (has('--check')) { open++; console.log('OFF  ' + line); continue; }
  if (!has('--write')) { console.log('plan ' + line); continue; }
  const tmp = p + '.tmp.mp3';
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', from.toFixed(3), '-i', p, '-t', (to - from).toFixed(3), '-map', '0:a', '-c', 'copy', '-map_metadata', '0', tmp], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(tmp)) throw new Error('ffmpeg failed on ' + f + ': ' + String(r.stderr).slice(-200));
  const a = seam(tmp);
  if (!(a.dur > (to - from) - 0.2) || a.artist !== s.artist) { fs.unlinkSync(tmp); throw new Error(`${f}: trimmed file failed its check (dur ${a.dur}, artist "${a.artist}" vs "${s.artist}")`); }
  fs.renameSync(tmp, p); done++;
  console.log(`done ${line}  (now ${a.dur.toFixed(1)} s, seam ${(a.lead + a.tail).toFixed(2)} s)`);
}
if (has('--check')) { console.log(open ? `${open} track(s) with a loop seam of ${MIN_SEAM} s or more` : `no loop seam of ${MIN_SEAM} s or more`); process.exit(open ? 1 : 0); }
if (has('--write')) console.log(`${done} track(s) trimmed`);
