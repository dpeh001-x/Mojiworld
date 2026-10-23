// Gravitos: Collapse Rain and Soul Drain reworked; the Singularity is unchanged.
//  A. COLLAPSE RAIN drains you to 1 HP / 1 MP instead of killing you, and kills only a hero already at 1 HP (per user:
//     "Change collapse rain to a 1hp and 1mp attack", then "If youre at 1 hp you die").
//  B. SOUL DRAIN is a status, not a clamp (per user: "Soul drain should not be a OHKO move, it should be a move whereby the players
//     HP drops by 10% every second for 10 seconds with a unique status affliction", then "10% of max HP, but it can't kill").
// ============================================================================
// A. What the player saw: Collapse Rain (his later-form one-shot: four boxes of light in a row, about 4 s apart, each field live
// 1.4 s) is built on the Singularity's own hazard - the same dark veil, countdown, "REACH THE LIGHT" and safe-box art - and a box
// that caught you outside its light killed you outright. In a fight it fires about as often as the Singularity but puts four
// lethal fields on screen per cast, so it read as "the Singularity, cast far too quickly", and v0.30.1852's Singularity gap
// (50 / 40 / 30 s) never applied to it.
// What changes:
//  (1) each rain box is tagged (_rainDrain) and named ("Gravitos' Collapse Rain");
//  (2) when a tagged box resolves on a hero outside its light: above 1 HP -> HP 1 and MP 1, alive, with normal hit i-frames
//      (900 ms); already at 1 HP -> a real death through the same path the Singularity uses (cheat-death charge, triggerDeath,
//      co-op downed). God mode and live invulnerability (dodge, hit i-frames, Holy Shield / Apotheosis grants) skip it, as they
//      skip any hit. Each box applies at most once (it resolves once; a latch backs that up). Block / DR are not applied: it is a
//      forced drain like Soul Drain and the Sovereign's pillars;
//  (3) co-op: the tag rides with the mirrored hazard, so a guest resolves its own box on its own HP / MP the same way;
//  (4) the countdown's caption reads "REACH THE LIGHT OR DROP TO 1 HP" for a rain box (the Singularity keeps "REACH THE LIGHT").
// Untouched: the Singularity (still a one-shot, its v0.30.1852 spacing and lock rules), the rain's pattern, toast, four boxes,
// timing, safe box and spacing (it still counts as a one-shot for the Gravity Bind rules), every other attack, loot.
// B. What the player saw: Soul Drain (every form: a 1.5 s ring, then a line-of-sight check) set HP and MP straight to 1.
// What changes:
//  (5) caught -> the SOUL DRAIN status: 10 ticks, one a second, each 10% of max HP, never below 1 HP (the drain alone cannot
//      kill; anything else still can). No DEF, no i-frames, no hit flash per tick; MP is no longer touched. Caught again while
//      it runs -> the 10 ticks refresh, they do not stack. Ends on death / downed, a form change, leaving the map, a Status Cure
//      Remedy or the Priest's Celestial Aurora cleanse. Breaking line of sight still avoids it; the post-drain recovery window,
//      the warning and the pattern are unchanged; it still counts for the Gravity Bind spacing;
//  (6) the look: its own sticker in the status row over the head (a wisp with a heart), a SOUL DRAIN pill on the HUD buff row
//      (Sprites/skills/buff_soulDrain.webp, ludo.ai), a violet aura on the hero with wisps rising toward Gravitos, a toast when it
//      lands, and a small violet number on each tick. The skull leaves its warning toast;
//  (7) co-op: the drain resolves on every client (the gvDrain exec), so a guest gets the same status on its own HP.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxRainDrainHit(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); if (/[^\x09\x0a\x0d\x20-\x7e]/.test(b.split(a).join(''))) die(what + ': non-ASCII in the insert'); s = s.replace(a, () => b); };
const T = 'v0.30.1874 gravitos-ohko-rework';

// (1) the rain box carries its tag and its name
once('          safeZones: [safeRect],', J('          safeZones: [safeRect],',
  `          _rainDrain: true, _sourceLabel: "Gravitos' Collapse Rain",   // ${T} - drains to 1 HP / 1 MP (kills only at 1 HP), see _lxRainDrainHit`), 'rain push');

