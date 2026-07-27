// balance_sim.mjs — incoming-damage simulator for mojiworld_game.html.
//
//   node scripts/balance_sim.mjs
//
// Reports how much damage a warrior / mage in average gear takes at every
// 10-level interval from Lv 20, and how many hits it takes to kill them.
// The band constants are READ OUT OF THE GAME FILE at run time, so the sim
// cannot silently drift from what actually ships — retune the table in
// mojiworld_game.html and re-run this to see the effect immediately.
//
// Mitigation chain modelled (mirrors the live order exactly):
//   band clamp -> DEF pierce -> flat DEF -> class DR -> absorb curve
//   -> contact floor (touch only) -> difficulty punish -> raw guard
//
// Assumptions, deliberately conservative: Normal difficulty, star-0 gear, no
// stat-point investment from level-ups, no blocking or buffs, mean damage
// roll. A real player invests level-up points, so treat these as a floor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');

function grab(re, name) {
  const m = src.match(re);
  if (!m) throw new Error(`could not read ${name} from mojiworld_game.html`);
  return m[1];
}
const BAND_TABLE = JSON.parse(
  '[' + grab(/const _DMG_BAND_TABLE = \[([\s\S]*?)\];/, '_DMG_BAND_TABLE')
    .replace(/\s+/g, '').replace(/,$/, '') + ']');
const CAP_RATIO   = parseFloat(grab(/const _BAND_CAP_RATIO = ([\d.]+)/, '_BAND_CAP_RATIO'));
const TOUCH_RATIO = parseFloat(grab(/const _BAND_TOUCH_RATIO = ([\d.]+)/, '_BAND_TOUCH_RATIO'));
const GEAR_ALLOW  = parseFloat(grab(/const _REF_GEAR_ALLOWANCE = ([\d.]+)/, '_REF_GEAR_ALLOWANCE'));
const CLASS_REF   = JSON.parse('{' + grab(/const _CLASS_HP_REF = \{([^}]*)\}/, '_CLASS_HP_REF')
  .replace(/(\w+):/g, '"$1":').replace(/,\s*$/, '') + '}');

function bandPct(lv) {
  const L = Math.max(1, Math.min(100, lv | 0));
  let p = BAND_TABLE[BAND_TABLE.length - 1][1];
  for (let i = 0; i < BAND_TABLE.length - 1; i++) {
    const a = BAND_TABLE[i], b = BAND_TABLE[i + 1];
    if (L >= a[0] && L <= b[0]) { p = a[1] + (b[1] - a[1]) * ((L - a[0]) / (b[0] - a[0])); break; }
  }
  const t = p * TOUCH_RATIO;
  return { pFloor: p, pCap: p * CAP_RATIO, tFloor: t, tCap: t * CAP_RATIO };
}

// Player model — class bases + per-level gains as defined in the game file.
const CLASS_BASE = {
  warrior: { hp: 150, def: 11, hpGain: 30, defGain: 2, hpMul: 1.30 },
  mage:    { hp: 70,  def: 2,  hpGain: 15, defGain: 1, hpMul: 1.12 },
};
// "Average gear": class-appropriate armor+weapon+accessory at the tier a
// normally-progressing player wears in that level band.
const GEAR = {
  warrior: { 20:{t:2,d:18,h:50}, 30:{t:3,d:21,h:130}, 40:{t:4,d:68,h:270},
             50:{t:5,d:56,h:430}, 60:{t:6,d:95,h:420}, 70:{t:7,d:135,h:410}, 80:{t:8,d:170,h:520} },
  mage:    { 20:{t:2,d:6,h:25},  30:{t:3,d:12,h:50},  40:{t:4,d:36,h:75},
             50:{t:5,d:18,h:140}, 60:{t:6,d:50,h:190}, 70:{t:7,d:70,h:255},  80:{t:8,d:90,h:320} },
};
const TIER_MUL = [1, 1, 1, 1, 1, 1, 1.12, 1.28, 1.48, 1.72, 2.00];

function build(cls, lv) {
  const b = CLASS_BASE[cls], g = GEAR[cls][lv], tm = TIER_MUL[Math.min(g.t, 10)] || 1;
  let h = (b.hp + b.hpGain * (lv - 1)) + Math.floor(g.h * tm * 1.20);
  h = Math.floor(Math.floor(h * b.hpMul) * 1.5);          // class mul + global x1.5
  let d = (b.def + b.defGain * (lv - 1)) + Math.floor(g.d * tm * 1.20);
  if (cls === 'warrior') d = Math.floor(d * 1.25);
  return { cls, lv, maxHp: h, def: d };
}

