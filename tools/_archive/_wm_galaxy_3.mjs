// W-map galaxy pass · 3/3 — modal chrome: layered cosmic backdrop over the
// painted bg, CSS star-shimmer layer, glowing nebula title.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const OLD_STYLE = `    #worldmap-modal .modal::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url('backgrounds/worldmap_bg.png') center/cover no-repeat;
      opacity: 0.6;
      pointer-events: none;
      z-index: 0;
      border-radius: inherit;
    }`;
const NEW_STYLE = `    #worldmap-modal .modal::before {
      content: '';
      position: absolute;
      inset: 0;
      /* v0.26.868 — galaxy chrome: nebula gradients layered over the painted bg */
      background:
        radial-gradient(ellipse at 15% 10%, rgba(120,60,210,0.35), transparent 50%),
        radial-gradient(ellipse at 85% 85%, rgba(40,110,220,0.28), transparent 52%),
        radial-gradient(ellipse at 60% 35%, rgba(225,70,170,0.15), transparent 45%),
        url('backgrounds/worldmap_bg.png') center/cover no-repeat,
        linear-gradient(160deg, #07041a, #0c0626 55%, #050212);
      opacity: 0.85;
      pointer-events: none;
      z-index: 0;
      border-radius: inherit;
    }
    /* v0.26.868 — shimmering star dots over the chrome (CSS-only twinkle) */
    #worldmap-modal .modal::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(1.5px 1.5px at 12% 22%, rgba(255,255,255,0.8), transparent 60%),
        radial-gradient(1px 1px at 34% 68%, rgba(170,210,255,0.7), transparent 60%),
        radial-gradient(1.5px 1.5px at 58% 14%, rgba(255,230,170,0.7), transparent 60%),
        radial-gradient(1px 1px at 76% 48%, rgba(255,255,255,0.65), transparent 60%),
        radial-gradient(1.5px 1.5px at 90% 80%, rgba(200,170,255,0.7), transparent 60%),
        radial-gradient(1px 1px at 22% 88%, rgba(255,255,255,0.6), transparent 60%);
      animation: wm-shimmer 3.2s ease-in-out infinite;
      pointer-events: none;
      z-index: 0;
      border-radius: inherit;
    }
    @keyframes wm-shimmer { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.9; } }`;

const OLD_TITLE = `          <div style="font:700 18px Inter, system-ui, sans-serif; color:#fff; letter-spacing:-0.2px;">
            🗺 <span style="background:linear-gradient(90deg,#ffe6a8,#ff9aa2,#c8a8ff); -webkit-background-clip:text; background-clip:text; color:transparent;">World Map</span>
          </div>`;
const NEW_TITLE = `          <div style="font:700 18px Inter, system-ui, sans-serif; color:#fff; letter-spacing:0.3px; filter:drop-shadow(0 0 8px rgba(150,100,255,0.55));">
            🌌 <span style="background:linear-gradient(90deg,#9ad8ff,#c8a8ff,#ff9ae8,#ffe6a8); -webkit-background-clip:text; background-clip:text; color:transparent;">World Map</span>
          </div>`;

const OLD_CHIP = `<span id="worldmap-here-chip" style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:rgba(102,204,255,0.15); border:1px solid rgba(102,204,255,0.45); border-radius:14px; font:600 11px Inter, system-ui, sans-serif; color:#aae;">`;
const NEW_CHIP = `<span id="worldmap-here-chip" style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:linear-gradient(90deg, rgba(102,160,255,0.18), rgba(190,120,255,0.18)); border:1px solid rgba(160,140,255,0.55); border-radius:14px; font:600 11px Inter, system-ui, sans-serif; color:#cdf; box-shadow:0 0 10px rgba(130,100,255,0.25);">`;

const reps = [
  { old: OLD_STYLE, neu: NEW_STYLE },
  { old: OLD_TITLE, neu: NEW_TITLE },
  { old: OLD_CHIP,  neu: NEW_CHIP },
];
let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' chrome edits applied.');
