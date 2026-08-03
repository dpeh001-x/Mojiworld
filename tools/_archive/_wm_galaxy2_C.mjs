// W-map galaxy pass 2 · C — iridescent flowing title gradient.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // keyframes + class rule appended to the worldmap style block
  { old: `    @keyframes wm-shimmer { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.9; } }`,
    neu: `    @keyframes wm-shimmer { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.9; } }
    /* v0.26.869 — iridescent flowing title gradient */
    #worldmap-modal .wm-title-iris {
      background-size: 300% 100% !important;
      animation: wm-iris 7s linear infinite;
    }
    @keyframes wm-iris { 0% { background-position: 0% 0; } 100% { background-position: 300% 0; } }` },
  // tag the title span
  { old: `🌌 <span style="background:linear-gradient(90deg,#9ad8ff,#c8a8ff,#ff9ae8,#ffe6a8); -webkit-background-clip:text; background-clip:text; color:transparent;">World Map</span>`,
    neu: `🌌 <span class="wm-title-iris" style="background:linear-gradient(90deg,#9ad8ff,#c8a8ff,#ff9ae8,#ffe6a8,#9ad8ff); -webkit-background-clip:text; background-clip:text; color:transparent;">World Map</span>` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' title edits applied.');
