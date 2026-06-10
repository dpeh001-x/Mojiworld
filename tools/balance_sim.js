// Optimization-layer DPS gap sim — replicates the live formulas.
// Compares, at L90, SAME T10 gear: optimized (★10 + god affixes + boons,
// everything capped) vs unoptimized (★0, no affixes, no boons).
// Prestige & temp buffs excluded (out of scope / shared).

const FLAT = new Set(['atk','def','hp','mp','crit','accuracy']);
const TIER_MUL = [1,1,1,1,1,1,1.12,1.28,1.48,1.72,2.00];
let STAR_GROWTH = 1.08;          // tunable
let PCT_CAP = 4.0;               // getAtk pct clamp (tunable)
let CRITDMG_CAP = 4.0;           // getCritDmg clamp (tunable)
let ITEM_CRIT_CAP = 30;          // per-item crit contribution cap (tunable)
let AFFIX_LVL_COEF = 0.04;       // affix magnitude per (mobLevel-1) (tunable)
const starMul = s => Math.pow(STAR_GROWTH, s);
const tierMul = t => TIER_MUL[t] || 1;

// T10 sets [weapon, armor, accessory]
const SETS = {
  warrior: [
    {atk:410,crit:24,hp:380,atkPct:0.20,critDmg:0.50,lifesteal:0.08,tier:10},
    {def:305,hp:900,atk:38,atkPct:0.28,lifesteal:0.06,tier:10},
    {atk:65,def:120,hp:520,atkPct:0.30,lifesteal:0.10,critDmg:0.40,tier:10},
  ],
  rogue: [
    {atk:330,crit:60,lifesteal:0.18,speed:0.80,critDmg:0.40,tier:10},
    {def:175,hp:580,crit:50,speed:0.95,critDmg:0.35,tier:10},
    {atk:42,def:55,crit:65,critDmg:0.45,lifesteal:0.16,speed:0.40,tier:10},
  ],
  mage: [
    {atk:355,mp:240,crit:40,atkPct:0.35,critDmg:0.45,tier:10},
    {def:145,hp:560,mp:330,atkPct:0.32,crit:28,critDmg:0.35,tier:10},
    {atk:55,def:48,mp:260,crit:40,atkPct:0.30,critDmg:0.50,tier:10},
  ],
  archer: [
    {atk:370,crit:48,speed:0.95,multishot:3,critDmg:0.35,tier:10},
    {def:195,hp:620,crit:38,speed:1.05,multishot:2,critDmg:0.30,tier:10},
    {atk:55,def:65,crit:42,multishot:3,speed:0.85,critDmg:0.40,tier:10},
  ],
};
const baseAtk = cls => cls==='warrior' ? 12+89*3 : 12+89*2;   // L90
const classMul = cls => ({warrior:1,rogue:1.15,mage:1.32,archer:1.25}[cls]);  // v0.26.461 mage 1.20->1.32

// God-roll affix bundle per item (pre-scale): 2 prefix + 2 suffix, offensive.
function affixBundle() {
  return { atk: 11, crit: 5, atkPct: 0.20+0.23, critDmg: 0.40, hp: 59, lifesteal: 0.11 };
}
// Boons an optimized build runs (modest; caps below absorb most of it anyway).
const BOON = { atk: 250, atkPct: 0.25, crit: 18, critDmg: 0.30 };

function equipBonus(items, opt, mobLevel) {
  const lvlMul = 1 + (mobLevel-1)*AFFIX_LVL_COEF;
  const out = {};
  for (const it of items) {
    const merged = {...it};
    if (opt) {
      const af = affixBundle();
      for (const k in af) {
        let v = af[k];
        if (k!=='multishot') v = (Number.isInteger(v)? Math.round(v*lvlMul) : v*lvlMul);
        merged[k] = (merged[k]||0) + v;
      }
    }
    const s = opt ? 10 : 0;
    const NO_STAR = new Set(['multishot','burn','extraJumps']);   // discrete flags — must NOT scale
    for (const k in merged) {
      if (k==='tier' || typeof merged[k]!=='number') continue;
      const sm = NO_STAR.has(k) ? 1 : starMul(s);
      const tm = (FLAT.has(k) && !NO_STAR.has(k)) ? tierMul(it.tier) : 1;
      let c = merged[k] * sm * tm;
      if (k==='crit' && c > ITEM_CRIT_CAP) c = ITEM_CRIT_CAP;
      out[k] = (out[k]||0) + c;
    }
  }
  if (opt) for (const k in BOON) out[k] = (out[k]||0) + BOON[k];
  return out;
}

function dps(cls, opt) {
  const eb = equipBonus(SETS[cls], opt, 90);
  const base = baseAtk(cls) + (eb.atk||0);
  let pct = 1 + (eb.atkPct||0);
  pct = Math.min(PCT_CAP, pct);
  const atk = base * pct * 1 * 1 * classMul(cls);
  let crit = 5 + (eb.crit||0); if (cls==='rogue') crit*=1.2; crit = Math.min(100, crit);
  const critMult = Math.min(CRITDMG_CAP, 1.5 + (eb.critDmg||0));
  const cf = (crit/100)*critMult + (1-crit/100);
  const ms = 1 + (eb.multishot||0);     // projectiles
  return atk * cf * ms;
}

function critDetail(cls, opt) {
  const eb = equipBonus(SETS[cls], opt, 90);
  let crit = 5 + (eb.crit||0); if (cls==='rogue') crit*=1.2; crit = Math.min(100, crit);
  const critMult = Math.min(CRITDMG_CAP, 1.5 + (eb.critDmg||0));
  const cf = (crit/100)*critMult + (1-crit/100);
  return { crit:Math.round(crit), critMult:critMult.toFixed(2), cf:cf.toFixed(2) };
}
function report(tag) {
  console.log(`\n=== ${tag} | CRITDMG_CAP=${CRITDMG_CAP} ITEM_CRIT_CAP=${ITEM_CRIT_CAP} ===`);
  let sum=0,n=0;
  for (const cls of ['warrior','rogue','mage','archer']) {
    const o=dps(cls,true), u=dps(cls,false), r=o/u;
    const cd=critDetail(cls,true);
    sum+=r; n++;
    console.log(`${cls.padEnd(8)} opt=${o.toFixed(0).padStart(8)} ratio=${r.toFixed(1)}x  [optCrit ${cd.crit}% × ${cd.critMult} → critFactor ${cd.cf}]`);
  }
  console.log(`AVERAGE ratio = ${(sum/n).toFixed(1)}x`);
}

report('CURRENT (post-multishot fix)');
// --- proposed crit/critDmg nerf ---
CRITDMG_CAP = 3.0;     // max crit hit 4.0x -> 3.0x
ITEM_CRIT_CAP = 20;    // per-item crit 30 -> 20 (3 slots ~60% + base, vs 90%)
report('PROPOSED crit nerf');
