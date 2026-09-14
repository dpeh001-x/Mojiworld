// The parry gets its own counter-flash.
// ============================================================================
// Per user: "When the parry does dish damage to monsters make it have its own
// special effect sprite and animation (use ludo.ai)".
//
// WHERE A PARRY DAMAGES A MONSTER — both paths, not just the obvious one:
//
//   1. _riposteProc() — RIPOSTE NOVA (the Tier-1 boon): a defended hit detonates
//      a 150 px shockwave that damages everything in it. It drew LX_FX.nova_ring
//      — which is Nova Step's END-OF-DASH ring — so the parry's payoff looked
//      like a movement skill going off. The registry says so in as many words:
//      "Riposte Nova reuses nova_ring above".
//
//   2. triggerParry()'s ROGUE branch — hitMonster(source, getAtk() * 1.6) on the
//      monster that was just parried. Every rogue has it from level 1, no boon
//      required, and it carried NO effect of its own at all: the counter landed
//      as a generic melee hit. This is the most literal reading of the request
//      and it was the one with nothing on it.
//
// Both now flash Sprites/fx/parry_riposte.webp (ludo.ai, written by
// scripts/gen_parry_riposte_fx.mjs) with its nine-frame loop. The nova keeps
// nova_ring behind an else, so a 404 on the new art degrades to exactly what
// shipped rather than to nothing — the house rule for every burst site.
//
// FOUR registrations, not one. A key that misses any of them is silently dead:
//   • LX_FX's `files`            — the base sprite becomes an Image
//   • _FX_ANIM_KEYS              — _fxAnimFrames returns null for an unlisted key
//   • data/sprite_frame_index.js — _lxFrameCount is "indexed and absent -> 0, ask
//                                  for nothing", so with fx/anim indexed and this
//                                  key missing the nine frames are never even
//                                  REQUESTED, however real they are on disk
//   • the boot preload list      — so the first parry of a run is not a download
// Plus an eager warm, on the same argument the bolt_impact warm is written on: a
// parry is a defensive basic every class owns at level 1, so it can fire in the
// first seconds of a run, long before the staggered skill warmer reaches it.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';

const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
const IDX = process.env.LX_FRAME_INDEX_FILE || 'C:/Users/dpeh0/Mojiworld/data/sprite_frame_index.js';

