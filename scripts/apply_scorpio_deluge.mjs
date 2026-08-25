// SCORPIO'S VENOM DELUGE — a signature move of her own.
// =============================================================================
// Per user: "further work on scorpio boss mechanics and generate necessary
// sprites especially for signature move".
//
// Scorpio's "signature" was the GENERIC one. _sigMove hands taurus,
// sagittarius, aquarius and scorpio the same columnStrike, so the Venomlord's
// one big move was the same beam Sagitta and Aquari throw, recoloured. Her two
// bespoke mechanics (Stinger Execute at <25% HP, Burrow Ambush every 15s) are
// both SINGLE-POINT threats aimed at where the player is standing, so the fight
// never asked anything of the arena.
//
// The Deluge is arena denial, which is the shape neither of the other two has:
// she rears, and venom rains across the floor in a line of lingering pools with
// exactly one gap. It is dodgeable by reading the gap, and it makes the ground
// itself the threat instead of a spot under your feet.
//
// The column is deliberately KEPT. It has its own authored per-sign art
// (fx_col_zodiac_scorpio, v0.30.91) and works as her ranged poke; the Deluge
// layers on top as the rarer, bigger beat.
//
// Guarded + atomic + idempotent + EOL-aware, like the octobaby patches.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
if (s.includes('LX_SCORPIO_DELUGE_CD')) { console.log('already applied — nothing to do'); process.exit(0); }

