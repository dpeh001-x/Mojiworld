// CHANGELOG.html entry for v0.30.272, and a correction to v0.30.271.
// =============================================================================
// Newest on top, inserted directly under </header> per CLAUDE.md.
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

if (s.includes('v0.30.272')) { console.log('already applied'); process.exit(0); }

const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';

const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.272 <span class="tag"><span class="pill bug">bug</span> Firefox: nothing was watching the frame rate at the menus</span></h2>',
  '<p><b>This corrects v0.30.271, which did not work.</b> That version shipped a Gecko-only rule stopping three large decorative animations. Re-measured properly it does <em>nothing</em>, and it has been removed.</p>',
  '',
  '<p><b>How the wrong answer got shipped</b>, recorded because the mistake is easy to repeat. The ablation behind v0.30.271 applied effects <em>cumulatively</em> and measured them in sequence inside one page. The game is still baking sprites for the first tens of seconds, so the numbers climbed almost monotonically &mdash; 19.4 &rarr; 27.1 &rarr; 50.9 &rarr; 105.8 fps &mdash; and I read that settling curve as an ablation result. Re-run as A/B/A (settle first, then baseline &rarr; effect off &rarr; baseline, discarding any row whose two baselines disagree):</p>',
  `<pre style="${PRE}"><code>html.lx-nobackdrop              11.9 →  28.7 →  11.7    +143%`,
  'the overlay out of compositing  11.5 →  29.2 →  11.9    +150%',
  '#game colour grade alone        11.7 →  12.4 →  12.0    no effect',
  'the v0.30.271 animation gate    11.7 →  11.7 →  12.2    no effect',
  '',
  'and turning off ALL 40 running animations, across 76 elements:  no effect</code></pre>',
  '',
  '<h3>The actual bug</h3>',
  '<p>The game <b>already had</b> the fix. <code>html.lx-nobackdrop</code> &mdash; built for <em>&ldquo;even a computer without graphics card can run this smooth&rdquo;</em> &mdash; drops all 110 <code>backdrop-filter</code> declarations and the full-screen <code>#game</code> colour grade. It engages from two places, and <b>both miss Firefox</b>:</p>',
  `<pre style="${PRE}"><code>_lxRendererIsSoftware()   reads the WebGL renderer string. Firefox reports`,
  '                          "ANGLE (Intel, Intel(R) HD Graphics ...)" — a real GPU —',
  '                          so this correctly answers "not software".',
  '',
  'the frame watchdog        lives in _perfTick, which only runs inside the GAMEPLAY',
  '                          loop. Measured at the title screen after 20 s:',
  '                          LX_PERF.avgFrame 16.7, slowFrames 0. It is not slow to',
  '                          react — it never samples at all.</code></pre>',
  '<p>So the machine sat at ~11&nbsp;fps with 110 backdrop blurs live and nothing in the game noticed.</p>',
  '',
  '<h3>The fix: a watchdog that runs from boot</h3>',
  '<p>It samples presented frames from boot, menus included, and engages the same sticky mechanism. Two consecutive 2&nbsp;second windows under 25&nbsp;fps trip it; nothing counts before 6&nbsp;s (the sprite burst stalls frames honestly) and a hidden tab never counts. It is <b>not</b> a browser check &mdash; it measures the machine in front of it, so the &ldquo;no graphics card&rdquo; case this feature was written for is now covered from boot rather than only once combat starts.</p>',
  '<p><b>One detail decided whether it worked at all.</b> The first version scored each frame <code>+1</code> when slower than 40&nbsp;ms and <code>-1</code> otherwise, and never fired. Firefox delivers rAF callbacks in <em>alternating pairs</em> &mdash; measured <code>4.2, 87.5, 4.2, 108.3, 4.2, 87.5</code> &mdash; so every slow frame was cancelled by the fast one beside it and the score sat at <b>1 across 106 frames whose median was 87.5&nbsp;ms</b>. Counting frames per window is immune to that shape.</p>',
  '',
  '<h3>Result</h3>',
  `<pre style="${PRE}"><code>Firefox 153, headed, real GPU, title screen`,
  '  before   13.8 – 14.7 fps    lx-nobackdrop false, grade + 110 blurs live',
  '  after    26.9 – 27.9 fps    [perf] backdrop blur disabled (boot frame watchdog 16.6 fps)',
  '',
  'Chromium / Edge, same page',
  '  44.8 fps    watchdog does NOT fire — colour grade and HUD blur both kept</code></pre>',
  '<p>Roughly double the frame rate on the affected browser, and provably nothing taken from a browser that can afford the effects. <code>scripts/boot_frame_watchdog_test.mjs</code> asserts both halves &mdash; 8/8 on this build, 4/8 on the previous one.</p>',
  '',
  '<h3>What survives from v0.30.271</h3>',
  '<p>The loading-overlay teardown, which was a genuine defect and is kept. <code>#loading-overlay</code> is dismissed with <code>opacity:0</code> and is never <code>display:none</code>&rsquo;d or removed, so a <code>position:fixed inset:0 z-index:9999</code> layer survived the whole session &mdash; and under <code>.menu-up</code> (added once, never removed) it carries <code>lo-kenburns 40s infinite</code> with <code>will-change: transform</code>, pinning a compositor layer forever. Taking that layer out of compositing measured <b>+150%</b>. It now goes <code>visibility:hidden</code> once the fade completes.</p>',
  '<p>The &ldquo;sprites will not load&rdquo; half is unchanged: sprite right-sizing runs from the draw path, so at 11&nbsp;fps the bake queue advanced at 11&nbsp;fps. It lifts with the frame rate. Still outstanding and unrelated: nine <code>gravitos2star_*.webp</code> frames 404 in <em>both</em> engines &mdash; the files exist in <code>Sprites/bosses/attack/</code> but are requested from <code>Sprites/bosses/idle/</code>.</p>',
  '');

s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 3000 || grew > 9000) { console.error(`ABORT: moved ${n0} -> ${s.length} (+${grew})`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG.html v0.30.272 entry (${n0} -> ${s.length} chars, +${grew})`);
