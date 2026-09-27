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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Co-op server ready for launch: a party holds five, a full room says so, the lobby never strands you, idle parties cost nothing</span></h2>',
  '<p>A launch audit of the co-op server (the relay every party connects through, which also keeps online accounts) found it had no limits a busy launch needs: one room could grow without end, one broken or hostile client could push huge messages to everyone in its party, the server stayed awake as long as anybody was connected, and the account login was weaker than it should be.</p>',
  '<ul>',
  '<li><b>A party holds five players</b> &mdash; the party of five the Ticket Rush asks for. A sixth player joining the same code and channel now sees <em>&ldquo;Party ABCDE (Ch&nbsp;1) is full &mdash; try another channel or party code&rdquo;</em> with a <b>Retry</b> button. Before, they saw &ldquo;Co-op connection lost &mdash; reconnecting&hellip;&rdquo; and the game knocked on the full party for almost two minutes without saying why.</li>',
  '<li><b>The public lobby</b> (where the Multi window takes you with no party code) holds 50 players per channel. If your channel is full, the game moves you to the next one by itself and the channel button follows; only if all five channels are full does it tell you so. A party code never switches channels, so friends stay together.</li>',
  '<li>Getting back into <b>your own</b> party after a dropped connection always works, even when it is full, and so does a second window on the same computer.</li>',
  '<li>Messages over 64&nbsp;KB are dropped by the server instead of being passed to the whole party. The game never sends one &mdash; painted Wardrobe pieces already travel in smaller parts.</li>',
  '<li><b>A quiet party lets the server sleep</b> (menus, AFK, an empty lobby) and it picks up exactly where everyone was when it wakes. Your spot is saved about once a minute while you play and when you leave, and only if you moved &mdash; it used to be rewritten every 15 seconds for everybody.</li>',
  '<li><b>Online accounts:</b> passwords are stored with much stronger protection (an existing account upgrades by itself the next time it signs in), a sign-in lasts a year after its last use (the game no longer has a sign-in screen, so it is kept long), a wrong name and a wrong password get the same &ldquo;Invalid username or password&rdquo; answer so nobody can probe which names exist, and old sign-in and rate-limit records are cleaned up automatically.</li>',
  '<li>Groundwork: a party can now get a server room all to itself. This build does not use it yet; it is switched on in a later, coordinated update so that friends on older and newer builds never end up in different rooms.</li>',
  '</ul>',
  '<p>The server half takes effect when the co-op server is next deployed; the game half (the &ldquo;party is full&rdquo; message) ships in this build and works with the self-hosted server too.</p>',
  '<p><b>Verified.</b> <code>scripts/mp_relay_test.mjs</code> &mdash; 67 checks on a local copy of the server running on the same engine as the live one: the size cap, the party cap (a sixth player refused, the party never sees them, your own rejoin and a freed slot let in), a lobby channel taking seven, rooms of their own, the keepalive, the room rebuilt after the server sleeps, the idle clean-up, the minute-by-minute save, password upgrade of an old account with its save intact, year-long sign-ins, the single login error, the lockout, the record clean-up, plus the game: the full-party message, no re-dialling, Retry, the lobby moving on to a free channel and saying so when all are full, no page errors. 28 fail on the previous server and game; all pass three runs in a row.</p>',
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
