#!/usr/bin/env node
// Render the promo's kinetic-type cards as 1920x1080 PNGs.
// Every number on these cards is pulled from the repo at build time (see
// promo_build.mjs), so the piece cannot drift into advertising figures the
// project no longer backs up.
//
//   node scripts/promo_cards.mjs [outDir]
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
sharp.cache(false);
const OUT = process.env.PROMO_CARDS || process.argv[2] || 'C:/Users/dpeh0/AppData/Local/Temp/claude/promo/cards';
mkdirSync(OUT, { recursive: true });

// Size is env-driven so the vertical cutdown gets NATIVE 1080x1920 cards
// rather than a letterboxed 16:9 card, which reads as a mistake on social.
const W = Number(process.env.PROMO_W || 1920), H = Number(process.env.PROMO_H || 1080);
const VERT = H > W;
const BG = '#0b0616', GOLD = '#ffd86a', VIOLET = '#c8a8ff', CREAM = '#fff6dc', DIM = '#8b7fa8';
// Georgia ships on Windows and renders through librsvg here; the sans stack is
// the fallback chain the game itself uses.
// Single quotes inside the stacks on purpose: these get interpolated into
// double-quoted SVG attributes, and an inner double quote closes the attribute
// and corrupts the document.
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', Inter, system-ui, sans-serif";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A faint starfield + vignette so a full-frame card is never a flat black slab.
const backdrop = `
  <defs>
    <radialGradient id="vig" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="#1b0f33"/>
      <stop offset="60%" stop-color="#0d0720"/>
      <stop offset="100%" stop-color="#050210"/>
    </radialGradient>
    <linearGradient id="goldgrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff6dc"/><stop offset="100%" stop-color="#ffcf6a"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${Array.from({ length: 90 }, (_, i) => {
    const x = (i * 733) % W, y = (i * 421) % H, r = (i % 7 === 0) ? 2.2 : 1.2;
    const o = 0.10 + ((i * 37) % 30) / 100;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#cbb8ff" opacity="${o.toFixed(2)}"/>`;
  }).join('')}
`;

const render = async (name, svgBody) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${backdrop}${svgBody}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${name}.png`);
  return name;
};

// ---- card recipes ----------------------------------------------------------
// BIG NUMBER: the scroll-stopper. One figure, one line under it.
export const bigNumber = (name, figure, sub, tint = GOLD) => render(name, `
  <text x="${W / 2}" y="${H / 2 - 10}" text-anchor="middle" font-family="${SANS}"
        font-size="${VERT ? 210 : 300}" font-weight="800" fill="${tint}" filter="url(#glow)"
        letter-spacing="-6">${esc(figure)}</text>
  <text x="${W / 2}" y="${H / 2 + 110}" text-anchor="middle" font-family="${SANS}"
        font-size="46" font-weight="600" fill="${CREAM}" letter-spacing="10"
        opacity="0.92">${esc(sub.toUpperCase())}</text>
`);

// STATEMENT: a line of prose, serif, the emotional beats.
export const statement = (name, line1, line2) => render(name, `
  <text x="${W / 2}" y="${H / 2 - (line2 ? 40 : 0)}" text-anchor="middle" font-family="${SERIF}"
        font-size="${VERT ? 62 : 86}" font-style="italic" fill="${CREAM}">${esc(line1)}</text>
  ${line2 ? `<text x="${W / 2}" y="${H / 2 + 80}" text-anchor="middle" font-family="${SERIF}"
        font-size="86" font-style="italic" fill="${GOLD}">${esc(line2)}</text>` : ''}
`);

// TRIPLE: three figures in a row — the breadth of the work in one frame.
export const triple = (name, items) => render(name, `
  ${items.map((it, i) => {
    const x = VERT ? W / 2 : W / 2 + (i - 1) * 560;
    const yOff = VERT ? (i - 1) * 300 : 0;
    return `
      <text x="${x}" y="${H / 2 - 20 + yOff}" text-anchor="middle" font-family="${SANS}"
            font-size="${VERT ? 120 : 160}" font-weight="800" fill="${i === 1 ? GOLD : VIOLET}"
            filter="url(#glow)" letter-spacing="-3">${esc(it[0])}</text>
      <text x="${x}" y="${H / 2 + 60 + yOff}" text-anchor="middle" font-family="${SANS}"
            font-size="34" font-weight="600" fill="${CREAM}" letter-spacing="6"
            opacity="0.85">${esc(it[1].toUpperCase())}</text>`;
  }).join('')}
`);

