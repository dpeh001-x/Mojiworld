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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Co-op: every party and lobby channel gets its own lane on the server</span></h2>',
  '<p><b>What you saw.</b> Nothing yet, but you would have at launch. The co-op server can give each party and each lobby channel its own lane, but the game never asked for one, so every party, every lobby channel and every account sign-in shared a single lane. One crowded lobby, or a rush of sign-ins, would have made everyone&rsquo;s co-op stutter.</p>',
  '<p><b>What happens now.</b></p>',
  '<ul>',
  '<li>When you join a party or a lobby channel, the game asks for that room&rsquo;s own lane. Switching channel or party, hopping on from a full lobby channel, joining through an invite and reconnecting after a drop all ask for the new room&rsquo;s lane.</li>',
  '<li>&ldquo;Respawn where you logged off&rdquo; still works: those saved spots stay in one shared place whichever lane you are on, so none are lost when a room moves to its own lane.</li>',
  '<li>The server in use today ignores the request, so co-op works exactly as before until the team updates the server. That update also includes a switch that puts everyone back on the shared lane.</li>',
  '</ul>',
  '<p><b>Verified.</b> A test runs the real co-op server code, both the updated server and the one in use today, with real game windows. On the updated server, two players in a party land in that party&rsquo;s own lane and see each other. A lobby player gets the lobby channel&rsquo;s lane and never meets the party. A channel switch moves you to that channel&rsquo;s lane. Your spot is saved in the shared place and comes back when you rejoin, including spots saved before this change. On today&rsquo;s server, the party still meets and spots still come back. The switch works, and the shared store cannot be written to from outside. The build before this fix fails four of the nine checks.</p>',
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
