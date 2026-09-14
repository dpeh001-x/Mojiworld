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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> A skill icon that fails to load once is no longer lost for the session</span></h2>',
  '<p>Per user, over a screenshot of the warrior bar: <em>&ldquo;some of the icons here are a little weird from warrior, ensure to use the original skill icons&rdquo;</em> &mdash; and, asked whether they ever appear, <em>&ldquo;they stay like that for full session&rdquo;</em>.</p>',
  '<p><b>The art was never the problem.</b> All fourteen warrior icons exist, are on origin, and are proper game art &mdash; a crescent slash, a roaring lion for War Cry, crossed flaming axes for Rampage, a gold cross for Guardian. Probed in a live game, every slot on the desktop bar resolved to its sprite and not one request failed. The emoji in that screenshot are the <em>fallback</em>, with the real file sitting there perfectly loadable.</p>',
  '<p><b>The loader latched.</b> The icon probe is gated on one state:</p>',
  '<pre><code>if (_skillIconStatus[id] === undefined) { &hellip;probe once&hellip; }',
  "im.onerror = () =&gt; { _skillIconStatus[id] = 'fail'; };</code></pre>",
  '<p><code>undefined</code> is the <em>only</em> state that probes, so the first failure is final: that id never asks again and the bar serves its emoji for the rest of the session. Those probes all fire during the ~2700-sprite boot storm &mdash; the one moment a request is most likely to be dropped, aborted or starved &mdash; and a drop there is indistinguishable from a skill that genuinely has no art. That is exactly the reported symptom: permanent, affecting some icons and not others, with nothing wrong with the files.</p>',
  '<p><b>Now</b> a failure is retried up to three times, spaced 1.5&nbsp;s apart, and only then final. The retry rides the HUD tick that was already calling the loader rather than scheduling a timer, so nothing new is queued and an id nobody asks for costs nothing. Retries carry a cache-buster, because a browser that cached the failed response would hand back the same failure and the retry would prove nothing. A skill that genuinely has no art still settles on its emoji after three tries and stops asking.</p>',
  '<p>The batch gate is deliberately left alone: it latches open and returns early once latched, so an id going back to <code>pending</code> for a retry cannot re-close it and drop already-resolved icons back to emoji &mdash; the exact regression its own comment warns about.</p>',
  '<p><code>scripts/skill_icon_retry_test.mjs</code> &mdash; 8 checks in a live game, including the two that make this more than an assertion: the defect is <em>reproduced</em> by forcing an id to <code>fail</code> and confirming the shipped gate offers no way back, then the same id is watched recovering to art; and a deliberately missing id is probed until it stops, proving the cap holds. Also checked: the retries really do carry the cache-buster, the gate stays latched, and every healthy icon is untouched throughout.</p>',
  '<p><b>Two bugs in the test itself</b>, both caught by reading its own output rather than its verdict. It first counted the 404s from the deliberately-missing id as real failures &mdash; failing on evidence it had manufactured. And it asserted at least eight bar slots, which depends on the character&rsquo;s progression (nine on a progressed save, five on a fresh boot) rather than on the loader; it now asserts that every slot present resolves.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 12000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