const sub = (label, anchor, after) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c} times, expected 1`); process.exit(1); }
  s = s.replace(anchor, after.split('\n').join(EOL));
};

// ---- 1. register the two VFX sprites --------------------------------------
sub('vfx-files', `    flamePatch:      'flame_patch.webp',`,
`    scorpioVenomPool: 'scorpio_venompool.webp',  // v0.30.x — Scorpio Venom Deluge lingering pool
    scorpioDeluge:    'scorpio_deluge.webp',      // v0.30.x — Scorpio Venom Deluge impact burst
    flamePatch:      'flame_patch.webp',`);

sub('vfx-anim', `  dashStreak: 'dash_streak', lavaDrop: 'lava_drop', lavaPool: 'lava_pool',`,
`  dashStreak: 'dash_streak', lavaDrop: 'lava_drop', lavaPool: 'lava_pool',
  scorpioVenomPool: 'scorpio_venompool',`);

// ---- 2. constants + the move itself ---------------------------------------
sub('helpers', 'function drawHazards() {',
`// =========================================================================
// v0.30.x — SCORPIO'S VENOM DELUGE. See scripts/apply_scorpio_deluge.mjs for
// why she needed one: _sigMove gave her the same columnStrike as three other
// signs, and both of her bespoke mechanics aim at the tile the player is
// standing on. This one attacks the FLOOR.
//
// The gap is the whole design. Pools are laid across the arena with exactly one
// interior slot left empty, and it is never an outermost slot — an edge gap can
// be walled off by arena geometry, an interior one is always approachable from
// two sides. That is what keeps this a dodge rather than a tax.
const LX_SCORPIO_DELUGE_CD    = 13000;   // ms between deluges
const LX_SCORPIO_DELUGE_TELE  = 950;     // rear-up telegraph before it lands
const LX_SCORPIO_DELUGE_SLOTS = 6;       // slots across the arena; one is left open
const LX_SCORPIO_POOL_W       = 150;
const LX_SCORPIO_POOL_FRAMES  = 330;     // ~5.5s of lingering venom
function _lxScorpioDelugeSpots(m) {
  const _ww = (game.mapData && game.mapData.worldWidth) || 2000;
  const n = LX_SCORPIO_DELUGE_SLOTS;
  const span = Math.min(Math.max(600, _ww - 160), 1700);
  let left = (m.x + m.w / 2) - span / 2;
  left = Math.max(70, Math.min(left, Math.max(70, _ww - 70 - span)));
  const step = span / n;
  // interior only, so the gap can always be reached from either side
  const gap = 1 + Math.floor(Math.random() * Math.max(1, n - 2));
  const spots = [];
  for (let i = 0; i < n; i++) {
    if (i === gap) continue;
    spots.push(Math.round(left + step * (i + 0.5)));
  }
  return spots;
}
function _lxScorpioDelugeFire(m) {
  const gy = m.y + m.h - 4;
  const dmg = Math.max(18, Math.floor((m.atk || 300) * 0.16));
  for (const px of (m._delugeSpots || [])) {
    game.hazards.push({
      type: 'venom_pool',
      x: px - LX_SCORPIO_POOL_W / 2, y: gy - 16,
      cx: px, cy: gy,
      w: LX_SCORPIO_POOL_W, h: 28,
      life: LX_SCORPIO_POOL_FRAMES, maxLife: LX_SCORPIO_POOL_FRAMES,
      owner: 'enemy', damage: dmg, _owner: m,
      _sourceLabel: "Scorpio's Venom Deluge",
    });
    // Impact burst — art only, no damage of its own; the pool is the threat.
    game.hazards.push({
      type: 'venom_burst',
      x: px - 70, y: gy - 120, cx: px, cy: gy,
      w: 140, h: 140, life: 22, maxLife: 22,
      owner: 'enemy', _markerOnly: true,
    });
  }
  m._delugeSpots = null;
  if (typeof addShake === 'function') addShake(14);
  if (typeof flash === 'function') flash(0.28);
  if (typeof audio !== 'undefined' && audio.play) audio.play('crit');
}
function _lxScorpioDeluge(m, dt) {
  if (typeof player === 'undefined' || !player || player.hp <= 0) return;
  // Never overlap her other committed moves: the execute and the burrow both
  // own the screen while they resolve, and stacking a floor-denial pattern on
  // top of an unavoidable-looking execute reads as unfair rather than hard.
  if (m._burrowing || m._scorpStingerArmed || m.patternState === 'burrow') return;
  if (m._delugeCd == null) m._delugeCd = LX_SCORPIO_DELUGE_CD * 0.55;
  if ((m._delugeTele || 0) > 0) {
    m._delugeTele -= dt;
    // keep the rear-up pose on screen for the whole windup
    m.atkAnimUntil = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) + 200;
    if (m._delugeTele <= 0) { m._delugeTele = 0; _lxScorpioDelugeFire(m); }
    return;
  }
  m._delugeCd -= dt;
  if (m._delugeCd > 0) return;
  m._delugeCd = LX_SCORPIO_DELUGE_CD;
  m._delugeTele = LX_SCORPIO_DELUGE_TELE;
  m._delugeSpots = _lxScorpioDelugeSpots(m);
  // Telegraph every landing spot, so the gap is readable BEFORE the venom
  // lands rather than discovered by standing in it.
  const gy = m.y + m.h - 4;
  for (const px of m._delugeSpots) {
    game.hazards.push({
      type: 'meteor_warn', x: px - LX_SCORPIO_POOL_W / 2, y: gy,
      cx: px, w: LX_SCORPIO_POOL_W, h: 26, radius: LX_SCORPIO_POOL_W / 2,
      life: Math.round(LX_SCORPIO_DELUGE_TELE / 16.67), maxLife: Math.round(LX_SCORPIO_DELUGE_TELE / 16.67),
      owner: 'enemy', color: '#ff66cc', _markerOnly: true,
      _sourceLabel: "Scorpio's Venom Deluge",
    });
  }
  if (typeof showToast === 'function') showToast('\u{1F982} SCORPIO REARS \u2014 VENOM DELUGE! Find the gap', 'legendary');
  if (typeof addShake === 'function') addShake(7);
}
function drawHazards() {`);

// ---- 3. drive it from her AI ----------------------------------------------
sub('ai-call', `    // v0.26.086 — Per user "Scorpio Burrow Ambush — Scorpio disappears`,
`    // v0.30.x — VENOM DELUGE, her signature. Placed after the execute so that
    // block's armed-state is already resolved this frame when the Deluge checks
    // whether it is allowed to fire.
    _lxScorpioDeluge(m, dt);
    // v0.26.086 — Per user "Scorpio Burrow Ambush — Scorpio disappears`);

