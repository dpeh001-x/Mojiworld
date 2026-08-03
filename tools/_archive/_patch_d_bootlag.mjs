// v0.26.945 D: boot-lag — defer gear_erase.js, overlay-first paint, rAF gate
// behind the overlay, BGM preload none + post-auth warm, LX_OBJECTS bbox idle.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { execSync } from 'node:child_process';
const FILE = 'C:/Users/Xenon/Desktop/Mojiworld/mojiworld_game.html';
let s = await readFile(FILE, 'utf8');
function rep(old, neu, label, expect = 1) {
  let o = old, n = neu, c = s.split(o).length - 1;
  if (c !== expect) { o = old.replace(/\n/g, '\r\n'); n = neu.replace(/\n/g, '\r\n'); c = s.split(o).length - 1; }
  if (c !== expect) { console.error(`FAIL ${label}: ${c} != ${expect}`); process.exit(2); }
  s = s.split(o).join(n); console.log('ok: ' + label);
}

// D1 — 3.2MB gear_erase.js no longer parser-blocking (consumer is lazy).
rep(`<script src="gear_erase.js"></script>`,
    `<script src="gear_erase.js" defer></script>`, 'D1 defer gear_erase');

// D2 — full sim+render skipped while the opaque boot overlay is up.
rep(`function loop(time) {
  // v0.25.775 — dt cap bumped 32 → 50 ms.`,
`function loop(time) {
  // v0.26.945 — boot gate: while the opaque loading overlay is up, skip the
  // sim+render entirely (it was stealing main-thread time from the sprite
  // fetch/decode storm on phones). Resumes the frame the overlay fades.
  const _bo = document.getElementById('loading-overlay');
  if (_bo && !_bo.classList.contains('fade')) {
    lastTime = time;
    requestAnimationFrame(loop);
    return;
  }
  // v0.25.775 — dt cap bumped 32 → 50 ms.`, 'D2 rAF boot gate');

// D3 — BGM elements stop pulling 6.2MB during the boot fetch window.
rep(`  const a = new Audio('audio/bgm_mojiworld.mp3');
  a.loop = true;
  a.volume = 0.55;        // tasteful — sits below SFX
  a.preload = 'auto';`,
`  const a = new Audio('audio/bgm_mojiworld.mp3');
  a.loop = true;
  a.volume = 0.55;        // tasteful — sits below SFX
  a.preload = 'none';     // v0.26.945 — don't fight boot sprite fetches; warmed post-auth`, 'D3a main BGM');
rep(`  const a = new Audio('audio/bgm_boss.mp3');
  a.loop = true;
  a.volume = 0;           // starts silent — _setBossBgm fades it up
  a.preload = 'auto';`,
`  const a = new Audio('audio/bgm_boss.mp3');
  a.loop = true;
  a.volume = 0;           // starts silent — _setBossBgm fades it up
  a.preload = 'none';     // v0.26.945 — first boss room is minutes away`, 'D3b boss BGM');

// D3c — warm the main theme once the auth form is up (sprites done).
rep(`    // v0.26.945 — decode boss/zodiac sets while the player reads the form.
    try { setTimeout(() => { try { _warmDecodeRegistries(true); } catch (e) {} }, 1200); } catch (e) {}`,
`    // v0.26.945 — decode boss/zodiac sets while the player reads the form.
    try { setTimeout(() => { try { _warmDecodeRegistries(true); } catch (e) {} }, 1200); } catch (e) {}
    // v0.26.945 — start buffering the main theme now that sprites are done.
    try { setTimeout(() => { try { _bgmEl.load(); } catch (e) {} }, 2500); } catch (e) {}`, 'D3c BGM warm');

// D4 — prop bbox getImageData readbacks leave the boot crunch (both loops).
rep(`    img.onload = () => {
      LX_OBJECTS_META[k] = {
        bboxTopY:    _detectSpriteBboxTop(img),
        bboxBottomY: _detectSpriteBboxBottom(img),
      };
    };`,
`    img.onload = () => {
      // v0.26.945 — bbox scan is a main-thread getImageData readback; on
      // phones dozens of these landed mid-boot. Defer to idle time.
      const _run = () => {
        LX_OBJECTS_META[k] = {
          bboxTopY:    _detectSpriteBboxTop(img),
          bboxBottomY: _detectSpriteBboxBottom(img),
        };
      };
      if (window.requestIdleCallback) requestIdleCallback(_run, { timeout: 4000 });
      else setTimeout(_run, 1500);
    };`, 'D4 bbox idle defer', 2);

// D5 — overlay paints DURING the 5MB parse: move <style>+<div> above scripts.
const START = `<!-- ===== LOADING SCREEN (v0.25.104 polish) ===== blocks game start until hero sprites are ready -->`;
const END   = `<!-- v0.25.235 — Persistent deferred-loader pill. Shows in the corner`;
const i0 = s.indexOf(START), i1 = s.indexOf(END);
if (i0 < 0 || i1 < 0 || i1 <= i0) { console.error('D5 anchors'); process.exit(2); }
if (s.indexOf(START, i0 + 1) >= 0 || s.indexOf(END, i1 + 1) >= 0) { console.error('D5 dup'); process.exit(2); }
const block = s.slice(i0, i1).trimEnd();
s = s.slice(0, i0) + s.slice(i1);
let BODY = '\n<body>\n';
if (s.split(BODY).length - 1 !== 1) BODY = '\r\n<body>\r\n';
if (s.split(BODY).length - 1 !== 1) { console.error('D5 body anchor'); process.exit(2); }
s = s.replace(BODY, BODY + block + '\n');
if (s.split('id="loading-overlay"').length - 1 !== 1) { console.error('D5 overlay dup'); process.exit(2); }
console.log('ok: D5 overlay moved above scripts');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpd', s, 'utf8');
await rename(FILE + '.tmpd', FILE);
console.log('D DONE');
