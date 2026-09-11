// OHKO pass: unparryable collapse, quiet around it (both bosses), and
// Gravitos comets that seal healing with a visible HEAL LOCKED status.
// =============================================================================
// Per user: "ensure that the OHKO attack cannot be parried, ensure that it can
// be properly evaded by going into the safe zone, space out attacks such that
// there is no continuous attacks from the boss during and right after the
// OHKO attacks" + "for gravitos make some specific projectiles prevent healing
// effects when land - make sure to have a status that tells players that
// they are heal locked".
//
// 1. NO PARRY. _ohkoParry is armed by the block key (300 ms) and consumed in
//    exactly one place: the collapse resolver's PERFECT PARRY branch, which
//    negated the OHKO outright. That branch is now gated by a named constant,
//    LX_OHKO_PARRYABLE = false. The i-frame "PHASED" branch (a deliberate
//    2-2.5 s ult/bastion grant drops you to 1 HP + 1 MP instead of killing)
//    is NOT touched - it is a costed clutch, not a parry; flagged in the
//    report. The zone (v0.30.578: column test + grace) is the counter.
//
// 2. QUIET AROUND THE COLLAPSE.
//    Sovereign: the collapse-charge window (v0.30.570) covered only the 5 s
//    telegraph, with the volley/drain timers pushed 1 s past it. It now
//    covers telegraph + 2 s, and the timers are pushed 2.5 s past the resolve.
//    Gravitos: the regular rotation is already held by an 8 s "trail clear"
//    measured from the OHKO CAST - which leaves only 2.5 s after a 5.5 s
//    singularity and NOTHING after a 13 s collapse rain, whose next pattern
//    could start ~0.65-1.1 s (cycleBase) after the last box. Each OHKO
//    pattern (singularity, rain, soul drain) now stamps m._lastOhkoEndAt when
//    it ends, and the trail-clear gate also requires 2 s since that stamp.
//    During a telegraph nothing else can fire on either boss (single pattern
//    state; Gravitos carries no trait attacks; the Sovereign's are gated).
//
// 3. HEAL LOCK. There is no central heal function - 25 separate sites raise
//    player.hp - so the only lock that cannot be bypassed by the next heal a
//    parallel session adds is an accessor on player.hp itself: while locked,
//    a write that would RAISE hp is refused; lowering it (damage) always goes
//    through. `player` is a const object mutated in place (loadState uses
//    Object.assign, which routes through the setter), and the accessor is
//    enumerable so saves still serialise hp. Installed lazily on the first
//    lock; the install checks the live property descriptor, never a saved
//    flag. The lock is scoped by session clock, map and death so a reload,
//    a portal or a respawn can never carry it. Potions are additionally
//    refused at both chokepoints so a sealed drink is not wasted.
//    Carrier: Gravitos's chase comets (10 s, per user). Status: a HEAL LOCKED pill in
//    the existing buff bar (a BUFF_META entry driven by the lock clock), a
//    danger toast on seal, and a red pill tint.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_lxHealLockApply')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- helpers + the parry constant, beside the safe-zone helper ----------------
sub('helpers', 'const LX_SZ_JUMP_SLACK = 150;',
  J('// v0.30.588 ohko-pass — the collapse cannot be parried (per user). The block',
    '// key still arms _ohkoParry for its other uses; the resolver simply no longer',
    '// honours it. The safe zone is the counter.',
    'const LX_OHKO_PARRYABLE = false;',
    '// v0.30.588 ohko-pass — HEAL LOCK. No central heal function exists (25 sites',
    '// raise player.hp), so the lock is an accessor on player.hp: a write that',
    '// would raise hp is refused while locked; lowering it always goes through.',
    '// Scoped by session clock (t >= at: a reload cannot carry it), map and',
    '// death. Installed lazily on the first seal; the check reads the live',
    '// property descriptor, never a saved flag.',
    'function _lxHealLocked() {',
    "  if (typeof player === 'undefined' || !player) return false;",
    '  const t = game.time | 0;',
    '  return (player._healLockUntil | 0) > t && t >= (player._healLockAt | 0)',
    '      && player._healLockMap === game.currentMap && !game.dying;',
    '}',
    'function _lxHealLockInstall() {',
    "  const d = Object.getOwnPropertyDescriptor(player, 'hp');",
    '  if (d && d.get) return;',
    '  let _v = player.hp;',
    "  Object.defineProperty(player, 'hp', { enumerable: true, configurable: true,",
    '    get() { return _v; },',
    '    set(nv) {',
    "      if (typeof nv === 'number' && nv > _v && _lxHealLocked()) { player._healBlockedAt = game.time | 0; return; }",
    '      _v = nv;',
    '    } });',
    '}',
    'function _lxHealLockApply(ms, label) {',
    '  if (!player || player._god) return;',
    '  _lxHealLockInstall();',
    '  const t = game.time | 0, until = t + Math.round((ms || 10000) * 60 / 1000);',
    '  const fresh = !_lxHealLocked();',
    '  player._healLockAt = t;',
    '  player._healLockUntil = Math.max(player._healLockUntil | 0, until);',
    '  player._healLockTotalF = (player._healLockUntil | 0) - t;   // the overhead countdown drains against this',
    '  player._healLockMap = game.currentMap;',
    "  player._healLockLabel = label || 'a void projectile';",
    '  if (fresh) {',
    "    if (typeof showToast === 'function') showToast('\\u{1F6AB} HEAL LOCKED \\u2014 ' + Math.round((ms || 10000) / 1000) + 's: no healing of any kind', 'danger');",
    "    // (no floating HEAL LOCK damage number: the countdown over the head is the cue, and the number sat on top of it)",
    '  }',
    '}',
    'const LX_SZ_JUMP_SLACK = 150;'));