// (2) the shared resolver: a rain box takes the drain branch
once('      if (!safe && player.hp > 0 && !player._god) {',
  `      if (!safe && h._rainDrain) { _lxRainDrainHit(h); } else if (!safe && player.hp > 0 && !player._god) {   // ${T} - a Collapse Rain box drains instead of killing`,
  'resolver branch');

// (3) the drain itself + the co-op field, beside the other mirrored-hazard fields
once("_COOP_HZ_XF.push('_vfx');", J("_COOP_HZ_XF.push('_vfx');",
  `_COOP_HZ_XF.push('_rainDrain');   // ${T} - a guest's copy of a rain box drains its own HP / MP the same way`,
  `// ${T} - per user: "Change collapse rain to a 1hp and 1mp attack", then "If youre at 1 hp you die". A Collapse Rain box that`,
  '// resolves on a hero outside its light: above 1 HP -> HP 1 and MP 1 (alive, normal hit i-frames); at 1 HP -> a real death through the',
  "// Singularity's own death path (cheat-death charge, triggerDeath, co-op downed). God mode and live invulnerability skip it like any hit;",
  '// block and DR do not apply (a forced drain, as Soul Drain and the drain pillars). Once per box: the box resolves once, the latch backs it up.',
  `function _lxRainDrainHit(h) {   // ${T}`,
  '  if (!h || h._rdDone) return false;',
  '  h._rdDone = 1;',
  '  if (!player || !(player.hp > 0) || player._god || player._downed || game.dying) return false;',
  '  if ((player.invulnerable | 0) > 0) return false;',
  "  player._lastDamageSource = h._sourceLabel || \"Gravitos' Collapse Rain\";",
  '  player.lastHitTime = game.time;',
  '  if (player.hp <= 1) {',
  '    player.hp = 0;',
  "    game.damageNumbers.push({ taken: true, x: player.x + 14, y: player.y, vy: -2, text: 'COLLAPSED', life: 64, color: '#ff44ff', size: 20 });",
  "    if (!game.dying && typeof triggerDeath === 'function') { try { if (typeof _tryCheatDeathRevive !== 'function' || !_tryCheatDeathRevive()) triggerDeath(); } catch (_) {} }",
  '    return true;',
  '  }',
  '  player.hp = 1;',
  '  if (!(player.mp <= 1)) player.mp = 1;',
  '  player.invulnerable = Math.max(player.invulnerable || 0, 900); player._hitIframeAt = game.time;',
  "  game.damageNumbers.push({ taken: true, x: player.x + 14, y: player.y, vy: -2, text: 'HP\\u21921  MP\\u21921', life: 64, color: '#cc66ff', size: 18 });",
  '  return true;',
  '}'), 'coop xf + drain fn');

// (4) the countdown caption
once("    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(14,3,24,0.9)'; ctx.strokeText('REACH THE LIGHT', cx, ly);",
  `    const _ofLbl = h._rainDrain ? 'REACH THE LIGHT OR DROP TO 1 HP' : 'REACH THE LIGHT';   // ${T} - a rain box drains, the Singularity kills` + EOL +
  "    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(14,3,24,0.9)'; ctx.strokeText(_ofLbl, cx, ly);", 'caption stroke');
once("    ctx.fillStyle = '#ffd36b'; ctx.fillText('REACH THE LIGHT', cx, ly);", "    ctx.fillStyle = '#ffd36b'; ctx.fillText(_ofLbl, cx, ly);", 'caption fill');

