// W-map galaxy pass 2 · A — nebula drift, galactic core, aurora sweep,
// vignette, second comet; extends the v0.26.868 backdrop block in-place.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const OLD_STYLE = `  const _gstyle = document.createElementNS(SVG_NS, 'style');
  _gstyle.textContent =
    '@keyframes wmTw { 0%,100%{opacity:0.15} 50%{opacity:0.85} } ' +
    '.wm-tw { animation: wmTw 2.6s ease-in-out infinite; } ' +
    '@keyframes wmShoot { 0%{transform:translate(0,0); opacity:0} 4%{opacity:0.9} 14%{transform:translate(340px,170px); opacity:0} 100%{transform:translate(340px,170px); opacity:0} } ' +
    '.wm-shoot { animation: wmShoot 9s linear infinite; }';`;
const NEW_STYLE = `  const _gstyle = document.createElementNS(SVG_NS, 'style');
  _gstyle.textContent =
    '@keyframes wmTw { 0%,100%{opacity:0.15} 50%{opacity:0.85} } ' +
    '.wm-tw { animation: wmTw 2.6s ease-in-out infinite; } ' +
    '@keyframes wmShoot { 0%{transform:translate(0,0); opacity:0} 4%{opacity:0.9} 14%{transform:translate(340px,170px); opacity:0} 100%{transform:translate(340px,170px); opacity:0} } ' +
    '.wm-shoot { animation: wmShoot 9s linear infinite; } ' +
    // v0.26.869 — slow nebula drift (translate lives on a wrapper <g> so the
    // ellipse keeps its attribute rotation), galactic-core pulse, aurora sweep,
    // second comet, planet hover glow.
    '@keyframes wmNebA { 0%,100%{transform:translate(0,0)} 50%{transform:translate(26px,12px)} } .wm-nebA { animation: wmNebA 26s ease-in-out infinite; } ' +
    '@keyframes wmNebB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-30px,-10px)} } .wm-nebB { animation: wmNebB 34s ease-in-out infinite; } ' +
    '@keyframes wmNebC { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(14px,-16px) scale(1.07)} } .wm-nebC { animation: wmNebC 22s ease-in-out infinite; transform-origin:center; } ' +
    '@keyframes wmCore { 0%,100%{opacity:0.7} 50%{opacity:1} } .wm-core { animation: wmCore 5s ease-in-out infinite; } ' +
    '@keyframes wmAur { 0%{transform:translateX(-9%)} 100%{transform:translateX(9%)} } .wm-aur { animation: wmAur 16s ease-in-out infinite alternate; } ' +
    '@keyframes wmShoot2 { 0%,52%{transform:translate(0,0); opacity:0} 56%{opacity:0.85} 68%{transform:translate(-380px,150px); opacity:0} 100%{transform:translate(-380px,150px); opacity:0} } ' +
    '.wm-shoot2 { animation: wmShoot2 13s linear infinite; } ' +
    '.wm-node:hover .wm-disc { filter: drop-shadow(0 0 7px rgba(180,150,255,0.95)); }';`;

const OLD_NEB = `  const _neb = (fill, nx, ny, rx, ry, rot) => {
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
  _neb('rgba(235,240,255,0.05)', W*0.5, H*0.5, W*0.62, H*0.13, -16);   // milky-way band`;
const NEW_NEB = `  const _neb = (fill, nx, ny, rx, ry, rot, cls) => {
    const wrap = document.createElementNS(SVG_NS, 'g');               // v0.26.869 — drift wrapper (CSS transform must not clobber the attribute rotation)
    if (cls) wrap.setAttribute('class', cls);
    const e = document.createElementNS(SVG_NS, 'ellipse');
    e.setAttribute('cx', nx); e.setAttribute('cy', ny);
    e.setAttribute('rx', rx);  e.setAttribute('ry', ry);
    e.setAttribute('fill', fill);
    e.setAttribute('filter', 'url(#wm-nebblur)');
    if (rot) e.setAttribute('transform', 'rotate(' + rot + ' ' + nx + ' ' + ny + ')');
    e.setAttribute('pointer-events', 'none');
    wrap.appendChild(e);
    svg.appendChild(wrap);
  };
  _neb('url(#wm-neb-v)', W*0.22, H*0.20, W*0.30, H*0.22, -18, 'wm-nebA');
  _neb('url(#wm-neb-c)', W*0.78, H*0.74, W*0.28, H*0.20, 14, 'wm-nebB');
  _neb('url(#wm-neb-m)', W*0.58, H*0.34, W*0.20, H*0.14, -30, 'wm-nebC');
  _neb('rgba(235,240,255,0.05)', W*0.5, H*0.5, W*0.62, H*0.13, -16);   // milky-way band (static)`;

const OLD_TAIL = `  _shoot.setAttribute('class', 'wm-shoot');
  _shoot.setAttribute('pointer-events', 'none');
  svg.appendChild(_shoot);`;
const NEW_TAIL = `  _shoot.setAttribute('class', 'wm-shoot');
  _shoot.setAttribute('pointer-events', 'none');
  svg.appendChild(_shoot);
  // v0.26.869 — extra cosmos: defs for the new pieces, galactic core with
  // cross-flare, gradient-tail comet #2, aurora sweep, edge vignette.
  const _gdefs2 = document.createElementNS(SVG_NS, 'defs');
  _gdefs2.appendChild(_mkRad('wm-coreGrad', [['0%','rgba(255,250,235,0.95)'],['22%','rgba(220,180,255,0.55)'],['100%','rgba(190,120,255,0)']]));
  _gdefs2.appendChild(_mkRad('wm-vig', [['0%','rgba(0,0,0,0)'],['62%','rgba(0,0,0,0)'],['100%','rgba(2,0,14,0.55)']]));
  const _aurG = document.createElementNS(SVG_NS, 'linearGradient');
  _aurG.setAttribute('id', 'wm-aurGrad');
  _aurG.setAttribute('x1','0%'); _aurG.setAttribute('y1','0%');
  _aurG.setAttribute('x2','100%'); _aurG.setAttribute('y2','0%');
  [['0%','rgba(120,255,210,0)'],['35%','rgba(120,255,210,0.05)'],['60%','rgba(150,120,255,0.07)'],['100%','rgba(150,120,255,0)']].forEach(p => {
    const st = document.createElementNS(SVG_NS, 'stop');
    st.setAttribute('offset', p[0]); st.setAttribute('stop-color', p[1]);
    _aurG.appendChild(st);
  });
  _gdefs2.appendChild(_aurG);
  svg.appendChild(_gdefs2);
  const _coreG = document.createElementNS(SVG_NS, 'g');
  _coreG.setAttribute('class', 'wm-core');
  _coreG.setAttribute('pointer-events', 'none');
  const _coreGlow = document.createElementNS(SVG_NS, 'circle');
  _coreGlow.setAttribute('cx', W*0.86); _coreGlow.setAttribute('cy', H*0.12);
  _coreGlow.setAttribute('r', 30);
  _coreGlow.setAttribute('fill', 'url(#wm-coreGrad)');
  _coreG.appendChild(_coreGlow);
  const _flare = (dx, dy) => {
    const l = document.createElementNS(SVG_NS, 'line');
    l.setAttribute('x1', W*0.86 - dx); l.setAttribute('y1', H*0.12 - dy);
    l.setAttribute('x2', W*0.86 + dx); l.setAttribute('y2', H*0.12 + dy);
    l.setAttribute('stroke', 'rgba(255,250,235,0.55)');
    l.setAttribute('stroke-width', '1');
    _coreG.appendChild(l);
  };
  _flare(44, 0); _flare(0, 26);
  svg.appendChild(_coreG);
  const _shoot2 = document.createElementNS(SVG_NS, 'line');
  _shoot2.setAttribute('x1', W*0.88); _shoot2.setAttribute('y1', H*0.86);
  _shoot2.setAttribute('x2', W*0.88 + 52); _shoot2.setAttribute('y2', H*0.86 - 20);
  _shoot2.setAttribute('stroke', 'rgba(190,225,255,0.8)');
  _shoot2.setAttribute('stroke-width', '1.4');
  _shoot2.setAttribute('stroke-linecap', 'round');
  _shoot2.setAttribute('class', 'wm-shoot2');
  _shoot2.setAttribute('pointer-events', 'none');
  svg.appendChild(_shoot2);
  const _aurWrap = document.createElementNS(SVG_NS, 'g');
  _aurWrap.setAttribute('class', 'wm-aur');
  _aurWrap.setAttribute('pointer-events', 'none');
  const _aur = document.createElementNS(SVG_NS, 'rect');
  _aur.setAttribute('x', -W*0.2); _aur.setAttribute('y', 0);
  _aur.setAttribute('width', W*1.4); _aur.setAttribute('height', H);
  _aur.setAttribute('fill', 'url(#wm-aurGrad)');
  _aur.setAttribute('transform', 'rotate(-12 ' + (W/2) + ' ' + (H/2) + ')');
  _aurWrap.appendChild(_aur);
  svg.appendChild(_aurWrap);
  const _vig = document.createElementNS(SVG_NS, 'rect');
  _vig.setAttribute('x', 0); _vig.setAttribute('y', 0);
  _vig.setAttribute('width', W); _vig.setAttribute('height', H);
  _vig.setAttribute('fill', 'url(#wm-vig)');
  _vig.setAttribute('pointer-events', 'none');
  svg.appendChild(_vig);`;

const reps = [
  { old: OLD_STYLE, neu: NEW_STYLE },
  { old: OLD_NEB,   neu: NEW_NEB },
  { old: OLD_TAIL,  neu: NEW_TAIL },
];
let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' backdrop-2 edits applied.');