// ---- 1. the parry branch is gated off ------------------------------------------
sub('parry gate', '        if (player._ohkoParry > 0) {',
  '        if (LX_OHKO_PARRYABLE && player._ohkoParry > 0) {   // v0.30.588 ohko-pass — the collapse cannot be parried');

// ---- 2a. Sovereign: quiet through the telegraph AND 2 s after ------------------
sub('sov window', '      m._sovCollapseUntil = (game.time | 0) + 300;',
  '      m._sovCollapseUntil = (game.time | 0) + 300 + 120;   // v0.30.588 ohko-pass — telegraph + 2 s: nothing right after the collapse either');
sub('sov homing', '      m._sovereignHomingAt = Math.max(m._sovereignHomingAt | 0, (game.time | 0) + 300 + 60);',
  '      m._sovereignHomingAt = Math.max(m._sovereignHomingAt | 0, (game.time | 0) + 300 + 150);   // v0.30.588 ohko-pass — 2.5 s past the resolve');
sub('sov drain', '      m._sovereignDrainAt  = Math.max(m._sovereignDrainAt | 0,  (game.time | 0) + 300 + 60);',
  '      m._sovereignDrainAt  = Math.max(m._sovereignDrainAt | 0,  (game.time | 0) + 300 + 150);');

// ---- 2b. Gravitos: 2 s of quiet after every OHKO pattern ends -----------------
sub('trail clear', '      const _ohkoTrailClear = (_nowOhko - (m._lastOhkoAt || -999999)) >= _GAP;',
  J('      // v0.30.588 ohko-pass — the 8 s trail is measured from the CAST, which left',
    '      // ~2.5 s after a singularity and nothing after a 13 s rain. Also require',
    '      // 2 s since the OHKO pattern ENDED (stamped at each pattern exit).',
    '      const _ohkoTrailClear = (_nowOhko - (m._lastOhkoAt || -999999)) >= _GAP',
    '                           && (_nowOhko - (m._lastOhkoEndAt || -999999)) >= 120;'));
sub('sing exit', "        m.patternState = 'idle'; m.patternTimer = 0; m._sgSpawned = false;",
  "        m.patternState = 'idle'; m.patternTimer = 0; m._sgSpawned = false; m._lastOhkoEndAt = game.time | 0;   // v0.30.588 ohko-pass");
sub('rain exit', J('        m._rainIdx = 0;', "        m.patternState = 'idle';", '        m.patternTimer = 0;'),
  J('        m._rainIdx = 0;', "        m.patternState = 'idle';", '        m.patternTimer = 0;', '        m._lastOhkoEndAt = game.time | 0;   // v0.30.588 ohko-pass'));
sub('soul exit', J("        m.patternState = 'idle'; m.patternTimer = 0;", '        m._drainFired = false; m._drainAnnounced = false;'),
  J("        m.patternState = 'idle'; m.patternTimer = 0;", '        m._drainFired = false; m._drainAnnounced = false; m._lastOhkoEndAt = game.time | 0;   // v0.30.588 ohko-pass'));

