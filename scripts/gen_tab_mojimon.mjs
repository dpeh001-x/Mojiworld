// Builds Sprites/ui/tab_mojimon.webp — the U-panel MojiMon tab icon.
//
// The tab shipped with a bare U+26D3 CHAINS glyph, which at 18px is an
// unreadable gold squiggle: it carries no hint that the tab is about a
// creature companion, and it is the only tab whose icon is not a drawn sprite.
// The other four tabs already have tab_*.webp art in one house style — bold
// subject, thick black outline, flat purple disc — so this matches that rather
// than inventing a new look.
//
// The subject is taken from the existing MojiMon branding (Sprites/ui/
// mojimon_logo.png): a dark creature silhouette with glowing eyes. The logo's
// gold frame and chain ring are deliberately DROPPED — they read as mush below
// ~64px, and the silhouette is the part that survives at tab size. The chain
// idea is kept as a single thick collar link, which stays legible.
//
//   node scripts/gen_tab_mojimon.mjs
import sharp from 'sharp';
import { writeFileSync, renameSync, existsSync } from 'node:fs';

const S = 768;
const DISC = '#5a2a90';        // between tab_boons (74,25,134) and tab_skills (98,47,148)
const DISC_HI = '#7a45ad';
const BODY = '#1b1140';        // logo's creature navy
const BODY_HI = '#2e1f63';
const EYE = '#b9f2e0';         // logo's pale mint eyes
const GOLD = '#ffcf6b';

// Creature drawn in a 400x400 box, then placed on the disc.
//
// Tuned against the 18px preview, not the 768px master. The first pass had a
// smaller body with a fine 4-point skirt and a gold collar ring: at tab size
// that collapsed into a dark blob with a gold smear across it, and the eyes —
// the one feature that makes it read as a creature — disappeared. So: the body
// fills most of the disc, the skirt is 3 chunky points instead of 4 fine ones,
// the eyes are large, and the collar is gone. The chain idea the old glyph
// carried is simply not expressible at 18px without eating the silhouette.
const creature = `
  <path id="mm" d="
    M 74 160
    L 88 58 L 138 122
    C 168 104, 232 104, 262 122
    L 312 58 L 326 160
    C 340 205, 338 256, 330 292
    L 300 292 L 268 336 L 236 292 L 200 336 L 164 292 L 132 336 L 100 292 L 70 292
    C 62 256, 60 205, 74 160 Z" />`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="disc" cx="38%" cy="30%" r="78%">
      <stop offset="0%" stop-color="${DISC_HI}"/>
      <stop offset="100%" stop-color="${DISC}"/>
    </radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BODY_HI}"/>
      <stop offset="100%" stop-color="${BODY}"/>
    </linearGradient>
    <filter id="eyeglow" x="-120%" y="-120%" width="340%" height="340%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    ${creature}
  </defs>

  <circle cx="${S / 2}" cy="${S / 2}" r="${S / 2 - 8}" fill="url(#disc)"/>

  <g transform="translate(${S * 0.5} ${S * 0.5}) scale(1.98) translate(-200 -197)">
    <!-- thick black outline, the house style on every other tab sprite -->
    <use href="#mm" fill="none" stroke="#000" stroke-width="20" stroke-linejoin="round"/>
    <use href="#mm" fill="url(#body)"/>
    <g filter="url(#eyeglow)">
      <ellipse cx="157" cy="192" rx="30" ry="36" fill="${EYE}"/>
      <ellipse cx="243" cy="192" rx="30" ry="36" fill="${EYE}"/>
    </g>
    <path d="M 180 246 q 20 16 40 0" fill="none" stroke="${EYE}" stroke-width="9"
          stroke-linecap="round" opacity="0.9"/>
  </g>
</svg>`;

const OUT = 'Sprites/ui/tab_mojimon.webp';
// Render to a BUFFER, validate, then write — sharp keeps a file handle open on
// toFile(), so writing a .tmp and renaming it straight away fails EBUSY on
// Windows. Buffer -> writeFileSync closes before the rename.
const buf = await sharp(Buffer.from(svg)).webp({ quality: 92 }).toBuffer();
const meta = await sharp(buf).metadata();
if (meta.width !== S || meta.height !== S) throw new Error('unexpected size ' + meta.width + 'x' + meta.height);
if (!meta.hasAlpha) throw new Error('icon must keep its transparent corners');
const tmp = OUT + '.tmp';
writeFileSync(tmp, buf);
renameSync(tmp, OUT);
console.log(`wrote ${OUT} ${meta.width}x${meta.height} alpha=${meta.hasAlpha} ${(buf.length / 1024).toFixed(1)}KB`);

// Also emit a preview at the size it actually renders in the tab bar, plus a
// 3x blow-up, because "looks fine at 768px" says nothing about 18px.
const small = await sharp(buf).resize(18, 18, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
writeFileSync('scripts/_tmp_tab_18.png', small);
writeFileSync('scripts/_tmp_tab_18x8.png',
  await sharp(small).resize(144, 144, { kernel: 'nearest' }).png().toBuffer());
console.log('wrote scripts/_tmp_tab_18.png + _tmp_tab_18x8.png (actual tab size)');
