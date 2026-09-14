// King Gloopaloo: a crisp base, and slime balls you can actually see.
// ============================================================================
// Per user, over a video of the Gelwater Grotto fight: "for gloop the bottom
// part of the sprite is feathered off which was not intended, also for the blue
// small balls it shoots out, it is way too small, please make it bigger".
//
// 1. THE FEATHERED BASE. The edge-feather system fades any edge where the art
//    runs into the canvas border, to hide a crop. The bottom edge is excluded
//    from that everywhere - a character's feet meet the floor there, and fading
//    it dissolves the body - EXCEPT for the two types listed in
//    _LX_FEATHER_BOTTOM, which v0.29.5xx opted in because their art is cut flat
//    across the bottom. On Gloop that reads as his base melting away, which is
//    what the user is seeing: every one of his 18 idle/walk frames records a
//    bottom cut (data/sprite_edges.js: "|||11:19:29" - no left, right or top
//    cut, bottom only), so the feather is on him permanently rather than on the
//    odd frame. He comes off the list; his flat base sits on the floor line
//    with the ground shadow the draw already puts under him. Krook keeps his.
//
// 2. THE SLIME BALLS. The house rule since v0.26.170 is that a mob projectile's
//    hitbox IS its rendered diameter ("ensure the hitbox with regards to monster
//    projectiles correspond to the sprite size"), with the common band 24-31 px
//    - a mushroom's spore renders at 31. The King of all slimes threw 14 px
//    splash pellets and a 16 px glue spray: smaller than a common mob's shot,
//    which is why they read as dots. Splash goes 14 -> 28, the glue spray
//    16 -> 30, so both land in the ordinary band and the sprite (p_splash /
//    p_goo) is drawn at that diameter. His big lobbed goo (48) is untouched.
//    The hitbox grows with the art by that same rule - the ball you see is the
//    ball that hits you - and his damage per ball is unchanged.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) gloop-polish/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. his base stops dissolving --------------------------------------------
sub('feather bottom', "const _LX_FEATHER_BOTTOM = new Set(['king', 'kingKrook']);",
  J("// v0.30.701 gloop-polish - 'king' removed (per user: \"the bottom part of the sprite is feathered off",
    "// which was not intended\"). Every one of his frames records a bottom cut and nothing else, so the",
    "// opt-in faded his base on every frame instead of tidying the odd cropped one; his flat bottom now",
    "// sits on the floor line under the ground shadow the draw already puts there. Krook keeps his.",
    "const _LX_FEATHER_BOTTOM = new Set(['kingKrook']);"));

// ---- 2. the splash pellets ------------------------------------------------------
sub('splash size',
  J('            vx: i * 3 + m.facing * 2, vy: -5,',
    '            w: 14, h: 14, life: 80,'),
  J('            vx: i * 3 + m.facing * 2, vy: -5,',
    '            w: 28, h: 28, life: 80,   // v0.30.701 gloop-polish - was 14: smaller than a common mob shot (spore renders 31). Hitbox = rendered diameter (v0.26.170).'));

// ---- 3. the glue spray ----------------------------------------------------------
sub('gluespray size',
  J('          vy: vxRaw * sj + vyRaw * cj,',
    '          w: 16, h: 16, life: 90,'),
  J('          vy: vxRaw * sj + vyRaw * cj,',
    '          w: 30, h: 30, life: 90,   // v0.30.701 gloop-polish - was 16, same rule: the ball you see is the ball that hits you'));

const grew = s.length - n0;
if (grew < 400 || grew > 2500) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: Gloop's base is crisp, his splash 14->28 and glue spray 16->30 (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
