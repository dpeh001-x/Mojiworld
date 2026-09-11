// Sovereign of the Spire: a longer window to evade the collapse, nothing else
// fired while it charges, and the death screen names the right boss.
// =============================================================================
// Per user: "sovereign of the spire, needs more time interval to evade the
// OHKO attack, should not do any other attacks when doing the OHKO attack,
// also when dying to OHKO attack it mentions death by gravitos".
//
// 1. EVADE WINDOW. The collapse is a gravitos_singularity hazard whose `life`
//    IS the telegraph: 210 frames = 3.5 s to reach one of three safe zones
//    (which also shrink per phase, 110 -> 95 -> 82 px). 210 -> 300 frames
//    (5.0 s, +43%). The SPENT window that punishes the Sovereign after the
//    collapse resolves is expressed as telegraph + 150, so it moves with it,
//    and the held 'collapse' pose (frames) is scaled to match. The warning
//    ring already draws from life / maxLife, so it adapts on its own.
//
// 2. NOTHING ELSE DURING THE CHARGE. The Sovereign's other attacks are the
//    homing volley and the drain pillar (scheduled in _bossSpecialAttacks) and
//    two trait attacks - the 2.8x bigMelee swing (with its echoStrike
//    follow-up) and the columnStrike beam. A note in the fire block says no
//    suppression is needed because the type "doesn't carry bigMelee /
//    columnStrike traits"; that is stale - the current type line carries
//    both. So: the fire block stamps m._sovCollapseUntil for the length of the
//    telegraph; the volley and drain gates test it; and the trait handlers'
//    shared _ccHalted flag (already the single gate for bigMelee and
//    columnStrike) includes it. The volley/drain timers are also pushed past
//    the resolve so the first second after a collapse is clean - the same
//    idiom the Regalia break already uses.
//
// 3. THE DEATH SCREEN. The resolver is shared with Gravitos and hardcodes
//    "Gravitos' Singularity Collapse" as the killer in both its branches. It
//    now reads h._sourceLabel with that string as the default, and the
//    Sovereign's push sets the label. Gravitos's own pushes set none, so its
//    screen is unchanged.
//
// Guarded + atomic + idempotent. EOL-aware (multi-line anchors joined with
// the file's own ending).
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_sovCollapseUntil')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

const TEL = 300;   // telegraph frames (was 210)

// ---- 1. the telegraph, the SPENT window, the held pose --------------------
sub('telegraph', '        life: 210, maxLife: 210,              // 3.5 s telegraph',
  `        life: ${TEL}, maxLife: ${TEL},              // v0.30.570 sov-ohko — 5.0 s telegraph (was 210 = 3.5 s; per user: more time to evade)`);
sub('spent window', '      m._sovSpentUntil = (game.time | 0) + 210 + 150;',
  J(`      m._sovSpentUntil = (game.time | 0) + ${TEL} + 150;   // v0.30.570 sov-ohko — telegraph + 2.5 s, moves with the telegraph`,
    '      // v0.30.570 sov-ohko — while the collapse charges the Sovereign does nothing',
    '      // else (per user). Read by the volley + drain gates and by the trait',
    "      // handlers' shared _ccHalted. The two timers are also pushed past the",
    '      // resolve so the first second after a collapse is a clean beat, the',
    '      // same idiom the Regalia break uses.',
    `      m._sovCollapseUntil = (game.time | 0) + ${TEL};`,
    `      m._sovereignHomingAt = Math.max(m._sovereignHomingAt | 0, (game.time | 0) + ${TEL} + 60);`,
    `      m._sovereignDrainAt  = Math.max(m._sovereignDrainAt | 0,  (game.time | 0) + ${TEL} + 60);`));
sub('held pose', "_lxSovAtkPose(m, 'collapse', 200)", "_lxSovAtkPose(m, 'collapse', 290)");

// ---- 3. the Sovereign's push names itself ----------------------------------
sub('push label', "        type: 'gravitos_singularity',         // reuse renderer + resolve path",
  J("        type: 'gravitos_singularity',         // reuse renderer + resolve path",
    "        _sourceLabel: 'the Sovereign\\'s Singularity Collapse',   // v0.30.570 sov-ohko — the shared resolver used to credit Gravitos"));

// ---- 2. gates: volley, drain, and the trait handlers' shared halt ----------
sub('volley gate',
  "      !m._sovShielded && !m._sovExposedUntil && !m._sovSpentUntil) {   // v0.29.570 — shard-focus and the burn window are REAL windows",
  "      !m._sovShielded && !m._sovExposedUntil && !m._sovSpentUntil && !((m._sovCollapseUntil | 0) > (game.time | 0))) {   // v0.29.570 — shard-focus and the burn window are REAL windows; v0.30.x — and so is the collapse charge");
sub('drain gate',
  "      !m._sovShielded && !m._sovExposedUntil) {   // v0.29.570 — same reason as the volley",
  "      !m._sovShielded && !m._sovExposedUntil && !((m._sovCollapseUntil | 0) > (game.time | 0))) {   // v0.29.570 — same reason as the volley; v0.30.x — and the collapse charge");
sub('trait halt',
  "      || (m._stagger > 0) || (m._dirOpenT > 0);   // v0.30.x — the opening was only a START gate; a latched swing resolved into it",
  J("      || (m._stagger > 0) || (m._dirOpenT > 0)   // v0.30.x — the opening was only a START gate; a latched swing resolved into it",
    "      || ((m._sovCollapseUntil | 0) > (game.time | 0));   // v0.30.570 sov-ohko — the Sovereign's swing / echo / column stay holstered while its collapse charges"));

// hourglassCharge: gate it too if its condition does not already honour _ccHalted
{
  const hg = "    if (m.traits && m.traits.hourglassCharge > 0 && (!m.isBoss || m.traits.activeBoss)";
  const i = s.indexOf(hg);
  if (i < 0) { console.error('ABORT hourglass: anchor missing'); process.exit(1); }
  const cond = s.slice(i, i + 400);
  if (!cond.includes('_ccHalted')) {
    s = s.slice(0, i) + hg + ' && !_ccHalted' + s.slice(i + hg.length);
  }
}

// ---- 3. the resolver reads the label, Gravitos stays the default -----------
sub('resolver label',
  "player._lastDamageSource = 'Gravitos\\' Singularity Collapse';",
  "player._lastDamageSource = h._sourceLabel || 'Gravitos\\' Singularity Collapse';   // v0.30.570 sov-ohko — the Sovereign reuses this hazard",
  2);

const grew = s.length - n0;
if (grew < 900 || grew > 2600) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: sovereign ohko — telegraph ${TEL}f, collapse-charge gate, self-labelled death (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
