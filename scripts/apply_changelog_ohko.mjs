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
  '<h2>' + VER + ' <span class="tag"><span class="pill balance">balance</span> The collapse cannot be parried, both bosses go quiet around it, and Gravitos&rsquo;s comets seal healing</span></h2>',
  '<p>Per user: <em>&ldquo;ensure that the OHKO attack cannot be parried, ensure that it can be properly evaded by going into the safe zone, space out attacks such that there is no continuous attacks from the boss during and right after the OHKO attacks&rdquo;</em> and <em>&ldquo;for gravitos make some specific projectiles prevent healing effects when land &mdash; make sure to have a status that tells players that they are heal locked&rdquo;.</em></p>',
  '<p><b>No parry.</b> The block key&rsquo;s 300&nbsp;ms parry window was consumed in exactly one place: the collapse resolver&rsquo;s <em>perfect parry</em> branch, which negated the OHKO outright. It is now gated off by a named constant. The i-frame &ldquo;PHASED&rdquo; branch &mdash; a deliberate 2&ndash;2.5&nbsp;s ult or bastion grant drops you to 1&nbsp;HP and 1&nbsp;MP instead of killing you &mdash; is left as it was: a costed clutch, not a parry. The safe zone (v0.30.578&rsquo;s column test and grace) is the counter.</p>',
  '<p><b>Quiet around the collapse.</b> The Sovereign&rsquo;s charge window (v0.30.570) covered only the 5&nbsp;s telegraph, with its volley and drain pushed one second past it; it now covers the telegraph plus 2&nbsp;s, with both timers 2.5&nbsp;s past the resolve. Gravitos already held its regular rotation for 8&nbsp;s measured from the OHKO <em>cast</em> &mdash; which left 2.5&nbsp;s after a 5.5&nbsp;s singularity and <em>nothing</em> after a 13&nbsp;s collapse rain, whose next pattern could start within a second of the last box. Each OHKO pattern (singularity, rain, soul drain) now stamps its end, and the rotation also waits 2&nbsp;s from that stamp. During a telegraph nothing else fires on either boss.</p>',
  '<p><b>Heal lock.</b> There is no central heal function &mdash; twenty-five separate sites raise <code>player.hp</code> &mdash; so the only lock the next heal a parallel session adds cannot bypass is an accessor on <code>player.hp</code> itself: while sealed, any write that would <em>raise</em> hp is refused; lowering it (damage) always goes through. The player object is mutated in place (loading routes through the setter) and the accessor is enumerable, so saves still serialise hp; the lock is scoped by session clock, map and death so a reload, a portal or a respawn can never carry it. Potions are additionally refused at both chokepoints so a sealed drink is not wasted. The carrier is Gravitos&rsquo;s chase comets (10&nbsp;s on landing, per user). The status is a red <b>HEAL LOCKED</b> pill in the existing buff bar, counting down with the lock, a danger toast the moment it seals, and &mdash; per user &mdash; a countdown over the character&rsquo;s head: a struck-through heal cross whose ring drains with the seal, <b>HEAL LOCK</b>, tenths of a second and a drain bar, pulsing faster through the last two seconds. It takes the control banner&rsquo;s slot, or the one above it when both show.</p>',
  '<p><code>scripts/ohko_pass_test.mjs</code> &mdash; 10 checks: the collapse still lands with the parry armed and the player outside every zone (baseline: negated); standing in the zone survives; no Sovereign volley or pillar for 2&nbsp;s after the resolve; Gravitos&rsquo;s rotation holds &ge;&nbsp;2&nbsp;s after a collapse rain ends (the case that had no quiet at all); a comet landing refuses a direct heal and a potion while damage still lands, and the seal expires; the buff bar shows the HEAL LOCKED pill while sealed; healing works again afterwards; the seal lasts 10&nbsp;s; the countdown draws over the head and ticks down, and is gone once the seal expires.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 7000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