// LOWER THIRD: sits over gameplay, so it is bottom-anchored with a scrim.
export const lowerThird = (name, kicker, line) => render(name, `
  <rect x="0" y="${H - 300}" width="${W}" height="300" fill="#05020f" opacity="0.0"/>
  <rect x="130" y="${H - 250}" width="10" height="130" fill="${GOLD}"/>
  <text x="180" y="${H - 190}" font-family="${SANS}" font-size="34" font-weight="700"
        fill="${GOLD}" letter-spacing="8">${esc(kicker.toUpperCase())}</text>
  <text x="180" y="${H - 130}" font-family="${SANS}" font-size="56" font-weight="600"
        fill="${CREAM}">${esc(line)}</text>
`);

// END CARD: the payoff and the ask.
export const endCard = (name, title, sub, cta) => render(name, `
  <text x="${W / 2}" y="${H / 2 - 60}" text-anchor="middle" font-family="${SERIF}"
        font-size="${VERT ? 110 : 170}" font-weight="700" fill="url(#goldgrad)" filter="url(#glow)"
        letter-spacing="14">${esc(title)}</text>
  <rect x="${W / 2 - 240}" y="${H / 2 + 10}" width="480" height="2" fill="${VIOLET}" opacity="0.6"/>
  <text x="${W / 2}" y="${H / 2 + 100}" text-anchor="middle" font-family="${SANS}"
        font-size="44" font-weight="500" fill="${CREAM}" letter-spacing="6"
        opacity="0.92">${esc(sub)}</text>
  <text x="${W / 2}" y="${H / 2 + 210}" text-anchor="middle" font-family="${SANS}"
        font-size="38" font-weight="800" fill="${GOLD}" letter-spacing="9">${esc(cta.toUpperCase())}</text>
`);

// BEFORE/AFTER: the polish proof. Two sprites, labelled, with an arrow.
export const beforeAfter = async (name, beforeBuf, afterBuf, caption) => {
  const tile = async (buf) => sharp(buf).resize(420, 420, { fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const [bT, aT] = await Promise.all([tile(beforeBuf), tile(afterBuf)]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${backdrop}
    <text x="${W / 2}" y="150" text-anchor="middle" font-family="${SANS}" font-size="40"
          font-weight="700" fill="${GOLD}" letter-spacing="9">${esc(caption.toUpperCase())}</text>
    <text x="${VERT ? W/2 : W/2-330}" y="${VERT ? 950 : 880}" text-anchor="middle" font-family="${SANS}" font-size="32"
          font-weight="600" fill="${DIM}" letter-spacing="7">BEFORE</text>
    <text x="${VERT ? W/2 : W/2+330}" y="${VERT ? 1530 : 880}" text-anchor="middle" font-family="${SANS}" font-size="32"
          font-weight="600" fill="${GOLD}" letter-spacing="7">AFTER</text>
    <path d="${VERT ? `M ${W/2} 1000 L ${W/2} 1035 M ${W/2-18} 1012 L ${W/2} 1038 L ${W/2+18} 1012` : `M ${W/2-46} 620 L ${W/2+30} 620 M ${W/2+6} 598 L ${W/2+32} 620 L ${W/2+6} 642`}"
          stroke="${VIOLET}" stroke-width="6" fill="none" stroke-linecap="round"/>
  </svg>`;
  await sharp(Buffer.from(svg))
    .composite([VERT ? { input: bT, left: Math.round(W / 2 - 210), top: 480 } : { input: bT, left: Math.round(W / 2 - 330 - 210), top: 400 },
                VERT ? { input: aT, left: Math.round(W / 2 - 210), top: 1060 } : { input: aT, left: Math.round(W / 2 + 330 - 210), top: 400 }])
    .png().toFile(`${OUT}/${name}.png`);
  return name;
};

export const OUTDIR = OUT;