// ---- 3. heal lock: carrier, application, potions, status -----------------------
sub('comet tag', J("            color: '#cc66ff', noGravity: true, homing: true,", '            stunHit: 600,'),
  J("            color: '#cc66ff', noGravity: true, homing: true,", '            stunHit: 600,',
    "            _healLockMs: 10000, _sourceLabel: 'a Gravitos comet',   // v0.30.588 ohko-pass — landing seals healing for 10 s (per user)"));
sub('impact', '        if (p._normalMob && _projLost > 0) _projLost = Math.min(_projLost, Math.floor((p.damage || dmg) * 1.35));',
  J("        // v0.30.588 ohko-pass — a tagged projectile (Gravitos's comets) seals healing on landing.",
    "        if (p._healLockMs > 0 && _projLost > 0 && !player._god && typeof _lxHealLockApply === 'function') _lxHealLockApply(p._healLockMs, p._sourceLabel);",
    '        if (p._normalMob && _projLost > 0) _projLost = Math.min(_projLost, Math.floor((p.damage || dmg) * 1.35));'));
sub('potion gates', '  if ((player._potionLockUntil | 0) > (game.time | 0)) {',
  J("  if (typeof _lxHealLocked === 'function' && _lxHealLocked()) {   // v0.30.588 ohko-pass — a sealed drink would be wasted: refuse it",
    '    const _hl = Math.ceil(((player._healLockUntil | 0) - (game.time | 0)) / 60);',
    "    if (typeof showToast === 'function') showToast('\\u{1F6AB} HEAL LOCKED \\u2014 ' + _hl + 's', 'common');",
    "    if (typeof audio !== 'undefined' && audio && audio.play) audio.play('hit');",
    '    return;',
    '  }',
    '  if ((player._potionLockUntil | 0) > (game.time | 0)) {'), 2);
sub('buff meta', "  { key: 'sleight',       icon: '🗡',  label: 'Sleight',     dur: 2500  },",
  J("  { key: 'sleight',       icon: '🗡',  label: 'Sleight',     dur: 2500  },",
    "  { key: 'healLock',      icon: '\\u{1F6AB}', label: 'HEAL LOCKED', dur: 10000 },   // v0.30.588 ohko-pass — driven by the lock clock, see _updateBuffRow"));
sub('buff row sync', '  if (!row || !player || !player.buffs) return;',
  J('  if (!row || !player || !player.buffs) return;',
    '  // v0.30.588 ohko-pass — the heal lock keeps its own clock; mirror it into the',
    '  // buff timers so the bar shows a HEAL LOCKED pill that counts down with it.',
    "  if (typeof _lxHealLocked === 'function') {",
    '    const _hlMs = _lxHealLocked() ? Math.max(1, Math.round(((player._healLockUntil | 0) - (game.time | 0)) * 1000 / 60)) : 0;',
    '    if ((player.buffs.healLock | 0) !== _hlMs) player.buffs.healLock = _hlMs;',
    '  }'));
sub('pill css', '  .moji-buff-pill[data-buff="comboAtk"]    { border-color: rgba(255, 200, 80,  0.55); }',
  J('  .moji-buff-pill[data-buff="comboAtk"]    { border-color: rgba(255, 200, 80,  0.55); }',
    '  .moji-buff-pill[data-buff="healLock"]    { border-color: rgba(255, 60, 90, 0.85); background: rgba(80, 10, 24, 0.55); }   /* v0.30.588 ohko-pass — a debuff reads red */'));

