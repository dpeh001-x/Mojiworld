#!/usr/bin/env node
// NPC dialogue backdrop â€” Sprites/ui/npc_dialog_bg.webp.
//
// PROCEDURAL, not generated art. Per user: "background curtains remove, keep
// with simple designs similar to earlier". The ludo.ai rolls kept producing
// scenery â€” theatre curtains, stained-glass arches, painted nebulae â€” and
// scenery is the wrong job for this panel: it backs every NPC in the game and
// its only duty is to frame text. A pop-art halftone field is simple enough to
// state in code, which buys exact control over the two things that actually
// matter (warm dots ON the edges, nothing in the middle), determinism (same
// bytes every run, so a rebuild is a no-op diff), and no API key. It is not
// much smaller than the generated plates — a few thousand circles cost about
// what a painting does — so size is not the argument here; control is.
//
// Unlike the generated plates this one carries its OWN alpha rather than a
// constant baked band: the dots are semi-opaque and the centre is genuinely
// transparent, so the panel's dark gradient shows through cleanly behind the
// dialogue instead of through a veil of dimmed painting.
//   node scripts/gen_npc_dialog_bg.mjs           # writes the file
//   node scripts/gen_npc_dialog_bg.mjs --print   # dump the SVG instead
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'ui');
const dest = join(DIR, 'npc_dialog_bg.webp');

const W = 1024, H = 576;
const REACH = 340;          // how far the dot field travels inward from each edge
const SPACING = 38;         // Ben-Day grid pitch
const GOLD = '#e6b545', CREAM = '#ffeab4', ROSE = '#c8506a';

// deterministic jitter â€” same file every run, so a rebuild is a no-op diff
let seed = 20260815;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const dots = [];
for (const side of [-1, 1]) {
  let col = 0;
  for (let d = 6; d < REACH; d += SPACING, col++) {
    const t = d / REACH;                       // 0 at the edge, 1 at the inner limit
    const fall = Math.pow(1 - t, 1.7);         // dots shrink and fade inward
    const r = 19 * fall + 1.4;
    // Peak 0.62, not 1.0: the CSS stacks a 0.30 wash above this layer, so a
    // dot authored opaque still lands around 0.43 in situ. Tuned against the
    // rendered panel rather than against the file on its own.
    const a = 0.52 * Math.pow(1 - t, 1.35);
    if (a < 0.02) continue;
    const x = side < 0 ? d : W - d;
    for (let y = -SPACING; y < H + SPACING; y += SPACING) {
      const yy = y + (col % 2 ? SPACING / 2 : 0) + (rnd() - 0.5) * 5;
      const rr = r * (0.82 + rnd() * 0.36);
      // a few rose dots per band keep the crimson accent alive without curtains
      const fill = rnd() < 0.09 ? ROSE : (rnd() < 0.34 ? CREAM : GOLD);
      dots.push(`<circle cx="${(x + (rnd() - 0.5) * 4).toFixed(1)}" cy="${yy.toFixed(1)}" r="${rr.toFixed(1)}" fill="${fill}" opacity="${a.toFixed(3)}"/>`);
    }
  }
}

// Two soft gold wedges hard against each edge â€” structure under the dots, so
// the field reads as designed rather than as scattered confetti.
const wedge = (side) => {
  const x0 = side < 0 ? 0 : W;
  const s = side;
  return `
    <polygon points="${x0},0 ${x0 + s * 120},0 ${x0 + s * 26},${H} ${x0},${H}" fill="url(#edge${side < 0 ? 'L' : 'R'})"/>
    <polygon points="${x0},${H * 0.18} ${x0 + s * 186},${H * 0.52} ${x0},${H * 0.86}" fill="${GOLD}" opacity="0.07"/>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="edgeL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.24"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="edgeR" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.24"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${wedge(-1)}
  ${wedge(1)}
  ${dots.join('\n  ')}
</svg>`;

if (process.argv.includes('--print')) { console.log(svg); process.exit(0); }

const out = await sharp(Buffer.from(svg)).webp({ quality: 82, alphaQuality: 100 }).toBuffer();
await mkdir(DIR, { recursive: true });
await writeFile(dest, out);

// Report the two constraints so a bad edit is obvious without opening the file.
const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const band = (x0, x1) => { let vis = 0, warm = 0, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = x0; x < x1; x++) {
    const i = (y * info.width + x) * 4; n++;
    if (data[i + 3] > 20) { vis++; if (data[i] > 70 && data[i] > data[i + 2] * 1.25) warm++; }
  }
  return { visPct: Math.round(vis / n * 100), warmPct: Math.round(warm / n * 100) }; };
const L = band(0, 40), R = band(info.width - 40, info.width), C = band(info.width * 0.4 | 0, info.width * 0.6 | 0);
console.log(`ok ${W}x${H}  ${Math.round(out.length / 1024)} KB -> ${dest}`);
console.log(`left edge  warm ${L.warmPct}%  |  right edge warm ${R.warmPct}%  |  centre visible ${C.visPct}%`);
console.log('(want: both edges warm >= 8%, centre visible <= 5% â€” see scripts/npc_dialog_style_test.mjs)');


