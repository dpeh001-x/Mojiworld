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
  '<h2>' + VER + ' <span class="tag"><span class="pill feat">feat</span> The parry gets its own counter-flash</span></h2>',
  '<p>Per user: <em>&ldquo;when the parry does dish damage to monsters make it have its own special effect sprite and animation&rdquo;.</em></p>',
  '<p><b>A parry damages a monster in two unrelated places, and both were wrong.</b> The first is <b>Riposte Nova</b>, the Tier-1 boon: a defended hit detonates a 150&nbsp;px shockwave. It drew <code>nova_ring</code> &mdash; which is <em>Nova Step&rsquo;s end-of-dash ring</em> &mdash; so the payoff for a perfect parry looked like a movement skill going off. The registry admitted as much in a comment: &ldquo;Riposte Nova reuses nova_ring above&rdquo;. The second is the <b>rogue&rsquo;s parry counter-strike</b>, <code>getAtk() &times; 1.6</code> into the monster that was just parried &mdash; every rogue has it from level&nbsp;1, no boon needed &mdash; and it carried no effect of its own at all. The counter landed as a plain melee hit.</p>',
  '<p><b>Now.</b> New art, generated with ludo.ai (<code>scripts/gen_parry_riposte_fx.mjs</code>): an eight-point gold-and-white parry star over a ring of outward chevrons, with struck sparks and hairline cracks in the air &mdash; a blow turned aside, not a dash. It ships with a nine-frame loop, so the centre spark flares and settles like struck steel while the chevrons pulse around the ring. The nova wears it as its shockwave <em>and</em> drops a smaller flash on each monster it actually damaged &mdash; which is the thing the request names &mdash; and the rogue counter wears a bigger one, because that hit <em>is</em> the whole move. <code>nova_ring</code> stays behind it as an <code>else</code>: if the new art ever 404s, the nova degrades to precisely the effect that shipped, never to nothing.</p>',
  '<p><b>One key, four registrations.</b> A new FX key that misses any of them is silently dead, and only one of the four is obvious. It has to reach <code>LX_FX</code> (so the base becomes an image), <code>_FX_ANIM_KEYS</code> (<code>_fxAnimFrames</code> refuses an unlisted key outright), the boot preload list &mdash; and <code>data/sprite_frame_index.js</code>. That last one is the trap: the resolver is <em>&ldquo;indexed and absent &rarr; 0, ask for nothing&rdquo;</em>, so with <code>fx/anim</code> indexed and this key missing, the nine frames would never have been <em>requested</em>, however real they are on disk. The effect would have shipped as a still image with nothing to show for it. It is also warmed at load, on the same argument the Magic Bolt burst is: a parry is a defensive basic every class owns at level&nbsp;1 and can land in the first seconds of a run, long before the staggered skill warmer reaches it.</p>',
  '<p><code>scripts/parry_fx_test.mjs</code> &mdash; 7 checks in a live fight: the sim is asserted to have stepped before anything is measured, the base image and all nine frames are decoded, <code>_lxFrameCount</code> returns 9 (the check that catches the index trap), a live Riposte Nova proc spawns <code>parry_riposte</code> and not <code>nova_ring</code>, every monster the nova damaged gets its own flash, the rogue counter-strike flashes and still deals its damage, and a control that <code>nova_ring</code> is still spawned in exactly two places &mdash; Nova Step&rsquo;s own dash, and the fallback behind the nova.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 8000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
