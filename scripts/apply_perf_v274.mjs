// v0.30.274 — three corrections from the first REAL in-game measurement.
// =============================================================================
// The state-driven probe (ingame_perf_probe.mjs) finally measured actual
// gameplay — town and forest, A/B/A per row, rows whose baselines disagree
// discarded. Two findings survived:
//
// 1. THE BOOT WATCHDOG (v0.30.272) FALSE-FIRES DURING THE PROLOGUE.
//    Chromium logged "[perf] backdrop blur disabled (boot frame watchdog
//    15.9 fps)" while walking the prologue — cutscene video + back-to-back
//    map loads legitimately stall frames — and then held 85 fps in town with
//    the blurs stripped from a machine that could easily afford them. The
//    6s START_AFTER covers the boot sprite burst, not a 60s scripted intro.
//    Fix: the watchdog now (a) treats prologue time like hidden-tab time
//    (reset the window, count nothing) and (b) RETIRES the moment real play
//    begins (game.paused === false): from there _perfTick samples every frame
//    from the gameplay loop and its own lowFx trip already calls
//    _lxSetNoBackdrop. The boot watchdog's whole justification was that
//    nothing watches the MENUS; once play starts it has no business running.
//
// 2. BOX-SHADOWS COST AS MUCH AS THE BLURS, AND NOTHING EVER SHEDS THEM.
//    In-game on the same iGPU, A/B/A with both baselines agreeing:
//        all box-shadow off   town   61.5 -> 71.7 -> 59.7   +18%
//                             forest 65.7 -> 79.8 -> 69.9   +18%
//        lx-nobackdrop ON     town   +15%   forest +19%
//    (Canvas-side switches — weather, ambient, entity shadows, the FX tiers —
//    measured no effect or noise: this machine's in-game cost is DOM
//    compositing, not canvas work.)
//    Fix: box-shadow joins backdrop-filter in the html.lx-nobackdrop block.
//    Same bargain, same switch, same audience: a machine in degraded mode
//    wants frames, not chrome. Machines that never trip the ladder keep
//    every shadow. The `*` scope is deliberate for the same reason the blur
//    rule's is: a hand-maintained selector list would silently miss the next
//    shadow added to the sheet.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

if (s.includes('box-shadow: none !important;') && s.includes('watchdog retires')) {
  console.log('already applied'); process.exit(0);
}

const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1a. hand off to the gameplay watchdog once real play begins ------------
sub('watchdog handoff',
  "    if (_lxNoBackdropOn) return;              // sticky, and already decided",
  J("    if (_lxNoBackdropOn) return;              // sticky, and already decided",
    "    // v0.30.274 — the watchdog retires when real play begins: from here",
    "    // _perfTick samples every frame inside the gameplay loop and its lowFx",
    "    // trip calls _lxSetNoBackdrop itself. Staying armed past this point",
    "    // false-fired on the prologue's cutscene dips and stripped the blurs",
    "    // from a machine that then held 85 fps in town.",
    "    if (typeof game !== 'undefined' && game && game.paused === false) return;"));

// ---- 1b. prologue time counts like hidden-tab time --------------------------
sub('watchdog prologue guard',
  "      if (document.hidden) { frames = 0; wStart = t; }   // a hidden tab is not a slow one",
  "      if (document.hidden || window._prologueActive) { frames = 0; wStart = t; }   // hidden tab / scripted intro: not a slow machine");

// ---- 2. box-shadow joins the degrade block ----------------------------------
sub('nobackdrop block',
  J("  html.lx-nobackdrop *,",
    "  html.lx-nobackdrop *::before,",
    "  html.lx-nobackdrop *::after {",
    "    backdrop-filter: none !important;",
    "    -webkit-backdrop-filter: none !important;",
    "  }"),
  J("  html.lx-nobackdrop *,",
    "  html.lx-nobackdrop *::before,",
    "  html.lx-nobackdrop *::after {",
    "    backdrop-filter: none !important;",
    "    -webkit-backdrop-filter: none !important;",
    "    /* v0.30.274 — box-shadows measured +18% in town AND forest (A/B/A,",
    "       baselines agreeing) on the same iGPU that pays for the blurs. Same",
    "       bargain, same switch: this mode wants frames, not chrome. */",
    "    box-shadow: none !important;",
    "  }"));

// ---- 3. the trip line moves out of the healthy noise band -------------------
// Repeated runs put THIS machine's healthy Chromium title screen anywhere from
// 28 to 44 fps depending on ambient load, while the machine the watchdog was
// built for (Firefox here) sits at 12-17. A 25 fps line lives inside the
// healthy band's bad days and tripped on one of them; 18 sits in the gap.
// Machines between 18 and 25 no longer get rescued at the MENUS - tolerable,
// since _perfTick still rescues them the moment gameplay starts.
sub('watchdog threshold',
  '  const MIN_FPS     = 25;     // far below any machine that can afford the blurs',
  '  const MIN_FPS     = 18;     // v0.30.274 - 25 sat inside a healthy iGPU' + String.fromCharCode(39) + 's noise band (28-44 here) and false-fired; 18 sits in the gap above the 12-17 machines this exists for');

// ---- version bump -----------------------------------------------------------
sub('version', "GAME_VERSION = 'v0.30.273'", "GAME_VERSION = 'v0.30.274'");

const grew = s.length - n0;
if (grew < 400 || grew > 2200) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew}), expected roughly +1100`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: watchdog handoff + prologue guard + threshold 25->18 + box-shadow degrade, v0.30.274 (${n0} -> ${s.length} chars, +${grew})`);
