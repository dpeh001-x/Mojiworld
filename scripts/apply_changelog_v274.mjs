// CHANGELOG.html entry for v0.30.274. Newest on top, under </header>.
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
if (s.includes('>v0.30.274 <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.274 <span class="tag"><span class="pill bug">bug</span> The lag ladder, measured in real gameplay &mdash; and the boot watchdog tamed</span></h2>',
  '<p>First release informed by measurements taken in <em>actual play</em> rather than on the title screen: a state-driven harness walks New Game &rarr; class pick &rarr; through the prologue, then teleports to <b>town</b> and <b>forest</b> and runs every ablation as A/B/A (baseline &rarr; effect &rarr; baseline), discarding any row whose two baselines disagree.</p>',
  `<pre style="${PRE}"><code>in-game, Chromium, Intel iGPU, A/B/A with baselines agreeing:`,
  '  all box-shadow off      town  61.5 → 71.7 → 59.7   +18%',
  '                          forest 65.7 → 79.8 → 69.9  +18%',
  '  html.lx-nobackdrop ON   town  +15%    forest +19%',
  '',
  'canvas-side switches (weather / ambient / entity shadows / FX tiers):',
  '  no effect or noise — the in-game cost is DOM compositing, not canvas work</code></pre>',
  '',
  '<h3>Box-shadows join the degrade ladder</h3>',
  '<p><code>box-shadow: none</code> is now part of the <code>html.lx-nobackdrop</code> block, alongside the 110 backdrop blurs and the colour grade. Same bargain, same switch, same audience: a machine in degraded mode wants frames, not chrome. Machines that never trip the ladder keep every shadow &mdash; asserted both ways in the test.</p>',
  '',
  '<h3>Two boot-watchdog corrections</h3>',
  '<p><b>It false-fired during the prologue.</b> Cutscene video plus back-to-back map loads legitimately stall frames; the watchdog tripped on those dips and stripped the blurs from a machine that then held <b>85&nbsp;fps</b> in town. Prologue time now counts like hidden-tab time (window reset, nothing counted), and the watchdog <em>retires</em> the moment real play begins &mdash; from there <code>_perfTick</code> samples every frame inside the gameplay loop and its own lowFx trip already engages the same mechanism. The boot watchdog exists because nothing watches the menus; once play starts it has no business running.</p>',
  '<p><b>The trip line sat inside a healthy machine&rsquo;s noise band.</b> Repeated runs put a healthy Chromium title screen anywhere from 28 to 44&nbsp;fps by ambient load, while the machine the watchdog was built for sits at 12&ndash;17. The 25&nbsp;fps line tripped on one of the healthy band&rsquo;s bad days; it moves to <b>18</b>, in the gap between the two populations. Machines between 18 and 25 no longer get rescued at the menus &mdash; tolerable, since the in-game ladder rescues them the moment gameplay starts.</p>',
  '',
  '<h3>Result</h3>',
  `<pre style="${PRE}"><code>title screen, headed, real GPU:`,
  '  Firefox   trips at 17.0 fps → blurs + grade + box-shadows off → 29.3 fps',
  '            (13.8–14.7 before v0.30.272; 26.9 with v0.30.272 alone)',
  '  Chromium  41.5 fps — no trip; grade, HUD blur and box-shadows all kept</code></pre>',
  '<p><code>scripts/boot_frame_watchdog_test.mjs</code> &mdash; now 12 checks, all green; the four new ones fail on v0.30.273.</p>',
  '<p><b>Honest limitation:</b> Firefox <em>in-game</em> numbers are still unmeasured &mdash; headed Firefox fully suspends rAF when its window is occluded, which zeroed every sample on a busy desktop. The harness now fronts the window; the Chromium in-game numbers above are the evidence base for the box-shadow change, and the ladder applies identically in both engines.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2500 || grew > 8000) { console.error(`ABORT: moved ${n0} -> ${s.length} (+${grew})`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG v0.30.274 (+${grew} chars)`);
