// v0.30.281 — PQ pass: the Conductor hunts, the Spire demands one clean jump.
// =============================================================================
// Per user, for the PQ:
//  1. "master conductor boss should chase player aggressively and does special
//     attack that dish high damage"
//  2. "in stage 2 where it is the jump quest, the player is only limited to
//     1 jump, and the purple dimensional rift portals that damage players
//     should be randomised to occasionally knock players off the ledge"
//
// 1a. EXPRESS PURSUIT. The Conductor had storms/summons/bigMelee/hourglass
//     but NO movement of his own — he ambled on the generic path. He now
//     drives at the player boxer-style (the young_confused_barnaby pattern):
//     outside 210px he closes at 2.2x speed; inside 90-210px he keeps rolling
//     pressure so bigMelee and the hourglass lunge connect.
// 1b. DEPARTURE SIGNAL. columnStrike trait added — the same proven machinery
//     archon/blightElder/ossuaryTyrant/pathsBane already run — at dmgMul 3.2
//     (his bigMelee is 2.6): a telegraphed 700ms vertical column that hits
//     HARD but announces itself. Reuses the Arbiter's golden column art —
//     the golden judgment of a missed departure.
//
// 2a. ONE JUMP. _lxAirJumpCap() returns 0 on clockworkSpire — no air jumps
//     from gear, mods or map bonuses. The jump quest becomes a discipline of
//     single clean jumps.
// 2b. GAP REFIT — the change that makes 2a FAIR rather than impossible. The
//     v0.29.849 gap budget (20-80px) was built around the air jump: measured
//     in-engine reach is 62px plain, 112px with the air jump, so gaps beyond
//     62px REQUIRED the second jump this change removes. SP_GAP_MAX 80 -> 55
//     keeps every crossing inside plain-jump reach with a 7px margin.
// 2c. RIFT SURGE. Spire void-tears (and only them - _sourceLabel guards
//     Aetherion's cast tears) now have a 35% chance per damage tick to SHOVE:
//     a strong horizontal push away from the rift centre plus a small pop,
//     enough to carry a careless player off a narrow floor. Randomised, so
//     brushing a rift is sometimes just damage and sometimes a fall.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

