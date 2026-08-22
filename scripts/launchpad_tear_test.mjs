// Test: the Gravitos arena launch pad is a DIMENSIONAL TEAR, not the runic
// bumper disc (per user: "instead of such a large bumper, regenerate the image
// in a style of dimensional tears instead").
//
// The swap is not just "a new picture": drawLaunchPads derives the drawn size
// from the file's own aspect and plants the BOX bottom on the pad line, so the
// canvas geometry IS the layout. These checks pin the geometry that makes the
// art sit right, which a future re-roll could silently break.
//   node scripts/launchpad_tear_test.mjs
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const PAD = 'Sprites/objects/launchpad_pad.webp';

ok('the pad sprite ships', existsSync(PAD), PAD);
const buf = readFileSync(PAD);
const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const at = (x, y) => data[(y * W + x) * C + 3];
let x0 = W, x1 = -1, y0 = H, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) > 25) {
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
const bottomPad = H - 1 - y1;

// A tear is TALL; the disc it replaces was wide (484x378 content, ratio 0.78).
ok('the art is a tall rift, not a wide disc (content is >2x taller than wide)',
   ch / cw > 2, { content: cw + 'x' + ch, ratio: +(ch / cw).toFixed(2) });

// drawLaunchPads: drawW = pad.w * 1.42, drawH = drawW * (H / W). The arena's
// pads are w:120, so pin the DRAWN footprint the player actually sees.
const padW = 120, drawW = padW * 1.42, drawH = drawW * (H / W);
const drawnContentW = Math.round(drawW * cw / W);
const drawnContentH = Math.round(drawH * ch / H);
ok('it draws narrower than the old disc did (161px) on a 120px pad',
   drawnContentW > 60 && drawnContentW < 130, { drawnContentW });
ok('...and tall enough to read as a rift', drawnContentH > 200 && drawnContentH < 340, { drawnContentH });

// The box bottom lands 6px below the pad line, so a small bottom margin puts
// the rift's BASE on the ground instead of sunk into it.
const drawnBottomGap = Math.round(drawH * bottomPad / H);
ok('its base sits on the pad line (small bottom margin, not sunk or floating)',
   drawnBottomGap >= 2 && drawnBottomGap <= 20, { canvasBottomPad: bottomPad, drawnBottomGap });

// Colour: the draw code tints its procedural halo with pad.color (#66ddff by
// default), so the art has to be in that cyan family or the two disagree.
const { data: px } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let cyan = 0, lit = 0;
for (let i = 0; i < px.length; i += C) {
  if (px[i + 3] < 60) continue;
  lit++;
  if (px[i + 2] > 120 && px[i + 2] >= px[i + 1] && px[i + 1] >= px[i]) cyan++;
}
ok('the rift reads cyan/blue, matching the pad glow colour', lit > 0 && cyan / lit > 0.5,
   { cyanShare: +(cyan / Math.max(1, lit)).toFixed(2) });

// The old art is genuinely gone (no leftover backup shipping beside it).
ok('the replaced disc is not left behind in the ship path',
   !existsSync('Sprites/objects/launchpad_pad_disc_backup.webp'), '');

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
