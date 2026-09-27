import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>';
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Text that overlapped, got cut off, or named keys a phone does not have</span></h2>',
  '<p>A text pass over the tutorial, the menus and a landscape phone (667&times;375 and 844&times;390, touch) found words sitting on other words, cut short, or telling a phone player to press a key. Only text, wording and a few positions changed; nothing was restyled.</p>',
  '<ul>',
  '<li><b>The tutorial card covered the windows it sends you into.</b> With the tour running, opening <kbd>U</kbd> or <kbd>Q</kbd> faded the card, but its Skip / Back / Next row, its fold button and its key chips stayed solid on top of the window&rsquo;s contents. The card now steps aside completely while a window is open and comes back the moment you close it. Steps still tick off while it is hidden, and the 15-second pause before the next step waits until the card is back, so no step goes by unread.</li>',
  '<li><b>The tutorial&rsquo;s step name was cut off</b> (&ldquo;LEVEL UP &amp; ALLOCATE POI&hellip;&rdquo;). It wraps onto a second line now.</li>',
  '<li><b>Phones were told to press keys.</b> The World Map said &ldquo;Press W to close&rdquo;, the MojiDex &ldquo;press Y to close&rdquo;, the character panel &ldquo;Press U to close&rdquo;, and chat &ldquo;Enter send, Esc cancel&rdquo;. On a touch screen they now say <b>Tap &#10005; to close</b> and <b>tap Send</b>. A keyboard still sees the key, and a controller still sees its button.</li>',
  '<li><b>Compendium header.</b> On a phone the &ldquo;A Bestiary of Everdawn&rdquo; sticker sat on top of the &ldquo;0 / 131 catalogued &middot; 0 felled&rdquo; count. When the window is narrow the count now gets its own line under the sticker.</li>',
  '<li><b>Character creation on a short screen.</b> Guguma&rsquo;s tip bubble ran into the &ldquo;Choose your story&rdquo; banner, and the intro&rsquo;s dash wrapped onto a line by itself. The banner starts below the bubble now, and the dash stays with its words.</li>',
  '<li><b>Numbers and names.</b> The shop read &ldquo;Your Mojicoins: 1000000000&rdquo;. It reads <b>1,000,000,000</b> now, and so do the forge, the crafting bench and the taxi. A long name in the &ldquo;Welcome, &lt;name&gt;!&rdquo; greeting ran out of its notice; it wraps inside the notice now.</li>',
  '</ul>',
  '<p><b>Verified.</b> An automated check measured on-screen positions and read the text at 1280&times;720 and on both phone sizes with touch. It covered the tour card with the character panel and the quest journal open (and its return once they closed), every tutorial step name, the three close hints and the chat hint on touch and on a desktop, the Compendium header with large numbers, the shop balance, a 16-letter name in the greeting beside an open window and on the creation screen, the creation banner and dash, and page errors. It passed 3 runs in a row. On the build before this fix the tour card, touch hint, Compendium, shop and greeting checks all failed.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 300 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
