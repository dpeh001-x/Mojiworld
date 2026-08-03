// Generate the 76 Steam achievement icons (38 achieved + 38 locked).
//
//   node scripts/gen_achievement_icons.mjs [--sheet]
//
// Steam wants 256x256, "colourful achieved / grayscale unachieved". Output goes
// to steam/assets/achievements/<apiname>.png and <apiname>_locked.png, named so
// the upload order is obvious.
//
// Why glyphs and not colour emoji: librsvg (what sharp renders SVG with) has no
// COLR/CBDT support, so Segoe UI Emoji comes out as a flat silhouette. That is
// actually the better outcome here — a silhouette takes `fill`, so the same
// glyph gives a colourful achieved icon and a grey locked one for free.
//
// Milestone achievements draw their NUMBER instead of a glyph: at the 64px Steam
// often renders these at, "1000" reads instantly where a generic skull does not.
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';

const OUT = 'steam/assets/achievements';
const SIZE = 256;
const manifest = JSON.parse(readFileSync('steam/achievements_manifest.json', 'utf8'));

// Palettes per theme: [outer glow, inner bg, glyph]
const P = {
  kill:     ['#4a0d12', '#8e1b26', '#ff6b6b'],
  boss:     ['#2b0d3d', '#5b1d7a', '#d896ff'],
  zodiac:   ['#0d1b3d', '#223a7a', '#9fc4ff'],
  level:    ['#062b33', '#0e5f70', '#5fe0e8'],
  forge:    ['#3d2a06', '#8a5f12', '#ffc94a'],
  combo:    ['#3d1806', '#a33d0e', '#ff9b4a'],
  ascend:   ['#2a063d', '#65189a', '#c98aff'],
  cls:      ['#06331f', '#0e7a4a', '#5fe8a0'],
  coin:     ['#3d3306', '#8a7512', '#ffe14a'],
  bestiary: ['#12331f', '#2a7a3d', '#8ae86a'],
  boon:     ['#06283d', '#12688a', '#5fc8ff'],
};

// glyph: an emoji (drawn as a silhouette) OR {num} to draw text.
const MAP = {
  firstBlood:   { p: 'kill',     g: '\u{1F5E1}' },
  slayer100:    { p: 'kill',     n: '100'  },
  exterminator: { p: 'kill',     n: '1K'   },
  kill5000:     { p: 'kill',     n: '5K'   },
  kill10000:    { p: 'kill',     n: '10K'  },
  bossHunter:   { p: 'boss',     n: '3', sub: '\u{1F451}' },
  boss6:        { p: 'boss',     n: '6', sub: '\u{1F451}' },
  boss12:       { p: 'boss',     n: '12', sub: '\u{1F451}' },
  aetherionDown:{ p: 'boss',     g: '\u{1F300}' },
  gravitosDown: { p: 'boss',     g: '\u{1F573}' },
  // U+2605 (solid star) not U+2B50: the emoji star renders as a thin outline
  // at icon size, the text star fills properly.
  zodiac1:      { p: 'zodiac',   g: '★' },
  zodiacAll:    { p: 'zodiac',   n: '12', sub: '★' },
  lv10:         { p: 'level',    n: '10'  },
  lv20:         { p: 'level',    n: '20'  },
  lv30:         { p: 'level',    n: '30'  },
  lv50:         { p: 'level',    n: '50'  },
  lv70:         { p: 'level',    n: '70'  },
  lv100:        { p: 'level',    n: '100' },
  lv150:        { p: 'level',    n: '150' },
  legendary:    { p: 'forge',    g: '\u{1F48E}' },
  starforged:   { p: 'forge',    n: '5',  sub: '★' },
  star8:        { p: 'forge',    n: '8',  sub: '★' },
  star10:       { p: 'forge',    n: '10', sub: '★' },
  combo50:      { p: 'combo',    n: '50'  },
  combo100:     { p: 'combo',    n: '100' },
  combo200:     { p: 'combo',    n: '200' },
  ascendant:    { p: 'ascend',   g: '\u{1F54A}' },
  // U+2934 (⤴) has no glyph in Segoe UI Emoji and fell back to something that
  // read as a music note. U+2B06 renders as a solid arrow.
  prestige5:    { p: 'ascend',   n: '5',  sub: '⬆' },
  prestige20:   { p: 'ascend',   n: '20', sub: '⬆' },
  firstCalling: { p: 'cls',      g: '\u{1F9ED}' },
  truePath:     { p: 'cls',      g: '\u{1F396}' },
  coin50k:      { p: 'coin',     n: '50K' },
  coin100k:     { p: 'coin',     n: '100K' },
  bestiary20:   { p: 'bestiary', n: '20', sub: '\u{1F4D6}' },
  bestiary40:   { p: 'bestiary', n: '40', sub: '\u{1F4D6}' },
  bestiary60:   { p: 'bestiary', n: '60', sub: '\u{1F4D6}' },
  boonAttuned:  { p: 'boon',     g: '\u{1F52E}' },
  boonHunter:   { p: 'boon',     n: '10', sub: '\u{1F52E}' },
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const grey = (hex, lift) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  let v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  v = Math.round(v * 0.55 + lift);                       // darken; locked must read as "off"
  const h = Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return '#' + h + h + h;
};

