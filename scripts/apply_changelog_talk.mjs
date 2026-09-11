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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The NPC prompt is a translucent pill with a key cap, and it fades instead of popping</span></h2>',
  '<p>Per user (with a screenshot of the prompt): <em>&ldquo;The N talk should be much more aesthetically designed &mdash; make it semi translucent&rdquo;.</em></p>',
  '<p><b>Was:</b> <code>[N] Talk</code> as bare bold yellow text with a bob, drawn the frame you came within 70&nbsp;px of an NPC and gone the frame you left. <b>Now:</b> a pill at half alpha in the name plate&rsquo;s ink, bordered in the NPC&rsquo;s own tint with a soft halo outside it; a key cap on the left &mdash; a rounded square with a white rim and a darker bottom edge so it reads as a key &mdash; carrying a bold <kbd>N</kbd>; and <b>Talk</b> in the plate&rsquo;s cream with a one-pixel shadow. It keeps the bob, breathes gently, and eases in and out over about eight frames instead of popping. The chest and portal prompts are untouched; only the NPC prompt was asked for.</p>',
  '<p><code>scripts/talk_prompt_test.mjs</code> &mdash; 4 checks: next to an NPC the prompt draws its key cap <code>N</code> and <code>Talk</code> as separate labels over a filled pill (baseline: one bare <code>[N] Talk</code> string, no fill); the pill&rsquo;s fill is translucent (alpha 0.5; baseline: no pill); stepping away, the prompt keeps drawing for several frames at falling alpha before it is gone (baseline: gone the same frame); away from every NPC nothing is drawn.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1200 || grew > 5000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
