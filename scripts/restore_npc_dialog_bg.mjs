// Recover the plate the user pointed at (v0.29.755, commit eb403f9f) and re-cut
// it for the panel.
//
// The original was 768x768 with a DARK VIGNETTE BAKED INTO ITS OWN EDGES — that
// border, not the CSS fit, is why the shards always sat inset from the frame no
// matter how the layer was sized. So: measure where the artwork actually starts,
// crop the dead frame away, then widen to the panel's real proportions so the
// CSS 100%x100% is a 1:1 map rather than a smear.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
const SCRATCH = 'C:/Users/dpeh0/AppData/Local/Temp/claude/C--Users-dpeh0-Mojiworld/bc18c768-f8f1-4509-8f46-b01812de2502/scratchpad';
const raw = execFileSync('git', ['cat-file', '-p', 'eb403f9f:Sprites/ui/npc_dialog_bg.webp'],
  { cwd: 'C:/Users/dpeh0/Mojiworld', maxBuffer: 1 << 28, encoding: 'buffer' });
const meta = await sharp(raw).metadata();
console.log('recovered v1 art:', raw.length, 'bytes', meta.width + 'x' + meta.height);

const S = meta.width;
const src = await sharp(raw).flatten({ background: { r: 16, g: 9, b: 28 } }).removeAlpha().raw().toBuffer();
const warmInCol = (x) => { let h = 0; for (let y = 0; y < S; y++) { const i = (y * S + x) * 3;
  if (src[i] > 70 && src[i] > src[i + 2] * 1.2) h++; } return h / S; };
const warmInRow = (y) => { let h = 0; for (let x = 0; x < S; x++) { const i = (y * S + x) * 3;
  if (src[i] > 70 && src[i] > src[i + 2] * 1.2) h++; } return h / S; };
let L = 0, R = S - 1, T = 0, B = S - 1;
while (L < S * 0.2 && warmInCol(L) < 0.02) L++;
while (R > S * 0.8 && warmInCol(R) < 0.02) R--;
while (T < S * 0.2 && warmInRow(T) < 0.02) T++;
while (B > S * 0.8 && warmInRow(B) < 0.02) B--;
console.log(`baked frame: left ${L}px  right ${S - 1 - R}px  top ${T}px  bottom ${S - 1 - B}px`);

const W = 1024, H = 576, A = 108;   // 0.42 — a touch dimmer than v1's 0.46
const rgb = await sharp(raw)
  .flatten({ background: { r: 16, g: 9, b: 28 } })
  .extract({ left: L, top: T, width: R - L + 1, height: B - T + 1 })
  .resize(W, H, { fit: 'fill' })
  .removeAlpha().raw().toBuffer();
const out = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
  .joinChannel(Buffer.alloc(W * H, A), { raw: { width: W, height: H, channels: 1 } })
  .webp({ quality: 86 }).toBuffer();
writeFileSync(`${SCRATCH}/npc_dialog_bg_v5.webp`, out);
await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).resize(700, 394).png().toFile(`${SCRATCH}/v5_prev.png`);
const band = (x0, x1) => { let warm = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 3; n++;
    if (rgb[i] > 70 && rgb[i] > rgb[i + 2] * 1.25) warm++; }
  return Math.round(warm / n * 100); };
console.log(`wide plate ${Math.round(out.length / 1024)} KB alpha ${(A / 255).toFixed(2)}`);
console.log(`edge warmth: left ${band(0, 40)}%  right ${band(W - 40, W)}%  centre ${band(W * 0.4 | 0, W * 0.6 | 0)}%`);
