// Regenerate _LX_LEVEL_COST_TABLE in mojiworld_game.html.
//
// The cost of a level is baked as  target_kills(L) x EXP-per-kill(L), so the
// KILL count is the thing being designed and the EXP number is just its
// consequence. That keeps kills smooth even where the mob-EXP tables are lumpy
// (Lv-30 mobs pay less than Lv-15 mobs, which is what produced the old spike).
//
// TARGETS (per user, 2026-07-29) — kills to gain THAT level, against
// same-level monsters, Normal difficulty, no combo/gear/prestige:
//   Lv 30 -> 1,000   Lv 35 -> 2,000   Lv 50 -> 5,000   Lv 60 -> 7,500
//   Lv 65 -> 10,000  Lv 70 -> 20,000  Lv 80 -> 50,000  Lv 85 -> 100,000
//   Lv 90 and above -> 1,000,000
// Below Lv 30 the anchors preserve the current early-game feel (measured).
//
// IMPORTANT — the bake tracks the LIVE multiplier stack. LX_EVENT_EXP_MULT and
// LX_MONSTER_EXP_MULT are read out of the HTML rather than hardcoded, because
// the previous bake assumed event-OFF and was then invalidated when the
// permanent monster mult went 1 -> 10, leaving every level ~10x cheaper than
// its target. RE-RUN THIS SCRIPT after changing ANY EXP knob.
//
//   node scripts/level_time_retune.mjs           # verify only
//   node scripts/level_time_retune.mjs --write   # verify + patch the game file
import fs from 'node:fs';
const PATH = new URL('../mojiworld_game.html', import.meta.url);
const html = fs.readFileSync(PATH, 'utf8');

