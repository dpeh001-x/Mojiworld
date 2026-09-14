import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> King Gloopaloo: a crisp base, slime balls you can see, and a smoother idle</span></h2>',
  '<p>Per user, over a video of the Gelwater Grotto fight: <em>&ldquo;for gloop the bottom part of the sprite is feathered off which was not intended, also for the blue small balls it shoots out, it is way too small, please make it bigger, and improve smoothness of the animations&rdquo;.</em></p>',
  '<p><b>His base was dissolving.</b> The edge-feather system fades any edge where art runs into the border of its own canvas, to hide a crop. The bottom edge is excluded everywhere &mdash; that is where a character&rsquo;s feet meet the floor &mdash; except for two types that opted in because their art is cut flat across the bottom. Every one of his eighteen idle and walk frames records a bottom cut and nothing else, so on him the opt-in wasn&rsquo;t tidying the odd cropped frame, it was fading his base on every single one. He comes off the list; his flat bottom sits on the floor line under the ground shadow the draw already puts there. Krook keeps his.</p>',
  '<p><b>His slime balls were smaller than a common mob&rsquo;s.</b> Since v0.26.170 a mob projectile&rsquo;s hitbox <em>is</em> its rendered diameter, and the ordinary band is 24&ndash;31&nbsp;px &mdash; a mushroom&rsquo;s spore renders at 31. The King of all slimes threw 14&nbsp;px splash pellets and a 16&nbsp;px glue spray, which is why they read as dots. Splash goes to 28 and the spray to 30, so the sprite is drawn at that size and the ball you see is the ball that hits you. His big lobbed goo (48) and his damage per ball are unchanged.</p>',
  '<p><b>His idle stepped.</b> 158 of the 159 entities with authored animation carry per-frame timing; he carried it for his attack only, so his idle and walk fell back to a flat 130&nbsp;ms step &mdash; nine frames at under 8&nbsp;fps. Both now have an eased breathing curve, slower at the squash extremes and quicker through the middle, averaging 92&nbsp;ms.</p>',
  '<table><thead><tr><th></th><th>Before</th><th>After</th></tr></thead><tbody>',
  '<tr><td>Bottom rows of his sprite (alpha vs the body above)</td><td>0.12 &mdash; faded out</td><td>0.72 &mdash; crisp</td></tr>',
  '<tr><td>Splash pellet</td><td>14&nbsp;px</td><td>28&nbsp;px</td></tr>',
  '<tr><td>Glue spray</td><td>16&nbsp;px</td><td>30&nbsp;px</td></tr>',
  '<tr><td>Idle frame time</td><td>flat 130&nbsp;ms</td><td>eased, mean 92&nbsp;ms</td></tr>',
  '</tbody></table>',
  '<p><code>scripts/gloop_polish_test.mjs</code> &mdash; 5 checks: his sprite drawn through the game&rsquo;s own soft-draw keeps its bottom rows, while asking for the old opt-in on the same sprite still fades them (which is what proves the measure can tell them apart); the opt-in list still holds Krook and no longer holds him; his glue spray spawns at the ordinary size; and his idle and walk both carry frame times.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 8000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
