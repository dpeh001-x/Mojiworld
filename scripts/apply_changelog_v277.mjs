// CHANGELOG.html entry for v0.30.277. Newest on top, under </header>.
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
if (s.includes('>v0.30.277 <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.277 <span class="tag"><span class="pill bug">bug</span> The multikill freeze: 40 kills paid 40 layout reflows in one frame</span></h2>',
  '<p>Per user: <em>&ldquo;laggy when i multikill, boss fights and late game&rdquo;.</em> A combat probe now drives the REAL death pipeline &mdash; walk into the forest, spawn a pack, kill every mob in one synchronous task (what a screen-clear skill does) &mdash; under the V8 sampling profiler at 100&micro;s.</p>',
  `<pre style="${PRE}"><code>the 40-kill wipe task, before:  ~55 ms.  Top self-time inside it:`,
  '  26–34 ms   get offsetWidth      ← one forced reflow per kill',
  '   5.0 ms   showKillToast        ← one innerHTML toast per kill',
  '   4.0 ms   _renderMasteryBar    ← the function doing those reflows',
  '   2.8 ms   killMonster          ← everything else it does, combined',
  '  (saveState / quests / achievements: ~0 — the stall is DOM, not game logic)</code></pre>',
  '<p><b>The mechanism.</b> <code>_renderMasteryBar</code> runs once per kill and forces a reflow (<code>void el.offsetWidth</code>) to replay its pop-in animation, right after writing the HUD numbers &mdash; so every kill in a wipe pays write&nbsp;&rarr;&nbsp;forced-layout on a dirty tree. <code>showKillToast</code> mints a DOM toast per kill; the 4-toast cap then evicts most of them unseen. On the reporting machine (~3.5&times; slower than the probe host) the wipe stall lands at an estimated 200&ndash;300&nbsp;ms &mdash; one long visible freeze per multikill.</p>',
  '<p><b>The fix: coalesce per frame.</b> Nothing that paints changes &mdash; nothing paints <em>between</em> same-frame calls by definition.</p>',
  '<ul>',
  '<li><b>Mastery bar</b> &mdash; the reflow and pop replay run once per <code>game.time</code>; the number/fill writes still run every call, so the frame shows the last kill&rsquo;s totals. Kills on later frames replay the pop exactly as before.</li>',
  '<li><b>Kill toast</b> &mdash; same-frame kills merge into one toast showing the sums: forty stacked <code>+15&nbsp;XP</code> slivers become <code>+917&nbsp;XP &middot; +409🪙</code> &mdash; fewer parses, and more readable.</li>',
  '</ul>',
  `<pre style="${PRE}"><code>measured after:  wipe task 55 ms → 11.4 ms (−79%)`,
  '                 offsetWidth and showKillToast leave the profile entirely',
  '                 reflow reads during a 30-kill wipe: 45 → 1',
  '                 toasts after the wipe: 4 survivors-of-30 → 1 merged</code></pre>',
  '<p><b>What was ruled out first.</b> The static perf-pass (9 finder agents, 15 ranked findings) was audited finding-by-finding against the live tree: 13 had already shipped in earlier perf passes or parallel sessions (projectile cheap-reject v0.29.477, tint bakes v0.29.5xx, explosion gradient cache v0.29.744, tower-HUD memo, drop-magnet squared-distance, platform-loop hoists&hellip;), and 2 were dead on current code &mdash; the &ldquo;per-frame&rdquo; feather and boss-frame downscales are cached inside <code>_lxDrawSoft</code>&rsquo;s per-image FIFO. A drafted fix for the one plausible survivor (freeze/dying tints bypassing the filter budget) was <em>reverted unshipped</em> after its own test measured zero live filter assignments on the baseline: tint bakes are cached per image&times;filter, so there was nothing to save. Boss fights at probe level measured clean (147&nbsp;fps, worst frame 33&nbsp;ms).</p>',
  '<p><code>scripts/multikill_coalesce_test.mjs</code> &mdash; 5 checks: reflow count and merged toast (both FAIL on v0.30.276), plus controls that the kills processed, the instrumentation attached, and the mastery bar still renders.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2500 || grew > 8000) { console.error(`ABORT: moved ${n0} -> ${s.length} (+${grew})`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG v0.30.277 (+${grew} chars)`);