// ---- B. SOUL DRAIN ----
// (5) gvDrain (runs on every client): the HP / MP clamp becomes the status
{
  const A = "    // Apply unavoidable drain. Clamp to 1 (don't reduce below 1).", B = "    }   // v0.29.830 — end of the line-of-sight gate";
  if (s.split(A).length !== 2 || s.split(B).length !== 2) die('gvDrain anchors');
  const i = s.indexOf(A), e = s.indexOf(B);
  if (!(e > i) || e - i > 2200) die('gvDrain span ' + (e - i));
  const old = s.slice(i, e);
  if (!old.includes('player.hp = 1;') || !old.includes('player.mp = 1;') || (old.match(/\n/g) || []).length > 30) die('gvDrain body changed');
  s = s.slice(0, i) + J(`    _lxSoulDrainApply();   // ${T} - was HP -> 1 / MP -> 1: now 10% of max HP a second for 10 s, never below 1 HP`, '') + s.slice(e);
}
once("        showToast('\u{1F480} SOUL DRAIN — BREAK LINE OF SIGHT!', 'legendary');",
  `        showToast('\\u{1F47B} SOUL DRAIN \\u2014 BREAK LINE OF SIGHT!', 'legendary');   // ${T} - no skull: it drains, it does not kill`, 'drain toast');
// the tick, once a step, beside the other player DoTs
once('  // Zodiac status ticks — poison DOT, ice floor, frozen timer.', J(
  `  if (typeof _lxSoulDrainTick === 'function') _lxSoulDrainTick();   // ${T}`,
  '  // Zodiac status ticks — poison DOT, ice floor, frozen timer.'), 'tick call');
// cleanses: the Status Cure Remedy and Celestial Aurora
once('    player._poisonTickAcc = 0;' + EOL + '    player._skillLockTimer = 0;', J('    player._poisonTickAcc = 0;', `    player._sdLeft = 0;   // ${T}`, '    player._skillLockTimer = 0;'), 'cure');
once('    player._skillLockTimer = 0;' + EOL + '    player.hitStun = 0;', J('    player._skillLockTimer = 0;', `    player._sdLeft = 0;   // ${T}`, '    player.hitStun = 0;'), 'aurora');
// (6) the look: status-row sticker, HUD pill, aura + wisps
once("  poison: { kind: 'poison', tint: '#aa66ee' },", J("  poison: { kind: 'poison', tint: '#aa66ee' },", `  soul: { kind: 'soul', tint: '#a865ff' },   // ${T}`), 'psi entry');
once('        (player._poisonTimer | 0) > 0 || (player._slowTimer | 0) > 0 || (player._iceFloor | 0) > 0 ||',
  '        (player._poisonTimer | 0) > 0 || (player._slowTimer | 0) > 0 || (player._iceFloor | 0) > 0 || (player._sdLeft | 0) > 0 ||', 'psi precheck');
once('  if ((player._poisonTimer | 0) > 0) icons.push(_LX_PSI.poison);', J('  if ((player._poisonTimer | 0) > 0) icons.push(_LX_PSI.poison);',
  `  if ((player._sdLeft | 0) > 0) icons.push(_LX_PSI.soul);   // ${T}`), 'psi push');
once("      case 'slow': {                        // hourglass", J(
  `      case 'soul': {                        // ${T} - a wisp curling up, a heart at its core`,
  '        g.beginPath(); g.moveTo(s * 0.25, -s);',
  '        g.bezierCurveTo(s * 0.2, -s * 0.4, s * 0.95, -s * 0.1, s * 0.75, s * 0.45);',
  '        g.bezierCurveTo(s * 0.55, s, -s * 0.55, s, -s * 0.75, s * 0.45);',
  '        g.bezierCurveTo(-s * 0.95, -s * 0.15, -s * 0.1, -s * 0.35, s * 0.25, -s); F();',
  '        if (!K) { const hs = s * 0.24, hy = s * 0.3; g.fillStyle = INK; g.beginPath(); g.moveTo(0, hy + hs); g.bezierCurveTo(-hs * 2.1, hy - hs * 0.3, -hs * 0.7, hy - hs * 1.7, 0, hy - hs * 0.5); g.bezierCurveTo(hs * 0.7, hy - hs * 1.7, hs * 2.1, hy - hs * 0.3, 0, hy + hs); g.fill(); }',
  '        break;',
  '      }',
  "      case 'slow': {                        // hourglass"), 'glyph');
