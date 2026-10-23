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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Gravitos: Collapse Rain and Soul Drain no longer one-shot you</span></h2>',
  '<p>Per user: <em>&ldquo;Change collapse rain to a 1hp and 1mp attack&rdquo;</em>, <em>&ldquo;If youre at 1 hp you die&rdquo;</em>, and <em>&ldquo;Soul drain should not be a OHKO move, it should be a move whereby the players HP drops by 10% every second for 10 seconds with a unique status affliction&rdquo;</em> (10% of max HP, and it cannot kill). The Singularity stays exactly as it was.</p>',
  '<ul>',
  '<li><b>What you saw.</b> Collapse Rain looks just like the Singularity: the same dark veil, countdown and glowing safe box. But it drops four boxes in a row, each live for only 1.4 seconds, and the Singularity&rsquo;s 50 / 40 / 30 second gap never applied to it. Across his forms it put two to four times as many lethal fields on screen as the Singularity, so it read as &ldquo;the Singularity, cast far too quickly&rdquo;. Soul Drain set your HP and MP straight to 1.</li>',
  '<li><b>Collapse Rain now.</b> Same warning, same four boxes, same timing and safe box. A box that catches you outside its light drops you to <b>1 HP and 1 MP</b> instead of killing you. If you are <b>already at 1 HP</b>, it kills you, so heal between boxes. Each box hits at most once, and dodges, i-frames and shields protect you as they do from any hit. The countdown now reads <b>REACH THE LIGHT OR DROP TO 1 HP</b>.</li>',
  '<li><b>Soul Drain now.</b> Break line of sight and it still misses you. If it catches you, you get the new <b>Soul Drain</b> affliction: <b>10% of your max HP every second for 10 seconds</b>. The drain alone never takes you below 1 HP, but other hits still can. It no longer touches your MP. Being caught again restarts the 10 seconds; it does not stack. A Status Cure Remedy or Celestial Aurora clears it, and it ends if you die, leave the arena or Gravitos changes form.</li>',
  '<li><b>Easy to read.</b> Soul Drain has its own violet wisp-and-heart icon over your head and on the buff bar, with a countdown. Your hero glows violet and wisps drift off toward Gravitos. Each tick shows a small violet number. The skull is gone from its warning.</li>',
  '<li><b>Unchanged.</b> The Singularity is still a one-shot with its v0.30.1852 spacing. Gravity Bind still keeps clear of all three moves. His other attacks, damage, form changes and loot are the same. In co-op every player gets the same effects on their own HP and MP.</li>',
  '</ul>',
  '<p><b>Verified.</b> Tests ran in his arena with his own attacks and the real co-op handlers. A rain box leaves you at exactly 1 HP and 1 MP and alive, kills you at 1 HP, takes nothing inside its light, and hits only once. Soul Drain lands 10 ticks of 10% one second apart, floors at 1 HP, refreshes without stacking, ends on a form change, and misses you behind cover. A co-op guest gets both effects. The Singularity still kills and keeps its spacing.</p>',
  '');
s = s.replace(ANCHOR, () => ENTRY);
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
