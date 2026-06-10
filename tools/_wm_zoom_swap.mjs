// W-map open animation — replace the 3D globe spin (janky: re-rasterizes the
// heavy SVG under changing perspective) with a cinematic zoom-in: fly INTO the
// galaxy — scale 0.62 -> soft 1.012 overshoot -> settle, blur-to-sharp, fade.
// Pure compositor work (transform/opacity), 0.9s. Same lifecycle (grid class,
// animationend cleanup, hard fallback for frozen-animation windows).
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // CSS — keyframes swap (drop the perspective context entirely)
  { old: `    /* v0.26.872 — one-round globe spin-in when the W map opens */
    #worldmap-grid { perspective: 1400px; }
    #worldmap-grid.wm-globe-spin svg {
      animation: wm-globe 1.6s cubic-bezier(0.22, 1, 0.36, 1) 1;
    }
    @keyframes wm-globe {
      0%   { transform: rotateY(360deg) scale(0.55); opacity: 0; }
      30%  { opacity: 1; }
      100% { transform: rotateY(0deg) scale(1); opacity: 1; }
    }`,
    neu: `    /* v0.26.875 — cinematic zoom-in when the W map opens. Replaced the 3D
       globe spin: rotating the heavy SVG (78 gradient planets + blurred
       nebulae) under a perspective forced continuous re-rasterization and
       janked on mid-range machines. This is pure compositor work — fly INTO
       the galaxy: small + blurred + dim, soft 1.2% overshoot, settle sharp. */
    #worldmap-grid.wm-globe-spin svg {
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
  },
  // JS — comments + tightened fallback (animation is 0.9s now)
  { old: `  // v0.26.872 — one-round globe spin-in. Class sits on the persistent grid
  // (not the rebuilt svg) so internal re-renders don't re-spin; the reflow
  // poke restarts the CSS animation on rapid close/reopen, and the class is
  // dropped on animation end so hover/edit interactions run untransformed.`,
    neu: `  // v0.26.875 — cinematic zoom-in (was a 3D globe spin; see the CSS note).
  // Class sits on the persistent grid (not the rebuilt svg) so internal
  // re-renders don't re-trigger; the reflow poke restarts the animation on
  // rapid close/reopen, and the class is dropped on animation end so
  // hover/edit interactions run untransformed (and will-change releases).`,
  },
  { old: `    // Hard fallback: occluded/throttled windows freeze CSS animations at the
    // 0% keyframe and never fire animationend — without this the map would
    // sit invisible (opacity 0, scale 0.55). 1.8s > the 1.6s animation.
    if (_spinGrid._spinT) clearTimeout(_spinGrid._spinT);
    _spinGrid._spinT = setTimeout(_spinDone, 1800);`,
    neu: `    // Hard fallback: occluded/throttled windows freeze CSS animations at the
    // 0% keyframe and never fire animationend — without this the map would
    // sit invisible (opacity 0, scale 0.62). 1.1s > the 0.9s animation.
    if (_spinGrid._spinT) clearTimeout(_spinGrid._spinT);
    _spinGrid._spinT = setTimeout(_spinDone, 1100);`,
  },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' zoom-swap edits applied.');