if (s.includes('EXPRESS PURSUIT') || s.includes('RIFT SURGE')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1b. Departure Signal: high-damage telegraphed column -------------------
sub('conductor column trait',
  "      bigMelee:{ kind:'swing', dmgMul:2.6, range:170, swingW:260, swingH:100, cdMs:4800, telegraphMs:550 },",
  J("      bigMelee:{ kind:'swing', dmgMul:2.6, range:170, swingW:260, swingH:100, cdMs:4800, telegraphMs:550 },",
    "      // v0.30.281 — DEPARTURE SIGNAL (per user: 'special attack that dish",
    "      // high damage'). Proven columnStrike machinery; dmgMul 3.2 out-hits",
    "      // his 2.6x swing, telegraphed 700ms so it is dodged, not eaten.",
    "      // Arbiter's golden column art — the judgment of a missed departure.",
    "      columnStrike:{ dmgMul:3.2, width:130, range:620, cdMs:6500, telegraphMs:700, color:'#ffd866', sprite:'fx_col_arbiter' },"));

// ---- 1a. Express Pursuit: aggressive chase ---------------------------------
// Placed INSIDE bossAI (before the barnaby branch): _bossSpecialAttacks runs
// BEFORE bossAI each frame, so a vx written there is overwritten by bossAI's
// baseline movement - measured as zero net motion. In bossAI it wins, exactly
// like barnaby's boxer drive one branch below.
sub('conductor chase',
  "  } else if (m.type === 'young_confused_barnaby') {",
  J("  } else if (m.type === 'pqConductor') {",
    "    // v0.30.281 - EXPRESS PURSUIT (per user: 'chase player aggressively').",
    "    // He had storms, summons and two melee specials but no drive of his",
    "    // own. Boxer-style (the barnaby pattern one branch down): close hard",
    "    // from range, keep rolling pressure inside it so bigMelee + the",
    "    // hourglass lunge connect.",
    "    if (m.currentHp > 0 && player && player.hp > 0",
    "        && (m.stunTimer || 0) <= 0 && (m.freezeTimer || 0) <= 0) {",
    "      const _ccPcx = (player.x || 0) + (player.w || 28) / 2;",
    "      const _ccDx = _ccPcx - (m.x + m.w / 2);",
    "      const _ccTo = _ccDx >= 0 ? 1 : -1;",
    "      const _ccAdx = Math.abs(_ccDx);",
    "      m.facing = _ccTo;",
    "      m.patternState = 'chase';",
    "      if (_ccAdx > 210)     m.vx = _ccTo * (m.speed || 2.6) * 2.2;",
    "      else if (_ccAdx > 90) m.vx = _ccTo * (m.speed || 2.6) * 0.9;",
    "    }",
    "  } else if (m.type === 'young_confused_barnaby') {"));

// ---- 2a. one jump on the Spire ----------------------------------------------
sub('spire air-jump cap',
  "  const own = 1 + ((player.mods && player.mods.extraJumps) || 0) + ((md && md.bonusJumps) || 0);",
  J("  // v0.30.281 — the Spire jump quest is a ONE-JUMP discipline (per user:",
    "  // 'the player is only limited to 1 jump'). No air jumps from gear, mods",
    "  // or map bonuses; the gap band is refit to plain-jump reach (SP_GAP_MAX",
    "  // 80 -> 55 against the measured 62px plain reach) so it stays fair.",
    "  if (game && game.currentMap === 'clockworkSpire') return 0;",
    "  const own = 1 + ((player.mods && player.mods.extraJumps) || 0) + ((md && md.bonusJumps) || 0);"));

// ---- 2b. gap refit ----------------------------------------------------------
sub('spire gap max',
  "    const SP_GAP_MAX = 80;",
  "    const SP_GAP_MAX = 55;   // v0.30.281 — was 80, sized for the air jump (112px reach) the one-jump rule removes; 55 sits inside the measured 62px plain-jump reach");

// ---- 2c. rift surge ---------------------------------------------------------
sub('rift surge',
  "            player.invulnerable = Math.max(player.invulnerable, 400);",
  J("            player.invulnerable = Math.max(player.invulnerable, 400);",
    "            // v0.30.281 — RIFT SURGE (per user: 'randomised to occasionally",
    "            // knock players off the ledge'). Spire tears only — the",
    "            // _sourceLabel guards Aetherion's cast tears, which live on",
    "            // arena ground where a shove would be noise. 35% per damage",
    "            // tick: a hard horizontal push away from the rift centre plus",
    "            // a small pop, enough to carry a player off a narrow floor.",
    "            if (h._sourceLabel === 'a Spire void-tear' && Math.random() < 0.35) {",
    "              const _kdir = ((player.x + player.w / 2) >= h.cx) ? 1 : -1;",
    "              player.vx = _kdir * (7 + Math.random() * 4);",
    "              player.vy = Math.min(player.vy || 0, -3.5);",
    "              if (typeof addShake === 'function') addShake(4);",
    "              if (game.damageNumbers) game.damageNumbers.push({ x: player.x + 10, y: player.y - 12, vy: -2, text: 'RIFT SURGE!', life: 34, color: '#cc66ff', size: 12 });",
    "            }"));

// ---- version bump -----------------------------------------------------------
sub('version', "GAME_VERSION = 'v0.30.280'", "GAME_VERSION = 'v0.30.281'");

const grew = s.length - n0;
if (grew < 1800 || grew > 5200) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew}), expected roughly +3400`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: PQ pass — pursuit + departure signal + one-jump spire + gap refit + rift surge, v0.30.281 (+${grew})`);
