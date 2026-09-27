// Generates Sprites/ui/cs/stage_pop.svg - the character-creation stage behind the hero. Deterministic.
//   final-polish cs-stage3 (per user): "make it a AAA Pop punk style", "do not use polkadots", the lightning sign -> a star.
//   final-polish cs-stage4 (per user): "improving the stage background especially the backdrop" - a punk gig wall.
//   final-polish cs-stage5 (per user): "reduce the graffiti at the back, make it look like a stage, i like the speakers, make
//   it slightly comic style, not so cluttered" - the wall, posters and graffiti go; the backdrop is a theatre stage: berry
//   drapes tied back each side and a scalloped valance across the top, all flat comic cel shading with ink outlines and
//   hard drops. The speakers stay, standing in front of the drapes. Two sparkles, not four.
//   final-polish cs-stage6 (per user): "The back stage can look more muted, the ground can look more pronounced, make the
//   image flow". The wall, burst, rays and drapes drop to dusty, low-saturation tones; the floor starts higher (y 300) and is
//   a lit lilac stage - boards running back to a vanishing point, seams closing up toward the horizon, a crisp lit edge, a
//   pool where the beams land, soft shadows under the drapes and speakers; the bottom rim is lighter so the floor reads.
//   Everything - beams, drape curves, floor boards, the pool - leads the eye to the hero on the podium.
//   final-polish cs-stage7 (per user): "the podium especially the shadow on the podium looks weird, please rectify, push the
//   character vertically up slightly". The figure now stands 5% higher (CSS), so the podium rises to meet the feet (top at
//   y 330, was 344); its hard ink offset block becomes a soft shadow on the floor under the drum, and the contact shadow is
//   a soft gradient centred exactly under the feet instead of a solid ink disc behind them.
//   final-polish cs-stage8 (per user, on a crop of the feet): "add a suitable sized shadow ellipse to make it look realistic".
//   Measured from the preview canvas's own pixels, at 1280x720 and on an 842x325 phone alike: the feet end at y 332.6 and
//   span x 175-222 in these units. So the contact shadow is two ellipses centred there: a wide soft ambient one, and a dark
//   tight core wider than the feet and their white edge, centred at the soles so it shows round and in front of them - the way a real contact shadow is darkest where the soles touch.
//   final-polish cs-stage9 (per user: "The shadow can be much more nicer, please make it better"). A blurred dark smudge
//   read muddy against flat comic art, so the shadow is cel-shaded like everything else on the stage: a flat plum-tinted
//   oval with a crisp edge (flat to 86% of its radius, then a short feather), a darker second tone under the soles, and a
//   very faint soft bed beneath both. It leans a few units right and forward, away from the left beam. Chosen from three
//   variants rendered side by side (cel / leaner cel / soft painterly).
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
const PX = 200, PY = 330, RX = 122, RY = 22, H = 30;   // cs-stage6 - narrower (was 142 / 24 / 32); cs-stage7 - raised with the figure (PY was 344)
const face = `M${PX - RX},${PY}L${PX - RX},${PY + H}A${RX},${RY} 0 0 0 ${PX + RX},${PY + H}L${PX + RX},${PY}A${RX},${RY} 0 0 1 ${PX - RX},${PY}Z`;
// where the hero's feet land, measured from the preview canvas (see cs-stage8 above)
const FEET_X = 198.5, FEET_Y = 332.6;
let ticks = '';
for (let x = PX - RX + 12; x < PX + RX; x += 16) ticks += `<rect x="${x}" y="${PY - 30}" width="5" height="${H + 64}"/>`;
// an amp stack: cabinet with a slatted grille and one big cone, a head on top with a row of knobs (short bars, not dots)
const amp = (x, flip) => {
  const w = 76, top = 250, h = 84, hy = 232;
  let slats = ''; for (let y = top + 10; y < top + h - 6; y += 7) slats += `<path d="M${x + 7},${y}H${x + w - 7}"/>`;
  let knobs = ''; for (let i = 0; i < 5; i++) knobs += `<rect x="${x + 10 + i * 12}" y="${hy + 6}" width="6" height="6" rx="1.5" fill="#d9b457"/>`;
  const cx = x + w / 2, cy = top + h / 2;
  return `<ellipse cx="${x + w / 2 + 6}" cy="${top + h + 3}" rx="46" ry="8" fill="${INK}" fill-opacity=".45"/>` +
    `<g transform="${flip ? `translate(${2 * x + w} 0) scale(-1 1)` : ''}">` +
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
// the stage floor's boards: runs back to a vanishing point above the hero's head, seams closing up toward the horizon
let boards = '';
for (let x = -520; x <= 920; x += 58) boards += `<path d="M200,120L${x},400" stroke-opacity=".28" stroke-width="2"/>`;
for (const y of [307, 316, 328, 344, 364, 390]) boards += `<path d="M0,${y}H400" stroke-opacity=".2" stroke-width="1.8"/>`;
// a drape, tied back: the inner edge sweeps from the top to a tie and flares to the floor. Flat cel shading - one dark
// band along the inner edge, three ink fold lines, one light fold - an ink outline and a hard drop. Mirrored for the right.
const DRAPE = 'M-8,22L86,22C72,92 54,170 48,226C56,254 74,282 90,304L-8,304Z';
const drape = (flip) => `<g${flip ? ' transform="translate(400 0) scale(-1 1)"' : ''}>` +
  `<path d="${DRAPE}" transform="translate(5 4)" fill="${INK}" fill-opacity=".6"/>` +
  `<path d="${DRAPE}" fill="url(#drape)"/>` +
  `<path d="M86,22C72,92 54,170 48,226C56,254 74,282 90,304L72,304C58,282 46,254 40,226C45,176 60,100 70,22Z" fill="#4a2038" fill-opacity=".7"/>` +
  `<path d="M36,22C33,110 26,190 24,226" fill="none" stroke="#f08ab6" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/>` +
  `<g fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="2.5" stroke-linecap="round">` +
  `<path d="M18,22C18,110 14,190 12,226C15,254 22,282 24,304"/><path d="M52,22C48,110 38,190 34,226C40,254 50,282 58,304"/></g>` +
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
<radialGradient id="bg" cx="50%" cy="36%" r="78%"><stop offset="0" stop-color="#4c3560"/><stop offset=".5" stop-color="#2f2140"/><stop offset="1" stop-color="#140d1c"/></radialGradient>
<radialGradient id="fade" cx="50%" cy="37%" r="60%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="raym"><rect width="400" height="400" fill="url(#fade)"/></mask>
<radialGradient id="burstG" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#8e5c80"/><stop offset=".7" stop-color="#724866"/><stop offset="1" stop-color="#58374f"/></radialGradient>
<radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe3f1" stop-opacity=".4"/><stop offset=".6" stop-color="#ffc3e0" stop-opacity=".16"/><stop offset="1" stop-color="#ffc3e0" stop-opacity="0"/></radialGradient>
<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1f8" stop-opacity=".3"/><stop offset=".75" stop-color="#ffd6ea" stop-opacity=".07"/><stop offset="1" stop-color="#ffd6ea" stop-opacity="0"/></linearGradient>
<linearGradient id="drape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a4c78"/><stop offset=".6" stop-color="#7d3d63"/><stop offset="1" stop-color="#5c2c4b"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6aa0"/><stop offset=".3" stop-color="#5c4274"/><stop offset="1" stop-color="#22152e"/></linearGradient>
<radialGradient id="floorPool" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe9f5" stop-opacity=".42"/><stop offset=".6" stop-color="#ffd8ec" stop-opacity=".14"/><stop offset="1" stop-color="#ffd8ec" stop-opacity="0"/></radialGradient>
<radialGradient id="podShadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#0d0a14" stop-opacity=".62"/><stop offset=".7" stop-color="#0d0a14" stop-opacity=".3"/><stop offset="1" stop-color="#0d0a14" stop-opacity="0"/></radialGradient>
<radialGradient id="shadowBed" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3a1c44" stop-opacity=".16"/><stop offset=".2" stop-color="#3a1c44" stop-opacity=".16"/><stop offset="1" stop-color="#3a1c44" stop-opacity="0"/></radialGradient>\n<radialGradient id="shadowCel" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#6e3474" stop-opacity=".58"/><stop offset=".86" stop-color="#6e3474" stop-opacity=".58"/><stop offset="1" stop-color="#6e3474" stop-opacity="0"/></radialGradient>\n<radialGradient id="shadowCore" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3a1642" stop-opacity=".62"/><stop offset=".8" stop-color="#3a1642" stop-opacity=".62"/><stop offset="1" stop-color="#3a1642" stop-opacity="0"/></radialGradient>\n<clipPath id="floorClip"><rect y="300" width="400" height="100"/></clipPath>
<linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d3e8"/><stop offset=".45" stop-color="#d59ac4"/><stop offset="1" stop-color="#9c5aa0"/></linearGradient>
<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4508c"/><stop offset=".6" stop-color="#a8366f"/><stop offset="1" stop-color="#6e1f4a"/></linearGradient>
<radialGradient id="pool" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".55" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="rimShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${INK}" stop-opacity=".55"/><stop offset=".22" stop-color="${INK}" stop-opacity="0"/><stop offset=".78" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity=".55"/></linearGradient>
<linearGradient id="bottom" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#07030b" stop-opacity=".62"/><stop offset=".45" stop-color="#07030b" stop-opacity=".16"/><stop offset="1" stop-color="#07030b" stop-opacity="0"/></linearGradient>
<radialGradient id="vig" cx="50%" cy="42%" r="72%"><stop offset=".6" stop-color="#0a0512" stop-opacity="0"/><stop offset="1" stop-color="#0a0512" stop-opacity=".6"/></radialGradient>
<clipPath id="faceClip"><path d="${face}"/></clipPath>
</defs>
<rect width="400" height="400" fill="url(#bg)"/>
<g fill="#ffd9ee" fill-opacity=".035" mask="url(#raym)">${rays}</g>
<!-- the burst behind the hero: hard ink shadow, ink outline, a lighter inner cut -->
<path d="${burst(206, 174, 150, 118, 0)}" fill="${INK}" fill-opacity=".6"/>
<path d="${burst(200, 168, 150, 118, 0)}" fill="url(#burstG)" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="${burst(200, 168, 112, 92, 5)}" fill="#a87896" fill-opacity=".28"/>
<ellipse cx="200" cy="170" rx="106" ry="100" fill="url(#halo)"/>
<!-- two spotlight beams crossing onto the podium -->
<path d="M28,-20L78,-20L262,336L150,336Z" fill="url(#beam)"/>
<path d="M322,-20L372,-20L250,336L138,336Z" fill="url(#beam)"/>
<!-- floor, then the amp stacks standing on it at each side -->
<rect y="300" width="400" height="100" fill="url(#floor)"/>
<g clip-path="url(#floorClip)" fill="none" stroke="${INK}" stroke-linecap="round">${boards}</g>
<ellipse cx="200" cy="338" rx="178" ry="46" fill="url(#floorPool)"/>
<path d="M0,300.5H400" stroke="#f3dcef" stroke-opacity=".6" stroke-width="2.5"/><path d="M0,303H400" stroke="${INK}" stroke-opacity=".5" stroke-width="2"/>
<ellipse cx="34" cy="308" rx="70" ry="8" fill="${INK}" fill-opacity=".35"/><ellipse cx="366" cy="308" rx="70" ry="8" fill="${INK}" fill-opacity=".35"/>
<!-- the drapes frame the stage; the speakers stand in front of them -->
${drape(false)}${drape(true)}
${amp(-18, false)}${amp(342, true)}
<!-- podium: soft floor shadow, rim with light bars, glossy top, painted ring, spotlight pool, soft contact shadow -->
<ellipse cx="${PX + 4}" cy="${PY + H + 10}" rx="${RX + 18}" ry="${RY + 6}" fill="url(#podShadow)"/>
<path d="${face}" fill="url(#rim)"/>
<g clip-path="url(#faceClip)" fill="#ffe3f1" fill-opacity=".2">${ticks}</g>
<path d="${face}" fill="url(#rimShade)"/>
<path d="${face}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<ellipse cx="${PX}" cy="${PY}" rx="${RX}" ry="${RY}" fill="url(#top)" stroke="${INK}" stroke-width="5"/>
<ellipse cx="${PX}" cy="${PY}" rx="${RX - 22}" ry="${RY - 6}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2.5"/>
<ellipse cx="${PX}" cy="${PY}" rx="86" ry="15" fill="url(#pool)"/>
<path d="M${PX - RX + 26},${PY - 13}A${RX - 10},${RY - 5} 0 0 1 ${PX + RX - 26},${PY - 13}" fill="none" stroke="url(#gloss)" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="${f(FEET_X + 3)}" cy="${f(FEET_Y + 3)}" rx="62" ry="13" fill="url(#shadowBed)"/>
<ellipse cx="${f(FEET_X + 3)}" cy="${f(FEET_Y + 2.8)}" rx="40" ry="9.2" fill="url(#shadowCel)"/>
<ellipse cx="${f(FEET_X + 1.5)}" cy="${f(FEET_Y + 1.2)}" rx="27" ry="5.2" fill="url(#shadowCore)"/>
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
