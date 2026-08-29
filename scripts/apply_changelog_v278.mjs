// CHANGELOG.html entry for v0.30.278. Newest on top, under </header>.
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
if (s.includes('>v0.30.278 <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.278 <span class="tag"><span class="pill bug">bug</span> Late-game lag: loot piles culled and capped, and a render rung below native</span></h2>',
  '<p>Per user: <em>&ldquo;improve on the multikill lag and boss fight lags&rdquo;</em> &mdash; continuing from v0.30.277 with the probes upgraded to <em>fight for real</em>: the harness now attacks through the same call chain as the keyboard handler and melted Krook + Octobaby to 12% while measuring.</p>',
  `<pre style="${PRE}"><code>measured on the probe host (the reporting machine runs ~3.5× slower):`,
  '  boss fight, actually fighting     211–231 fps · worst frame 16.5 ms  → boss JS is not hot',
  '  wipe aftermath, traced            main thread: 12 ms Layout + 7.5 ms MajorGC, nothing bigger',
  '  drawDrops per call                100 coins 0.18 ms · 300 coins 1.31 ms',
  '                                    → ~4.5 ms/frame on a weak machine: ~15% of a 30 fps budget,',
  '                                      every frame, for as long as an AoE-farm pile stands</code></pre>',
  '<p><b>Loot piles were the ONE unbounded cost.</b> <code>game.drops</code> was the one combat queue <code>_trimVisualQueues</code> never capped (an 80-kill wipe leaves ~300 coins), and <code>drawDrops</code> the one per-frame draw pass with no viewport cull. Three changes:</p>',
  '<ul>',
  '<li><b>Cull</b> &mdash; off-camera drops draw nothing, like every sibling pass. Measured 1.31&nbsp;ms &rarr; 0.003&nbsp;ms per call for an off-screen pile.</li>',
  '<li><b>Cap by merging</b> &mdash; above 240 drops, the oldest <em>coin</em> merges its value into the next-oldest coin. 400 coins converge to 240 with the total value conserved exactly (asserted: 2000 of 2000); items, potions and boss walk-over loot are never touched. Nothing a player earned is lost &mdash; big piles just consolidate.</li>',
  '<li><b>Resolution floor 0.75, desktop only</b> &mdash; the dynamic-resolution governor is the ladder&rsquo;s deliberate last resort (it acts only after <code>veryLowFx</code> is engaged <em>and</em> frames stay above 22&nbsp;ms), but at native scale it declared &ldquo;nothing to trade&rdquo; and gave up. Desktops may now step one quarter below native &mdash; 44% fewer canvas pixels, the one lever that scales with everything: boss fights, wipes, dense late-game maps. It restores itself when the pace recovers, exactly as before; mobile keeps its 1.0 floor by construction.</li>',
  '</ul>',
  '<p><b>Ruled out en route:</b> the wipe-aftermath frame spike was chased with the V8 sampler (only idle/(program)), then a devtools-timeline trace &mdash; the biggest main-thread events after a 40-kill wipe are a 12&nbsp;ms layout and a 7.5&nbsp;ms major GC; the rest of the headless spike is raster, not game code. The level-up modal was cleared as a suspect by repeating the wipe at Lv&nbsp;70 (no level-ups possible: spike unchanged).</p>',
  '<p><code>scripts/dropcap_drs_test.mjs</code> &mdash; 6 checks (cull cost ratio, cap convergence, exact value conservation, protected drops, desktop/mobile floors); three fail on v0.30.277. <code>multikill_coalesce_test.mjs</code> re-run on this build: still 5/5.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 7000) { console.error(`ABORT: moved ${n0} -> ${s.length} (+${grew})`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG v0.30.278 (+${grew} chars)`);
