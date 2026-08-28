// FIREFOX, take two: engage the mechanism the game already has.
// =============================================================================
// v0.30.271 shipped a Gecko gate that stopped four decorative animations. It
// does NOTHING, and this removes it. The measurement that justified it was
// wrong in a way worth recording so it is not repeated: the ablation applied
// effects CUMULATIVELY and measured in sequence inside one page, and the game
// is still baking sprites for the first tens of seconds, so the numbers rose
// almost monotonically (19.4 -> 27.1 -> 50.9 -> 105.8) for reasons that had
// nothing to do with the CSS. I read a settling curve as an ablation result.
//
// Re-measured with an A/B/A rig — settle first, then baseline / effect-off /
// baseline, discarding any row whose two baselines disagree — on headed
// Firefox 153:
//
//   html.lx-nobackdrop            11.9 -> 28.7 -> 11.7    +143%
//   the overlay out of compositing 11.5 -> 29.2 -> 11.9   +150%
//   #game colour grade alone      11.7 -> 12.4 -> 12.0    no effect
//   the v0.30.271 animation gate  11.7 -> 11.7 -> 12.2    no effect
//   (turning off ALL 40 running animations, 76 elements:  no effect)
//
// THE ACTUAL BUG. The game already has html.lx-nobackdrop — built for "even a
// computer without graphics card can run this smooth" — which drops all 110
// backdrop-filter declarations and the #game colour grade. It engages from two
// places and BOTH miss Firefox:
//
//   _lxRendererIsSoftware()  reads the WebGL renderer string. Firefox reports
//                            "ANGLE (Intel, Intel(R) HD Graphics ...)" — a real
//                            GPU — so this correctly says "not software".
//   the frame watchdog       lives in _perfTick, which only runs inside the
//                            gameplay loop. Measured at the title screen after
//                            20 s: LX_PERF.avgFrame 16.7, slowFrames 0. It is
//                            not slow to react; it never samples at all.
//
// So a machine sits at 11 fps with 110 backdrop blurs live and nothing notices.
// This adds a watchdog that samples presented frames from boot — menus
// included — and engages the same sticky mechanism. It is not Firefox-specific
// and not a UA sniff: it measures the machine in front of it, so the "no
// graphics card" case the feature was written for is covered from boot too.
//
// It counts frames per 2 s window rather than scoring individual frames, and
// that detail is the whole reason it works. The first version scored a frame
// +1 when slower than 40 ms and -1 otherwise; it never fired, because Firefox
// delivers rAF callbacks in alternating pairs — measured 4.2, 87.5, 4.2,
// 108.3, 4.2, 87.5 — so each slow frame was cancelled by the fast one beside
// it and the score sat at 1 across 106 frames whose MEDIAN was 87.5 ms.
//
// Thresholds: nothing before 6 s (the sprite burst legitimately stalls frames),
// then two consecutive windows under 25 fps trip it — about four seconds of
// sustained slowness, and one alt-tab is not enough. Hidden tabs do not count.
// It stops watching after ~30 windows, by which point the gameplay loop's own
// watchdog owns the decision.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const q = String.fromCharCode(39);

