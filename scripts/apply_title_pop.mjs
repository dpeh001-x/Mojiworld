// The title menu goes pop punk: a POP render backdrop, a hand-cut ink card for the gold frame, sticker buttons + icons.
// ============================================================================
// Per user: "the ornate gold frame can be changed to more pop punk style", "the background image can be swapped out
// with a more POP render", and "perhaps we can do something to the rectangular modal and icons".
//   BACKDROP - backgrounds/title_keyart_pop.webp (ludo.ai cut-out on a painted pop sky, see
//     scripts/gen_title_pop_keyart.mjs + compose_title_pop_keyart.mjs); a checkerboard strip along the bottom.
//   CARD - the painted gold 9-slice is dropped for layered clip-path paper: an ink edge, a white keyline, a deep
//     violet halftone ground, a hard hot-pink offset (itself ink-edged). The card is hand-cut: a hair skewed, a torn
//     bottom edge, tilted -1.2deg, hazard tape and pink tape over the top corners, a star and a bolt sticker hanging
//     off its edges. It slams in (scale + wobble) instead of the gold settle.
//   BUTTONS - ink stickers with a white keyline and a hard offset (pink on hover), alternately tilted; the primary
//     one acid yellow. Layers are pseudo-elements, so html.lx-nobackdrop (which strips box-shadow) keeps them.
//   ICONS - new pop sticker art (Sprites/ui/menu/menu_pop_*.webp, scripts/gen_title_pop_icons.mjs), die-cut white
//     edge + ink offset via drop-shadow, hanging off the chip's left edge. The Continue card's gold class crest becomes
//     a pop class sticker too (menu_pop_class_<cls>.webp - per user: "for the class icon it could be more fitting");
//     the class-select crests elsewhere are untouched.
//   TYPE - ink + pink hard shadow and a tilt on the logo, a yellow sticker star, a pink scribble rule, a torn paper
//     "Once upon a time", a yellow price-tag version chip, sticker social badges.
// Menu state only (#loading-overlay.menu-up); the loading phase is untouched. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import { SOCIAL } from './_title_pop_social.mjs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) title-pop/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const count = (a) => s.split(a).length - 1;
const uri = (svg) => `url("data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}")`;
const svg = (w, h, body) => `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`;
const star = (fill) => { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 13 : 30; p.push((36 + Math.cos(a) * r).toFixed(1) + ',' + (36 + Math.sin(a) * r).toFixed(1)); }
  return uri(svg(72, 72, `<polygon points='${p.join(' ')}' fill='${fill}' stroke='#0c0b10' stroke-width='4' stroke-linejoin='round'/>`)); };
const bolt = uri(svg(60, 90, "<path d='M34 4 L8 50 L28 50 L20 86 L52 34 L32 34 L42 4 Z' fill='#ff2e88' stroke='#0c0b10' stroke-width='4' stroke-linejoin='round'/>"));
// the card's silhouette: a hair skewed, torn along the bottom
const pts = ['0.9% 1.1%', '99.1% 0%', '100% 97.2%'];
for (let i = 1; i < 24; i++) pts.push(`${(100 - i * 100 / 24).toFixed(2)}% ${(i % 2 ? 99.7 - ((i * 7) % 5) * 0.25 : 97.6 + ((i * 3) % 4) * 0.3).toFixed(2)}%`);
pts.push('0% 98.9%');
const SHAPE = `polygon(${pts.join(', ')})`;
// the divider under the wordmark: two straight rules (per user: "the pink and yellow wavy lines can be better changed
// to straight lines with more harmony") - a full hot-pink bar over a shorter centred yellow one, set parallel to the logo
const rule = uri(svg(300, 18, "<path d='M6 6 H294' stroke='#ff2e88' stroke-width='6' stroke-linecap='round'/><path d='M60 14 H240' stroke='#ffe45c' stroke-width='3' stroke-linecap='round'/>"));
// "Once upon a time" (per user: "black pink", then "can be a better colour"): an ink torn tag with lemon capitals on a
// hot-pink offset - the wordmark's own lemon-to-pink, so the header reads as one set
const TORN = 'polygon(0 12%, 4% 0, 12% 10%, 22% 2%, 33% 9%, 45% 0, 57% 8%, 69% 1%, 80% 10%, 91% 2%, 100% 11%, 98% 55%, 100% 92%, 90% 100%, 79% 91%, 67% 100%, 55% 92%, 43% 100%, 31% 91%, 19% 100%, 8% 92%, 0 100%, 2% 50%)';

