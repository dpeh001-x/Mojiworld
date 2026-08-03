// W-map galaxy pass · 1/3 — deep-space SVG canvas + nebula/starfield backdrop.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const OLD_CSS = `  svg.style.cssText = _fitCss + 'background:linear-gradient(rgba(10,6,24,0.18),rgba(10,6,24,0.22)),radial-gradient(ellipse at center,#1e1834,#0a0618 80%); border-radius:10px; border:1px solid rgba(180,140,220,0.35); display:block;';`;
const NEW_CSS = `  svg.style.cssText = _fitCss + 'background:radial-gradient(ellipse at 24% 18%, rgba(88,44,160,0.40), transparent 52%),radial-gradient(ellipse at 78% 80%, rgba(30,90,190,0.34), transparent 55%),radial-gradient(ellipse at 55% 40%, rgba(190,60,160,0.16), transparent 45%),radial-gradient(ellipse at center, #14102e, #060314 82%); border-radius:12px; border:1px solid rgba(160,120,255,0.45); box-shadow:0 0 26px rgba(120,80,220,0.25) inset, 0 0 18px rgba(120,80,220,0.30); display:block;';   // v0.26.868 — galaxy canvas`;

const OLD_STARS = `  // Background sparkle stars
  // v0.25.563 — count cut 60 → 14 per "<15 particles" spec.
  for (let i = 0; i < 14; i++) {
    const s = document.createElementNS(SVG_NS, 'circle');
    s.setAttribute('cx', Math.random() * W);
    s.setAttribute('cy', Math.random() * H);
    s.setAttribute('r', Math.random() * 1.2 + 0.4);
    s.setAttribute('fill', 'rgba(255,255,255,0.35)');
    svg.appendChild(s);
  }`;