// ---------------------------------------------------------------- the game file
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const done = /v0\.30\.(x|\d+) parry-fx/.test(s);
if (!done) {
  const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
  const EOL = crlf > lf / 2 ? '\r\n' : '\n';
  const J = (...L) => L.join(EOL);
  const sub = (label, anchor, after, expect) => {
    const c = s.split(anchor).length - 1;
    if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
    s = s.split(anchor).join(after);
  };

  // ---- 1. the base sprite joins LX_FX ----------------------------------------
  sub('LX_FX entry',
    J('    // v0.29.362 — Tier-1 boon FX (art shipped v0.29.355). Riposte Nova reuses',
      '    // nova_ring above; Mirror Step\'s decoy is a procedural afterimage.'),
    J('    // v0.29.362 — Tier-1 boon FX (art shipped v0.29.355). Mirror Step\'s decoy',
      '    // is a procedural afterimage.',
      '    // v0.30.704 parry-fx — the parry has its own art at last (per user: "when the parry',
      '    // does dish damage to monsters make it have its own special effect sprite and',
      '    // animation"). Riposte Nova used to borrow nova_ring, which is the Nova Step DASH',
      '    // shockwave, so the win moment read as a movement skill; and the rogue\'s parry',
      '    // counter-strike had no effect of its own at all. Both wear this now.',
      '    parry_riposte:      \'parry_riposte.webp\',   // Riposte Nova + the rogue counter (anim/parry_riposte_0..8, ludo.ai via scripts/gen_parry_riposte_fx.mjs)'));

  // ---- 2. the loop is allowed to load ----------------------------------------
  sub('anim key',
    "  'arcane_burst',   // v0.29.946 — mage W detonation star (anim/arcane_burst_0..8, ludo.ai via gen_arcane_burst_fx.mjs)",
    J("  'arcane_burst',   // v0.29.946 — mage W detonation star (anim/arcane_burst_0..8, ludo.ai via gen_arcane_burst_fx.mjs)",
      "  'parry_riposte',  // v0.30.704 parry-fx — the parry counter-flash (anim/parry_riposte_0..8, ludo.ai via gen_parry_riposte_fx.mjs)"));

  // ---- 3. warm it at load, like the other combat basic ------------------------
  sub('eager warm',
    "setTimeout(() => { try { _fxAnimFrames('bolt_impact'); } catch (e) {} }, 0);",
    J("setTimeout(() => { try { _fxAnimFrames('bolt_impact'); } catch (e) {} }, 0);",
      '// v0.30.704 parry-fx — the same argument, and a stronger one: a parry is a defensive',
      '// BASIC every class owns from level 1, needs no skill and no boon, and can land in',
      '// the first seconds of a run — long before the staggered skill warmer would reach it.',
      "setTimeout(() => { try { _fxAnimFrames('parry_riposte'); } catch (e) {} }, 0);"));

  // ---- 4. the helper both damage paths call ----------------------------------
  sub('parry fx helper',
    J('// v0.29.362 — RIPOSTE NOVA (Tier-1). A defended hit detonates a shockwave.'),
    J('// v0.30.704 parry-fx — the counter-flash a parry leaves on what it damaged. One',
      '// helper, because the parry damages monsters from two unrelated places (the',
      '// Riposte Nova boon and the rogue counter-strike) and they should look like the',
      '// same move. Silent and total no-op until the art has decoded, so a missing file',
      '// costs nothing; the caller keeps whatever fallback it already had.',
      'function _lxParryFx(cx, cy, size, life) {',
      '  if (typeof spawnSpriteBurst !== \'function\' || typeof _lxVfxReady !== \'function\') return false;',
      '  if (typeof LX_FX === \'undefined\' || !_lxVfxReady(LX_FX.parry_riposte)) return false;',
      '  try { spawnSpriteBurst(cx, cy, \'parry_riposte\', { size: size, life: life, spin: 0.02 }); return true; } catch (e) { return false; }',
      '}',
      '',
      '// v0.29.362 — RIPOSTE NOVA (Tier-1). A defended hit detonates a shockwave.'));

  // ---- 5. the nova wears it, and flashes every monster it damaged -------------
  sub('nova hit flash',
    J("    hitMonster(_rm, _rdmg, false, 'nova');",
      '    _rm.vx = (_rm.vx || 0) + Math.sign(_rdx || 1) * 5;'),
    J('    // v0.30.704 parry-fx — the flash lands ON each monster the nova actually DAMAGED,',
      '    // which is exactly what the request names; the ring alone only marks where the',
      '    // player stood. Gated on the health actually dropping rather than on the call',
      "    // being made: hitMonster returns early on a dead target, and while 'nova' is",
      '    // MISS_EXEMPT today, a flash that can appear over a monster that took nothing is',
      '    // the wrong promise to leave lying around.',
      '    const _pfHp = _rm.currentHp;',
      "    hitMonster(_rm, _rdmg, false, 'nova');",
      '    _rm.vx = (_rm.vx || 0) + Math.sign(_rdx || 1) * 5;',
      '    if (_rm.currentHp < _pfHp) _lxParryFx(_rm.x + _rm.w / 2, _rm.y + _rm.h / 2, 76, 16);'));

  sub('nova ring art',
    J("  if (typeof _lxVfxReady === 'function' && typeof LX_FX !== 'undefined' && _lxVfxReady(LX_FX.nova_ring)) {",
      "    try { spawnSpriteBurst(_rcx, _rcy, 'nova_ring', { size: _rr * 2.1, life: 20, spin: 0.02 }); } catch (e) {}",
      '  }'),
    J('  // v0.30.704 parry-fx — its own ring now. nova_ring stays as the else: if the new art',
      '  // 404s the nova degrades to precisely the effect that shipped, never to nothing.',
      '  if (!_lxParryFx(_rcx, _rcy, _rr * 2.1, 20)',
      "      && typeof _lxVfxReady === 'function' && typeof LX_FX !== 'undefined' && _lxVfxReady(LX_FX.nova_ring)) {",
      "    try { spawnSpriteBurst(_rcx, _rcy, 'nova_ring', { size: _rr * 2.1, life: 20, spin: 0.02 }); } catch (e) {}",
      '  }'));

  // ---- 6. the rogue counter-strike, which had nothing at all ------------------
  sub('rogue counter',
    "    hitMonster(source, Math.floor(getAtk() * 1.6), true, 'melee');",
    J('    // v0.30.704 parry-fx — the other place a parry damages a monster, and the one that',
      '    // had no effect of its own: the counter landed as a plain melee hit. Bigger and a',
      '    // little longer than the nova\'s per-monster flash, because this IS the whole move.',
      "    // Gated on damage: 'melee' is NOT in MISS_EXEMPT_SKILLS, so this counter can whiff,",
      '    // and a whiffed counter dishes nothing — the request is "when the parry does dish',
      '    // damage to monsters", so a miss keeps its MISS marker and gets no flash.',
      '    const _pfHpR = source.currentHp;',
      "    hitMonster(source, Math.floor(getAtk() * 1.6), true, 'melee');",
      '    if (source.currentHp < _pfHpR) _lxParryFx(source.x + source.w / 2, source.y + source.h / 2, 92, 20);'));

  // ---- 7. warm the base sprite with the rest of the boot preload --------------
  sub('preload',
    "    'Sprites/fx/arcane_burst.webp',",
    J("    'Sprites/fx/arcane_burst.webp',",
      "    'Sprites/fx/parry_riposte.webp',   // v0.30.704 parry-fx — a parry can land in the first seconds of a run"));

  const grew = s.length - n0;
  if (grew < 2000 || grew > 5000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
  writeFileSync(F + '.tmp', s, 'utf8');
  if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
  renameSync(F + '.tmp', F);
  console.log(`applied: the parry has its own flash on both damage paths (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
} else {
  console.log('game file: already applied');
}

// ------------------------------------------------- the frame index (separate file)
// Decide by PARSING. A regex over this file is how a neighbouring entity's key
// got matched once and reported "already applied" on a file that had never been
// touched, so the change silently never landed.
{
  let t = readFileSync(IDX, 'utf8');
  const probe = {};
  // eslint-disable-next-line no-new-func
  new Function('window', t)(probe);
  const dir = probe.LX_SPRITE_FRAME_INDEX && probe.LX_SPRITE_FRAME_INDEX.frames && probe.LX_SPRITE_FRAME_INDEX.frames['fx/anim'];
  if (!dir) { console.error('ABORT: fx/anim is not in the frame index'); process.exit(1); }
  if (dir.parry_riposte) {
    console.log(`frame index: already applied (parry_riposte = ${dir.parry_riposte})`);
  } else {
    const IEOL = (t.match(/\r\n/g) || []).length > (t.match(/\n/g) || []).length / 2 ? '\r\n' : '\n';
    const anchor = '   "nightreaper_ult": 9,' + IEOL + '   "phantom_ult": 9,';
    const c = t.split(anchor).length - 1;
    if (c !== 1) { console.error(`ABORT index: anchor matched ${c}, expected 1`); process.exit(1); }
    t = t.split(anchor).join('   "nightreaper_ult": 9,' + IEOL + '   "parry_riposte": 9,' + IEOL + '   "phantom_ult": 9,');
    // re-parse before writing: a broken index kills every animated effect in the game
    const after = {};
    // eslint-disable-next-line no-new-func
    new Function('window', t)(after);
    const d2 = after.LX_SPRITE_FRAME_INDEX.frames['fx/anim'];
    if (d2.parry_riposte !== 9) { console.error('ABORT index: parry_riposte did not take'); process.exit(1); }
    if (Object.keys(d2).length !== Object.keys(dir).length + 1) { console.error('ABORT index: key count moved by more than one'); process.exit(1); }
    writeFileSync(IDX + '.tmp', t, 'utf8');
    renameSync(IDX + '.tmp', IDX);
    console.log(`applied: frame index carries parry_riposte = 9 (${Object.keys(d2).length} fx/anim sets)`);
  }
}
