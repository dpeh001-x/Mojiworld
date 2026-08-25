// Apply the Octobaby Zakum pass to mojiworld_game.html.
// Idempotent + guarded + atomic. Written as a script rather than done by hand
// because a parallel session reset the working tree mid-edit once already and
// wiped the whole change; this makes re-applying it a single command.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('LX_OCTO_ARM_DR')) { console.log('already applied — nothing to do'); process.exit(0); }

const sub = (label, anchor, replacement) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c} times, expected 1`); process.exit(1); }
  s = s.replace(anchor, replacement);
};

// ---- 1. constants + helpers + the extracted arm spawner --------------------
const HELPERS = `// =========================================================================
// v0.30.x — OCTOBABY, THE ZAKUM PASS (per user: "improve the mechanics of
// octababy and the tentacles similar to how zakum from maplestory functions").
//
// What Zakum actually is, mechanically: a body you cannot meaningfully hurt
// while its arms live. You clear the arms, the body is exposed, you burst it,
// and the arms come back. That loop is the whole fight.
//
// Octobaby had every PART of that and none of the LOOP. Four tentacles with
// their own HP and status specials already existed, but the head's own comment
// admitted the shape of the problem — "Killed legs simply die and stop firing
// — head fight continues" — so the arms were optional scenery. A player could
// ignore all four and race the head down, which is the exact opposite of the
// Zakum read.
//
// Deliberately a SOFT gate rather than Zakum's hard untargetable body: at
// 0.55^4 the head still takes ~9% while all four arms live, so a player who
// insists on hitting the head is slowed to a crawl and taught, rather than
// hard-walled behind an IMMUNE marker for minutes.
const LX_OCTO_ARM_DR    = 0.55;    // each LIVING arm multiplies damage reaching the head
const LX_OCTO_BREAK_MUL = 2.0;     // arms all down: the exposed body takes double
const LX_OCTO_BREAK_MS  = 9000;    // how long that exposed window stays open
const LX_OCTO_REGROW_MS = 7000;    // ...then the stumps writhe for this long
const LX_OCTO_ARM_GEN_HP = 0.7;    // each regrown generation is weaker, so the loop CONVERGES
// Living arms. _legRefs is spliced by the death handler, so its length is the
// count — but read defensively: it is empty for one tick before _octoInit runs.
function _lxOctoArmsAlive(m) {
  return (m && m._octoInit === true && Array.isArray(m._legRefs)) ? m._legRefs.length : 0;
}
// Extracted from the inline _octoInit block so the head can grow arms TWICE:
// once at fight start, and again after every exposed window. \`gen\` is the
// regrowth generation — 0 is the original set.
function _lxOctoSpawnArms(m, gen) {
  const LEG_TYPES = [
    'octoLegPoison', 'octoLegFreeze', 'octoLegSkillLock', 'octoLegStun',
    'octoLegPoison', 'octoLegFreeze', 'octoLegSkillLock', 'octoLegStun',
  ];
  // v0.29.949 scale and v0.25.599 count are both explicit user tuning calls —
  // "reduce the size of the octababy tenctacles" and "asked for 4". Neither is
  // changed here; this pass is about what the arms MEAN, not how many.
  const HUMONGOUS_SCALE = 1.7;
  const LEG_COUNT = 4;
  const _hpMul = Math.pow(LX_OCTO_ARM_GEN_HP, Math.max(0, gen | 0));
  for (let i = 0; i < LEG_COUNT; i++) {
    const a = (i / LEG_COUNT) * Math.PI * 2 + Math.PI / 8;
    const lt = monsterTypes[LEG_TYPES[i]];
    const legW = Math.floor(lt.w * HUMONGOUS_SCALE);
    const legH = Math.floor(lt.h * HUMONGOUS_SCALE);
    const legX = m.x + m.w / 2 + Math.cos(a) * (m.w * 0.85);
    const legY = m.y + m.h / 2 + Math.abs(Math.sin(a)) * (m.h * 0.55);
    const _legHp = Math.max(1, Math.floor(lt.hp * _hpMul));
    const leg = {
      type: LEG_TYPES[i],
      ...lt,
      w: legW, h: legH,
      x: legX - legW / 2, y: legY - legH / 2,
      vx: 0, vy: 0,
      currentHp: _legHp, maxHp: _legHp,
      facing: 1, onGround: false,
      hitFlash: 0, burnTimer: 0, burnDmg: 0,
      stunTimer: 0, freezeTimer: 0,
      animTimer: i * 12,
      aggroTarget: null, aggroRange: 0,
      isBoss: false, isMiniBoss: false, isElite: false,
      attackTimer: 0, attackCooldown: 0,
      patternTimer: i * 600,
      patternState: 'idle',
      _octoLegIndex: i,
      _octoParent: m,
      _octoAngle: a,
      _octoFireCd: 5500,
      _octoFireT: i * 600,
      _octoFireFlash: 0,
      _octoArmGen: gen | 0,
      // A regrown arm rises with the head already loose in phase 2; without
      // this it would inherit the anchored orbit and stand still in a frenzy.
      _octoLoose: !!m._octoLoose,
    };
    // Regrown arms surface with a burst so they are never mistaken for
    // something that was quietly there the whole time.
    if (gen) for (let _p = 0; _p < 14; _p++) {
      game.particles.push({
        x: legX, y: legY, vx: (Math.random() - 0.5) * 8, vy: -2 - Math.random() * 4,
        life: 38, color: leg.color || '#cc66ee', size: 3,
      });
    }
    game.monsters.push(leg);
    m._legRefs.push(leg);
  }
}
function hitMonster(m, dmg, isCrit, skill) {`;
sub('helpers', 'function hitMonster(m, dmg, isCrit, skill) {', HELPERS);

// ---- 2. the inline spawn loop becomes a call -------------------------------
const OLD_LOOP_START = '      const LEG_TYPES = [';
const iStart = s.indexOf(OLD_LOOP_START);
const iEnd = s.indexOf('        m._legRefs.push(leg);\n      }\n    }', iStart);
if (iStart < 0 || iEnd < 0) { console.error('ABORT: could not bound the inline spawn loop'); process.exit(1); }
const tail = '        m._legRefs.push(leg);\n      }\n    }';
s = s.slice(0, iStart) +
`      // v0.30.x — the body of this loop moved to _lxOctoSpawnArms (above
      // hitMonster) because the head now grows arms MORE THAN ONCE: the Zakum
      // loop regrows them after every exposed window, and two copies of a
      // 40-line entity literal would drift apart the first time one was tuned.
      m._octoArmGen = 0;
      _lxOctoSpawnArms(m, 0);
    }` + s.slice(iEnd + tail.length);

// ---- 3. the damage gate ---------------------------------------------------
sub('gate', 'if (m._virgoChanneling) dmg = Math.max(1, Math.floor(dmg * 0.4));',
`if (m._virgoChanneling) dmg = Math.max(1, Math.floor(dmg * 0.4));
  // v0.30.x — OCTOBABY: THE ARMS GATE THE BODY (see LX_OCTO_ARM_DR above).
  // This is the line that makes it a Zakum fight rather than four optional
  // side-monsters: while arms live the head sheds damage exponentially in the
  // number of them, and with all four down it takes DOUBLE for the length of
  // the exposed window. Marked on screen both ways — an unexplained 9% would
  // read as a bug, and the whole point is to TEACH "kill the arms".
  if (m.type === 'octobaby') {
    const _arms = _lxOctoArmsAlive(m);
    if (_arms > 0) {
      dmg = Math.max(1, Math.floor(dmg * Math.pow(LX_OCTO_ARM_DR, _arms)));
      if ((game.time | 0) - (m._octoArmMarkT | 0) > 40) {
        m._octoArmMarkT = game.time | 0;
        game.damageNumbers.push({ x: m.x + m.w / 2 - 30, y: m.y - 30, vy: -1.6,
          text: '\\u{1F991} ARMOURED x' + _arms, life: 30, color: '#cc66ee', size: 12 });
      }
    } else if ((m._octoBreakT || 0) > 0) {
      dmg = Math.max(1, Math.floor(dmg * LX_OCTO_BREAK_MUL));
      if ((game.time | 0) - (m._octoArmMarkT | 0) > 40) {
        m._octoArmMarkT = game.time | 0;
        game.damageNumbers.push({ x: m.x + m.w / 2 - 26, y: m.y - 30, vy: -1.8,
          text: '\\u{1F4A5} EXPOSED', life: 30, color: '#ffdd55', size: 13 });
      }
    }
  }`);

// ---- 4. the loop: break window, then regrowth ------------------------------
sub('loop', 'if (m._octoInit === true && Array.isArray(m._legRefs) && m._legRefs.length === 0) {',
`// \u2500\u2500 v0.30.x — THE ZAKUM LOOP. Clear the arms, burst the exposed body,
    // the arms come back. Before this, severing all four ended the fight's
    // structure: the head's own comment said "Killed legs simply die and stop
    // firing — head fight continues", so the last minutes were a flat DPS race
    // on a stationary target. Now the moment the fourth arm falls the body is
    // EXPOSED at double damage — then the stumps writhe and a fresh set rises,
    // each generation at 70% of the last one's HP so the loop tightens rather
    // than running forever.
    if (m._octoInit === true && Array.isArray(m._legRefs) && m._legRefs.length === 0
        && !m._octoBroken && (m._octoRegrowT || 0) <= 0) {
      m._octoBroken = true;
      m._octoBreakT = LX_OCTO_BREAK_MS;
      showToast('\u{1F419} EVERY ARM SEVERED — THE BODY IS EXPOSED!', 'legendary');
      flash(0.35); addShake(10);
    }
    if ((m._octoBreakT || 0) > 0) {
      m._octoBreakT -= dt;
      if (m._octoBreakT <= 0) {
        m._octoBreakT = 0;
        m._octoRegrowT = LX_OCTO_REGROW_MS;
        showToast('\u{1F991} The stumps writhe — new arms are coming', 'epic');
        addShake(6);
      }
    } else if ((m._octoRegrowT || 0) > 0) {
      m._octoRegrowT -= dt;
      if (m._octoRegrowT <= 0) {
        m._octoRegrowT = 0;
        m._octoBroken = false;
        m._octoArmGen = (m._octoArmGen | 0) + 1;
        _lxOctoSpawnArms(m, m._octoArmGen);
        showToast('\u{1F419} OCTOBABY REGROWS ITS ARMS', 'legendary');
        flash(0.25); addShake(8);
      }
    }
    if (m._octoInit === true && Array.isArray(m._legRefs) && m._legRefs.length === 0) {`);

for (const c of s) if (c.charCodeAt(0) >= 0xD800 && c.charCodeAt(0) <= 0xDBFF) { /* surrogate pairs are fine */ }
writeFileSync(F + '.tmp', s, 'utf8');
const n = statSync(F + '.tmp').size;
if (n <= n0) { console.error(`ABORT: tmp ${n}B is not larger than original ${n0}B`); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: ${n0} -> ${s.length} chars (+${s.length - n0})`);
