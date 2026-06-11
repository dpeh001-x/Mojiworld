// W-map zoom-in: much faster + lag-free. The 0.9s animation animated
// filter:blur — blurring a 78-planet SVG re-PAINTS the layer every frame
// (the actual jank). Now 0.45s, transform+opacity ONLY (pure compositor),
// no blur, tighter travel. Fallback timer tightened to match.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  { old: `    #worldmap-grid.wm-globe-spin svg {
      animation: wm-zoom 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1;
      will-change: transform, opacity, filter;
      transform-origin: 50% 50%;
    }
    @keyframes wm-zoom {
      0%   { transform: scale(0.62) translateY(14px); opacity: 0; filter: blur(6px); }
      55%  { opacity: 1; }
      80%  { transform: scale(1.012) translateY(0); filter: blur(0); }
      100% { transform: scale(1); opacity: 1; filter: blur(0); }
    }`,
    neu: `    /* v0.26.903 — zoom sped up 0.9s → 0.45s and the blur REMOVED: animating
       filter:blur re-rasterizes the heavy SVG every frame (that was the lag);
       transform+opacity stay on the compositor. */
    #worldmap-grid.wm-globe-spin svg {
      animation: wm-zoom 0.45s cubic-bezier(0.22, 1, 0.36, 1) 1;
      will-change: transform, opacity;
      transform-origin: 50% 50%;
    }
    @keyframes wm-zoom {
      0%   { transform: scale(0.78) translateY(8px); opacity: 0; }
      60%  { opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }` },
  { old: `    // Hard fallback: occluded/throttled windows freeze CSS animations at the
    // 0% keyframe and never fire animationend — without this the map would
    // sit invisible (opacity 0, scale 0.62). 1.1s > the 0.9s animation.
    if (_spinGrid._spinT) clearTimeout(_spinGrid._spinT);
    _spinGrid._spinT = setTimeout(_spinDone, 1100);`,
    neu: `    // Hard fallback: occluded/throttled windows freeze CSS animations at the
    // 0% keyframe and never fire animationend — without this the map would
    // sit invisible (opacity 0). 0.65s > the 0.45s animation.
    if (_spinGrid._spinT) clearTimeout(_spinGrid._spinT);
    _spinGrid._spinT = setTimeout(_spinDone, 650);`,
  },
];

let n = 0;
for (let { old, neu } of reps) {
  // CRLF-tolerant: parts of the file were normalized to \r\n by another tool.
  let o = old, r = neu;
  if (src.split(o).length - 1 !== 1) { o = old.replace(/\n/g, '\r\n'); r = neu.replace(/\n/g, '\r\n'); }
  const c = src.split(o).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60).replace(/\n/g, '\\n') + '...'); process.exit(2); }
  src = src.replace(o, r); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' zoom edits applied.');