if (s.includes('_lxBootFrameWatch')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. remove the v0.30.271 animation gate, which measures as no effect ----
const DEAD = J(
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
  '  }');
const KEEP = J(
  '',
  '  /* v0.30.272 — a Gecko-only rule stopping these three animations lived here',
  '     in v0.30.271. It was measured again with an A/B/A rig and does nothing:',
  '     11.7 / 11.7 / 12.2 fps with it off, on, off. Turning off ALL 40 running',
  '     animations across 76 elements does nothing either. The cost is the',
  '     backdrop blurs, which html.lx-nobackdrop already handles. Please do not',
  '     re-add it on the strength of how large these layers look. */');
sub('dead gecko gate', DEAD, KEEP);

// ---- 2. a watchdog that samples frames from boot, menus included -----------
sub('software probe',
  "try { if (_lxRendererIsSoftware()) _lxSetNoBackdrop('software renderer'); } catch (e) {}",
  J("try { if (_lxRendererIsSoftware()) _lxSetNoBackdrop('software renderer'); } catch (e) {}",
    '',
    '// v0.30.272 — BOOT FRAME WATCHDOG.',
    '//',
    '// The two paths above miss the case that prompted this: a machine reporting',
    '// a real GPU that is nevertheless too slow to composite the page. Firefox',
    '// 153 on Intel HD graphics runs the title screen at 11 fps with all 110',
    '// backdrop blurs live, reports "ANGLE (Intel(R) HD Graphics)" so the',
    '// software probe passes it, and never reaches _perfTick — that only runs',
    '// inside the gameplay loop, so at 20 s on the title screen LX_PERF still',
    '// read avgFrame 16.7 and slowFrames 0. Nothing was watching.',
    '//',
    '// This watches presented frames from boot, menus included. Engaging',
    '// html.lx-nobackdrop there measured 11.9 -> 28.7 fps, bracketed by',
    '// baselines of 11.9 and 11.7 so it is the class and not drift.',
    '//',
    '// Not a browser check — it measures the machine in front of it, so the',
    '// "even a computer without graphics card" case this feature was written',
    '// for is now covered from boot rather than only once combat starts.',
    '(function _lxBootFrameWatch() {',
    '  if (typeof requestAnimationFrame !== ' + q + 'function' + q + ') return;',
    '  // Windowed fps, NOT per-frame scoring. The first version scored each',
    '  // frame +1 when slower than 40ms and -1 otherwise, and never fired:',
    '  // Firefox delivers rAF in alternating pairs — measured 4.2, 87.5, 4.2,',
    '  // 108.3, 4.2, 87.5 — so every slow frame was cancelled by the fast one',
    '  // beside it and the score stayed at 1 across 106 frames whose MEDIAN was',
    '  // 87.5ms. Counting frames per window is immune to that shape.',
    '  const START_AFTER = 6000;   // the initial sprite burst stalls frames honestly',
    '  const WINDOW_MS   = 2000;',
    '  const MIN_FPS     = 25;     // far below any machine that can afford the blurs',
    '  const NEED_BAD    = 2;      // consecutive bad windows, so one alt-tab is not enough',
    '  const GIVE_UP     = 30;     // ~1 min; after that the gameplay loop owns the call',
    '  let t0 = 0, wStart = 0, frames = 0, bad = 0, windows = 0;',
    '  const tick = (t) => {',
    '    if (_lxNoBackdropOn) return;              // sticky, and already decided',
    '    if (!t0) { t0 = t; wStart = t; }',
    '    if ((t - t0) > START_AFTER) {',
    '      if (document.hidden) { frames = 0; wStart = t; }   // a hidden tab is not a slow one',
    '      else {',
    '        frames++;',
    '        if ((t - wStart) >= WINDOW_MS) {',
    '          const fps = frames * 1000 / (t - wStart);',
    '          bad = (fps < MIN_FPS) ? bad + 1 : 0;',
    '          if (bad >= NEED_BAD) { try { _lxSetNoBackdrop(' + q + 'boot frame watchdog ' + q + ' + fps.toFixed(1) + ' + q + ' fps' + q + '); } catch (e) {} return; }',
    '          if (++windows > GIVE_UP) return;',
    '          frames = 0; wStart = t;',
    '        }',
    '      }',
    '    }',
    '    requestAnimationFrame(tick);',
    '  };',
    '  try { requestAnimationFrame(tick); } catch (e) {}',
    '})();'));

// ---- version bump ----------------------------------------------------------
sub('version', "GAME_VERSION = 'v0.30.271'", "GAME_VERSION = 'v0.30.272'");

const grew = s.length - n0;
if (grew < 300 || grew > 3500) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew}), expected roughly +1200`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: boot frame watchdog + removed the dead v0.30.271 gate, v0.30.272 (${n0} -> ${s.length} chars, ${grew >= 0 ? '+' : ''}${grew})`);
