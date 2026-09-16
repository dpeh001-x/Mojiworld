// Knight GUARDIAN: a grander cast emblem, animated, and much larger.
// ============================================================================
// Per user: "For knight's skill guarding skill sprite and animation need to be larger and grander,
// more grandiose looking, ensure no cutoffs of canvas edges" (using ludo.ai).
//
// WHAT IT WAS. One STATIC sprite - a gold cross in a glowing ring - at size 180 for 50 frames, grown
// 0.5x -> 1.1x, drawn OVER the knight. (The spawnFx('warrior','shieldBash') beside it is a no-op:
// FX_CATALOG is empty, so the sprite was the whole effect.)
//
// WHAT IT IS. New art from scripts/gen_knight_guardian_fx.mjs: a gold heraldic tower shield with a
// cross crest, two vast wings of light and a spiked rune halo, with a 9-frame loop (the wings beat,
// the halo pulses plate by plate, the crest glows). Every frame was measured clear of its canvas
// border before it was written, and the static fallback is the loop's own frame 0.
//
// In game: size 180 -> 400 on a stately 0.78 -> 1.06 swell (312 -> 424 px, against 90 -> 198 before),
// 50 -> 84 frames, looping every 5 frames. It is drawn BEHIND the entity layer and FOLLOWS the knight:
// at 400 px an emblem on top would bury the knight and every foe beside it, and a cast point left
// behind by a moving knight would read as a dropped decal rather than the knight's own guardian.
//
// Registration, all three of which fail silently if missed: the key goes in _FX_ANIM_KEYS (unlisted
// keys never request frames), the frame index gets "knight_guardian": 9 (an indexed dir answers 0
// for an absent key), and _LX_SKILL_FX warms the set when the character can cast Guardian.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
const IDX = process.env.LX_INDEX_FILE || 'C:/Users/dpeh0/Mojiworld/data/sprite_frame_index.js';