const A = '    #loading-overlay .lo-embers { display: none; }' + EOL + '  }' + EOL + '</style>';
if (count(A) !== 1) die('anchor matched ' + count(A));
const ORN = '<span class="lo-ornate" aria-hidden="true"></span>';
if (count(ORN) !== 1) die('ornate span matched ' + count(ORN));
const ICONS = ['newgame', 'coop', 'settings', 'backups'];
for (const k of ICONS) if (count(`src="Sprites/ui/menu/menu_${k}.webp"`) !== 1) die('icon src ' + k + ' matched ' + count(`src="Sprites/ui/menu/menu_${k}.webp"`));
const CREST_TAG = 'id="menu-continue-icon" alt="" src="Sprites/ui/class_crest_warrior.webp"';
const CREST_JS = "icon.src = 'Sprites/ui/class_crest_' + meta.cls + '.webp';";
// the four community badges: each link's inline <svg> is swapped whole for its pop redraw
const ICO_OPEN = '<span class="lo-link-ico">', ICO_CLOSE = '</svg></span>';
const icoSpan = (id) => { const a = s.indexOf(`<a class="lo-link" id="${id}"`), i = s.indexOf(ICO_OPEN, a), j = s.indexOf(ICO_CLOSE, i), next = s.indexOf('<a ', a + 3);
  if (a < 0 || i < 0 || j < 0 || j - i > 6000 || (next > 0 && next < j)) die('badge ' + id + ' not where expected'); return [i, j + ICO_CLOSE.length]; };
