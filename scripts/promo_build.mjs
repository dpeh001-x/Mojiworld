#!/usr/bin/env node
// Assemble the Mojiworld promo from real captured gameplay, real shipped
// cinematics, and cards whose numbers are read out of the repo at build time.
//
// STRUCTURE (the marketing spine, not just a montage):
//   HOOK      one number that stops the scroll
//   PROOF     the breadth of the work
//   THE GAME  it has to actually look good
//   CRAFT     before/after — the "hard at work" claim, evidenced
//   PAYOFF    title + the ask
//
// Every segment is normalised to the same codec/rate first and concatenated
// after, because ffmpeg's concat demuxer will silently produce a broken or
// stuttering file when inputs disagree on timebase.
//
//   node scripts/promo_build.mjs [--vertical]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const FF = 'C:/Users/dpeh0/Mojiworld/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const PROMO = 'C:/Users/dpeh0/AppData/Local/Temp/claude/promo';
const SEG = join(PROMO, 'seg');
const CARDS = join(PROMO, process.argv.includes('--vertical') ? 'cards_v' : 'cards');
const VERTICAL = process.argv.includes('--vertical');
const W = VERTICAL ? 1080 : 1920, H = VERTICAL ? 1920 : 1080;
mkdirSync(SEG, { recursive: true });

const ff = (args) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
const seg = [];
const push = (p) => { seg.push(p); return p; };

// Common tail: everything lands on the same pixel format, size and framerate.
// 16:9 gameplay inside a 9:16 frame: black bars read as a mistake on social,
// so the vertical cut fills the dead space with a blurred, darkened copy of the
// same frame — the standard reframe move, and it keeps the eye on the middle.
const NORM = VERTICAL
  ? `split[bgsrc][fgsrc];[bgsrc]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=28,eq=brightness=-0.12:saturation=0.7[bg];[fgsrc]scale=${W}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=25,format=yuv420p`
  : `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=#05020f,setsar=1,fps=25,format=yuv420p`;
const ENC = ['-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '25', '-an'];

// ---- a card, with a slow push-in so static type still has motion ----------
function card(name, dur, { push: zoom = 1.06, fadeIn = 0.35, fadeOut = 0.35 } = {}) {
  const out = join(SEG, `${String(seg.length).padStart(2, '0')}_${name}.mp4`);
  const frames = Math.round(dur * 25);
  // zoompan needs an oversized source or it stair-steps; scale up first.
  const vf = [
    `scale=${Math.round(W * 1.5)}:-2`,
    `zoompan=z='min(1+(${(zoom - 1).toFixed(4)}*on/${frames}),${zoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=25`,
    `fade=t=in:st=0:d=${fadeIn}`,
    `fade=t=out:st=${(dur - fadeOut).toFixed(2)}:d=${fadeOut}`,
    'format=yuv420p',
  ].join(',');
  // NO -t on the input: zoompan emits `d` frames for EVERY frame it consumes,
  // so feeding it a 2.8 s loop (70 frames) produced 70x the intended length —
  // a 3 m 16 s "card". One input frame in, `-frames:v` out.
  ff(['-loop', '1', '-i', join(CARDS, `${name}.png`), '-vf', vf, '-frames:v', String(frames), ...ENC, '-y', out]);
  return push(out);
}

// ---- a slice of captured gameplay -----------------------------------------
function shot(file, start, dur, { speed = 1, fadeIn = 0.2, fadeOut = 0.2, punch = 1 } = {}) {
  const out = join(SEG, `${String(seg.length).padStart(2, '0')}_shot.mp4`);
  const filters = [];
  if (speed !== 1) filters.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
  if (punch !== 1) filters.push(`scale=iw*${punch}:ih*${punch},crop=iw/${punch}:ih/${punch}`);
  filters.push(NORM);
  // A touch of contrast/saturation: captures read flat next to the cards.
  filters.push('eq=contrast=1.06:saturation=1.12:brightness=0.01');
  filters.push(`fade=t=in:st=0:d=${fadeIn}`);
  const shown = dur / speed;
  filters.push(`fade=t=out:st=${(shown - fadeOut).toFixed(2)}:d=${fadeOut}`);
  ff(['-ss', String(start), '-t', String(dur), '-i', file, '-vf', filters.join(','), ...ENC, '-y', out]);
  return push(out);
}

// ---- inputs ----------------------------------------------------------------
const raw = join(PROMO, 'raw');
const shotFile = (name) => {
  const dir = join(raw, name);
  if (!existsSync(dir)) return null;
  const meta = existsSync(join(dir, 'meta.json')) ? JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) : null;
  const vid = readdirSync(dir).find((f) => f.endsWith('.webm'));
  if (!vid || !meta) return null;
  return { file: join(dir, vid), start: meta.gameplayStartMs / 1000 };
};
const combat = shotFile('combat'), boss = shotFile('boss'), traverse = shotFile('traverse');
const cine = (n) => join(ROOT, 'steam/higgsfield/cinematics', n);

