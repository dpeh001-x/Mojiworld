// W-map galaxy pass 2 · B — active starlanes (travelling light pulses on links
// touching the current map), orbiting moon on the here-node, shimmering hub
// rings, node/disc classes for the CSS hover glow.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // 1) ACTIVE STARLANES — after the pass-2 edge is appended
  { old: `    if (!twoWay) {
      path.setAttribute('marker-end', isRemoved ? 'url(#wm-arrow-removed)' : 'url(#wm-arrow)');
    }
    svg.appendChild(path);`,
    neu: `    if (!twoWay) {
      path.setAttribute('marker-end', isRemoved ? 'url(#wm-arrow-removed)' : 'url(#wm-arrow)');
    }
    svg.appendChild(path);
    // v0.26.869 — ACTIVE STARLANES: links touching the current map brighten
    // and carry a travelling light pulse (SMIL animateMotion along the lane).
    if (!isRemoved && !_wmEditMode && (d.lo === cur || d.hi === cur)) {
      path.setAttribute('stroke', 'rgba(170,225,255,0.92)');
      path.setAttribute('stroke-width', '2.6');
      const _pulse = document.createElementNS(SVG_NS, 'circle');
      _pulse.setAttribute('r', '2.8');
      _pulse.setAttribute('fill', '#dff1ff');
      _pulse.setAttribute('opacity', '0.9');
      _pulse.setAttribute('pointer-events', 'none');
      const _mo = document.createElementNS(SVG_NS, 'animateMotion');
      _mo.setAttribute('dur', '2.4s');
      _mo.setAttribute('repeatCount', 'indefinite');
      _mo.setAttribute('begin', (-(Math.random() * 2.4)).toFixed(2) + 's');
      _mo.setAttribute('path', _wmCurvePath(pathFrom, pathTo));
      _pulse.appendChild(_mo);
      svg.appendChild(_pulse);
    }` },

  // 2) ORBITING MOON on the current-map node
  { old: `      halo.appendChild(_haO);
      g.appendChild(halo);
    }`,
    neu: `      halo.appendChild(_haO);
      g.appendChild(halo);
      // v0.26.869 — faint orbit ring + a little moon circling the here-planet
      const _orbit = document.createElementNS(SVG_NS, 'circle');
      _orbit.setAttribute('r', 40);
      _orbit.setAttribute('fill', 'none');
      _orbit.setAttribute('stroke', 'rgba(200,220,255,0.22)');
      _orbit.setAttribute('stroke-width', '1');
      _orbit.setAttribute('stroke-dasharray', '3,5');
      _orbit.setAttribute('pointer-events', 'none');
      g.appendChild(_orbit);
      const _moonG = document.createElementNS(SVG_NS, 'g');
      const _spin = document.createElementNS(SVG_NS, 'animateTransform');
      _spin.setAttribute('attributeName', 'transform');
      _spin.setAttribute('type', 'rotate');
      _spin.setAttribute('from', '0 0 0');
      _spin.setAttribute('to', '360 0 0');
      _spin.setAttribute('dur', '7s');
      _spin.setAttribute('repeatCount', 'indefinite');
      _moonG.appendChild(_spin);
      const _moon = document.createElementNS(SVG_NS, 'circle');
      _moon.setAttribute('cx', 40); _moon.setAttribute('cy', 0);
      _moon.setAttribute('r', 3.2);
      _moon.setAttribute('fill', '#ffeebb');
      _moon.setAttribute('pointer-events', 'none');
      _moonG.appendChild(_moon);
      g.appendChild(_moonG);
    }` },

  // 3) HUB-RING SHIMMER
  { old: `      _haloRing.setAttribute('stroke', 'rgba(255,221,102,0.40)');
      _haloRing.setAttribute('stroke-width', '1.5');
      _haloRing.setAttribute('pointer-events', 'none');
      g.insertBefore(_haloRing, disc);
    }`,
    neu: `      _haloRing.setAttribute('stroke', 'rgba(255,221,102,0.40)');
      _haloRing.setAttribute('stroke-width', '1.5');
      _haloRing.setAttribute('pointer-events', 'none');
      // v0.26.869 — gentle gold shimmer so the safe-hub ring twinkles
      const _hrA = document.createElementNS(SVG_NS, 'animate');
      _hrA.setAttribute('attributeName', 'stroke-opacity');
      _hrA.setAttribute('values', '0.55;1;0.55');
      _hrA.setAttribute('dur', '3.4s');
      _hrA.setAttribute('repeatCount', 'indefinite');
      _haloRing.appendChild(_hrA);
      g.insertBefore(_haloRing, disc);
    }` },

  // 4) node group class (hover-glow CSS hook)
  { old: `    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', \`translate(\${p.x},\${p.y})\`);`,
    neu: `    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'wm-node');   // v0.26.869 — hover-glow CSS hook
    g.setAttribute('transform', \`translate(\${p.x},\${p.y})\`);` },

  // 5) disc class
  { old: `    const disc = document.createElementNS(SVG_NS, 'circle');
    disc.setAttribute('r', here ? 24 : 21);             // v0.26.336 was 32 / 28 (was 22 / 19)`,
    neu: `    const disc = document.createElementNS(SVG_NS, 'circle');
    disc.setAttribute('class', 'wm-disc');              // v0.26.869 — hover-glow CSS hook
    disc.setAttribute('r', here ? 24 : 21);             // v0.26.336 was 32 / 28 (was 22 / 19)` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' motion edits applied.');
