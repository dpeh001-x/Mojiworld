// The map pin, spherical from the mid down.
// ============================================================================
// Per user, on the shipped v0.30.671 pin: "this guguma pin can be more spherical
// from the mid and bottom section, please make it more spherical from mid and
// bottom section".
//
// WHY IT WAS AN EGG. The head is his sprite cut by one ellipse. That ellipse sat
// high (centre at 46% of the crop) and closed BELOW the crop's bottom edge, so
// its widest point was up near his eyes and its lower arc pinched inward all the
// way down - an egg pointing at the needle. Measured against the circle through
// its own widest row: 8.1% rms deviation across the mid and bottom, worst 20.6%,
// and the underside only reached 0.74 of the radius before the silhouette ran out.
//
// WHY NOT JUST A ROUNDER ELLIPSE. Closing the arc inside the crop closes the TOP
// arc too, which shears his tuft off. So the cut is now a UNION: a circle, plus
// everything above that circle's centre. Below the centre the circle rules and
// the mid and the underside are one round arc; above it his own silhouette rules,
// so the tuft, the crown and his outline are still his.
//
// THE CIRCLE. 232 px in both axes on a 560x540 crop centred on his belly - the
// largest circle that stays inside his body's own width, so every edge of the pin
// is his art and nothing is invented. Swept 21 candidates and measured each: this
// one is 1.2% rms (worst 2.0%) with the underside reaching 0.88 of the radius.
// --legacytop restores the old single-ellipse cut.
//
// Guarded + atomic + idempotent.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_PIN_GEN || 'C:/Users/dpeh0/Mojiworld/scripts/gen_guguma_pin.mjs';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('ball-bottom')) { console.log('already applied'); process.exit(0); }
const sub = (label, anchor, after) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.split(anchor).join(after);
};
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

sub('crop', "const HEAD_BOX = { left: Number(arg('bx', 222)), top: Number(arg('by', 183)), width: Number(arg('bw', 516)), height: Number(arg('bh', 496)) };",
  "const HEAD_BOX = { left: Number(arg('bx', 199)), top: Number(arg('by', 183)), width: Number(arg('bw', 560)), height: Number(arg('bh', 540)) };");

sub('oval', "const OVAL = { rx: Number(arg('ovrx', 0.52)), ry: Number(arg('ovry', 0.56)), cy: Number(arg('ovcy', 0.46)) };",
  "const OVAL = { rx: Number(arg('ovrx', 0.4143)), ry: Number(arg('ovry', 0.4296)), cy: Number(arg('ovcy', 0.530)) };   // ball-bottom: 232 px both ways, a CIRCLE centred on his belly");

sub('mask', '  const ell = Buffer.from(`<svg width="${m0.width}" height="${m0.height}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${m0.width / 2}" cy="${m0.height * OVAL.cy}" rx="${m0.width * OVAL.rx}" ry="${m0.height * OVAL.ry}" fill="#fff"/></svg>`);',
  J('  // ball-bottom - per user: "more spherical from the mid and bottom section". The cut is a circle,',
    '  // but it only rules BELOW its own centre: the rect unions everything above it, so his head, his',
    '  // tuft and his crown stay his own shape while the mid and the underside become one round arc.',
    '  // (A plain ellipse cannot do both - closing the bottom arc inside the crop closes the top too and',
    '  // shears the tuft off. Measured: 8.1% rms deviation from a circle before, 1.2% after.)',
    '  const ellCy = m0.height * OVAL.cy;',
    '  const ell = Buffer.from(`<svg width="${m0.width}" height="${m0.height}" xmlns="http://www.w3.org/2000/svg">`',
    '    + `<ellipse cx="${m0.width / 2}" cy="${ellCy}" rx="${m0.width * OVAL.rx}" ry="${m0.height * OVAL.ry}" fill="#fff"/>`',
    "    + (has('legacytop') ? '' : `<rect x=\"0\" y=\"0\" width=\"${m0.width}\" height=\"${ellCy}\" fill=\"#fff\"/>`)",
    "    + '</svg>');"));

const grew = s.length - n0;
if (grew < 300 || grew > 2000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: the pin's cut is a circle below its centre (+${grew} chars)`);