once('  _drawPlayerNameTag(sx, sy);' + EOL + '  _drawPlayerStatusIcons(sx, sy);', J(
  `  if ((player._sdLeft | 0) > 0 && typeof _lxSoulDrainAura === 'function') _lxSoulDrainAura(sx, sy);   // ${T}`,
  '  _drawPlayerNameTag(sx, sy);', '  _drawPlayerStatusIcons(sx, sy);'), 'aura call');
once("  if (typeof _lxPotionSealLeftF === 'function') {   // v0.30.621 - the potion seal counts down as a pill, so 'not sealed' is visible", J(
  `  { const _sdMs = (player._sdLeft | 0) > 0 ? Math.max(1, Math.round(_lxSoulDrainLeftF() * 1000 / 60)) : 0; if ((player.buffs.soulDrain | 0) !== _sdMs) player.buffs.soulDrain = _sdMs; }   // ${T}`,
  "  if (typeof _lxPotionSealLeftF === 'function') {   // v0.30.621 - the potion seal counts down as a pill, so 'not sealed' is visible"), 'buff row clock');
once("  { key: 'potionSeal',    skill: 'buff_potionSeal',", J(
  `  { key: 'soulDrain',     skill: 'buff_soulDrain', icon: '\\u{1F47B}', label: 'SOUL DRAIN', dur: 10000 },   // ${T} - driven by the drain's own clock`,
  "  { key: 'potionSeal',    skill: 'buff_potionSeal',"), 'buff meta');
once('  .moji-buff-pill[data-buff="potionSeal"]  { border-color: rgba(255, 60, 90, 0.85); background: rgba(80, 10, 24, 0.55); }   /* v0.30.621 - a debuff reads red */', J(
  '  .moji-buff-pill[data-buff="potionSeal"]  { border-color: rgba(255, 60, 90, 0.85); background: rgba(80, 10, 24, 0.55); }   /* v0.30.621 - a debuff reads red */',
  `  .moji-buff-pill[data-buff="soulDrain"]   { border-color: rgba(190, 120, 255, 0.9); background: rgba(42, 10, 66, 0.6); }   /* ${T} - the drain reads violet */`), 'pill css');
// the status itself (after the rain-drain helper)
once("_COOP_HZ_XF.push('_rainDrain');", J("_COOP_HZ_XF.push('_rainDrain');", SOUL_FN()), 'soul fns');

const grew = s.length - n0;
if (grew < 6000 || grew > 11000) die('size moved ' + grew);
const marks = [...s.matchAll(/v0\.30\.(?:x|\d+) gravitos-ohko-rework/g)].length;   // the ship chain retags x to the real version, here and in this file
if (marks !== 19) die('markers ' + marks);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: gravitos-ohko-rework (+' + grew + ' chars, ' + marks + ' marks)');

