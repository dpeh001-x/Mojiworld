// CHANGELOG.html entry for v0.30.271 (Firefox).
// =============================================================================
// Per CLAUDE.md: newest entry on top, inserted directly under </header>,
// self-contained inline styling, pill tags, no external deps.
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

if (s.includes('v0.30.271')) { console.log('already applied'); process.exit(0); }

const ANCHOR = '</header>' + EOL + EOL;
const hits = s.split(ANCHOR).length - 1;
if (hits !== 1) { console.error(`ABORT: header anchor matched ${hits}, expected 1`); process.exit(1); }

const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';

const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.271 <span class="tag"><span class="pill bug">bug</span> Firefox ran the game at 11&ndash;19&nbsp;fps &mdash; the title screen never stopped compositing</span></h2>',
  '<p>Per user: <em>&ldquo;this game is unplayable on firefox very lag, and ur sprites will not load&rdquo;.</em></p>',
  '',
  '<p><b>Reproduced first.</b> Headed Firefox&nbsp;153 with a real GPU, against Edge/Chromium on the same machine and the same screen: <b>11&ndash;19&nbsp;fps versus 130&ndash;157</b>. Headless Firefox showed 1&nbsp;fps, which exaggerates it about tenfold &mdash; every number quoted here is headed.</p>',
  '',
  '<p><b>It was not the game&rsquo;s code.</b> Over a 5&nbsp;second window the rAF callback plus every timer, promise handler and event listener totalled <b>138&nbsp;ms</b>, and a 4&nbsp;ms heartbeat timer kept near-perfect time &mdash; worst lateness <b>10&nbsp;ms</b> &mdash; while rAF fired only 57 times. The main thread was <em>idle</em>. Firefox simply could not present frames.</p>',
  '',
  '<p><b>What that ruled out, each by measurement rather than by argument:</b></p>',
  `<pre style="${PRE}"><code>createImageBitmap resize options   Firefox 153 honours them (16x16 requested, 16x16 returned)`,
  'ctx.filter / url(#goo)             supported; never set to a non-none value on the sampled frames',
  'canvas 2D draw calls               12 ms of a 6398 ms window, identical call counts in both engines',
  'the blob decode path               FASTER on Firefox: 2 ms of jank against 184 ms from the &lt;img&gt;',
  'surface memory                     54 canvases / ~175 MB — byte-identical in both engines',
  'rAF throttling                     a blank page in the same browser does 240 fps, visible + focused',
  'boot-time sprite loading           loading bar hits 100% at 9 s on Firefox, ahead of Chromium&rsquo;s 20 s</code></pre>',
  '',
  '<p>What remained was large-area CSS compositing, which Gecko charges far more for than Blink. Ablating one effect at a time, headed:</p>',
  `<pre style="${PRE}"><code>character-select page   46.2 fps  →  123.5 fps   with CSS animations off          (2.7×)`,
  'title screen            19.4 fps  →  105.8 fps   animations + backdrop-filter off (5.5×)',
  '',
  'the offending layers    .cs-rays   conic-gradient rotating across 1,575,406 px²',
  '                        .lo-bg     ken-burns pan across          1,176,990 px²',
  '                        .cs-stars  twinkle across                  750,723 px²</code></pre>',
  '',
  '<h3>The bug: the title screen is never taken down</h3>',
  '<p><code>#loading-overlay</code> is dismissed by adding <code>.fade</code>, which sets <code>opacity:0</code> and <code>pointer-events:none</code>. It is <b>never</b> <code>display:none</code>&rsquo;d and never removed. So a <code>position:fixed; inset:0; z-index:9999</code> layer survives for the entire session with <code>lo-kenburns 40s infinite</code> and the ember field still running on it &mdash; invisible, and still invalidating a full-viewport layer every frame, <em>forever</em>. Fading it out stopped it being seen, not being composited. <b>This is why the complaint is about playing and not just about menus</b>, and it is wasted work in every browser, not only Firefox.</p>',
  '<p>Now <code>visibility</code> flips to <code>hidden</code> once the fade finishes, via a <code>0s</code> transition delayed by <code>0.6s</code>. The delay lives on the <code>.fade</code> rule rather than the base rule &mdash; a transition is read from the state being <em>entered</em>, so putting it on the base rule would have delayed the un-fade too and left anything that re-showed the overlay invisible for 0.6&nbsp;s. The fade itself looks exactly as it did.</p>',
  '',
  '<h3>The Gecko gate</h3>',
  '<p>The three oversized ambient animations are stopped under <code>@supports (-moz-appearance: none)</code> &mdash; verified <b>true</b> on Firefox&nbsp;153 and <b>false</b> on Chromium, so this is a capability gate and not a user-agent sniff. Only full-screen ambient motion is dropped: the gradients and the starfield still render, they just hold still. Every functional animation &mdash; button pulses, the loading shimmer, damage feedback &mdash; is untouched, and no canvas or gameplay code is involved. Chromium loses only ~16&nbsp;fps of 157 to the same three, so it keeps them.</p>',
  '',
  '<h3>&ldquo;Sprites will not load&rdquo;</h3>',
  '<p>Not a loading failure &mdash; the bar reaches 100% on Firefox <em>before</em> Chromium. Sprite right-sizing is driven from the draw path, so at 11&nbsp;fps the bake queue advances at 11&nbsp;fps too and frames stay unbaked for minutes. It is the same defect seen from the other side, and it lifts with the frame rate.</p>',
  '<p><b>Separately, and genuinely missing:</b> nine <code>gravitos2star_*.webp</code> frames 404 in <em>both</em> engines. The files exist in <code>Sprites/bosses/attack/</code> but are requested from <code>Sprites/bosses/idle/</code>. Reported rather than fixed here &mdash; it is boss code, where other sessions are working, and it is not a Firefox problem.</p>',
  '',
  '<h3>Not done, deliberately</h3>',
  '<p>The large <code>backdrop-filter</code> blurs are worth <b>+23.8&nbsp;fps</b> on the title screen but <b>&minus;5.9</b> on the class page, and removing them changes how every panel reads. That is a visual trade for the user to make, not one to take silently.</p>',
  '',
  '<p><b>On the measurement itself.</b> The first verification compared both builds in one browser session and was worthless: whichever build ran <em>second</em> measured ~2.5&times; faster in both engines and in both orders, as warm cache and warm JIT swamped the change. The numbers above come from a fresh browser per sample with the build order alternated across repetitions.</p>',
  '');

s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 3000 || grew > 9000) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (+${grew}), expected roughly +5000`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG.html v0.30.271 entry (${n0} -> ${s.length} chars, +${grew})`);
