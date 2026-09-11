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
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Flying monsters stop pinning themselves against the edge of the map</span></h2>',
  '<p>Per user (with a screenshot of B1, Spirelings sitting against the right edge): <em>&ldquo;monsters are stuck at the side after attacking (B1 expedition)&rdquo;.</em></p>',
  '<p><b>Why.</b> A flying monster that is chasing you picks a point 180&ndash;320&nbsp;px from you at a random angle and swoops to it, then picks another. Nothing kept that point inside the map. Near a wall a large share landed <em>past</em> it, so the flyer flew into the wall and the edge stopped it there &mdash; and because a point outside the map can never be reached, it never counted as arriving. It sat pressed against the wall until a 1.2&ndash;2.4&nbsp;s timer picked a new point, and near a wall about half of those landed outside again. B1 is only 1,200&nbsp;px wide and holds 30 Spirelings, so you are rarely far from a wall there. (The Spireling&rsquo;s dash was checked and ruled out: its burst is capped back to cruising speed the same frame.)</p>',
  '<p><b>Now.</b> A point that would land outside the map is mirrored to the other side of you, so the swoop passes over you instead of into the wall, and then held a little inside the edge. Near a wall the chasers now circle on the open side of you &mdash; a median of about 150&nbsp;px away, where before they sat about 100&nbsp;px away pressed into the wall. This is the one steering routine every flying monster shares, so fliers on every map stop hugging walls, not only B1&rsquo;s.</p>',
  '<table><thead><tr><th>Your position on B1</th><th>Before: samples at a wall</th><th>Before: pinned over 2&nbsp;s</th><th>Before: pinned at the end</th><th>After</th></tr></thead><tbody>',
  '<tr><td>Near the right wall</td><td>27&ndash;29%</td><td>22&ndash;26</td><td>11&ndash;13 of 30</td><td>0% &middot; 0 &middot; 0</td></tr>',
  '<tr><td>Near the left wall</td><td>19&ndash;21%</td><td>15&ndash;21</td><td>8&ndash;12 of 30</td><td>0% &middot; 0 &middot; 0</td></tr>',
  '<tr><td>Centre</td><td>0&ndash;3%</td><td>0&ndash;1</td><td>0&ndash;1</td><td>0% &middot; 0 &middot; 0</td></tr>',
  '</tbody></table>',
  '<p><code>scripts/flier_wall_test.mjs</code> &mdash; 5 checks, B1 reloaded fresh for each position with you held still: near the right wall and near the left wall, under 5% of flier samples touch a wall and none stays pinned over 2&nbsp;s; no flier ever aims outside the map (baseline: 3,922 and 4,479 samples did); the fliers chasing you still orbit close by and the Spireling dash still fires; and with you at the centre nothing sits at the walls. The before figures span two runs of the previous build; the after figures were zero in every run.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 6500) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
