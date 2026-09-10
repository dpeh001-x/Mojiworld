import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The Wayfarer preview stands in a violet alcove, not a grey one</span></h2>',
  '<p>Per user, with a screenshot of the character creator: <em>&ldquo;backdrop can be purplish base rather than grey&rdquo;.</em></p>',
  '<p><b>The obvious fix would have done nothing.</b> The rule already ends in a grey base gradient &mdash; the natural thing to recolour &mdash; but it is never visible. Measured: <code>Sprites/ui/cs_preview_bg_floor.webp</code> is 512&times;512, <code>hasAlpha</code> false, <b>100% opaque</b>, mean <code>rgb(189,190,194)</code> with a channel spread of 5. The grey the player sees <em>is</em> that art; the base gradient under it is dead pixels.</p>',
  '<p><b>So the art itself is recoloured, in CSS.</b> A violet wash layer is inserted directly above the image and given <code>background-blend-mode: color</code> for its slot. The <code>color</code> blend takes hue and saturation from the wash and <em>luminance</em> from what is underneath, so every highlight, shadow and carved edge of the alcove survives and only the grey goes. A plain translucent overlay would have hazed the art out and flattened its contrast instead. The violet is <code>rgb(118,92,178)</code> &mdash; not a new colour, but the exact one this same element used before an earlier neutral pass, so the plate rejoins the existing palette.</p>',
  '<p>Measured on the rendered plate, sampling the border ring and skipping the figure:</p>',
  '<pre style="' + PRE + '"><code>              chroma   hue    luminance   luminance sd',
  'before          18-23   252    125         38      <- reads as grey',
  'after              52   259    122         38      <- violet, same structure</code></pre>',
  '<p>Chroma more than doubles while <b>luminance and its standard deviation barely move</b> &mdash; that pair is the proof the blend recoloured the alcove rather than painting over it.</p>',
  '<p><b>The hidden base was recoloured too, and that is not cosmetic:</b> the backdrop image is staged for deletion in the shared index by a parallel session right now. If it does go, the fallback base is what renders &mdash; and on a violet design that fallback must not be the grey this change removes. The asset itself was deliberately left alone for the same reason.</p>',
  '<p><code>scripts/cs_preview_violet_test.mjs</code> &mdash; 5 checks, screenshotting the plate and measuring its pixels, since no CSS colour can be read to prove this. The load-bearing one is the <b>control</b>: a flat violet slab painted over the art would pass a hue check while destroying the alcove, so the test also requires the luminance spread to stay high. On the unpatched build 4 of 5 fail. Its own layer-count check was wrong at first &mdash; splitting the background stack on commas counts the commas nested inside each gradient, reporting 18 layers for 6 &mdash; and now asserts the wash is present instead.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
