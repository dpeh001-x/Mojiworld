// Mobile v0.26.940 patch A: un-hide touch deck (de-bake stale body class,
// boot-authoritative show), mobile fullscreen (nag button + login-tap),
// version bump. Atomic write + node --check verify.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { execSync } from 'node:child_process';
const FILE = 'C:/Users/Xenon/Desktop/Mojiworld/mojiworld_game.html';
let s = await readFile(FILE, 'utf8');

function rep(old, neu, label) {
  let o = old, n = neu;
  let c = s.split(o).length - 1;
  if (c !== 1) {                       // retry with CRLF line endings
    o = old.replace(/\n/g, '\r\n'); n = neu.replace(/\n/g, '\r\n');
    c = s.split(o).length - 1;
  }
  if (c !== 1) { console.error(`FAIL ${label}: ${c} matches`); process.exit(2); }
  s = s.split(o).join(n);
  console.log(`ok: ${label}`);
}

// A1 — de-bake the stale hidden-state class from the shipped markup.
rep(`<body class="hide-mobile-ctrl">`, `<body>`, 'A1 body de-bake');

// A2 — boot is authoritative: no pref + no ?nomobile=1 => force-show.
rep(`  if (_urlForceHide || _hidePref) {
    document.body.classList.add('hide-mobile-ctrl');
    if (toggle) toggle.textContent = '◀';
  }
  if (toggle) {`,
`  if (_urlForceHide || _hidePref) {
    document.body.classList.add('hide-mobile-ctrl');
    if (toggle) toggle.textContent = '◀';
  } else {
    // v0.26.940 — boot is authoritative. The shipped markup once carried a
    // stale \`hide-mobile-ctrl\` baked into <body> by a DOM-snapshot
    // recovery, so fresh mobile players never saw the touch deck. With no
    // saved pref and no ?nomobile=1, boot force-shows the controls.
    document.body.classList.remove('hide-mobile-ctrl');
    if (toggle) toggle.textContent = '✕';
  }
  if (toggle) {`, 'A2 init else-branch');

// A3 — rotate-nag gains a primary fullscreen button.
rep(`    <button onclick="document.body.classList.remove('nag-portrait')">Play in portrait anyway</button>`,
`    <button class="nag-fs" onclick="_lxMobileFullscreen()">⛶ Fullscreen landscape</button>
    <button onclick="document.body.classList.remove('nag-portrait')">Play in portrait anyway</button>`, 'A3 nag button');

// A4 — mobile fullscreen helper (no force-desktop flip, which hides the deck).
rep(`function toggleFullscreenDesktop() {`,
`// v0.26.940 — Mobile fullscreen WITHOUT the force-desktop layout flip
// (toggleFullscreenDesktop hides the touch deck — wrong for phones). Called
// from the rotate-nag button and the first login tap on touch devices; both
// are user gestures, so requestFullscreen is permitted.
function _lxMobileFullscreen() {
  document.body.classList.remove('nag-portrait');
  const root = document.documentElement;
  let p = null;
  try {
    if (root.requestFullscreen)            p = root.requestFullscreen();
    else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
  } catch (e) {}
  Promise.resolve(p).catch(() => {}).then(() => {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {}
    _fitGameToViewport();
    setTimeout(_fitGameToViewport, 240);
    setTimeout(_fitGameToViewport, 800);
  });
}
function toggleFullscreenDesktop() {`, 'A4 fullscreen helper');

// A5 — primary styling for the nag fullscreen button.
rep(`  #rotate-nag button {
    margin-top: 20px; padding: 10px 22px; font-size: 14px;
    background: #2a1f45; color: #ffdd88;
    border: 1px solid #8866aa; border-radius: 20px;
    cursor: pointer; font-family: inherit;
    pointer-events: auto !important;
  }`,
`  #rotate-nag button {
    margin-top: 20px; padding: 10px 22px; font-size: 14px;
    background: #2a1f45; color: #ffdd88;
    border: 1px solid #8866aa; border-radius: 20px;
    cursor: pointer; font-family: inherit;
    pointer-events: auto !important;
  }
  #rotate-nag button.nag-fs {
    background: linear-gradient(180deg, #46d68a, #1f9e5f);
    color: #06281a; border-color: #7df0b4; font-weight: 700;
  }
  #rotate-nag button + button { margin-top: 10px; }`, 'A5 nag CSS');

// A6 — login taps double as the fullscreen gesture on touch devices.
const FS_TRY = `      try {
        if ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
            && !document.fullscreenElement && !document.webkitFullscreenElement
            && typeof _lxMobileFullscreen === 'function') _lxMobileFullscreen();
      } catch (e) {}
`;
rep(`    guest.addEventListener('click', () => {
      _setAuthError(''); lock(true);`,
`    guest.addEventListener('click', () => {
${FS_TRY}      _setAuthError(''); lock(true);`, 'A6 guest fullscreen');
rep(`    const doSubmit = async () => {
      _setAuthError(''); lock(true);`,
`    const doSubmit = async () => {
${FS_TRY}      _setAuthError(''); lock(true);`, 'A7 signin fullscreen');

rep(`const GAME_VERSION = 'v0.26.924';`, `const GAME_VERSION = 'v0.26.940';`, 'A8 version');

// surrogate sanity then atomic write
for (let i = 0; i < s.length; i++) {
  const c = s.charCodeAt(i);
  if (c >= 0xD800 && c <= 0xDBFF && !(s.charCodeAt(i+1) >= 0xDC00 && s.charCodeAt(i+1) <= 0xDFFF)) {
    console.error('lone surrogate at ' + i); process.exit(3);
  }
  if (c >= 0xDC00 && c <= 0xDFFF && !(s.charCodeAt(i-1) >= 0xD800 && s.charCodeAt(i-1) <= 0xDBFF)) {
    console.error('lone low surrogate at ' + i); process.exit(3);
  }
}
// node --check the largest <script> payload of the PATCHED string
const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
const chk = 'C:/Users/Xenon/Desktop/Mojiworld/tools/_v940_check.js';
await writeFile(chk, big, 'utf8');
execSync(`node --check "${chk}"`, { stdio: 'inherit' });
console.log('syntax OK ' + big.length + ' chars');
await writeFile(FILE + '.tmpa', s, 'utf8');
const back = await readFile(FILE + '.tmpa', 'utf8');
if (back.length !== s.length) { console.error('size mismatch after write'); process.exit(4); }
await rename(FILE + '.tmpa', FILE);
console.log('PATCH A DONE — size ' + s.length);
