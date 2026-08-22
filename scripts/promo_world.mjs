#!/usr/bin/env node
// Build the promo's WORLD montage: slow Ken Burns moves over the painted
// backdrops, cut fast enough to read as scale rather than as a slideshow.
//
// This is the strongest B-roll in the repo and needs no capture — 88 authored
// backdrops at 2912x1632, i.e. already bigger than the output frame, so a push
// or a drift costs nothing in sharpness.
//
//   node scripts/promo_world.mjs [--vertical]
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FF = 'C:/Users/dpeh0/Mojiworld/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const PROMO = 'C:/Users/dpeh0/AppData/Local/Temp/claude/promo';
const VERTICAL = process.argv.includes('--vertical');
const W = VERTICAL ? 1080 : 1920, H = VERTICAL ? 1920 : 1080;
const OUT = join(PROMO, VERTICAL ? 'world_v' : 'world');
mkdirSync(OUT, { recursive: true });
const ff = (a) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', ...a], { stdio: ['ignore', 'pipe', 'pipe'] });

// Curated for CONTRAST between neighbours — a montage that stays in one biome
// reads as one place. Jungle → ruin → ocean → forge → sky → tomb → candy →
// cosmos covers the range the game actually has.
const PICKS = [
  ['verdant', 'in'], ['bastionThrone', 'left'], ['kelpForest', 'out'],
  ['magmaFoundry', 'in'], ['skyGarden', 'right'], ['hollowSepulchre', 'in'],
  ['candyland', 'left'], ['zodiacSanctum', 'out'], ['glasswindSteppe', 'right'],
  ['queensHollow', 'in'], ['clockworkSpire', 'in'], ['galaxy', 'out'],
];

const DUR = 1.5;                    // per backdrop — long enough to read, short enough to drive
const FR = Math.round(DUR * 25);
const seg = [];

for (const [name, move] of PICKS) {
  const src = join(ROOT, 'backgrounds', `bg_v3_${name}.webp`);
  if (!existsSync(src)) { console.log('  (missing) ' + name); continue; }
  const out = join(OUT, `${String(seg.length).padStart(2, '0')}_${name}.mp4`);
  // zoompan works on a scaled-up copy so the motion is sub-pixel smooth.
  const big = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}`;
  let z, x, y;
  if (move === 'in')       { z = `min(1+0.10*on/${FR},1.10)`; x = 'iw/2-(iw/zoom/2)'; y = 'ih/2-(ih/zoom/2)'; }
  else if (move === 'out') { z = `max(1.10-0.10*on/${FR},1.0)`; x = 'iw/2-(iw/zoom/2)'; y = 'ih/2-(ih/zoom/2)'; }
  else if (move === 'left'){ z = '1.08'; x = `(iw-iw/zoom)*(1-on/${FR})`; y = 'ih/2-(ih/zoom/2)'; }
  else                     { z = '1.08'; x = `(iw-iw/zoom)*(on/${FR})`; y = 'ih/2-(ih/zoom/2)'; }
  const vf = [
    big,
    `zoompan=z='${z}':x='${x}':y='${y}':d=${FR}:s=${W}x${H}:fps=25`,
    'eq=contrast=1.05:saturation=1.10',
    'fade=t=in:st=0:d=0.25',
    `fade=t=out:st=${(DUR - 0.25).toFixed(2)}:d=0.25`,
    'format=yuv420p',
  ].join(',');
  // NO -t on the input: zoompan emits `d` frames per frame CONSUMED, so a
  // looped input multiplies the clip length by its own frame count.
  ff(['-loop', '1', '-i', src, '-vf', vf, '-frames:v', String(FR),
      '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '25', '-an', '-y', out]);
  seg.push(out);
  console.log('  ' + name + ' (' + move + ')');
}

const { writeFileSync } = await import('node:fs');
const list = join(OUT, 'list.txt');
writeFileSync(list, seg.map((p) => `file '${p.split('\\').join('/')}'`).join('\n'));
const merged = join(PROMO, VERTICAL ? 'world_montage_v.mp4' : 'world_montage.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-y', merged]);
console.log(`world montage: ${seg.length} backdrops, ${(seg.length * DUR).toFixed(1)}s -> ${merged}`);
