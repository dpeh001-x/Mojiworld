// FIREFOX: unplayable frame rate. Two fixes, one measured cause.
// =============================================================================
// Per user: "fix this game is unplayable on firefox very lag, and ur sprites
// will not load".
//
// WHAT WAS MEASURED (headed Firefox 153 with a real GPU, vs Edge/Chromium):
//
//   Firefox 11-19 fps against Chromium's 130-157 on the same screen. The
//   game's own JavaScript was NOT the cause: over a 5s window the rAF callback
//   plus every timer and promise handler totalled 138ms, and a 4ms heartbeat
//   timer kept near-perfect time (worst lateness 10ms) while rAF fired 57
//   times. The main thread was idle. The cost was entirely in compositing.
//
//   Ruled out along the way, each by measurement rather than by reasoning:
//   createImageBitmap resize options (Firefox honours them), ctx.filter,
//   canvas 2D draw calls (12ms of a 6.4s window), the blob decode path
//   (FASTER on Firefox than the <img> path: 2ms of jank against 184ms),
//   surface memory (54 canvases / 175MB, identical in both engines), rAF
//   throttling (a blank page in the same browser does 240fps) and boot-time
//   sprite loading (the loading bar reaches 100% at 9s on Firefox, ahead of
//   Chromium's 20s).
//
//   What remained: large-area CSS compositing. Ablation, headed:
//       class-select page   46.2 fps -> 123.5 with animations off  (2.7x)
//       title screen        19.4 fps -> 105.8 with animations and
//                                       backdrop-filter off        (5.5x)
//   The heavy layers are decorative and enormous: .cs-rays spinning across
//   1,575,406px2, .lo-bg ken-burns across 1,176,990px2, .cs-stars twinkling
//   across 750,723px2.
//
// FIX 1 — a real bug, and the reason this affects PLAY and not just menus.
//   #loading-overlay is dismissed by adding .fade, which sets opacity:0 and
//   pointer-events:none. It is never display:none'd and never removed. So a
//   position:fixed, inset:0, z-index:9999 layer survives for the whole session
//   with `lo-kenburns 40s infinite` and the ember field still animating on it
//   — invisible, and still invalidating a full-viewport layer every frame,
//   forever. Fading it out stops it being seen, not being composited.
//   Now: visibility flips to hidden once the 0.6s fade has finished (a 0s
//   transition delayed by 0.6s, so the fade itself is untouched), and the
//   animations inside it stop when it starts fading.
//   This one is not Firefox-specific — it is wasted work everywhere.
//
// FIX 2 — Gecko only, gated on @supports (-moz-appearance: none), which was
//   verified TRUE on Firefox 153 and false on Chromium. No UA sniffing.
//   Stops the three oversized decorative animations on the title and
//   character-select screens. Only full-screen ambient motion is touched;
//   every functional animation (button pulses, the loading shimmer, damage
//   feedback) is left alone, and no canvas or gameplay code is involved.
//
// NOT DONE, deliberately: the large backdrop-filters. They are worth +23.8 fps
// on the title screen but MINUS 5.9 on the class page, and removing them
// changes how every panel reads. That is a visual decision for the user, not a
// silent one, so it is reported rather than taken.
//
// Guarded + atomic + idempotent + EOL-aware (this file is CRLF; a multi-line
// anchor joined with \n matches zero times).
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

if (s.includes('FIREFOX / GECKO COMPOSITING')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- FIX 1: hide it for real, and stop the animations it keeps running ------
// The delayed visibility transition goes on the .fade rule, NOT on the base
// rule. A transition is read from the state being entered, so putting it on
// the base rule would delay the un-fade too: anything that re-showed the
// overlay would stay invisible for 0.6s while opacity animated back in. This
// way the delay applies only on the way out. It also leaves the base rule
// untouched, which is a smaller diff for a file several sessions are editing.
sub('overlay fade rule',
  '  #loading-overlay.fade { opacity: 0; pointer-events: none; transform: scale(1.02); }',
  J('  #loading-overlay.fade {',
    '    opacity: 0; pointer-events: none; transform: scale(1.02);',
    '    visibility: hidden;',
    '    transition: opacity 0.6s ease-out, transform 0.6s ease-out, visibility 0s linear 0.6s;',
    '  }',
    '  /* v0.30.271 — the overlay was faded but never taken down: opacity:0 on a',
    '     position:fixed inset:0 z-index:9999 layer still composites, and .lo-bg',
    '     kept running `lo-kenburns 40s infinite` for the whole session. Measured',
    '     on Firefox as a permanent full-viewport invalidation during PLAY, not',
    '     just on the title screen. visibility:hidden arrives via the 0s/0.6s-delay',
    '     transition on the .fade rule, so the fade still looks exactly the same. */',
    '  #loading-overlay.fade, #loading-overlay.fade * { animation: none !important; }'));

// ---- FIX 2: Gecko-only, drop the oversized ambient motion -------------------
// Appended to the .cs-rays/.cs-stars block so the whole change sits in one
// contiguous region rather than scattered across the stylesheet.
sub('cs-twinkle decl',
  '  @keyframes cs-twinkle { 0%   { opacity: 0.35; } 100% { opacity: 0.85; } }',
  J('  @keyframes cs-twinkle { 0%   { opacity: 0.35; } 100% { opacity: 0.85; } }',
    '',
    '  /* =====================================================================',
    '     FIREFOX / GECKO COMPOSITING — v0.30.271',
    '',
    '     Gecko pays far more than Blink for animating a very large layer. These',
    '     three are the biggest surfaces in the game and all three are purely',
    '     ambient: a conic-gradient ray field rotating across 1,575,406px2, a',
    '     ken-burns pan across 1,176,990px2, and a twinkle across 750,723px2.',
    '',
    '     Measured headed, real GPU, character-select page:  46.2 -> 123.5 fps.',
    '     Chromium loses ~16 fps of 157 to the same three, so it keeps them.',
    '',
    '     @supports (-moz-appearance: none) is Gecko-only — verified TRUE on',
    '     Firefox 153 and false on Chromium — so this is a capability gate, not',
    '     a user-agent sniff. Only ambient motion is dropped; the gradients and',
    '     the starfield still render, they just hold still. Every functional',
    '     animation in the UI is untouched.',
    '     ===================================================================== */',
    '  @supports (-moz-appearance: none) {',
    '    .cs-rays, .cs-stars,',
    '    #loading-overlay .lo-bg, #loading-overlay .lo-embers { animation: none !important; }',
    '  }'));

// ---- version bump ----------------------------------------------------------
// A parallel session shipped v0.30.270 while this was being measured, so the
// base moved under it; this targets their tip rather than the version this
// investigation started on.
sub('version', "GAME_VERSION = 'v0.30.270'", "GAME_VERSION = 'v0.30.271'");

// Characters vs characters: a byte-size comparison trips on this file's
// multi-byte content, which is how an earlier apply script aborted spuriously.
const grew = s.length - n0;
if (grew < 800 || grew > 3200) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (+${grew}), expected roughly +1500`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: overlay teardown + Gecko ambient-motion gate, v0.30.271 (${n0} -> ${s.length} chars, +${grew})`);