for (const id of Object.keys(SOCIAL)) { if (count(`<a class="lo-link" id="${id}"`) !== 1) die('link ' + id + ' matched ' + count(`<a class="lo-link" id="${id}"`)); icoSpan(id); }
if (count(CREST_TAG) !== 1) die('continue icon tag matched ' + count(CREST_TAG));
if (count(CREST_JS) !== 1) die('continue icon src line matched ' + count(CREST_JS));
for (const need of ['#loading-overlay.menu-up .lo-bg {', '#loading-overlay .lo-ornate {', '<p class="lede">Once upon a time</p>', 'id="lo-menu"', '@keyframes lo-menu-in']) if (!s.includes(need)) die('the title screen moved: no ' + need);
const M = '#loading-overlay.menu-up';
const INK = '#0c0b10', PAPER = '#f4f1ea', PINK = '#ff2e88', YEL = '#ffe45c';
const L = (sel, body) => `  ${sel} { ${body} }`;
const CSS = [
  '  /* v0.30.1118 title-pop — THE TITLE MENU GOES POP PUNK (per user: "the ornate gold frame can be changed to more pop punk',
  '     style", "the background image can be swapped out with a more POP render", "do something to the rectangular modal and',
  '     icons"). Menu state only; see scripts/apply_title_pop.mjs. */',
  // backdrop
  L(`${M} .lo-bg`, "background-image: url('backgrounds/title_keyart_pop.webp'); filter: none;"),
  L(`${M} .lo-bg::after`, 'background: radial-gradient(120% 95% at 50% 42%, rgba(0,0,0,0) 48%, rgba(20,6,40,0.32) 86%, rgba(20,6,40,0.55) 100%);'),
  L(`${M}::after`, `inset: auto 0 0 0; width: auto; height: 16px; border-radius: 0; filter: none; transform: none; animation: none; opacity: 1; z-index: 1; border-top: 3px solid ${INK}; background: repeating-conic-gradient(${INK} 0 25%, ${PAPER} 0 50%) 0 0 / 16px 16px;`),
  // the card: five clip-path layers, bottom to top - ink offset, pink offset, ink edge, white keyline, violet paper
  L(`${M} .lo-frame`, 'overflow: visible; background: none; border: 0; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; rotate: -1.2deg; animation: lo-pop-slam 0.62s cubic-bezier(.2,.9,.3,1.25) both;'),
  '  @keyframes lo-pop-slam { 0% { opacity: 0; transform: scale(1.16) rotate(5deg); } 60% { opacity: 1; transform: scale(0.97) rotate(-1deg); } 100% { opacity: 1; transform: none; } }',
  L(`${M} .lo-corner`, `display: block; position: absolute; width: auto; height: auto; border: 0 !important; border-radius: 0 !important; pointer-events: none;`),
  L(`${M} .lo-corner.bl`, `inset: -6px; translate: 14px 14px; background: ${INK}; clip-path: ${SHAPE}; z-index: -6;`),
  L(`${M} .lo-corner.br`, `inset: -2px; translate: 14px 14px; background: radial-gradient(circle, rgba(12,11,16,0.28) 1.3px, rgba(0,0,0,0) 1.9px) 0 0 / 8px 8px, ${PINK}; clip-path: ${SHAPE}; z-index: -5;`),
  L(`${M} .lo-frame::before`, `inset: -6px; padding: 0; border-radius: 0; background: ${INK}; -webkit-mask: none; mask: none; clip-path: ${SHAPE}; z-index: -4;`),
  L(`${M} .lo-ornate`, `inset: -2px; border: 0; border-image: none; background: ${PAPER}; clip-path: ${SHAPE}; z-index: -3; transition: none;`),
  L(`${M} .lo-frame::after`, `inset: 0; transform: none; animation: none; opacity: 1; mix-blend-mode: normal; clip-path: ${SHAPE}; z-index: -2; background: radial-gradient(circle, rgba(255,255,255,0.06) 1px, rgba(0,0,0,0) 1.6px) 0 0 / 9px 9px, linear-gradient(168deg, #2d1a4d 0%, #1d1136 55%, #150c28 100%);`),
  // tape over the top corners + stickers hanging off the edges
  L(`${M} .lo-corner.tl, ${M} .lo-corner.tr`, `inset: auto; top: 8px; width: 108px; height: 25px; z-index: 6; box-sizing: border-box;`),
  L(`${M} .lo-corner.tl`, `left: -36px; rotate: -38deg; border: 2.5px solid ${INK} !important; background: repeating-linear-gradient(-45deg, ${YEL} 0 10px, ${INK} 10px 20px);`),
  L(`${M} .lo-corner.tr`, `right: -34px; rotate: 36deg; background: linear-gradient(180deg, rgba(255,255,255,0.22) 0 30%, rgba(0,0,0,0) 30%), ${PINK}; opacity: 0.94; clip-path: polygon(0 8%, 4% 0, 7% 12%, 10% 0, 90% 0, 93% 14%, 96% 0, 100% 10%, 97% 50%, 100% 92%, 95% 100%, 92% 86%, 88% 100%, 12% 100%, 8% 88%, 4% 100%, 0 90%, 3% 50%);`),
  L('#loading-overlay .lo-pop-stk', 'display: none;'),
  L(`${M} .lo-pop-stk`, 'display: block; position: absolute; inset: 0; z-index: 6; pointer-events: none;'),
  L(`${M} .lo-pop-stk::before, ${M} .lo-pop-stk::after`, "content: ''; position: absolute; background-repeat: no-repeat; background-size: contain;"),
  L(`${M} .lo-pop-stk::before`, `left: -32px; bottom: 34px; width: 60px; height: 60px; background-image: ${star(YEL)}; rotate: -14deg;`),
  L(`${M} .lo-pop-stk::after`, `right: -30px; top: 30%; width: 42px; height: 63px; background-image: ${bolt}; rotate: 16deg;`),
  // type
  // the wordmark keeps its paint; only its soft dark blur and violet glow pulse go (on the ink card they read as a hazy
  // box behind it) for one hard ink drop like everything else here. Its entrance still plays (fill: backwards).
  L(`${M} .lo-title`, 'rotate: -3deg;'),
  // and it is recoloured lemon - a brighter, cleaner yellow than the brown-gold, the painted bevel kept (per user: "The MOjiworld colour can be
  // better"; Sprites/ui/mojiworld_logo_pop.webp from scripts/gen_title_pop_logo.mjs). content:url() swaps the picture
  // for the menu only; the loading screen keeps the gold one, and a browser without it simply shows the gold.
  L(`${M} .lo-stack.compact #lo-logo`, `content: url('Sprites/ui/mojiworld_logo_pop.webp'); animation: lo-logo-in 0.9s cubic-bezier(.2,.8,.25,1) 0.12s backwards; filter: drop-shadow(3px 3px 0 ${INK});`),
  L(`${M} .lo-emoji`, `color: ${YEL}; -webkit-text-stroke: 2px ${INK}; paint-order: stroke fill; rotate: 14deg; text-shadow: 3px 3px 0 ${PINK}; filter: none;`),
  L(`${M} .lo-rule`, `width: min(260px, 70%); height: 18px; margin: 2px 0 10px; rotate: -3deg; background: ${rule} center / contain no-repeat;`),
  L(`${M} .lo-stack .lede`, `display: table; position: relative; isolation: isolate; margin: 4px auto 18px; padding: 8px 18px 7px; opacity: 1; color: ${YEL}; background: none; rotate: -1.5deg; font: 900 12px/1 'Nunito', system-ui, sans-serif; letter-spacing: 4px; text-transform: uppercase;`),
  L(`${M} .lo-stack .lede::before, ${M} .lo-stack .lede::after`, `content: ''; position: absolute; inset: 0; clip-path: ${TORN};`),
  L(`${M} .lo-stack .lede::before`, `z-index: -1; background: ${INK};`),
  L(`${M} .lo-stack .lede::after`, `z-index: -2; background: ${PINK}; translate: 3px 3px;`),
  // buttons: the face and the offset are pseudo-elements behind the label
  L(`${M} #lo-menu`, 'gap: 12px;'),
  L(`${M} #lo-menu .menu-item`, 'position: relative; isolation: isolate; background: none; border: 0; border-radius: 12px; box-shadow: none; padding: 10px 14px 10px 12px; animation-fill-mode: backwards; rotate: -0.6deg; transition: translate 0.12s, rotate 0.12s;'),
  L(`${M} #lo-menu .menu-item:nth-child(even)`, 'rotate: 0.5deg;'),
  L(`${M} #lo-menu .menu-item::before, ${M} #lo-menu .menu-item::after`, "content: ''; position: absolute; inset: 0; border-radius: 12px; pointer-events: none; transition: translate 0.12s, background-color 0.12s, border-color 0.12s;"),
  L(`${M} #lo-menu .menu-item::before`, `z-index: -1; background: #120d1c; border: 2.5px solid ${PAPER};`),
  L(`${M} #lo-menu .menu-item::after`, `z-index: -2; background: ${INK}; translate: 5px 5px;`),
  L(`${M} #lo-menu .menu-item:hover, ${M} #lo-menu .menu-item:focus-visible`, 'transform: none; box-shadow: none; translate: -2px -2px; rotate: -1.4deg;'),
  L(`${M} #lo-menu .menu-item:hover::before, ${M} #lo-menu .menu-item:focus-visible::before`, `border-color: ${YEL};`),
  L(`${M} #lo-menu .menu-item:hover::after, ${M} #lo-menu .menu-item:focus-visible::after`, `background: ${PINK}; translate: 7px 7px;`),
  L(`${M} #lo-menu .menu-item:active`, 'translate: 2px 2px;'),
  L(`${M} #lo-menu .menu-item:active::after`, 'translate: 1px 1px;'),
  L(`${M} #lo-menu .menu-item .mi-label`, "font: 900 16px/1.1 'Nunito', system-ui, sans-serif; letter-spacing: 1.6px; text-transform: uppercase; color: #ffffff;"),
  L(`${M} #lo-menu .menu-item .mi-sub`, "font: 700 11px/1.3 'Nunito', system-ui, sans-serif; letter-spacing: 0; color: #cfc6e0;"),
  L(`${M} #lo-menu .menu-item.primary::before`, `background: ${YEL}; border: 3px solid ${INK};`),
  L(`${M} #lo-menu .menu-item.primary::after`, `background: ${PINK};`),
  L(`${M} #lo-menu .menu-item.primary .mi-label`, `color: ${INK};`),
  L(`${M} #lo-menu .menu-item.primary .mi-sub`, 'color: #4a3a06;'),
  // icons: die-cut stickers hanging off the chip's left edge
  L(`${M} #lo-menu .menu-item .mi-art, ${M} #lo-menu #menu-continue-icon`, `width: 54px; height: 54px; flex: 0 0 54px; object-fit: contain; border: 0; border-radius: 0; background: none; box-shadow: none; margin: -9px 0 -9px -24px; rotate: -8deg; transition: rotate 0.16s, scale 0.16s;` +
    ` filter: drop-shadow(1.5px 0 0 ${PAPER}) drop-shadow(-1.5px 0 0 ${PAPER}) drop-shadow(0 1.5px 0 ${PAPER}) drop-shadow(0 -1.5px 0 ${PAPER}) drop-shadow(3px 3px 0 ${INK});`),
  L(`${M} #lo-menu .menu-item:nth-child(even) .mi-art`, 'rotate: 7deg;'),
  L(`${M} #lo-menu .menu-item:hover .mi-art, ${M} #lo-menu .menu-item:hover #menu-continue-icon`, 'rotate: 0deg; scale: 1.12; box-shadow: none;'),
  // social badges, note, version
  L(`${M} .lo-link`, `color: ${PAPER}; font: 800 10px/1.1 'Nunito', system-ui, sans-serif; letter-spacing: 0.3px;`),
  L(`${M} .lo-link-ico`, `width: 38px; height: 38px; outline: 2.5px solid ${PAPER}; outline-offset: -1px; rotate: -7deg; filter: drop-shadow(2px 2px 0 ${INK});`),
  L(`${M} .lo-link:nth-child(even) .lo-link-ico`, 'rotate: 6deg;'),
  L(`${M} .lo-link:hover .lo-link-ico, ${M} .lo-link:focus-visible .lo-link-ico`, `filter: drop-shadow(3px 3px 0 ${PINK});`),
  L(`${M} .auth-note`, "color: #d9d0ea; font: 700 10.5px/1.4 'Nunito', system-ui, sans-serif; letter-spacing: 0; text-wrap: balance;"),
  L(`${M} .lo-copy`, "margin-top: 18px !important; font-family: 'Nunito', system-ui, sans-serif; font-weight: 700;"),
  L(`${M} .lo-version`, `width: max-content; margin: 8px 0 0 auto; padding: 3px 8px 2px; opacity: 1; color: ${INK}; background: ${YEL}; border: 2px solid ${INK}; border-radius: 4px; rotate: -4deg; font: 900 10.5px/1.2 'Nunito', system-ui, sans-serif;`),
  '  @media (prefers-reduced-motion: reduce) {',
  `    ${M} .lo-frame, ${M} .lo-stack.compact #lo-logo { animation: none; }`,
  '  }',
].join(EOL) + EOL;
if (/[^\x00-\x7e\r\n\u2014]/.test(CSS)) die('unexpected non-ASCII in the CSS');
s = s.replace(A, () => A.replace('</style>', '') + CSS + '</style>');
// the class stickers + the lemon wordmark load with the page (hidden <img>s), so the Continue card and the logo never
// pop in late when the menu mounts - the gold crests they replace were already warm from the class-select screen
const PRELOAD = ['class_warrior', 'class_mage', 'class_rogue', 'class_archer'].map((k) => `<img src="Sprites/ui/menu/menu_pop_${k}.webp" alt="">`).join('') + '<img src="Sprites/ui/mojiworld_logo_pop.webp" alt="">';
s = s.replace(ORN, () => ORN + '<span class="lo-pop-stk" aria-hidden="true"></span><span class="lo-pop-preload" hidden aria-hidden="true">' + PRELOAD + '</span><!-- v0.30.1118 title-pop stickers + art warm-up -->');
for (const k of ICONS) s = s.replace(`src="Sprites/ui/menu/menu_${k}.webp"`, `src="Sprites/ui/menu/menu_pop_${k}.webp"`);
s = s.replace(CREST_TAG, () => 'id="menu-continue-icon" alt="" src="Sprites/ui/menu/menu_pop_class_warrior.webp"');
for (const id of Object.keys(SOCIAL)) { const [i, j] = icoSpan(id); s = s.slice(0, i) + ICO_OPEN + SOCIAL[id] + '</span>' + s.slice(j); }
s = s.replace(CREST_JS, () => "icon.src = 'Sprites/ui/menu/menu_pop_class_' + meta.cls + '.webp';   /* v0.30.1118 title-pop - a pop class sticker, not the gold crest */");

const grew = s.length - n0;
if (grew < 9000 || grew > 24000) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: title-pop (+' + grew + ' chars)');
