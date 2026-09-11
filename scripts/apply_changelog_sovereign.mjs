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
  '<h2>' + VER + ' <span class="tag"><span class="pill balance">balance</span> The Sovereign&rsquo;s collapse: five seconds to reach the light, nothing else thrown, and the right name on the death screen</span></h2>',
  '<p>Per user: <em>&ldquo;sovereign of the spire, needs more time interval to evade the OHKO attack, should not do any other attacks when doing the OHKO attack, also when dying to OHKO attack it mentions death by gravitos&rdquo;.</em></p>',
  '<p><b>Evade window.</b> The Singularity Collapse is a hazard whose lifetime <em>is</em> the telegraph: 210 frames, 3.5&nbsp;s, to reach one of three safe zones that also shrink per phase (110 &rarr; 95 &rarr; 82&nbsp;px). Now <b>300 frames, 5.0&nbsp;s</b>. The SPENT window that lets you punish the Sovereign after the resolve is expressed as telegraph&nbsp;+&nbsp;2.5&nbsp;s, so it moves with it; the held pose scales; and the warning ring already draws from <code>life&nbsp;/&nbsp;maxLife</code>, so it adapts on its own. The interval <em>between</em> collapses (24 / 18 / 13.5&nbsp;s by phase, set in v0.30.470) is unchanged.</p>',
  '<p><b>Nothing else while it charges.</b> Measured on the old build with every timer due: the homing volley happened to be muted during the charge by a truthy-timestamp check, but the <b>drain pillar fired for 23 frames inside the telegraph</b>, and the 2.8&times; swing and the column beam were free to start whenever you came in range &mdash; a stale note in the fire block said the type carried neither trait; it carries both. The fire block now stamps a collapse-charge window; the volley and drain gates test it explicitly; and the trait handlers&rsquo; shared halt flag (already the single gate for the swing, its echo follow-up, the column and the hourglass lunge) includes it. The two timers are also pushed a second past the resolve, the same idiom the Regalia break uses, so the beat after a collapse is clean.</p>',
  '<p><b>The death screen.</b> The collapse reuses Gravitos&rsquo;s hazard type, and the shared resolver hardcoded <em>&ldquo;Gravitos&rsquo; Singularity Collapse&rdquo;</em> as the killer in both of its branches. It now reads the hazard&rsquo;s own label with that string as the default; the Sovereign&rsquo;s push names itself. Gravitos sets no label, so its screen is byte-for-byte unchanged.</p>',
  '<p><code>scripts/sovereign_ohko_test.mjs</code> &mdash; 6 checks against a real spawned Sovereign with its OHKO, volley and drain all forced due at once: the telegraph is 300 frames; the hazard carries the Sovereign&rsquo;s label; no volley, no pillar and no trait attack starts during the charge; a control that it attacks again once the charge ends (a window, not a silence); a control that a Gravitos-style push still credits Gravitos, resolved through the survivable 99% branch with a phase-1 Gravitos present; and dying to the Sovereign&rsquo;s collapse credits the Sovereign. On the unpatched build five of six fail.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1800 || grew > 6500) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
// Transient EPERM on this OneDrive working copy: retry the atomic rename.
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