function extractObject(v) {
  const idx = html.indexOf('const ' + v + ' = {'); const start = html.indexOf('{', idx);
  let d = 0, i = start, s = null, e = false, c = null;
  for (; i < html.length; i++) {
    const ch = html[i], n = html[i + 1];
    if (c === '//') { if (ch === '\n') c = null; continue; } if (c === '/*') { if (ch === '*' && n === '/') { c = null; i++; } continue; }
    if (s) { if (e) e = false; else if (ch === '\\') e = true; else if (ch === s) s = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { s = ch; continue; }
    if (ch === '/' && n === '/') { c = '//'; i++; continue; } if (ch === '/' && n === '*') { c = '/*'; i++; continue; }
    if (ch === '{') d++; else if (ch === '}') { d--; if (d === 0) break; }
  }
  return eval('(' + html.slice(start, i + 1) + ')');
}
const num = (name, dflt) => {
  const m = html.match(new RegExp('const\\s+' + name + '\\s*=\\s*([\\d.]+)\\s*;'));
  return m ? parseFloat(m[1]) : dflt;
};
const EVENT   = num('LX_EVENT_EXP_MULT', 1);
const MONSTER = num('LX_MONSTER_EXP_MULT', 1);
const XP_CURVE = 1.35;                       // global host curve, unchanged
const EARLY = L => (L <= 5 ? 3 : 1);         // v0.26.x early-level kicker

// EXP-per-kill comes from MEASUREMENT, not a model. An earlier version derived
// it as monsterTypes.exp x the multiplier chain and came out ~100x too high:
// it missed the x0.1 scale spawnMonster applies to authored EXP, and the
// level-gap penalty on top. The inflated numbers also pushed Lv 90 past the
// 1e12 save clamp. scripts/levelup_kill_curve.mjs --dump= writes the real
// figures by spawning and killing through the live pipeline.
const PERKILL_FILE = new URL('./level_perkill_measured.json', import.meta.url);
if (!fs.existsSync(PERKILL_FILE)) {
  console.error('missing scripts/level_perkill_measured.json — regenerate it first:\n'
    + '  node serve.js 8775\n'
    + '  node scripts/levelup_kill_curve.mjs 8775 --dump=scripts/level_perkill_measured.json');
  process.exit(2);
}
const MEASURED = JSON.parse(fs.readFileSync(PERKILL_FILE, 'utf8'));
const mLv = Object.keys(MEASURED).map(Number).sort((a, b) => a - b);

// Using the raw per-level measurements directly turned out to be too noisy to
// bake against: which monster you happen to fight at a level swings EXP/kill
// several-fold (Lv 30 mobs measured 1,026-2,369 across runs), so anchors baked
// from one sample missed on the next. Instead: take the SHAPE from the authored
// mob tables (deterministic, smooth, defined at every level) and take the SCALE
// from the measurements, by fitting one calibration constant. That constant
// absorbs everything the raw tables do not model — the x0.1 spawn scale on
// authored EXP, xpCurveMul, and the level-gap penalty.
const monsterTypes = extractObject('monsterTypes'), NAT = extractObject('MOB_NATURAL_LEVEL');
const mobs = [];
for (const k in monsterTypes) {
  const m = monsterTypes[k];
  if (!m || typeof m !== 'object' || m.exp == null || m.boss || /^octoLeg/.test(k)) continue;
  if (/^(tower|express|ticket|conductor|mirror)/i.test(k)) continue;
  const lvl = (m.level != null) ? m.level : NAT[k]; if (lvl == null) continue;
  mobs.push({ k, lvl, exp: m.exp });
}
mobs.sort((a, b) => a.lvl - b.lvl);
const TOP_MOB = mobs[mobs.length - 1].lvl;
const avgAdj = L => {
  const at = Math.min(L, TOP_MOB);          // past the top mob you keep fighting it
  let p = mobs.filter(m => Math.abs(m.lvl - at) <= 2);
  if (!p.length) p = mobs.slice().sort((a, b) => Math.abs(a.lvl - at) - Math.abs(b.lvl - at)).slice(0, 3);
  return p.reduce((s, m) => s + m.exp, 0) / p.length;
};
// NOTE: a calibrated-shape model (mob tables x one fitted scalar) was tried and
// REJECTED — it reproduced the measurements with a median error of 64%, because
// authored EXP does not track delivered EXP closely enough once xpCurveMul and
// the level-gap penalty are in play. Direct measurement wins; the mob tables are
// used only to extend past the last measured level.
const TOP_MEASURED = mLv[mLv.length - 1];
function perKill(L) {
  if (L <= mLv[0]) return MEASURED[mLv[0]].perKill;
  if (L >= TOP_MEASURED) return MEASURED[TOP_MEASURED].perKill;
  if (MEASURED[L]) return MEASURED[L].perKill;
  let lo = mLv[0], hi = TOP_MEASURED;
  for (const k of mLv) { if (k <= L) lo = k; else { hi = k; break; } }
  const a = MEASURED[lo].perKill, b2 = MEASURED[hi].perKill;
  return a * Math.pow(b2 / a, (L - lo) / (hi - lo));
}

// --- target kills per level -------------------------------------------------
// Anchors are exact; between them the count grows geometrically so the ramp is
// smooth in the way a player feels it (a constant % harder each level) rather
// than linear jumps.
const ANCHORS = [
  [1, 8], [5, 8], [10, 13], [15, 26], [20, 65], [25, 103],   // measured early game, preserved
  [30, 1000], [35, 2000], [50, 5000], [60, 7500], [65, 10000],
  [70, 20000], [80, 50000], [85, 100000], [90, 1000000], [200, 1000000],
];
function targetKills(L) {
  if (L <= ANCHORS[0][0]) return ANCHORS[0][1];
  for (let i = 1; i < ANCHORS.length; i++) {
    const [x0, y0] = ANCHORS[i - 1], [x1, y1] = ANCHORS[i];
    if (L <= x1) {
      if (y0 === y1) return y0;
      const f = (L - x0) / (x1 - x0);
      return y0 * Math.pow(y1 / y0, f);          // geometric interpolation
    }
  }
  return ANCHORS[ANCHORS.length - 1][1];
}

// Cost is pinned EXACTLY at the anchors, then interpolated geometrically
// BETWEEN them — not computed per level.
// Why: the mob-EXP tables are genuinely lumpy (27 of 65 consecutive levels pay
// LESS per kill than the level below; Lv 46 pays 18% of Lv 45). Baking
// target_kills x perKill at every level honours a kill count nobody specified
// for the in-between levels and, in exchange, makes the EXP bar lurch — a
// level costing a fifth of the one before it. Pinning the anchors and
// smoothing between them keeps the requested targets exact where they were
// actually requested, and keeps the curve monotonic everywhere else.
const anchorCost = new Map();
for (const [L] of ANCHORS) {
  if (L <= 200) anchorCost.set(L, Math.max(15, Math.round(targetKills(L) * perKill(L))));
}
const aLv = [...anchorCost.keys()].sort((a, b) => a - b);
function costAt(L) {
  if (L <= aLv[0]) return anchorCost.get(aLv[0]);
  if (L >= aLv[aLv.length - 1]) return anchorCost.get(aLv[aLv.length - 1]);
  if (anchorCost.has(L)) return anchorCost.get(L);
  let lo = aLv[0], hi = aLv[aLv.length - 1];
  for (const k of aLv) { if (k <= L) lo = k; else { hi = k; break; } }
  const a = anchorCost.get(lo), b2 = anchorCost.get(hi);
  const f = (L - lo) / (hi - lo);
  return Math.round(a * Math.pow(b2 / a, f));
}
const COST = [];
let running = 0;
for (let L = 1; L <= 200; L++) {
  // Monotonic guard: the EXP needed for a level must never fall below the
  // previous level's, whatever the local mob tables do.
  running = Math.max(running, Math.max(15, costAt(L)));
  COST.push(running);
}
const cost = L => (L < 1 ? COST[0] : L <= 200 ? COST[L - 1] : COST[199]);

// --- verification -----------------------------------------------------------
console.log(`live stack: event x${EVENT}  monster x${MONSTER}  curve x${XP_CURVE}`);
console.log(`EXP/kill: measured at ${mLv.length} levels (1-${TOP_MEASURED}), interpolated between,`
  + ` held flat above (top field mob is Lv ${TOP_MOB})`);
console.log('\n  Lv    target kills    baked kills    EXP/kill      EXP to next');
let bad = 0;
for (const [L, want] of ANCHORS) {
  if (L > 200) continue;
  const got = cost(L) / perKill(L);
  const off = Math.abs(got - want) / want;
  if (off > 0.02) bad++;
  console.log('  ' + String(L).padStart(3)
    + String(Math.round(want)).toLocaleString().padStart(15)
    + String(Math.round(got)).toLocaleString().padStart(15)
    + String(Math.round(perKill(L))).toLocaleString().padStart(12)
    + String(cost(L)).toLocaleString().padStart(17)
    + (off > 0.02 ? '   <== OFF' : ''));
}
const maxCost = Math.max(...COST);
console.log(`\nmax EXP-to-next: ${maxCost.toLocaleString()} (save clamp 1e12) -> ${maxCost < 1e12 ? 'OK' : 'EXCEEDS CLAMP'}`);
let cum = 0;
for (let L = 1; L < 90; L++) cum += cost(L) / perKill(L);
console.log(`cumulative kills Lv1 -> Lv90: ${Math.round(cum).toLocaleString()}`);
console.log(`anchors off by >2%: ${bad}`);

let out = 'const _LX_LEVEL_COST_TABLE = [\n';
for (let i = 0; i < COST.length; i += 10) out += '  ' + COST.slice(i, i + 10).join(',') + (i + 10 < COST.length ? ',' : '') + '\n';
out += '];';

if (process.argv.includes('--write')) {
  const re = /const _LX_LEVEL_COST_TABLE = \[[\s\S]*?\n\];/;
  if (!re.test(html)) { console.error('could not locate the existing table'); process.exit(1); }
  const next = html.replace(re, out);
  if (next === html) { console.error('replacement was a no-op'); process.exit(1); }
  // atomic write per CLAUDE.md file-safety rules
  fs.writeFileSync(PATH.pathname.replace(/^\//, '') + '.tmp', next);
  fs.renameSync(PATH.pathname.replace(/^\//, '') + '.tmp', PATH.pathname.replace(/^\//, ''));
  console.log('\npatched mojiworld_game.html');
} else {
  console.log('\n(dry run — pass --write to patch)\n' + out.slice(0, 300) + ' ...');
}
process.exit(bad ? 1 : 0);

