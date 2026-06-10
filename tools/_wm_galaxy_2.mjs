// W-map galaxy pass · 2/3 — glowing star-lane edges, planet-sphere node
// fills (gradients from pass 1's defs), pulsing "you are here" halo.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const OLD_EDGE = `    const isRemoved = _wmEditMode && _wmEditDeltas[key] === 'remove';
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', _wmCurvePath(pathFrom, pathTo));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', isRemoved ? 'rgba(255,80,80,0.65)' : 'rgba(200,170,240,0.55)');
    path.setAttribute('stroke-width', '2.2');
    path.setAttribute('stroke-linecap', 'round');`;
const NEW_EDGE = `    const isRemoved = _wmEditMode && _wmEditDeltas[key] === 'remove';
    // v0.26.868 — star-lane glow underlay (soft cyan halo under the core line)
    if (!isRemoved) {
      const glow = document.createElementNS(SVG_NS, 'path');
      glow.setAttribute('d', _wmCurvePath(pathFrom, pathTo));
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', 'rgba(120,200,255,0.14)');
      glow.setAttribute('stroke-width', '6.5');
      glow.setAttribute('stroke-linecap', 'round');
      glow.setAttribute('pointer-events', 'none');
      svg.appendChild(glow);
    }
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', _wmCurvePath(pathFrom, pathTo));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', isRemoved ? 'rgba(255,80,80,0.65)' : 'rgba(205,180,255,0.72)');
    path.setAttribute('stroke-width', '2.2');
    path.setAttribute('stroke-linecap', 'round');`;

const OLD_DISC = `    disc.setAttribute('fill',
      _isSafeHub ? 'rgba(80,60,18,0.92)'                // warm-gold body for hubs
                 : (acc.ok ? \`rgba(40,28,60,0.85)\` : 'rgba(20,15,30,0.7)'));`;
const NEW_DISC = `    disc.setAttribute('fill',
      _isSafeHub ? 'url(#wm-planet-hub)'                // v0.26.868 — gold planet-sphere for hubs
                 : (acc.ok ? 'url(#wm-planet)' : 'url(#wm-planet-locked)'));   // planet-shaded globes`;

const OLD_HALO = `    if (here) {
      const halo = document.createElementNS(SVG_NS, 'circle');
      halo.setAttribute('r', 30);                       // v0.26.336 was 40
      halo.setAttribute('fill', 'rgba(255,221,136,0.18)');
      halo.setAttribute('stroke', '#ffdd88');
      halo.setAttribute('stroke-width', '2.5');         // was 2
      g.appendChild(halo);
    }`;
const NEW_HALO = `    if (here) {
      const halo = document.createElementNS(SVG_NS, 'circle');
      halo.setAttribute('r', 30);                       // v0.26.336 was 40
      halo.setAttribute('fill', 'rgba(255,221,136,0.18)');
      halo.setAttribute('stroke', '#ffdd88');
      halo.setAttribute('stroke-width', '2.5');         // was 2
      // v0.26.868 — gentle SMIL pulse so "you are here" breathes like a star
      const _haR = document.createElementNS(SVG_NS, 'animate');
      _haR.setAttribute('attributeName', 'r');
      _haR.setAttribute('values', '30;34;30');
      _haR.setAttribute('dur', '2.4s');
      _haR.setAttribute('repeatCount', 'indefinite');
      halo.appendChild(_haR);
      const _haO = document.createElementNS(SVG_NS, 'animate');
      _haO.setAttribute('attributeName', 'stroke-opacity');
      _haO.setAttribute('values', '1;0.45;1');
      _haO.setAttribute('dur', '2.4s');
      _haO.setAttribute('repeatCount', 'indefinite');
      halo.appendChild(_haO);
      g.appendChild(halo);
    }`;

const reps = [
  { old: OLD_EDGE, neu: NEW_EDGE },
  { old: OLD_DISC, neu: NEW_DISC },
  { old: OLD_HALO, neu: NEW_HALO },
];
let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' edge/node/halo edits applied.');
