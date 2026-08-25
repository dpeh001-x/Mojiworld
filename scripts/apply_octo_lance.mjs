// Octobaby follow-up 2: tankier arms (+50% HP, more DEF) and an occasional
// MOOD LANCE — a projectile that stuns and takes 33% of the player's max HP.
// Per user: "make the 4 arms have more def and have 50% more HP" and "make the
// tentacles occasional shoot projectiles that stun and deal 33% HP damage".
// Guarded + atomic + idempotent.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
// This file is CRLF. A multi-line anchor joined with '\n' matches ZERO times
// here — the first run of this script aborted on exactly that — so the EOL is
// detected once and every multi-line anchor and insert is joined with it.
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
if (s.includes('LX_OCTO_LANCE_EVERY')) { console.log('already applied — nothing to do'); process.exit(0); }
if (!s.includes('LX_OCTO_AILMENT_MS')) { console.error('ABORT: apply_octo_moods.mjs must run first'); process.exit(1); }

// ---- 1. HP 400k -> 600k (+50%) --------------------------------------------
const hpN = s.split('hp:400000,').length - 1;
if (hpN !== 4) { console.error(`ABORT: expected 4 'hp:400000,', found ${hpN}`); process.exit(1); }
s = s.split('hp:400000,').join('hp:600000,');

// ---- 2. DEF 120 -> 600, ONLY on the four tentacle rows ---------------------
// 'def:120,' occurs 8 times in the file; half of those are other monsters, so
// this is scoped to the octoLeg* rows by name rather than replaced globally.
let defHits = 0;
s = s.replace(/(octoLeg(?:Poison|Freeze|SkillLock|Stun):\s*\{[^}]*?)def:120,/g,
  (_m, pre) => { defHits++; return pre + 'def:600,'; });
if (defHits !== 4) { console.error(`ABORT: expected 4 tentacle def rows, rewrote ${defHits}`); process.exit(1); }

// ---- 3. the MOOD LANCE ----------------------------------------------------
const A = 'const LX_OCTO_AILMENT_TELE_MS = 1200;';
if (s.split(A).length - 1 !== 1) { console.error('ABORT: lance anchor not unique'); process.exit(1); }
s = s.replace(A, A + (`
// v0.30.x — THE MOOD LANCE (per user: the tentacles should "occasional shoot
// projectiles that stun and deal 33% HP damage").
//
// Every 4th shot from a given arm is upgraded instead of adding a second
// firing timer: the arms already stagger their cadence against each other via
// _octoFireT, so counting per-arm inherits that spread for free and the four
// lances never arrive together.
//
// Damage rides the EXISTING _radiance channel rather than a new one. That is
// the pillar-of-judgment path, and it already does exactly what was asked —
// a flat fraction of the player's CURRENT max HP — while routing through
// block, warrior DR and Aegis, so the hit stays mitigable and the player has
// counterplay instead of a flat unavoidable third of their bar.
//
// Homing is deliberately switched OFF for the lance. The ordinary status shot
// homes, which is fine at 0.7x ATK; a homing 33% hit would be undodgeable by
// construction. This one has to be side-stepped, which is what makes a hit
// feel earned rather than taxed.
const LX_OCTO_LANCE_EVERY = 4;       // every 4th shot from that arm
const LX_OCTO_LANCE_HP_FRAC = 0.33;  // 33% of max HP
const LX_OCTO_LANCE_STUN_MS = 900;
function _lxOctoMaybeLance(leg, proj) {
  if (!leg || !proj) return false;
  leg._octoShots = (leg._octoShots | 0) + 1;
  if (leg._octoShots % LX_OCTO_LANCE_EVERY !== 0) return false;
  proj.color = '#ff4d6d';
  proj.w = 46; proj.h = 46;
  proj.homing = false;                 // must be dodgeable — see above
  proj.vx *= 0.75; proj.vy *= 0.75;    // slower, so the read is fair
  proj.stun = LX_OCTO_LANCE_STUN_MS;
  proj.stunHit = LX_OCTO_LANCE_STUN_MS;
  proj._octoLance = true;
  proj._radiance = { chance: 1, frac: LX_OCTO_LANCE_HP_FRAC, flat: true,
                     label: 'a mood lance', color: '#ff8fa3' };
  if (typeof showToast === 'function') showToast('\u{1F991} MOOD LANCE \u2014 dodge it', 'epic');
  if (typeof addShake === 'function') addShake(6);
  if (typeof audio !== 'undefined' && audio.play) audio.play('crit');
  return true;
}`).split('\n').join(EOL));

// ---- 4. call it from BOTH leg fire sites -----------------------------------
// The anchored orbit path and the phase-2 "loose" path each build their own
// projectile literal; upgrading only one would make the lance vanish for half
// the fight.
const SITE_A = [
  `        else                                     { _proj.color = '#ffee44'; _proj.stun = 1800; }`,
  `        game.projectiles.push(_proj);`,
].join(EOL);
const SITE_B = [
  `      else                                     { proj.color = '#ffee44'; proj.stun = 1800; }`,
  `      game.projectiles.push(proj);`,
].join(EOL);
for (const [tag, site, v] of [['A', SITE_A, '_proj'], ['B', SITE_B, 'proj']]) {
  const c = s.split(site).length - 1;
  if (c !== 1) { console.error(`ABORT: fire site ${tag} matched ${c} times`); process.exit(1); }
  const pad = tag === 'A' ? '        ' : '      ';
  s = s.replace(site, site.replace(`game.projectiles.push(${v});`,
    `_lxOctoMaybeLance(m, ${v});${EOL}${pad}game.projectiles.push(${v});`));
}

writeFileSync(F + '.tmp', s, 'utf8');
const n = statSync(F + '.tmp').size;
if (n <= n0) { console.error(`ABORT: tmp ${n}B not larger than ${n0}B`); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: ${n0} -> ${s.length} chars (+${s.length - n0})`);
console.log('  tentacle HP  400000 -> 600000 (+50%)');
console.log(`  tentacle DEF 120 -> 600 on ${defHits} rows`);
console.log('  MOOD LANCE: every 4th shot, 33% max HP + 900ms stun, non-homing');