// ---- 4. hazard behaviour ---------------------------------------------------
sub('hazard-update', `    // v0.25.647 — gloop_puddle: persistent shallow puddle from King`,
`    // v0.30.x — venom_burst: the Deluge's impact art. No damage of its own.
    if (h.type === 'venom_burst') {
      if (h.life <= 0) { game.hazards.splice(i, 1); }
      continue;
    }
    // v0.30.x — venom_pool: Scorpio's lingering Deluge venom. Modelled on
    // gloop_puddle below, but it POISONS as well as chipping — she is the
    // Venomlord, and a pool that only slowed would be Gloopaloo in pink. The
    // poison is refreshed while you stand in it and then ticks on after you
    // leave, so stepping out early still costs something.
    if (h.type === 'venom_pool') {
      if (h.life <= 0) { game.hazards.splice(i, 1); continue; }
      // A pool outlives its caster by up to its whole lifetime, and the boss
      // victory window is seconds long — same reasoning as mob_quake's owner
      // check. Venom dies with the Venomlord.
      if (h._owner && (h._owner.currentHp <= 0 ||
          (game.monsters && game.monsters.indexOf(h._owner) < 0))) {
        game.hazards.splice(i, 1); continue;
      }
      if (player && player.hp > 0 && player.invulnerable <= 0) {
        const _vBox = { x: h.x, y: h.y, w: h.w, h: h.h };
        if (typeof aabb === 'function' && aabb(_vBox, player)) {
          player._slowTimer = Math.max(player._slowTimer || 0, 260);
          player._poisonTimer = Math.max(player._poisonTimer || 0, 3200);
          player._poisonDmg = Math.max(player._poisonDmg || 0, Math.max(1, Math.floor((h.damage || 18) * 0.35)));
          if ((h._chipTick == null) || h._chipTick <= 0) {
            // Full DR stack, matching gloop_puddle's v0.25.648 pipeline: DEF,
            // block, warrior DR, Aegis, godmode and difficulty all apply.
            let dmg = Math.max(1, Math.floor((h.damage || 18) - (typeof getDef === 'function' ? getDef() : 0) * 0.4));
            if (player.blockTimer > 0) {
              dmg = Math.max(1, Math.floor(dmg * 0.3));
              if (typeof triggerBlock === 'function') triggerBlock();
            }
            if (player.cls === 'warrior' && typeof _warriorDr === 'function') dmg = Math.max(1, Math.floor(dmg * _warriorDr()));
            if (player._aegis) dmg = Math.max(1, Math.floor(dmg * 0.5));
            player.hp -= (player._god ? 0 : ((typeof _diffDmg === 'function') ? _diffDmg(dmg) : dmg));
            player.lastHitTime = game.time;
            player._lastDamageSource = "Scorpio's Venom Deluge";
            if (game.damageNumbers) {
              game.damageNumbers.push({ x: player.x + 14, y: player.y, vy: -2,
                text: '-' + dmg, life: 26, color: '#ff66cc', size: 11 });
            }
            h._chipTick = 26;
          } else { h._chipTick -= 1; }
        }
      }
      if (game.time % 12 === 0 && typeof _budgetedParticlePush === 'function') {
        _budgetedParticlePush({
          x: h.cx + (Math.random() - 0.5) * (h.w * 0.55), y: h.y + 4,
          vx: (Math.random() - 0.5) * 0.4, vy: -0.45 - Math.random() * 0.35,
          life: 16, color: '#ff66cc', size: 1.6,
        });
      }
      continue;
    }
    // v0.25.647 — gloop_puddle: persistent shallow puddle from King`);