const NEW_STARS = `  // v0.26.868 — GALAXY BACKDROP (per user "galaxy themed and very fancy").
  // Supersedes the v0.25.563 14-star sparkle: blurred nebula clouds, a tilted
  // milky-way band, ~58 static + 12 twinkling stars, one lazy shooting star,
  // and planet-sphere gradients consumed by the node loop below. Animations
  // are CSS-scoped to this SVG and only run while the modal is open.
  const _gdefs = document.createElementNS(SVG_NS, 'defs');
  const _mkRad = (id, stops) => {
    const rg = document.createElementNS(SVG_NS, 'radialGradient');
    rg.setAttribute('id', id);
    for (const pair of stops) {
      const st = document.createElementNS(SVG_NS, 'stop');
      st.setAttribute('offset', pair[0]); st.setAttribute('stop-color', pair[1]);
      rg.appendChild(st);
    }
    return rg;
  };
  _gdefs.appendChild(_mkRad('wm-neb-v', [['0%','rgba(150,80,255,0.34)'],['100%','rgba(150,80,255,0)']]));
  _gdefs.appendChild(_mkRad('wm-neb-c', [['0%','rgba(70,180,255,0.26)'],['100%','rgba(70,180,255,0)']]));
  _gdefs.appendChild(_mkRad('wm-neb-m', [['0%','rgba(255,90,200,0.20)'],['100%','rgba(255,90,200,0)']]));
  // Planet-sphere node fills (off-centre highlight reads as a lit globe)
  const _mkPlanet = (id, hi, mid, dark) => {
    const rg = _mkRad(id, [['0%',hi],['45%',mid],['100%',dark]]);
    rg.setAttribute('cx','35%'); rg.setAttribute('cy','30%'); rg.setAttribute('r','75%');
    return rg;
  };
  _gdefs.appendChild(_mkPlanet('wm-planet',        'rgba(120,95,185,0.95)', 'rgba(58,40,95,0.92)',  'rgba(22,14,42,0.95)'));
  _gdefs.appendChild(_mkPlanet('wm-planet-hub',    'rgba(255,215,120,0.95)','rgba(150,105,35,0.95)','rgba(70,45,12,0.95)'));
  _gdefs.appendChild(_mkPlanet('wm-planet-locked', 'rgba(60,50,85,0.85)',  'rgba(30,22,48,0.8)',   'rgba(12,8,24,0.85)'));
  const _nblur = document.createElementNS(SVG_NS, 'filter');
  _nblur.setAttribute('id', 'wm-nebblur');
  _nblur.setAttribute('x','-60%'); _nblur.setAttribute('y','-60%');
  _nblur.setAttribute('width','220%'); _nblur.setAttribute('height','220%');
  const _gb = document.createElementNS(SVG_NS, 'feGaussianBlur');
  _gb.setAttribute('stdDeviation', '22');
  _nblur.appendChild(_gb);
  _gdefs.appendChild(_nblur);
  svg.appendChild(_gdefs);
  const _gstyle = document.createElementNS(SVG_NS, 'style');
  _gstyle.textContent =
    '@keyframes wmTw { 0%,100%{opacity:0.15} 50%{opacity:0.85} } ' +
    '.wm-tw { animation: wmTw 2.6s ease-in-out infinite; } ' +
    '@keyframes wmShoot { 0%{transform:translate(0,0); opacity:0} 4%{opacity:0.9} 14%{transform:translate(340px,170px); opacity:0} 100%{transform:translate(340px,170px); opacity:0} } ' +
    '.wm-shoot { animation: wmShoot 9s linear infinite; }';
  svg.appendChild(_gstyle);
  const _neb = (fill, nx, ny, rx, ry, rot) => {
    const e = document.createElementNS(SVG_NS, 'ellipse');
    e.setAttribute('cx', nx); e.setAttribute('cy', ny);
    e.setAttribute('rx', rx);  e.setAttribute('ry', ry);
    e.setAttribute('fill', fill);
    e.setAttribute('filter', 'url(#wm-nebblur)');
    if (rot) e.setAttribute('transform', 'rotate(' + rot + ' ' + nx + ' ' + ny + ')');
    e.setAttribute('pointer-events', 'none');
    svg.appendChild(e);
  };
  _neb('url(#wm-neb-v)', W*0.22, H*0.20, W*0.30, H*0.22, -18);
  _neb('url(#wm-neb-c)', W*0.78, H*0.74, W*0.28, H*0.20, 14);
  _neb('url(#wm-neb-m)', W*0.58, H*0.34, W*0.20, H*0.14, -30);
  _neb('rgba(235,240,255,0.05)', W*0.5, H*0.5, W*0.62, H*0.13, -16);   // milky-way band
  const _starCols = ['rgba(255,255,255,0.65)','rgba(170,210,255,0.6)','rgba(255,230,170,0.55)'];
  for (let i = 0; i < 58; i++) {
    const s = document.createElementNS(SVG_NS, 'circle');
    s.setAttribute('cx', (Math.random() * W).toFixed(1));
    s.setAttribute('cy', (Math.random() * H).toFixed(1));
    s.setAttribute('r', (Math.random() * 1.3 + 0.3).toFixed(2));
    s.setAttribute('fill', _starCols[i % 3]);
    s.setAttribute('opacity', (0.25 + Math.random() * 0.5).toFixed(2));
    s.setAttribute('pointer-events', 'none');
    svg.appendChild(s);
  }
  for (let i = 0; i < 12; i++) {
    const s = document.createElementNS(SVG_NS, 'circle');
    s.setAttribute('cx', (Math.random() * W).toFixed(1));
    s.setAttribute('cy', (Math.random() * H).toFixed(1));
    s.setAttribute('r', (Math.random() * 1.4 + 0.7).toFixed(2));
    s.setAttribute('fill', '#fff');
    s.setAttribute('class', 'wm-tw');
    s.style.animationDelay = (Math.random() * 2.6).toFixed(2) + 's';
    s.setAttribute('pointer-events', 'none');
    svg.appendChild(s);
  }
  const _shoot = document.createElementNS(SVG_NS, 'line');
  _shoot.setAttribute('x1', W*0.12); _shoot.setAttribute('y1', H*0.10);
  _shoot.setAttribute('x2', W*0.12 - 46); _shoot.setAttribute('y2', H*0.10 - 23);
  _shoot.setAttribute('stroke', 'rgba(255,255,255,0.85)');
  _shoot.setAttribute('stroke-width', '1.6');
  _shoot.setAttribute('stroke-linecap', 'round');
  _shoot.setAttribute('class', 'wm-shoot');
  _shoot.setAttribute('pointer-events', 'none');
  svg.appendChild(_shoot);`;

const reps = [ { old: OLD_CSS, neu: NEW_CSS }, { old: OLD_STARS, neu: NEW_STARS } ];
let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' galaxy-backdrop edits applied.');