const refHp   = (lv, cls) => Math.round((104 + 23.6 * Math.max(1, lv)) * GEAR_ALLOW * (CLASS_REF[cls] || 1));
const absorb  = (def, p) => { if (def <= 0) return 1; let a = Math.min(0.90, def / (def + 500)); if (p < 1) a *= p; return 1 - a; };
const pierce  = (ml, pl) => { const b = Math.max(0, Math.min(0.15, (ml - 50) * 0.003)); const g = ml - pl; const gp = g > 2 ? Math.min(0.60, (g - 2) * 0.06) : 0; return 1 - Math.min(0.75, b + gp); };
const warrDr  = lv => lv <= 50 ? 0.85 : 0.85 - Math.min(1, (lv - 50) / 50) * 0.30;
const diffDmg = (d, src, pl) => Math.max(0, Math.round(d * Math.min(6, 1.3 + Math.max(0, pl - src) * 0.08)));

export function touchDmg(P, lv, atk) {
  const r = refHp(lv, P.cls), bp = bandPct(lv);
  const band = Math.min(Math.floor(r * bp.tCap), Math.max(Math.floor(r * bp.tFloor), Math.floor(atk * 0.28)));
  const pc = pierce(lv, P.lv);
  let d = Math.max(1, band - Math.floor(P.def * 0.5 * pc) + 2);
  if (P.cls === 'warrior') d = Math.max(1, Math.floor(d * warrDr(P.lv)));
  d = Math.max(1, Math.floor(d * absorb(P.def, pc)));
  const floorV = Math.max(2, Math.floor(band * 0.40));     // normal-mob contact floor
  if (d < floorV) d = floorV;
  return diffDmg(d, lv, P.lv);
}
export function projDmg(P, lv, atk) {
  const r = refHp(lv, P.cls), bp = bandPct(lv);
  let s = Math.floor(atk * 1.2);
  s = Math.min(Math.floor(r * bp.pCap), Math.max(Math.floor(r * bp.pFloor), s));
  const pc = pierce(lv, P.lv);
  let d = Math.max(1, s - Math.floor(P.def * 0.5 * pc));
  if (P.cls === 'warrior') d = Math.max(1, Math.floor(d * warrDr(P.lv)));
  d = Math.max(1, Math.floor(d * absorb(P.def, pc)));
  return Math.min(diffDmg(d, lv, P.lv), Math.floor(s * 1.35));
}

// Representative authored ATK values for at-level mobs (weak / hot of the band).
const ENC = { 20:{w:55,h:230}, 30:{w:62,h:128}, 40:{w:98,h:234}, 50:{w:148,h:387},
              60:{w:378,h:604}, 70:{w:495,h:850}, 80:{w:610,h:850} };
const LEVELS = [20, 30, 40, 50, 60, 70, 80];
const targetHits = lv => Math.max(2, 7 - 0.1 * (lv - 20));
const pctOf = (d, hp) => `${(100 * d / hp).toFixed(0)}%`;

console.log(`band constants read from game file: capRatio ${CAP_RATIO}, touchRatio ${TOUCH_RATIO}, ` +
            `gearAllowance ${GEAR_ALLOW}, classRef ${JSON.stringify(CLASS_REF)}`);
for (const cls of ['warrior', 'mage']) {
  console.log(`\n=== ${cls.toUpperCase()} (average gear) ===`);
  console.log('Lv  maxHP   DEF |  touch (ratio)      |  projectile (ratio)   | hits to die  [target]');
  for (const lv of LEVELS) {
    const P = build(cls, lv), e = ENC[lv];
    const tLo = touchDmg(P, lv, e.w), tHi = touchDmg(P, lv, e.h);
    const pLo = projDmg(P, lv, e.w),  pHi = projDmg(P, lv, e.h);
    console.log(
      String(lv).padEnd(3) + String(P.maxHp).padStart(6) + String(P.def).padStart(6) + ' | ' +
      `${tLo}-${tHi}`.padEnd(11) + `(${pctOf(tLo, P.maxHp)}-${pctOf(tHi, P.maxHp)})`.padEnd(10) + ' | ' +
      `${pLo}-${pHi}`.padEnd(12) + `(${pctOf(pLo, P.maxHp)}-${pctOf(pHi, P.maxHp)})`.padEnd(10) + ' | ' +
      `${(P.maxHp / pHi).toFixed(1)}-${(P.maxHp / pLo).toFixed(1)}`.padEnd(12) +
      `[~${targetHits(lv).toFixed(0)}]`);
  }
}
console.log('\n=== does DEF investment still pay off? (Lv 60 mage, at-level shot) ===');
for (const extra of [0, 150, 400, 900]) {
  const P = build('mage', 60); P.def += extra;
  const d = projDmg(P, 60, 490);
  console.log(`  DEF ${String(P.def).padStart(4)} -> ${String(d).padStart(5)} per shot   ` +
              `${(P.maxHp / d).toFixed(1)} hits to die`);
}