// ---- 5. hazard rendering ---------------------------------------------------
sub('hazard-draw', `    // v0.25.647 — gloop_puddle render: wobbly blue jelly ellipse with a`,
`    // v0.30.x — Scorpio's Venom Deluge. Both use authored art with a primitive
    // fallback, the same contract every other hazard here follows.
    if (h.type === 'venom_burst') {
      const _t = 1 - (h.life / Math.max(1, h.maxLife));
      const _img = (typeof _lxVfxFrame === 'function') ? _lxVfxFrame('scorpioDeluge') : null;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - _t) * 0.95;
      if (typeof _lxVfxReady === 'function' && _lxVfxReady(_img)) {
        const _bw = h.w * (0.7 + _t * 0.7), _bh = h.h * (0.7 + _t * 0.7);
        ctx.drawImage(_img, sx - _bw / 2, h.cy - _bh * 0.86, _bw, _bh);
      } else {
        ctx.fillStyle = 'rgba(255,102,204,0.5)';
        ctx.beginPath(); ctx.arc(sx, h.cy - 20, 20 + _t * 40, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      continue;
    }
    if (h.type === 'venom_pool') {
      const fade = Math.min(1, h.life / 40);
      const wobble = Math.sin((game.time + (h.cx | 0)) * 0.16) * 1.6;
      const rx = h.w / 2 + wobble, ry = h.h / 2;
      ctx.save();
      const _vp = (typeof _lxVfxFrame === 'function') ? _lxVfxFrame('scorpioVenomPool') : null;
      if (typeof _lxVfxReady === 'function' && _lxVfxReady(_vp)) {
        // The art is authored as a wide shallow ellipse with margin, so it is
        // overdrawn slightly and anchored to the floor line rather than centred.
        const _pw = rx * 2.3, _ph = ry * 3.4;
        ctx.globalAlpha = Math.min(1, 0.95 * fade);
        ctx.drawImage(_vp, sx - _pw / 2, h.cy - _ph * 0.60, _pw, _ph);
        ctx.restore();
        continue;
      }
      ctx.fillStyle = \`rgba(136,34,102,\${0.6 * fade})\`;
      ctx.beginPath(); ctx.ellipse(sx, h.cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = \`rgba(255,102,204,\${0.7 * fade})\`;
      ctx.beginPath(); ctx.ellipse(sx - rx * 0.2, h.cy - ry * 0.4, rx * 0.45, ry * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = \`rgba(51,0,34,\${0.75 * fade})\`;
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.ellipse(sx, h.cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      continue;
    }
    // v0.25.647 — gloop_puddle render: wobbly blue jelly ellipse with a`);

// ---- 6. scrub her venom when she dies --------------------------------------
sub('death-scrub', `  if (m.type === 'king' || m.type === 'gravitos') {`,
`  // v0.30.x — Scorpio's pools linger ~5.5s and the boss-victory window is
  // seconds long, so without this the Venomlord can still kill you during her
  // own death animation. The per-pool _owner check covers the live case; this
  // is the same belt-and-suspenders splice king/gravitos get.
  if (m.type === 'scorpio' || m.zodiacId === 'scorpio') {
    for (let _hi = game.hazards.length - 1; _hi >= 0; _hi--) {
      const _h = game.hazards[_hi];
      if (_h && (_h.type === 'venom_pool' || _h.type === 'venom_burst')) game.hazards.splice(_hi, 1);
    }
  }
  if (m.type === 'king' || m.type === 'gravitos') {`);

writeFileSync(F + '.tmp', s, 'utf8');
const n = statSync(F + '.tmp').size;
if (n <= n0) { console.error(`ABORT: tmp ${n}B not larger than ${n0}B`); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: ${n0} -> ${s.length} chars (+${s.length - n0})`);