// ---- 6. the countdown over the character -------------------------------------
sub('overhead timer fn', 'function _drawPlayerStatusIcons(sx, sy) {',
  J('// v0.30.588 ohko-pass \u2014 HEAL LOCK countdown above the character (per user). The',
    '// buff-bar pill sits off to the side; the seal is the one status a player has',
    '// to read mid-dodge, so it also counts down over the head: a struck-through',
    '// heal cross whose ring drains, the label, tenths of a second, a drain bar,',
    '// and a pulse that quickens in the last two seconds. Takes the control',
    '// banner\'s slot, or the one above it when both show. Plain strokes and two',
    '// short fillTexts, no emoji and no shadowBlur (see the v0.30.346 perf notes).',
    'function _drawHealLockTimer(sx, sy, lifted) {',
    "  if (!player || typeof _lxHealLocked !== 'function' || !_lxHealLocked()) return;",
    '  const now = game.time | 0;',
    '  const remainF = Math.max(0, (player._healLockUntil | 0) - now);',
    '  const totalF = Math.max(1, player._healLockTotalF | 0);',
    '  const frac = Math.max(0, Math.min(1, remainF / totalF));',
    "  const secs = (remainF / 60).toFixed(1) + 's';",
    '  const cx = sx + (player.w || 28) / 2;',
    '  const h = 20, r = 7, ico = 16;',
    '  const y = sy - 30 - (lifted ? 26 : 0);',
    "  const label = 'HEAL LOCK', tint = '#ff4d6d';",
    '  ctx.save();',
    "  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';",
    "  ctx.font = 'bold 12px sans-serif';",
    '  const sw = Math.ceil(ctx.measureText(secs).width);',
    "  ctx.font = 'bold 11px sans-serif';",
    '  if (window._lxHealLockLabelW == null) window._lxHealLockLabelW = Math.ceil(ctx.measureText(label).width);',
    '  const lw = window._lxHealLockLabelW;',
    '  const w = ico + 12 + lw + 8 + sw + 10;',
    '  const x0 = cx - w / 2;',
    '  const urgent = remainF <= 120;',
    '  ctx.globalAlpha = urgent ? 0.8 + Math.sin(now * 0.45) * 0.2 : 0.92 + Math.sin(now * 0.15) * 0.06;',
    '  const pill = () => { ctx.beginPath(); ctx.moveTo(x0 + r, y); ctx.arcTo(x0 + w, y, x0 + w, y + h, r); ctx.arcTo(x0 + w, y + h, x0, y + h, r); ctx.arcTo(x0, y + h, x0, y, r); ctx.arcTo(x0, y, x0 + w, y, r); ctx.closePath(); };',
    "  pill(); ctx.strokeStyle = 'rgba(255,77,109,' + (urgent ? 0.35 : 0.18) + ')'; ctx.lineWidth = 5; ctx.stroke();   // soft halo: a wide faint stroke",
    "  pill(); ctx.fillStyle = 'rgba(46,4,16,0.82)'; ctx.fill();",
    '  ctx.strokeStyle = tint; ctx.lineWidth = 1.5; ctx.stroke();',
    '  // glyph: a heal cross, struck through, inside a ring that drains with the seal',
    '  const gx = x0 + 6 + ico / 2, gy = y + h / 2;',
    "  ctx.lineCap = 'round';",
    "  ctx.strokeStyle = 'rgba(120,255,170,0.9)'; ctx.lineWidth = 2.2;",
    '  ctx.beginPath(); ctx.moveTo(gx - 4, gy); ctx.lineTo(gx + 4, gy); ctx.moveTo(gx, gy - 4); ctx.lineTo(gx, gy + 4); ctx.stroke();',
    '  ctx.strokeStyle = tint; ctx.lineWidth = 1.8;',
    '  ctx.beginPath(); ctx.arc(gx, gy, 7, 0, Math.PI * 2); ctx.stroke();',
    '  ctx.beginPath(); ctx.moveTo(gx - 5, gy - 5); ctx.lineTo(gx + 5, gy + 5); ctx.stroke();',
    "  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;",
    '  ctx.beginPath(); ctx.arc(gx, gy, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();',
    '  // label, then the seconds',
    '  ctx.fillStyle = tint; ctx.fillText(label, x0 + ico + 12, y + h / 2 + 0.5);',
    "  ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = urgent ? '#ffffff' : '#ffe3e8';",
    '  ctx.fillText(secs, x0 + ico + 12 + lw + 8, y + h / 2 + 0.5);',
    '  // drain bar: what is left of the seal',
    "  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x0, y + h + 2, w, 3);",
    '  ctx.fillStyle = tint; ctx.fillRect(x0, y + h + 2, w * frac, 3);',
    '  ctx.restore();',
    '}',
    'function _drawPlayerStatusIcons(sx, sy) {'));
sub('overhead timer call', '  if (_ctl) _drawPlayerControlBanner(sx, sy, _ctl);',
  J('  if (_ctl) _drawPlayerControlBanner(sx, sy, _ctl);',
    "  if (typeof _lxHealLocked === 'function' && _lxHealLocked()) _drawHealLockTimer(sx, sy, !!_ctl);   // v0.30.588 ohko-pass \u2014 the seal counts down over the head"));
const grew = s.length - n0;
if (grew < 7000 || grew > 12000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: ohko pass — no parry, quiet windows (both bosses), comet heal lock 10 s + HEAL LOCKED pill + overhead countdown (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
