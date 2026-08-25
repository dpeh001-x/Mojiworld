// Octobaby follow-up: way tankier tentacles + a 30s status-ailment pulse.
// Per user: "make sure that the tentacles are way tankier, more HP and
// occasionally inflicts status ailments to player every 30 seconds".
// Guarded + atomic + idempotent, same as apply_octo_zakum.mjs.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('LX_OCTO_AILMENT_MS')) { console.log('already applied — nothing to do'); process.exit(0); }
if (!s.includes('LX_OCTO_ARM_DR')) { console.error('ABORT: apply_octo_zakum.mjs must run first'); process.exit(1); }

// ---- 1. HP: 50k -> 400k on all four tentacle types ------------------------
// Every hp:50000, in the file is one of the four octoLeg* types; the guard
// below is what makes that safe to assert rather than assume.
const HP_OLD = 'hp:50000,', HP_NEW = 'hp:400000,';
const hpCount = s.split(HP_OLD).length - 1;
if (hpCount !== 4) { console.error(`ABORT: expected 4 '${HP_OLD}', found ${hpCount}`); process.exit(1); }
s = s.split(HP_OLD).join(HP_NEW);

// ---- 2. the ailment pulse -------------------------------------------------
const A_ANCHOR = 'const LX_OCTO_ARM_GEN_HP = 0.7;    // each regrown generation is weaker, so the loop CONVERGES';
if (s.split(A_ANCHOR).length - 1 !== 1) { console.error('ABORT: ailment anchor not unique'); process.exit(1); }
s = s.replace(A_ANCHOR, A_ANCHOR + `
// v0.30.x — THE EIGHT MOODS (per user: the tentacles should "occasionally
// inflict status ailments to player every 30 seconds"). Each arm already owned
// a status, but only ever delivered it on a dodgeable projectile every 5.5s —
// so a player who kept moving could take an entire Octobaby fight without ever
// being poisoned, frozen, silenced or shocked, and the boss's whole identity as
// the Eight-Mood Tyrant never actually landed.
// This is a scheduled PULSE instead: on the cadence below every LIVING arm
// speaks its mood at once. Telegraphed 1.2s ahead so it is a brace-and-cleanse
// moment rather than an ambush, and it scales with the fight — clear the arms
// and there is nothing left to inflict anything, which is the same lesson the
// damage gate teaches. The stun leg still honours getStunResist(), so stun
// resistance keeps meaning what it means everywhere else.
const LX_OCTO_AILMENT_MS = 30000;   // one pulse every 30s
const LX_OCTO_AILMENT_TELE_MS = 1200;
function _lxOctoMoodPulse(head) {
  const arms = Array.isArray(head._legRefs) ? head._legRefs : [];
  if (!arms.length) return 0;
  if (typeof player === 'undefined' || !player || player.hp <= 0) return 0;
  const spoke = [];
  for (const leg of arms) {
    if (!leg || leg.currentHp <= 0) continue;
    if (leg.type === 'octoLegPoison') {
      player._poisonTimer = Math.max(player._poisonTimer || 0, 5000);
      player._poisonDmg = Math.max(player._poisonDmg || 0, Math.max(1, Math.floor((leg.atk || 120) * 0.25)));
      spoke.push('\u2620 POISON');
    } else if (leg.type === 'octoLegFreeze') {
      player.freezeTimer = Math.max(player.freezeTimer || 0, 1400);
      spoke.push('\u2744 FREEZE');
    } else if (leg.type === 'octoLegSkillLock') {
      player._skillLockTimer = Math.max(player._skillLockTimer || 0, 3500);
      spoke.push('\u{1F512} SILENCE');
    } else {
      const _mul = (typeof getStunResist === 'function') ? (1 - getStunResist()) : 1;
      const _ms = Math.floor(1500 * Math.max(0, _mul));
      if (_ms > 0) player.stunTimer = Math.max(player.stunTimer || 0, _ms);
      spoke.push('\u26A1 SHOCK');
    }
    leg._octoFireFlash = 12;
    for (let _p = 0; _p < 10; _p++) {
      game.particles.push({
        x: leg.x + leg.w / 2, y: leg.y + leg.h / 2,
        vx: (Math.random() - 0.5) * 6, vy: -1 - Math.random() * 3,
        life: 30, color: leg.color || '#cc66ee', size: 3,
      });
    }
  }
  if (spoke.length) {
    showToast('\u{1F419} EIGHT MOODS: ' + spoke.join('  '), 'legendary');
    addShake(7); flash(0.18);
  }
  return spoke.length;
}`);

// ---- 3. tick the pulse from the head's AI ----------------------------------
const T_ANCHOR = `    // \u2500\u2500 v0.30.x — THE ZAKUM LOOP.`;
if (s.split(T_ANCHOR).length - 1 !== 1) { console.error('ABORT: tick anchor not unique'); process.exit(1); }
s = s.replace(T_ANCHOR, `    // v0.30.x — mood cadence. Ticked here, inside the same block as the Zakum
    // loop, so it shares the head's AI gating: a staggered or submerged head is
    // not silently building toward a pulse the player cannot see coming.
    m._octoMoodT = (m._octoMoodT || 0) + dt;
    if (!m._octoMoodTele && m._octoMoodT >= LX_OCTO_AILMENT_MS - LX_OCTO_AILMENT_TELE_MS) {
      m._octoMoodTele = true;
      showToast('\u{1F419} THE MOODS RISE \u2014 brace', 'epic');
      addShake(3);
    }
    if (m._octoMoodT >= LX_OCTO_AILMENT_MS) {
      m._octoMoodT = 0; m._octoMoodTele = false;
      _lxOctoMoodPulse(m);
    }
` + T_ANCHOR);

writeFileSync(F + '.tmp', s, 'utf8');
const n = statSync(F + '.tmp').size;
if (n <= n0) { console.error(`ABORT: tmp ${n}B not larger than original ${n0}B`); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: ${n0} -> ${s.length} chars (+${s.length - n0}); tentacle HP 50000 -> 400000 (x8)`);