function svgFor(spec, locked) {
  let [outer, inner, glyph] = P[spec.p];
  if (locked) { outer = grey(outer, 6); inner = grey(inner, 10); glyph = grey(glyph, 26); }
  const n = spec.n;
  // Long numbers shrink so "100K" still fits inside the ring.
  const fs = !n ? 0 : n.length >= 4 ? 66 : n.length === 3 ? 84 : 112;
  const body = n
    ? `<text x="128" y="${spec.sub ? 150 : 168}" font-size="${fs}" text-anchor="middle"
             font-family="Segoe UI, sans-serif" font-weight="bold" fill="${glyph}">${esc(n)}</text>` +
      (spec.sub ? `<text x="128" y="200" font-size="46" text-anchor="middle"
             font-family="Segoe UI Emoji" fill="${glyph}">${esc(spec.sub)}</text>` : '')
    : `<text x="128" y="176" font-size="126" text-anchor="middle"
             font-family="Segoe UI Emoji" fill="${glyph}">${esc(spec.g)}</text>`;
  return Buffer.from(
`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="${inner}"/><stop offset="100%" stop-color="${outer}"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="34" fill="url(#bg)"/>
  <rect x="9" y="9" width="${SIZE - 18}" height="${SIZE - 18}" rx="27"
        fill="none" stroke="${glyph}" stroke-opacity="${locked ? 0.28 : 0.62}" stroke-width="4"/>
  ${body}
</svg>`);
}

mkdirSync(OUT, { recursive: true });
const missing = manifest.achievements.filter(a => !MAP[a.apiname]).map(a => a.apiname);
if (missing.length) { console.error('no icon spec for: ' + missing.join(', ')); process.exit(1); }

let n = 0;
for (const a of manifest.achievements) {
  const spec = MAP[a.apiname];
  await sharp(svgFor(spec, false)).png().toFile(`${OUT}/${a.apiname}.png`);
  await sharp(svgFor(spec, true)).png().toFile(`${OUT}/${a.apiname}_locked.png`);
  n += 2;
}
console.log(`wrote ${n} icons (${manifest.achievements.length} achieved + locked) to ${OUT}/`);

if (process.argv.includes('--sheet')) {
  const CELL = 96, COLS = 10;
  const items = [];
  for (const a of manifest.achievements) items.push(`${OUT}/${a.apiname}.png`, `${OUT}/${a.apiname}_locked.png`);
  const rows = Math.ceil(items.length / COLS);
  const comps = [];
  for (let i = 0; i < items.length; i++) {
    comps.push({ input: await sharp(items[i]).resize(CELL - 6, CELL - 6).png().toBuffer(),
                 left: (i % COLS) * CELL + 3, top: Math.floor(i / COLS) * CELL + 3 });
  }
  await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 4,
                          background: { r: 16, g: 14, b: 22, alpha: 1 } } })
    .composite(comps).png().toFile('scripts/_tmp_ach_sheet.png');
  console.log('contact sheet -> scripts/_tmp_ach_sheet.png (achieved/locked pairs, reading order)');
}
