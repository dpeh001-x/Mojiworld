// W-map — one-round globe spin-in on open (perspective rotateY 360° → 0°,
// decelerating into place). Class lives on the persistent #worldmap-grid so
// internal re-renders don't re-trigger; only the player W open path spins
// (dev key-1 editor stays instant).
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // 1) CSS — appended after the iris keyframes in the worldmap style block
  { old: `    @keyframes wm-iris { 0% { background-position: 0% 0; } 100% { background-position: 300% 0; } }`,
    neu: `    @keyframes wm-iris { 0% { background-position: 0% 0; } 100% { background-position: 300% 0; } }
    /* v0.26.872 — one-round globe spin-in when the W map opens */
    #worldmap-grid { perspective: 1400px; }
    #worldmap-grid.wm-globe-spin svg {
      animation: wm-globe 1.6s cubic-bezier(0.22, 1, 0.36, 1) 1;
    }
    @keyframes wm-globe {
      0%   { transform: rotateY(360deg) scale(0.55); opacity: 0; }
      30%  { opacity: 1; }
      100% { transform: rotateY(0deg) scale(1); opacity: 1; }
    }` },

  // 2) JS — trigger on the player W open path
  { old: `  renderWorldMap();
  modal.style.display = 'flex';
  game.paused = true;
}

// v0.26.x - DEV WORLD-MAP EDITOR (key 1).`,
    neu: `  renderWorldMap();
  // v0.26.872 — one-round globe spin-in. Class sits on the persistent grid
  // (not the rebuilt svg) so internal re-renders don't re-spin; the reflow
  // poke restarts the CSS animation on rapid close/reopen, and the class is
  // dropped on animation end so hover/edit interactions run untransformed.
  const _spinGrid = document.getElementById('worldmap-grid');
  if (_spinGrid) {
    _spinGrid.classList.remove('wm-globe-spin');
    void _spinGrid.offsetWidth;
    _spinGrid.classList.add('wm-globe-spin');
    const _spinSvg = _spinGrid.querySelector('svg');
    if (_spinSvg) _spinSvg.addEventListener('animationend', () => _spinGrid.classList.remove('wm-globe-spin'), { once: true });
  }
  modal.style.display = 'flex';
  game.paused = true;
}

// v0.26.x - DEV WORLD-MAP EDITOR (key 1).` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' globe-spin edits applied.');