function SOUL_FN() {   // the Soul Drain status: apply, tick, clock, aura
  return J(
    `// ${T} - SOUL DRAIN, the status (per user: "Soul drain should not be a OHKO move, it should be a move whereby the players HP drops`,
    '// by 10% every second for 10 seconds with a unique status affliction", then "10% of max HP, but it can\'t kill"). Ticks run on',
    '// game.time (60 a step-second): 10 of them, 10% of max HP each, never below 1 HP, no DEF / i-frames / hit flash. Caught again',
    '// while it runs -> back to 10 ticks (no stack). Ends on death / downed, a form change, leaving the map, or a cleanse.',
    'const LX_SD_TICKS = 10, LX_SD_EVERY_F = 60, LX_SD_FRAC = 0.10;',
    'function _lxSoulDrainBoss() { const ms = game.monsters; if (ms) for (let i = 0; i < ms.length; i++) { const m = ms[i]; if (m && m.type === \'gravitos\') return m; } return null; }',
    'function _lxSoulDrainLeftF() { return (player._sdLeft | 0) > 0 ? Math.max(0, ((player._sdLeft | 0) - 1) * LX_SD_EVERY_F + ((player._sdNextAt | 0) - (game.time | 0))) : 0; }',
    'function _lxSoulDrainApply() {',
    '  if (!player || !(player.hp > 0) || player._god || player._downed) return false;',
    '  const now = game.time | 0, was = (player._sdLeft | 0) > 0, g = _lxSoulDrainBoss();',
    '  player._sdLeft = LX_SD_TICKS;',
    '  if (!was) player._sdNextAt = now + LX_SD_EVERY_F;',
    '  player._sdMap = game.currentMap; player._sdForm = g ? ((g._gravitosPhase | 0) || 1) : null;',
    "  if (typeof showToast === 'function') showToast(was ? '\\u{1F47B} SOUL DRAIN renewed \\u2014 10 s' : '\\u{1F47B} SOUL DRAIN \\u2014 10% HP a second for 10 s (it cannot kill)', 'epic');",
    "  if (game.damageNumbers) game.damageNumbers.push({ taken: true, x: player.x + 8, y: player.y - 12, vy: -2, text: 'SOUL DRAIN', life: 56, color: '#c08cff', size: 16 });",
    '  return true;',
    '}',
    'function _lxSoulDrainTick() {',
    '  if (!((player._sdLeft | 0) > 0)) return;',
    '  const now = game.time | 0, g = _lxSoulDrainBoss();',
    '  if (!(player.hp > 0) || player._downed || game.dying || player._sdMap !== game.currentMap',
    '      || (player._sdForm != null && (!g || ((g._gravitosPhase | 0) || 1) !== player._sdForm))) { player._sdLeft = 0; return; }',
    "  if (now % 3 === 0 && typeof _budgetedParticlePush === 'function') {   // wisps rise off the hero and drift toward him",
    '    const px = player.x + player.w / 2, dir = g ? Math.sign((g.x + g.w / 2) - px) || 1 : 0;',
    "    _budgetedParticlePush({ x: px + (Math.random() - 0.5) * player.w, y: player.y + player.h * (0.25 + Math.random() * 0.6), vx: dir * (0.9 + Math.random() * 1.1), vy: -0.9 - Math.random() * 0.9, life: 34, color: Math.random() < 0.6 ? '#b47cff' : '#efe2ff', size: 2.5 + Math.random() * 2 });",
    '  }',
    '  if (now < (player._sdNextAt | 0)) return;',
    '  player._sdNextAt = now + LX_SD_EVERY_F; player._sdLeft = (player._sdLeft | 0) - 1;',
    '  if (player._god) return;',
    "  const mh = Math.max(1, (typeof getMaxHp === 'function') ? getMaxHp() : (player.maxHp || 100)), before = player.hp;",
    '  player.hp = Math.max(1, player.hp - Math.max(1, Math.floor(mh * LX_SD_FRAC)));',
    '  const lost = Math.max(0, Math.round(before - player.hp));',
    "  if (game.damageNumbers) game.damageNumbers.push({ taken: true, x: player.x + 10 + (Math.random() - 0.5) * 12, y: player.y + 4, vy: -1.6, text: lost > 0 ? '-' + lost : 'SOUL', life: 40, color: '#b47cff', size: 13 });",
    '}',
    'function _lxSoulDrainAura(sx, sy) {   // a violet aura over the hero, breathing with the ticks',
    '  try {',
    "    const cx = sx + (player.w || 28) / 2, cy = sy + (player.h || 44) * 0.55, k = 1 - Math.min(1, Math.max(0, ((player._sdNextAt | 0) - (game.time | 0)) / LX_SD_EVERY_F));",
    "    const img = (typeof _lxGfBake === 'function') ? _lxGfBake('sd_aura', 128, (c) => { const gr = c.createRadialGradient(0, 0, 6, 0, 0, 64); gr.addColorStop(0, 'rgba(214,170,255,0.75)'); gr.addColorStop(0.45, 'rgba(150,80,255,0.42)'); gr.addColorStop(1, 'rgba(90,30,180,0)'); c.fillStyle = gr; c.fillRect(-64, -64, 128, 128); }) : null;",
    '    if (!img) return;',
    '    const w = (player.w || 28) * 2.6, h = (player.h || 44) * 1.9;',
    "    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 + 0.3 * k;",
    '    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h); ctx.restore();',
    '  } catch (e) {}',
    '}');
}