let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) kg-grand/.test(s)) {
  console.log('game file: already applied');
} else {
  const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
  const EOL = crlf > lf / 2 ? '\r\n' : '\n';
  const J = (...L) => L.join(EOL);
  const sub = (label, anchor, after, expect) => {
    const c = s.split(anchor).length - 1;
    if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
    s = s.split(anchor).join(after);
  };

  // ---- 1. the loop is allowed to load ----------------------------------------------
  sub('anim key',
    "  'ground_slam',    // v0.30.740 — the warrior A landing (anim/ground_slam_0..8, ludo.ai via gen_ground_slam_fx.mjs)",
    J("  'ground_slam',    // v0.30.740 — the warrior A landing (anim/ground_slam_0..8, ludo.ai via gen_ground_slam_fx.mjs)",
      "  'knight_guardian',   // v0.30.769 kg-grand — the Guardian aegis: wings beat, halo pulses (anim/knight_guardian_0..8, ludo.ai via gen_knight_guardian_fx.mjs)"));

  // ---- 2. warmed with the rest of what this character can cast -----------------------
  // Anchored on the table's opening line, not a neighbouring entry: a parallel session extended the
  // crusader_ult entry between the review and the first ship attempt, and that exact-line anchor missed.
  sub('prewarm',
    "const _LX_SKILL_FX = {",
    J("const _LX_SKILL_FX = {",
      "  guardian: ['knight_guardian'],   // v0.30.769 kg-grand — Guardian has a loop of its own now"));

  // ---- 3. the static entry says where its frames come from --------------------------
  sub('LX_FX entry',
    "    knight_guardian:   'knight_guardian.webp',",
    "    knight_guardian:   'knight_guardian.webp',   // v0.30.769 kg-grand — frame 0 of anim/knight_guardian_0..8 (gen_knight_guardian_fx.mjs)");

  // ---- 4. the cast itself --------------------------------------------------------------
  sub('cast',
    J('    // v0.25.215 — divine shield-bubble sprite at the player\'s chest as',
      '    // the guardian buff ignites. Held visible ~50 frames.',
      "    spawnSpriteBurst(player.x + player.w / 2, player.y + player.h / 2, 'knight_guardian',",
      '      { size: 180, life: 50 });'),
    J('    // v0.25.215 — divine shield-bubble sprite at the player\'s chest as',
      '    // the guardian buff ignites.',
      '    // v0.30.769 kg-grand — per user: "need to be larger and grander, more grandiose looking". The',
      '    // winged aegis loop at 400 on a stately 0.78 -> 1.06 swell (312 -> 424 px; was a static 90 -> 198),',
      '    // held 84 frames and looping every 5. BEHIND the entity layer so it frames the knight instead of',
      '    // burying the knight and every foe beside it at this size, and FOLLOWING the knight so a cast on',
      '    // the move is not left behind as a decal. pivotY 0.86 seats the knight at the foot of the aegis so it',
      '    // RISES behind them - centred on the chest, a knight standing on low ground had the bottom third of',
      '    // the emblem cut off by the bottom of the screen - and clampView keeps all of it on screen anywhere.',
      "    spawnSpriteBurst(player.x + player.w / 2, player.y + player.h / 2, 'knight_guardian',",
      '      { size: 400, life: 84, frameGap: 5, behind: true, follow: player, pivotY: 0.86, clampView: true,',   // the burst fade starts at 60% of life: ~34 frames at full strength
      '        scaleStartX: 0.78, scaleEndX: 1.06, scaleStartY: 0.78, scaleEndY: 1.06 });'));

  // ---- 5. the burst carries the new flag ---------------------------------------------
  sub('spawn flag',
    "    follow: opts.follow || null,   // v0.30.398 — an entity to ride: the burst re-centres on it every step",
    J("    follow: opts.follow || null,   // v0.30.398 — an entity to ride: the burst re-centres on it every step",
      '    // v0.30.769 kg-grand — keep the whole sprite on screen: the draw nudges it back inside the view',
      '    // instead of letting the screen edge cut it. Opt-in; every existing burst is unchanged.',
      '    clampView: !!opts.clampView,'));

  // ---- 6. ...and the draw honours it -------------------------------------------------
  sub('draw clamp',
    J('      ctx.globalAlpha = (fx.fadeOut ? alpha * Math.max(0, 1 - t * fx.fadeOut) : alpha) * _opa;',
      '      ctx.translate(sx, fx.y);'),
    J('      ctx.globalAlpha = (fx.fadeOut ? alpha * Math.max(0, 1 - t * fx.fadeOut) : alpha) * _opa;',
      '      // v0.30.769 kg-grand — clampView: shift the box back inside the view (screen x, world y under the',
      '      // camera-y translate) rather than let the screen edge slice a large emblem. The box is the',
      '      // same one drawImage fills below, measured about the same pivot.',
      '      let _cvx = sx, _cvy = fx.y;',
      '      if (fx.clampView) {',
      '        const _cpx = (fx.pivotX != null ? fx.pivotX : 0.5), _cpy = fx.anchorBottom ? 1 : (fx.pivotY != null ? fx.pivotY : 0.5);',
      '        const _vt = Math.round((game.camera && game.camera.y) || 0);',
      '        _cvx = Math.min(Math.max(_cvx, wpx * _cpx), W - wpx * (1 - _cpx));',
      '        _cvy = Math.min(Math.max(_cvy, _vt + hpx * _cpy), _vt + H - hpx * (1 - _cpy));',
      '      }',
      '      ctx.translate(_cvx, _cvy);'));

  const grew = s.length - n0;
  if (grew < 1500 || grew > 4500) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
  writeFileSync(F + '.tmp', s, 'utf8');
  if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
  renameSync(F + '.tmp', F);
  console.log(`applied: Guardian casts the winged aegis loop at ${400} behind the knight (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
}

// ------------------------------------------------- the frame index (separate file)
// Decided by PARSING, never a regex: a regex once matched a neighbouring key and reported
// "already applied" on a file that had never been touched.
{
  let t = readFileSync(IDX, 'utf8');
  const probe = {};
  // eslint-disable-next-line no-new-func
  new Function('window', t)(probe);
  const dir = probe.LX_SPRITE_FRAME_INDEX && probe.LX_SPRITE_FRAME_INDEX.frames && probe.LX_SPRITE_FRAME_INDEX.frames['fx/anim'];
  if (!dir) { console.error('ABORT: fx/anim is not in the frame index'); process.exit(1); }
  if (dir.knight_guardian) {
    console.log(`frame index: already applied (knight_guardian = ${dir.knight_guardian})`);
  } else {
    const IEOL = (t.match(/\r\n/g) || []).length > (t.match(/\n/g) || []).length / 2 ? '\r\n' : '\n';
    const anchor = '   "hexmaster_ult": 9,' + IEOL + '   "marksman_oneshot": 9,';
    const c = t.split(anchor).length - 1;
    if (c !== 1) { console.error(`ABORT index: anchor matched ${c}, expected 1`); process.exit(1); }
    t = t.split(anchor).join('   "hexmaster_ult": 9,' + IEOL + '   "knight_guardian": 9,' + IEOL + '   "marksman_oneshot": 9,');
    const after = {};
    // eslint-disable-next-line no-new-func
    new Function('window', t)(after);   // a broken index kills every animated effect in the game
    const d2 = after.LX_SPRITE_FRAME_INDEX.frames['fx/anim'];
    if (d2.knight_guardian !== 9) { console.error('ABORT index: knight_guardian did not take'); process.exit(1); }
    if (Object.keys(d2).length !== Object.keys(dir).length + 1) { console.error('ABORT index: key count moved by more than one'); process.exit(1); }
    writeFileSync(IDX + '.tmp', t, 'utf8');
    renameSync(IDX + '.tmp', IDX);
    console.log(`applied: frame index carries knight_guardian = 9 (${Object.keys(d2).length} fx/anim sets)`);
  }
}
