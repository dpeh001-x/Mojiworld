import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';   // a chain builds in a private copy
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
// the icon count comes from the shipped atlas, so the entry cannot drift from what was generated
const atlasJs = readFileSync('C:/Users/dpeh0/Mojiworld/data/emoji_atlas.js', 'utf8');
const ICONS = Object.keys(JSON.parse(atlasJs.slice(atlasJs.indexOf('{'), atlasJs.lastIndexOf('}') + 1)).map).length;
if (!(ICONS > 100)) { console.error('ABORT: atlas holds only ' + ICONS + ' icons'); process.exit(1); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> No more system emoji: every symbol in the game is now one of ' + ICONS + ' custom icons</span></h2>',
  '<p>Per user: <em>&ldquo;ensure that no emojis are used, if they are they should be changed to customised images, use ludo.ai to generate them&rdquo;.</em></p>',
  '<p><b>What was there.</b> The game showed 387 different emoji in 2,531 places &mdash; skill and item icons, the ATK and DEF labels on the HUD, toasts, buttons and tabs, the arrows on every portal name &mdash; drawn in whatever emoji font the player&rsquo;s operating system happens to have, so they looked different on every machine and pasted-in against the game&rsquo;s own art.</p>',
  '<p><b>Now.</b> Each of them has its own icon, generated with ludo.ai in one consistent style (a clean dark outline and soft cel shading) and packed into a single image the game loads once. The swap happens where text reaches the screen, so it covers everything at once, including emoji added later: text drawn on the game canvas lays the icons out inline at the size of the surrounding text, and text on the page shows them as inline images that follow the font size. Game code that reads a label still sees the character it wrote. Symbols drawn by the stylesheet itself &mdash; the globe on the Multi button and the flask over the potion stall &mdash; are painted from the same atlas. The few places that cannot show a picture &mdash; tooltips, placeholders, drop-down options and browser pop-ups &mdash; simply drop the emoji. An emoji that has no icon yet shows the custom sparkle rather than the system glyph. &copy;, &reg; and &trade; stay ordinary text.</p>',
  '<p><code>scripts/no_emoji_test.mjs</code> &mdash; 7 checks, with spies on the browser&rsquo;s own text drawing installed before the game loads: no emoji reaches the canvas text renderer (previous build: 165 fills and 164 outlines in one short walk through town, starting with the portal names); the custom icons are drawn from the atlas; no visible page text shows an emoji (previous build: 13, among them &ldquo;saved&rdquo;, &ldquo;Taxi&rdquo;, &ldquo;Daily Challenge&rdquo; and &ldquo;Claimed&rdquo;); the icons are on screen; a label&rsquo;s text still reads what the game wrote; a tooltip set with an emoji comes back without it; and no stylesheet rule draws an emoji through CSS <code>content</code> (previous build: 2, the Multi button&rsquo;s globe and the potion stall&rsquo;s flask). The icons are made by <code>scripts/gen_emoji_icons.mjs</code> and packed by <code>scripts/pack_emoji_atlas.mjs</code>.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars, ' + ICONS + ' icons)');