// ---- the cut ---------------------------------------------------------------
const world = join(PROMO, VERTICAL ? 'world_montage_v.mp4' : 'world_montage.mp4');

// HOOK — the number first, before anything has earned attention.
card('c_hook', 2.8, { push: 1.10, fadeIn: 0.5 });
card('c_hook2', 2.4);
// PAY IT OFF IMMEDIATELY — real combat, no preamble.
if (combat) shot(combat.file, combat.start + 4.5, 4.0, { punch: 1.06 });
if (combat) shot(combat.file, combat.start + 11.0, 3.4, { speed: 1.15, punch: 1.03 });
// PROOF — the breadth of the work, one frame.
card('c_stats', 2.8);
// SCALE — the boss reveal the game plays on entering the arena.
if (boss) shot(boss.file, boss.start + 5.0, 5.2, { punch: 1.03 });
// THE WORLD — painted backdrops, cut for range rather than for place.
if (existsSync(world)) shot(world, 0.2, 8.4, { fadeIn: 0.3 });
// CRAFT — the "hard at work" claim, evidenced rather than asserted.
card('c_craft', 2.4);
card('ba_pad', 2.8, { push: 1.04 });
card('ba_apo', 2.8, { push: 1.04 });
// MOVEMENT — a different class, so the kit reads as broad.
if (traverse) shot(traverse.file, traverse.start + 4.0, 3.6, { speed: 1.2 });
// ...and the rest of the world, now that the craft claim is paid for.
if (existsSync(world)) shot(world, 9.0, 6.0, { fadeIn: 0.3 });
// PAYOFF
card('c_total', 2.6, { push: 1.10 });
card('c_end', 5.0, { push: 1.05, fadeOut: 1.2 });

// ---- concat ----------------------------------------------------------------
const listFile = join(SEG, 'list.txt');
writeFileSync(listFile, seg.map((p) => `file '${p.split('\\').join('/')}'`).join('\n'));
const silent = join(PROMO, VERTICAL ? 'moji_promo_vertical_silent.mp4' : 'moji_promo_silent.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-y', silent]);

// ---- music -----------------------------------------------------------------
// "The Singularity" was chosen by measuring RMS over time: it is the only
// candidate with a real 16 dB build, which is what a rising montage needs.
// Duration of the assembled cut, parsed from ffmpeg's own report. ffmpeg
// exits non-zero when given only an input, so the read lives in the catch —
// that is the normal path here, not an error.
let total = 60;
try {
  execFileSync(FF, ['-hide_banner', '-i', silent], { stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  const m = String(e.stderr || '').match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (m) total = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
}
const music = join(ROOT, 'audio/The Singularity.mp3');
const final = join(PROMO, VERTICAL ? 'MOJIWORLD_promo_vertical.mp4' : 'MOJIWORLD_promo.mp4');
ff(['-i', silent, '-ss', '6', '-i', music,
    '-filter_complex', `[1:a]atrim=0:${total.toFixed(2)},afade=t=in:st=0:d=1.5,afade=t=out:st=${(total - 3).toFixed(2)}:d=3,volume=0.85[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-y', final]);

console.log(`segments: ${seg.length}`);
console.log(`duration: ${total.toFixed(1)}s`);
console.log(`OUT: ${final}`);
