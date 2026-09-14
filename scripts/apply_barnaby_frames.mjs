// Confused Barnaby stops walking through his own fight.
// ============================================================================
// Per user: "he is using his walking sprite way too much, ensure that he uses
// his other sprites that are already generated ... especially when attacking or
// dashing".
//
// MEASURED FIRST (scripts/_tmp_barnaby_probe.mjs, 600 frames of a live fight):
// walk 272 draws, idle 175, attack 23, weave 0, duck 0 - so 58% of his frames
// were the walk loop and 5% were his attack art, with two of his five authored
// sets never drawn at all. His states over the same window: chase 128,
// dashIn 48, wind 35, jab 18, reposition 43, idle 196 - he WAS attacking and
// dashing; the draw just wasn't showing it.
//
// WHY. A boss counts as attacking only when it is PLANTED - `_lxPlanted` is
// "has not moved for 140 ms" - or mid brace-dash. That rule exists so a boss
// that strolls during a wind-up doesn't freeze into its attack pose. Barnaby
// moves through almost everything he does (seven separate vx writes in his AI)
// and never stamps atkAnimUntil, so he was almost never planted: his wind and
// jab fell through to the walk loop. And his dash is `dashIn`, one of the
// states that draw as movement by design, so that read as walking too.
//
// NOW. Two narrow opt-ins, both keyed to him alone:
//   - his attack states draw his attack art whether or not he is moving, the
//     same exemption the brace-dash already gets;
//   - his dash draws the WEAVE set - the lean he already has art for - instead
//     of the walk cycle, which is what a committed lunge should look like.
// Every other boss is untouched: the sets are keyed by type, so nothing else
// can take either branch.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) barnaby-frames/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the two opt-in tables, beside the move-state set they qualify --------
sub('tables', "const _BOSS_MOVE_DRAW_STATES = new Set(['chase', 'reposition', 'dashIn',",
  J("// v0.30.699 barnaby-frames - a boss draws its attack art only while PLANTED (see _lxPlanted),",
    "// which is right for bosses that stroll through a wind-up and wrong for one whose whole kit",
    "// moves: measured over 600 frames, Barnaby drew walk 272 times and attack 23, with his weave",
    "// and duck sets never drawn at all. These two tables are keyed by type, so only he takes them.",
    "const _LX_ATK_WHILE_MOVING = new Set(['young_confused_barnaby']);   // attack art even while moving",
    "const _LX_DASH_WEAVE = { young_confused_barnaby: new Set(['dashIn']) };   // the dash wears the weave lean, not the walk cycle",
    "const _BOSS_MOVE_DRAW_STATES = new Set(['chase', 'reposition', 'dashIn',"));

// ---- 2. his attacks read as attacks even while he moves ---------------------
sub('attacking', "                       && (_lxPlanted || m._braceDashing));",
  "                       && (_lxPlanted || m._braceDashing || _LX_ATK_WHILE_MOVING.has(m.type)));   // v0.30.699 barnaby-frames");

// ---- 3. his dash wears the weave set ----------------------------------------
sub('dash weave', "  const _bossWeaveImg = _bossAirborne ? _bossWeaveFrame(_bodyKey, m) : null;",
  J("  // v0.30.699 barnaby-frames - a listed dash state draws the weave lean too, not just genuine hangtime",
    "  const _lxDashWeave = !_bossAttacking && m.patternState && _LX_DASH_WEAVE[m.type] && _LX_DASH_WEAVE[m.type].has(m.patternState);",
    "  const _bossWeaveImg = (_bossAirborne || _lxDashWeave) ? _bossWeaveFrame(_bodyKey, m) : null;"));

const grew = s.length - n0;
if (grew < 700 || grew > 3000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: Barnaby's attacks and dash use their own art (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
