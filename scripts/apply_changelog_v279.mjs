// CHANGELOG.html entry for v0.30.279. Newest on top, under </header>.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
if (s.includes('>v0.30.279 <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.279 <span class="tag"><span class="pill bug">bug</span> The asset cache-warmer now yields to gameplay &mdash; the hidden stutter source</span></h2>',
  '<p>Per user: <em>&ldquo;further work on how we can reduce lag and improve smoothness and flow of gameplay&rdquo;.</em> A new hitch-attribution probe plays 60&nbsp;seconds of genuine combat and records, for <em>every frame over 25&nbsp;ms</em>, exactly which instrumented systems executed inside that frame.</p>',
  `<pre style="${PRE}"><code>steady-state pacing:   212 fps · p95 8.3 ms · p99 12.5 ms   → clean`,
  'but 34 hitches of 29–129 ms — EVERY one tagged with the v0.26.x full-asset',
  'cache warmer&rsquo;s fetches (Sprites/monsters/idle/stormKitty_*, stump_*,',
  'thornmaw_* … 3,319 fetches in the window) or sandwiched between them.',
  '',
  'ruled out by the same probe:',
  '  the save flush        2,552 bytes · 0.1 ms   — nothing',
  '  localStorage traffic  96 writes · 3.6 ms total over 60 s</code></pre>',
  '<p><b>The mechanism.</b> The warmer trickle-fetches the full ~6.5k-file manifest so later sessions have zero pop-in &mdash; guarded against hidden tabs, Save-Data and 2G, with a comment promising it &ldquo;never competes with gameplay&rdquo;. But its guard list missed the one that matters: <em>the frame budget</em>. On a machine already at 30&nbsp;fps the sweep runs for minutes straight through early play &mdash; which reads as &ldquo;the game is just stuttery&rdquo;, and then quietly stops being reproducible once the device&rsquo;s cache is warm.</p>',
  '<p><b>The fix.</b> The pump now parks for 2.5&nbsp;s and re-checks whenever the player is actively in game <em>and</em> frames are strained (<code>LX_PERF.avgFrame &gt; 17.5&nbsp;ms</code> &mdash; below ~57&nbsp;fps, the same EWMA the lowFx ladder trusts). Menus, pause screens, hidden tabs and healthy machines warm exactly as before, and the resume cursor still carries across sessions &mdash; a weak machine finishes warming during the moments that cost nothing.</p>',
  `<pre style="${PRE}"><code>verified with the machine state pinned (avgFrame 25 ms):`,
  '  playing, strained    patched:      0 sprite fetches in 20 s',
  '                       v0.30.278:  980 sprite fetches in 20 s',
  '  paused,  strained    patched:  1,067 — menus are exactly when warming should run</code></pre>',
  '<p><code>scripts/warm_yield_test.mjs</code> &mdash; 4 checks including a service-worker control (a scripts/-served baseline copy gets no SW and would fake a pass &mdash; the control catches it). <code>scripts/hitch_probe.mjs</code> is the 60&nbsp;s attribution harness behind the finding.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 6500) { console.error(`ABORT: moved ${n0} -> ${s.length} (+${grew})`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG v0.30.279 (+${grew} chars)`);
