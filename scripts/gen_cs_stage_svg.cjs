// Generates Sprites/ui/cs/stage_pop.svg - the character-creation stage behind the hero. Deterministic.
//   final-polish cs-stage3 (per user): "make it a AAA Pop punk style", "do not use polkadots", the lightning sign -> a star.
//   final-polish cs-stage4 (per user): "improving the stage background especially the backdrop" - a punk gig wall.
//   final-polish cs-stage5 (per user): "reduce the graffiti at the back, make it look like a stage, i like the speakers, make
//   it slightly comic style, not so cluttered" - the wall, posters and graffiti go; the backdrop is a theatre stage: berry
//   drapes tied back each side and a scalloped valance across the top, all flat comic cel shading with ink outlines and
//   hard drops. The speakers stay, standing in front of the drapes. Two sparkles, not four.
//   node scripts/gen_cs_stage_svg.cjs [out.svg]
const fs = require('fs');
const OUT = process.argv[2] || require('path').join(__dirname, '..', 'Sprites', 'ui', 'cs', 'stage_pop.svg');
const INK = '#0d0a14';
const f = (n) => +n.toFixed(1);
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };   // fixed-seed Park-Miller
const star = (cx, cy, R, r, rot, pts = 5) => {
  const out = [];
  for (let i = 0; i < pts * 2; i++) { const a = (rot - 90 + i * 180 / pts) * Math.PI / 180, rr = i % 2 ? r : R; out.push(f(cx + rr * Math.cos(a)) + ',' + f(cy + rr * Math.sin(a))); }
  return 'M' + out.join('L') + 'Z';
};
// the burst: 18 hand-cut spikes, radii jittered by a fixed table so it reads cut by hand, not by compass
const J = [1, 0.9, 1.06, 0.94, 1.02, 0.88, 1.08, 0.95, 1, 0.9, 1.05, 0.92, 1.03, 0.89, 1.07, 0.94, 1.01, 0.91];
const burst = (cx, cy, R, r, k) => {
  const n = J.length, out = [];
  for (let i = 0; i < n * 2; i++) { const a = (-90 + i * 180 / n + 3) * Math.PI / 180, rr = (i % 2 ? r : R * J[(i / 2 + k) % n]); out.push(f(cx + rr * Math.cos(a)) + ',' + f(cy + rr * Math.sin(a) * 0.96)); }
  return 'M' + out.join('L') + 'Z';
};
// soft rays from behind the head
let rays = '';
for (let i = 0; i < 24; i += 2) {
  const a0 = (i * 15 - 3) * Math.PI / 180, a1 = ((i + 1) * 15 - 3) * Math.PI / 180, R = 420, cx = 200, cy = 150;
  rays += `<path d="M${cx},${cy}L${f(cx + R * Math.cos(a0))},${f(cy + R * Math.sin(a0))}L${f(cx + R * Math.cos(a1))},${f(cy + R * Math.sin(a1))}Z"/>`;
}
// podium: a drum seen from slightly above - top ellipse at y 344, front face down to y 376
const PX = 200, PY = 344, RX = 142, RY = 24, H = 32;
const face = `M${PX - RX},${PY}L${PX - RX},${PY + H}A${RX},${RY} 0 0 0 ${PX + RX},${PY + H}L${PX + RX},${PY}A${RX},${RY} 0 0 1 ${PX - RX},${PY}Z`;
const silhouette = `M${PX - RX},${PY}A${RX},${RY} 0 0 1 ${PX + RX},${PY}L${PX + RX},${PY + H}A${RX},${RY} 0 0 1 ${PX - RX},${PY + H}Z`;
let ticks = '';
for (let x = PX - RX + 12; x < PX + RX; x += 16) ticks += `<rect x="${x}" y="${PY - 30}" width="5" height="${H + 64}"/>`;
// an amp stack: cabinet with a slatted grille and one big cone, a head on top with a row of knobs (short bars, not dots)
const amp = (x, flip) => {
  const w = 76, top = 250, h = 84, hy = 232;
  let slats = ''; for (let y = top + 10; y < top + h - 6; y += 7) slats += `<path d="M${x + 7},${y}H${x + w - 7}"/>`;
  let knobs = ''; for (let i = 0; i < 5; i++) knobs += `<rect x="${x + 10 + i * 12}" y="${hy + 6}" width="6" height="6" rx="1.5" fill="#d9b457"/>`;
  const cx = x + w / 2, cy = top + h / 2;
  return `<g transform="${flip ? `translate(${2 * x + w} 0) scale(-1 1)` : ''}">` +
    `<rect x="${x + 5}" y="${hy + 6}" width="${w}" height="${top + h - hy}" fill="${INK}" fill-opacity=".8"/>` +
    `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="4" fill="#1a1224" stroke="${INK}" stroke-width="4"/>` +
    `<g stroke="#2e2340" stroke-width="3">${slats}</g>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="24" ry="24" fill="#120c1a" stroke="#3b2e4f" stroke-width="4"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="10" ry="10" fill="#2c2240" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M${cx - 14},${cy - 14}A20,20 0 0 1 ${cx + 6},${cy - 19}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>` +
    `<rect x="${x}" y="${hy}" width="${w}" height="${top - hy + 2}" rx="3" fill="#221830" stroke="${INK}" stroke-width="4"/>` +
    `${knobs}</g>`;
};
const sparkle = (x, y, s, fill) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0,-12L2.6,-2.6L12,0L2.6,2.6L0,12L-2.6,2.6L-12,0L-2.6,-2.6Z" fill="${fill}" stroke="${INK}" stroke-width="${f(2 / s)}" stroke-linejoin="round"/>`;
// a drape, tied back: the inner edge sweeps from the top to a tie and flares to the floor. Flat cel shading - one dark
// band along the inner edge, three ink fold lines, one light fold - an ink outline and a hard drop. Mirrored for the right.
const DRAPE = 'M-8,22L86,22C72,92 54,170 48,226C58,262 82,300 100,334L-8,334Z';
const drape = (flip) => `<g${flip ? ' transform="translate(400 0) scale(-1 1)"' : ''}>` +
  `<path d="${DRAPE}" transform="translate(5 4)" fill="${INK}" fill-opacity=".6"/>` +
  `<path d="${DRAPE}" fill="url(#drape)"/>` +
  `<path d="M86,22C72,92 54,170 48,226C58,262 82,300 100,334L80,334C64,300 48,262 40,226C45,176 60,100 70,22Z" fill="#5e1a40" fill-opacity=".75"/>` +
  `<path d="M36,22C33,110 26,190 24,226" fill="none" stroke="#f08ab6" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/>` +
  `<g fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="2.5" stroke-linecap="round">` +
  `<path d="M18,22C18,110 14,190 12,226C16,262 24,300 26,334"/><path d="M52,22C48,110 38,190 34,226C42,262 56,300 64,334"/></g>` +
  `<path d="${DRAPE}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
  `<rect x="-10" y="216" width="64" height="15" rx="5" transform="rotate(-7 22 223)" fill="#e8c86a" stroke="${INK}" stroke-width="3.5"/>` +
  `</g>`;
// the valance: a scalloped swag across the top, butter trim just above the scallops, pleat creases at the joins
let scal = 'M-4,-4H404V24', trim = 'M404,17', pleats = '';
for (let x = 400; x > 0; x -= 50) { scal += `Q${x - 25},46 ${x - 50},24`; trim += `Q${x - 25},39 ${x - 50},17`; if (x < 400) pleats += `<path d="M${x},0V22"/>`; }
scal += 'L-4,24Z';
const valance = `<path d="${scal}" transform="translate(0 5)" fill="${INK}" fill-opacity=".6"/>` +
  `<path d="${scal}" fill="url(#drape)"/>` +
  `<g fill="none" stroke="${INK}" stroke-opacity=".45" stroke-width="2.5">${pleats}</g>` +
  `<path d="${trim}" fill="none" stroke="#e8c86a" stroke-width="3"/>` +
  `<path d="${scal}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
