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
  '<h2>' + VER + ' <span class="tag"><span class="pill balance">balance</span> The Magma Foundry&rsquo;s codex studies open together &mdash; the Smith Golem&rsquo;s Apex Study with the rest</span></h2>',
  '<p>Per user: <em>&ldquo;for smith golem apex quest pls try to align it together with the other monsters in the magma foundry at the same time&rdquo;.</em></p>',
  '<p><b>Why they were apart.</b> The codex placed every study per creature: the first study at the creature&rsquo;s own level &minus;&nbsp;2, the Greater Study at +&nbsp;3, the Apex Study at +&nbsp;6. The Foundry&rsquo;s four residents sit at levels 60, 62, 65 and 66, so their Apex Studies opened at <b>66, 68, 71 and 72</b> &mdash; the Smith Golem&rsquo;s three and five levels after the first two, though all four live on the same map and are farmed in the same runs.</p>',
  '<p><b>Now.</b> The Magma Foundry is a <em>cohort</em>: its residents&rsquo; Greater Studies all open at <b>Lv&nbsp;66</b> and their Apex Studies all at <b>Lv&nbsp;69</b>, so one Foundry run advances all four together. The Smith Golem&rsquo;s Apex Study moves from 71 to 69. The Greater tier moves with it because one shared Apex level alone could not keep the codex&rsquo;s order: anything under 70 would open the Bellowsbat&rsquo;s Apex before its own Greater Study, and anything higher would delay the other three instead of bringing the Smith Golem forward. The shared levels come from the roster itself &mdash; the average level plus 3 for the Greater tier, then 3 more for the Apex &mdash; and residents are read from the map&rsquo;s spawn table, so a monster added to the Foundry joins without an edit. <b>Only when a study opens changes:</b> its kill count and its rewards are still worked out from the creature&rsquo;s own level, the first study of each creature is untouched, and every other map keeps the per-creature rule. A study you have already unlocked stays unlocked.</p>',
  '<table><thead><tr><th>Monster</th><th>First study</th><th>Greater (was)</th><th>Apex (was)</th></tr></thead><tbody>',
  '<tr><td>Forgewight</td><td>58</td><td>66 (63)</td><td>69 (66)</td></tr>',
  '<tr><td>Cinderling</td><td>60</td><td>66 (65)</td><td>69 (68)</td></tr>',
  '<tr><td>Smith Golem</td><td>63</td><td>66 (68)</td><td>69 (71)</td></tr>',
  '<tr><td>Bellowsbat</td><td>64</td><td>66 (69)</td><td>69 (72)</td></tr>',
  '</tbody></table>',
  '<p><code>scripts/codex_cohort_test.mjs</code> &mdash; 7 checks: the four Apex Studies share one level (baseline: 66 / 68 / 71 / 72); the Smith Golem&rsquo;s opens at it, earlier than 71; the four Greater Studies share one level; every resident keeps first study &lt; Greater &lt; Apex with Apex three levels after Greater; through the live unlock pass none of the four Apex Studies is open one level below the shared level and all four open at it (baseline: one of four); each first study stays at the creature&rsquo;s level &minus;&nbsp;2; and a map outside the cohort (Glasswind Steppe) keeps the per-creature rule. Before the push, every quest in the game was diffed against the previous build: of all of them, only these eight unlock levels differ &mdash; no kill count, EXP or coin reward moved. <code>scripts/level_consistency_audit.mjs</code> now knows the cohort rule, so it does not report the shared levels as formula mismatches.</p>',
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
