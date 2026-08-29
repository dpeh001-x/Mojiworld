// CHANGELOG.html entry for v0.30.281. Newest on top, under </header>.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
if (s.includes('>v0.30.281 <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.281 <span class="tag"><span class="pill feat">feat</span> PQ pass: the Conductor hunts, the Spire demands one clean jump, stage 1 breathes</span></h2>',
  '<p>Per user, three PQ items in one pass.</p>',
  '<h3>1 &middot; The Master Conductor fights like a boss</h3>',
  '<p><b>Express Pursuit</b> &mdash; he had ticket storms, summons and two melee specials but <em>no movement of his own</em>; he ambled on the generic path while the player kited freely. He now drives at the player boxer-style (the Barnaby pattern): beyond 210px he closes at 2.2&times; speed; inside it he keeps rolling pressure so the swing and the hourglass lunge actually connect. Verified live: <b>431px &rarr; 70px in 3 seconds</b>. <b>Departure Signal</b> &mdash; a new high-damage special on the proven <code>columnStrike</code> machinery: a golden judgment column at <b>dmgMul 3.2</b> (his swing is 2.6), telegraphed 700ms so it is dodged, not eaten.</p>',
  '<h3>2 &middot; The Spire is a one-jump discipline with treacherous rifts</h3>',
  `<pre style="${PRE}"><code>air jumps on clockworkSpire   -> 0 (gear, mods and map bonuses included)`,
  'gap band                      SP_GAP_MAX 80 -> 55: the old band was sized for',
  '                              the air jump (112px reach) this rule removes;',
  '                              55 sits inside the measured 62px plain reach.',
  '                              Verified: max generated crossing 54px, 40 floors.',
  'RIFT SURGE                    void-tears now shove on ~35% of damage ticks -',
  '                              a hard push away from the rift plus a small pop,',
  '                              enough to carry a careless player off a floor.',
  '                              Measured 10-15 of 40 ticks. Spire tears only;',
  '                              Aetherion&rsquo;s cast tears are untouched.</code></pre>',
  '<h3>3 &middot; Stage-1 lag</h3>',
  '<p>Measured in the Underpass with the swarm live: <b>p95 frame time 25ms vs 8ms in the forest</b> on the same rig. Two named contributors: the asset cache-warmer colliding with the stage (already parked on strained machines by v0.30.279), and the densest swarm in the game (cap 24) on the full background stack. Relief rides the lowFx ladder: when the machine is struggling, the Underpass holds <b>16 mechs instead of 24</b> &mdash; the respawn drip backfills every kill, so the 150-kill grind paces almost identically with a third less to draw and tick. Healthy machines keep the full Ticket-Panic density. (The auto-lowFx heuristic already trips on the swarm itself, so the relief self-targets.)</p>',
  '<p><code>scripts/pq_pass_test.mjs</code> &mdash; 7 checks, all live-simulated: pursuit closure, the column trait, the jump cap on and off the Spire, every generated crossing inside plain-jump reach, the baked rift config, shove randomisation (not never, not always), and the cap relief both ways. En route it uncovered a harness truth worth recording: <code>loop()</code> parks until the loading overlay fades, so a test that walks the menus by DOM clicks must add <code>.fade</code> itself or its entire &ldquo;live&rdquo; simulation is a frozen clock.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 7000) { console.error(`ABORT: moved ${n0} -> ${s.length} (+${grew})`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG v0.30.281 (+${grew} chars)`);