<!-- Mojiworld - character-creation stage, comic pop punk (v0.30.x final-polish cs-stage3, cs-stage5 theatre stage). Generated by
     scripts/gen_cs_stage_svg.cjs; no dots by request. -->
<defs>
<radialGradient id="bg" cx="50%" cy="36%" r="78%"><stop offset="0" stop-color="#5b2c76"/><stop offset=".5" stop-color="#3c1c57"/><stop offset="1" stop-color="#170a24"/></radialGradient>
<radialGradient id="fade" cx="50%" cy="37%" r="60%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="raym"><rect width="400" height="400" fill="url(#fade)"/></mask>
<radialGradient id="burstG" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#b0457f"/><stop offset=".7" stop-color="#8a2f68"/><stop offset="1" stop-color="#6c2254"/></radialGradient>
<radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe3f1" stop-opacity=".55"/><stop offset=".6" stop-color="#ffc3e0" stop-opacity=".16"/><stop offset="1" stop-color="#ffc3e0" stop-opacity="0"/></radialGradient>
<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1f8" stop-opacity=".3"/><stop offset=".75" stop-color="#ffd6ea" stop-opacity=".07"/><stop offset="1" stop-color="#ffd6ea" stop-opacity="0"/></linearGradient>
<linearGradient id="drape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b03c74"/><stop offset=".6" stop-color="#94305f"/><stop offset="1" stop-color="#6e2249"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b153d"/><stop offset="1" stop-color="#0c0612"/></linearGradient>
<linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d3e8"/><stop offset=".45" stop-color="#d59ac4"/><stop offset="1" stop-color="#9c5aa0"/></linearGradient>
<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4508c"/><stop offset=".6" stop-color="#a8366f"/><stop offset="1" stop-color="#6e1f4a"/></linearGradient>
<radialGradient id="pool" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".55" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="rimShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${INK}" stop-opacity=".55"/><stop offset=".22" stop-color="${INK}" stop-opacity="0"/><stop offset=".78" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity=".55"/></linearGradient>
<linearGradient id="bottom" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#07030b" stop-opacity=".85"/><stop offset=".45" stop-color="#07030b" stop-opacity=".3"/><stop offset="1" stop-color="#07030b" stop-opacity="0"/></linearGradient>
<radialGradient id="vig" cx="50%" cy="42%" r="72%"><stop offset=".6" stop-color="#0a0512" stop-opacity="0"/><stop offset="1" stop-color="#0a0512" stop-opacity=".6"/></radialGradient>
<clipPath id="faceClip"><path d="${face}"/></clipPath>
</defs>
<rect width="400" height="400" fill="url(#bg)"/>
<g fill="#ffd9ee" fill-opacity=".06" mask="url(#raym)">${rays}</g>
<!-- the burst behind the hero: hard ink shadow, ink outline, a lighter inner cut -->
<path d="${burst(206, 174, 150, 118, 0)}" fill="${INK}" fill-opacity=".85"/>
<path d="${burst(200, 168, 150, 118, 0)}" fill="url(#burstG)" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="${burst(200, 168, 112, 92, 5)}" fill="#c35a92" fill-opacity=".38"/>
<ellipse cx="200" cy="170" rx="106" ry="100" fill="url(#halo)"/>
<!-- two spotlight beams crossing onto the podium -->
<path d="M28,-20L78,-20L262,336L150,336Z" fill="url(#beam)"/>
<path d="M322,-20L372,-20L250,336L138,336Z" fill="url(#beam)"/>
<!-- floor, then the amp stacks standing on it at each side -->
<rect y="330" width="400" height="70" fill="url(#floor)"/>
<path d="M0,330H400" stroke="#ffd4ea" stroke-opacity=".35" stroke-width="2"/>
<!-- the drapes frame the stage; the speakers stand in front of them -->
${drape(false)}${drape(true)}
${amp(-18, false)}${amp(342, true)}
<!-- podium: hard ink shadow, rim with light bars, glossy top, painted ring, spotlight pool, contact shadow -->
<path d="${silhouette}" transform="translate(6 8)" fill="${INK}"/>
<path d="${face}" fill="url(#rim)"/>
<g clip-path="url(#faceClip)" fill="#ffe3f1" fill-opacity=".2">${ticks}</g>
<path d="${face}" fill="url(#rimShade)"/>
<path d="${face}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<ellipse cx="${PX}" cy="${PY}" rx="${RX}" ry="${RY}" fill="url(#top)" stroke="${INK}" stroke-width="5"/>
<ellipse cx="${PX}" cy="${PY}" rx="${RX - 22}" ry="${RY - 6}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2.5"/>
<ellipse cx="${PX}" cy="${PY}" rx="98" ry="17" fill="url(#pool)"/>
<path d="M${PX - RX + 26},${PY - 13}A${RX - 10},${RY - 5} 0 0 1 ${PX + RX - 26},${PY - 13}" fill="none" stroke="url(#gloss)" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="${PX}" cy="${PY + 2}" rx="44" ry="8" fill="${INK}" fill-opacity=".45"/>
<!-- stickers: a butter star and a berry star, hard shadows, ink outlines; sparkles -->
<path d="${star(78, 86, 25, 11, -14)}" transform="translate(5 5)" fill="${INK}"/>
<path d="${star(78, 86, 25, 11, -14)}" fill="#ffe07a" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
<path d="M66,75L72,81" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-opacity=".85"/>
<path d="${star(314, 206, 22, 9.5, 12)}" transform="translate(4 4)" fill="${INK}"/>
<path d="${star(314, 206, 22, 9.5, 12)}" fill="#f07aa8" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
${sparkle(150, 60, 0.9, '#fff4d6')}${sparkle(284, 104, 0.8, '#fff4d6')}
${valance}
<rect width="400" height="400" fill="url(#vig)"/>
<rect y="300" width="400" height="100" fill="url(#bottom)"/>
</svg>
`;
if (/[\uD800-\uDFFF]/.test(svg)) throw new Error('surrogate');
fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
fs.writeFileSync(OUT + '.tmp', svg); fs.renameSync(OUT + '.tmp', OUT);
console.log('wrote', OUT, svg.length, 'bytes');
